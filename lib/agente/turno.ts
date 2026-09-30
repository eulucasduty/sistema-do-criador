import "server-only";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { createAdminClient, type Db } from "@/lib/supabase/admin";
import { lerConfig, lerPerfil, type Oferta, type Persona } from "@/lib/config";
import { criarAlerta, type TipoAlerta } from "@/lib/alertas";
import { urlDoApp } from "@/lib/app";
import { hojeSP, horaSP } from "@/lib/formato";
import { descreverImagem, iaConfigurada, precoDoModelo, transcreverAudio } from "@/lib/ia/openrouter";
import { digitandoIG, instagramConfigurado, perfilDe } from "@/lib/instagram/api";
import { enviarRegistrado } from "@/lib/instagram/enviar";
import { auditar, type Auditoria } from "./auditor";
import { linksPermitidos, montarMensagens, type ContatoModelo, type ContextoInstagram, type Extras, type MsgModelo, type OfertaModelo } from "./contexto";
import { criarFerramentas, novosEfeitos, type Efeitos, type TipoPassagem } from "./ferramentas";
import { emBaloes, tempoDigitando } from "./formato";
import { pediuPraSair, perguntouSeEhIA } from "./gatilhos";
import { criarGrafo, criarModelo, rodarGrafo } from "./grafo";
import { PROMPT_PADRAO } from "./prompt";

// Um turno do agente, do lote de mensagens da pessoa até os balões enviados no direct.
//
// O relógio (lib/relogio.ts) chama `processarConversa` quando vence a espera
// (conversa.responder_apos). A ordem das travas importa: primeiro o que não custa nada
// (pausa, janela de 24 h, horário, limite), depois a mídia (áudio vira texto, imagem vira
// descrição) e só então o modelo.

export type Agente = {
  id: string;
  nome: string;
  ativo: boolean;
  modelo: string;
  temperatura: number | string;
  prompt: string | null;
  limite_mensagens: number;
  espera_segundos: number;
  horario_inicio: string;
  horario_fim: string;
  pausado_ate: string | null;
};

type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Teste local (IG_SIMULADO=1): contato com id e2e_… é sempre de teste e o horário não vale
const SIMULADO = process.env.IG_SIMULADO === "1";

/** 'infinity' (pausa sem data) ou uma data no futuro. */
export function estaPausado(ate: string | null | undefined): boolean {
  if (!ate) return false;
  if (ate === "infinity") return true;
  const t = Date.parse(ate);
  return Number.isFinite(t) && t > Date.now();
}

/** O agente do sistema (tem um só; a migração já cria, desligado). */
export async function carregarAgente(db: Db): Promise<Agente | null> {
  const { data } = await db.from("agente").select("*").order("criado_em").limit(1).maybeSingle();
  return (data as Agente | null) ?? null;
}

/** Perfil de teste (Agente → Perfis de teste): o agente responde mesmo desligado e fora do horário. */
export async function ehDeTeste(contato: { instagram_id?: string | null; instagram_usuario?: string | null }): Promise<boolean> {
  if (SIMULADO && /^e2e_/.test(contato.instagram_id ?? "")) return true;
  const u = (contato.instagram_usuario ?? "").toLowerCase().replace(/^@/, "");
  if (!u) return false;
  const perfis = await lerConfig<string[]>("perfis_teste", []);
  return perfis.map((x) => x.toLowerCase().replace(/^@/, "")).includes(u);
}

/** Próxima abertura do horário do agente (com folga aleatória), ou null se agora está dentro. */
export function foraDoHorario(inicio: string, fim: string): string | null {
  const { h, m } = horaSP();
  const agora = h * 60 + m;
  const [hi, mi] = inicio.split(":").map(Number);
  const [hf, mf] = fim.split(":").map(Number);
  const a = hi * 60 + mi;
  const b = hf * 60 + mf;
  if (a === b) return null; // início igual ao fim = 24 horas
  // Janela que vira a noite (ex.: 08:00 → 02:00)
  if (a < b ? agora >= a && agora < b : agora >= a || agora < b) return null;
  const hoje = hojeSP();
  const dia = agora < a ? hoje : new Date(Date.parse(`${hoje}T12:00:00-03:00`) + 86400e3).toISOString().slice(0, 10);
  const abre = Date.parse(`${dia}T${String(hi).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00-03:00`);
  return new Date(abre + Math.round(Math.random() * 25 * 60_000)).toISOString();
}

/** As ofertas cadastradas, com o link rastreado da pessoa (/r/<código>?ir=oferta-<n>). */
export async function ofertasDoContato(codigo: string | null): Promise<OfertaModelo[]> {
  const ofertas = (await lerConfig<Oferta[]>("ofertas", [])).filter((o) => o.nome?.trim() && o.link?.trim());
  return ofertas.map((o, i) => ({
    nome: o.nome.trim(),
    para_quem: o.para_quem?.trim() || "quem se interessar",
    url: codigo ? `${urlDoApp()}/r/${codigo}?ir=oferta-${i + 1}` : o.link.trim(),
  }));
}

// ── Geração (compartilhada com o simulador do painel) ─────────────────

export type Geracao = {
  baloes: string[];
  efeitos: Efeitos;
  auditoria: Auditoria;
  tentativas: number;
  bloqueado: boolean;
  ferramentas: Array<{ nome: string; args: unknown }>;
  tokensEntrada: number;
  tokensSaida: number;
  custoUsd: number;
  modelo: string;
};

export async function gerarResposta(opcoes: {
  agente: Agente;
  contato: ContatoModelo;
  historico: MsgModelo[];
  lote: MsgModelo[];
  respostasFeitas: number;
  instagram?: ContextoInstagram | null;
  ofertas: OfertaModelo[];
  verificarSeSegue?: () => Promise<boolean | null>;
}): Promise<Geracao> {
  const db = createAdminClient();
  const { agente } = opcoes;
  const { data: conhecimento } = await db.from("conhecimento").select("titulo, conteudo").eq("ativo", true).order("criado_em");
  const persona = await lerConfig<Persona>("persona", {});

  const extras: Extras = {
    perfil: await lerPerfil(),
    persona: persona.guia?.trim() || null,
    ofertas: opcoes.ofertas,
    instagram: opcoes.instagram ?? null,
    respostasFeitas: opcoes.respostasFeitas,
    limiteRespostas: agente.limite_mensagens,
  };
  let mensagens = montarMensagens({
    prompt: agente.prompt?.trim() || PROMPT_PADRAO,
    conhecimento: conhecimento ?? [],
    contato: opcoes.contato,
    historico: opcoes.historico,
    lote: opcoes.lote,
    extras,
  });

  const modelo = await criarModelo({ modelo: agente.modelo, temperatura: Number(agente.temperatura) });
  const permitidos = linksPermitidos(extras);
  let tokensEntrada = 0;
  let tokensSaida = 0;
  const ferramentas: Geracao["ferramentas"] = [];

  for (let tentativa = 1; ; tentativa++) {
    const efeitos = novosEfeitos();
    const saida = await rodarGrafo(
      criarGrafo(modelo, criarFerramentas(efeitos, { ofertas: opcoes.ofertas.map((o) => o.nome), verificarSeSegue: opcoes.verificarSeSegue })),
      mensagens,
    );
    tokensEntrada += saida.tokensEntrada;
    tokensSaida += saida.tokensSaida;
    ferramentas.push(...saida.ferramentas);

    // A rodada da oferta (convite + link) pode ocupar um balão a mais; se o modelo
    // esquecer o link, o código completa: instrução é estatística, código é garantia
    const maxBaloes = efeitos.oferta ? 4 : 3;
    let baloes = emBaloes(saida.texto, maxBaloes);
    if (efeitos.oferta && baloes.length) {
      const link = opcoes.ofertas.find((o) => o.nome === efeitos.oferta?.nome)?.url ?? null;
      baloes = completarComLink(baloes, link, maxBaloes);
    }
    const auditoria = auditar(baloes, {
      linksPermitidos: permitidos,
      maxBaloes,
      permitirRevelarIA: efeitos.passagens.some((p) => p.tipo === "perguntou_se_e_ia"),
      passou: efeitos.passagens.length > 0,
    });

    if (auditoria.ok || tentativa >= 2) {
      const preco = await precoDoModelo(agente.modelo);
      return {
        baloes,
        efeitos,
        auditoria,
        tentativas: tentativa,
        bloqueado: !auditoria.ok,
        ferramentas,
        tokensEntrada,
        tokensSaida,
        custoUsd: preco ? tokensEntrada * preco.entrada + tokensSaida * preco.saida : 0,
        modelo: agente.modelo,
      };
    }
    // Devolve pro agente refazer, dizendo o que barrou
    mensagens = [
      ...mensagens,
      new AIMessage(saida.texto || "(vazio)"),
      new HumanMessage(
        `<revisao_interna>essa resposta foi barrada antes de sair: ${auditoria.motivos.join("; ")}. ` +
          "reescreva do zero sem isso, na mesma voz. não comente a revisão.</revisao_interna>",
      ),
    ];
  }
}

/** Garante o link da oferta no fim da resposta, sem passar de `max` balões. */
function completarComLink(baloes: string[], link: string | null, max: number): string[] {
  if (!link || baloes.join("\n").includes(link)) return baloes;
  let saida = [...baloes, `tá aqui 👇\n${link}`];
  while (saida.length > max && saida.length > 2) saida = [`${saida[0]}\n${saida[1]}`, ...saida.slice(2)];
  return saida;
}

// ── Turno de verdade ─────────────────────────────────────────────────

/** Transcreve áudio e descreve imagem do lote (o link da mídia vem no webhook). */
async function processarMidias(db: Db, lote: Linha[]): Promise<number> {
  let custoUsd = 0;
  for (const m of lote) {
    if ((m.tipo !== "audio" && m.tipo !== "imagem") || m.transcricao || !m.midia_url) continue;
    try {
      const r = await fetch(m.midia_url, { signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(`mídia ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 15 * 1024 * 1024) continue;
      const mime = m.midia_tipo || r.headers.get("content-type") || (m.tipo === "audio" ? "audio/mp4" : "image/jpeg");
      const feito =
        m.tipo === "audio"
          ? await transcreverAudio(buf.toString("base64"), mime)
          : await descreverImagem(`data:${mime.split(";")[0]};base64,${buf.toString("base64")}`, m.conteudo);
      m.transcricao = feito.texto;
      custoUsd += feito.uso.custoUsd;
      await db.from("mensagem").update({ transcricao: feito.texto, midia_tipo: mime }).eq("id", m.id);
    } catch (e) {
      console.warn("[turno] mídia não processada:", (e as Error).message);
    }
  }
  return custoUsd;
}

/** Tira o agente da conversa e avisa você no painel. */
export async function passarProCriador(db: Db, conversa: Linha, contato: Linha, tipo: TipoAlerta, motivo: string): Promise<void> {
  await db.from("contato").update({ agente_pausado_ate: "infinity", agente_pausa_motivo: motivo.slice(0, 300) }).eq("id", contato.id);
  await db
    .from("conversa")
    .update({ status: "com_voce", status_motivo: motivo.slice(0, 300), status_em: new Date().toISOString() })
    .eq("id", conversa.id);
  await criarAlerta({ contatoId: contato.id, tipo, motivo });
}

function paraModelo(m: Linha): MsgModelo {
  return { autor: m.autor, tipo: m.tipo, texto: m.conteudo, transcricao: m.transcricao, em: m.enviada_em };
}

export function contatoParaModelo(c: Linha): ContatoModelo {
  return {
    nome: c.nome ?? null,
    primeiro_nome: c.primeiro_nome ?? null,
    usuario: c.instagram_usuario ?? null,
    tags: c.tags ?? [],
    observacoes: c.observacoes ?? null,
  };
}

/** De qual automação a pessoa veio e o que foi prometido. */
async function contextoDoInstagram(db: Db, contatoId: string): Promise<{ contexto: ContextoInstagram | null; fluxo: Linha | null; automacao: Linha | null }> {
  const { data: f } = await db
    .from("ig_fluxo")
    .select("id, etapa, comentario_texto, automacao:automacao_id (*)")
    .eq("contato_id", contatoId)
    .order("atualizado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!f) return { contexto: null, fluxo: null, automacao: null };
  const automacao = (Array.isArray(f.automacao) ? f.automacao[0] : f.automacao) as Linha | null;
  if (!automacao) return { contexto: null, fluxo: f, automacao: null };
  return {
    fluxo: f,
    automacao,
    contexto: {
      automacao: automacao.nome,
      comentario: f.comentario_texto ?? null,
      material: automacao.contexto ?? null,
      link: automacao.link_entrega ?? null,
      entregue: f.etapa === "entregue" || f.etapa === "com_agente",
      exigeSeguir: Boolean(automacao.exigir_seguir),
    },
  };
}

/**
 * Processa a conversa cuja espera venceu. `pegoEm` = instante em que o relógio pegou a
 * trava: se chegar mensagem nova durante o turno, o webhook empurra o `responder_apos`
 * pra depois disso e o relógio sabe que tem que voltar.
 */
export async function processarConversa(conversaId: string, pegoEm: string): Promise<void> {
  const db = createAdminClient();
  const inicio = Date.now();
  const adiar = (quando: string | null) => db.from("conversa").update({ responder_apos: quando }).eq("id", conversaId);

  const { data: conversa } = await db.from("conversa").select("*").eq("id", conversaId).single();
  if (!conversa) return;
  const { data: contato } = await db.from("contato").select("*").eq("id", conversa.contato_id).single();
  const agente = await carregarAgente(db);
  if (!contato || !agente) return void (await adiar(null));

  // ── travas sem custo ─────────────────────────────────────────────
  if (contato.nao_contatar) return void (await adiar(null));
  if (estaPausado(contato.agente_pausado_ate)) return void (await adiar(null));
  if (conversa.status === "com_voce") {
    // A pausa acabou (ou você devolveu): a conversa volta pro agente
    await db.from("conversa").update({ status: "aberta", status_motivo: null, status_em: new Date().toISOString() }).eq("id", conversaId);
  }
  const deTeste = await ehDeTeste(contato);
  if (!agente.ativo && !deTeste) return void (await adiar(null));
  if (estaPausado(agente.pausado_ate)) {
    return void (await adiar(agente.pausado_ate === "infinity" ? null : agente.pausado_ate));
  }
  if (!(await iaConfigurada()) || !(await instagramConfigurado()) || !contato.instagram_id) return void (await adiar(null));
  if (!conversa.janela_ate || Date.parse(conversa.janela_ate) < Date.now() + 60_000) return void (await adiar(null));
  // Perfil de teste responde a qualquer hora: teste é pra ver na hora
  const proximaAbertura = SIMULADO || deTeste ? null : foraDoHorario(agente.horario_inicio, agente.horario_fim);
  if (proximaAbertura) return void (await adiar(proximaAbertura));
  if (conversa.mensagens_do_agente >= agente.limite_mensagens) {
    await passarProCriador(db, conversa, contato, "precisa_de_voce", `chegou no limite de ${agente.limite_mensagens} respostas do agente, daqui é com você`);
    return void (await adiar(null));
  }

  const { data: recentes } = await db
    .from("mensagem")
    .select("id, autor, direcao, tipo, conteudo, transcricao, midia_url, midia_tipo, externo_id, enviada_em, metadados")
    .eq("conversa_id", conversaId)
    .order("enviada_em", { ascending: false })
    .limit(60);
  const msgs = (recentes ?? []).reverse();
  let corte = -1;
  msgs.forEach((m, i) => {
    if (m.direcao === "saida" && m.autor !== "sistema") corte = i;
  });
  const lote = msgs.slice(corte + 1).filter((m) => m.direcao === "entrada" && m.tipo !== "reacao");
  const historico = msgs.slice(0, corte + 1);
  if (!lote.length) return void (await adiar(null));

  const custoMidia = await processarMidias(db, lote);

  // ── gatilhos determinísticos ─────────────────────────────────────
  const textoDoLote = lote.map((m) => [m.conteudo, m.transcricao].filter(Boolean).join(" ")).join("\n");
  if (lote.some((m) => pediuPraSair(m.conteudo ?? "", m.metadados?.botao?.payload))) {
    await marcarSaida(db, conversa, contato, "pediu pra sair");
    await db.from("agente_turno").insert({
      agente_id: agente.id, conversa_id: conversaId, contato_id: contato.id, entrada: textoDoLote,
      resultado: "encerrou", motivo: "pediu pra sair (gatilho), sem resposta", duracao_ms: Date.now() - inicio,
    });
    return void (await adiar(null));
  }
  // Pergunta sincera se é IA: o modelo responde com a verdade (a ferramenta passa pra você);
  // se ele não chamar a ferramenta, o código passa do mesmo jeito depois do envio
  const perguntouIA = perguntouSeEhIA(textoDoLote);

  const ig = await contextoDoInstagram(db, contato.id);
  const ofertas = await ofertasDoContato(contato.codigo ?? null);

  // ── o modelo ─────────────────────────────────────────────────────
  let g: Geracao;
  try {
    g = await gerarResposta({
      agente,
      contato: contatoParaModelo(contato),
      historico: historico.map(paraModelo),
      lote: lote.map(paraModelo),
      respostasFeitas: conversa.mensagens_do_agente,
      instagram: ig.contexto,
      ofertas,
      verificarSeSegue: async () => (await perfilDe(contato.instagram_id))?.is_user_follow_business ?? null,
    });
  } catch (e) {
    await registrarErro(db, agente, conversa, contato, textoDoLote, e, inicio);
    return;
  }

  // Chegou mensagem nova enquanto o modelo pensava: descarta, o próximo turno pega tudo junto
  const { data: agora } = await db.from("conversa").select("responder_apos").eq("id", conversaId).single();
  if (agora?.responder_apos && Date.parse(agora.responder_apos) > Date.parse(pegoEm)) return;

  const base = {
    agente_id: agente.id,
    conversa_id: conversaId,
    contato_id: contato.id,
    entrada: textoDoLote,
    ferramentas: g.ferramentas,
    auditoria: { ...g.auditoria, tentativas: g.tentativas },
    modelo: g.modelo,
    tokens_entrada: g.tokensEntrada,
    tokens_saida: g.tokensSaida,
  };

  if (g.bloqueado) {
    await passarProCriador(db, conversa, contato, "precisa_de_voce", `o agente não conseguiu responder dentro das regras (${g.auditoria.motivos.join(", ")}), responde você`);
    await db.from("agente_turno").insert({
      ...base, resultado: "bloqueado", motivo: g.auditoria.motivos.join("; "),
      custo_usd: g.custoUsd + custoMidia, duracao_ms: Date.now() - inicio,
    });
    return void (await adiar(null));
  }

  // ── envio ────────────────────────────────────────────────────────
  const enviados: string[] = [];
  try {
    for (const balao of g.baloes) {
      await digitandoIG(contato.instagram_id);
      await dormir(Math.round(tempoDigitando(balao) * 0.6));
      await enviarRegistrado(db, { conversaId, contatoId: contato.id, igsid: contato.instagram_id, texto: balao.slice(0, 1000), metadados: { turno: true } });
      enviados.push(balao);
    }
  } catch (e) {
    await registrarErro(db, agente, conversa, contato, textoDoLote, e, inicio, enviados);
    if (!enviados.length) return;
  }

  // ── efeitos ──────────────────────────────────────────────────────
  const agoraISO = new Date().toISOString();
  await db
    .from("conversa")
    .update({ mensagens_do_agente: conversa.mensagens_do_agente + (enviados.length ? 1 : 0), aguardando_desde: null, ultima_mensagem_em: agoraISO })
    .eq("id", conversaId);
  if (enviados.length) await db.from("contato").update({ ultima_mensagem_em: agoraISO }).eq("id", contato.id);

  // O material foi mandado pelo agente: a automação conta como entregue
  const tags = new Set<string>(contato.tags ?? []);
  if (ig.fluxo && ig.automacao) {
    const link = ig.automacao.link_entrega as string | null;
    const jaEntregue = ig.fluxo.etapa === "entregue" || ig.fluxo.etapa === "com_agente";
    if (!jaEntregue && link && enviados.some((b) => b.includes(link))) {
      await db.from("ig_fluxo").update({ etapa: "entregue", entregue_em: agoraISO }).eq("id", ig.fluxo.id);
      if (ig.automacao.tag) tags.add(ig.automacao.tag);
    } else if (ig.fluxo.etapa === "abertura") {
      await db.from("ig_fluxo").update({ etapa: "com_agente" }).eq("id", ig.fluxo.id);
    }
  }

  let resultado: "respondeu" | "escalou" | "encerrou" = "respondeu";
  const motivos: string[] = [];
  if (g.efeitos.oferta && enviados.length) {
    tags.add("oferta_enviada");
    motivos.push(`oferta ${g.efeitos.oferta.nome}: ${g.efeitos.oferta.resumo}`);
  }
  if (tags.size !== (contato.tags ?? []).length) await db.from("contato").update({ tags: [...tags] }).eq("id", contato.id);

  const passagens = [...g.efeitos.passagens];
  if (perguntouIA && !passagens.some((p) => p.tipo === "perguntou_se_e_ia")) {
    passagens.push({ tipo: "perguntou_se_e_ia", motivo: `perguntou se é IA: “${textoDoLote.replace(/\s+/g, " ").slice(0, 160)}”` });
  }
  const vistos = new Set<TipoPassagem>();
  for (const p of passagens) {
    if (vistos.has(p.tipo)) continue;
    vistos.add(p.tipo);
    motivos.push(`${p.tipo}: ${p.motivo}`);
    await passarProCriador(db, conversa, contato, p.tipo, p.motivo);
    resultado = "escalou";
  }
  if (g.efeitos.sair) {
    await marcarSaida(db, conversa, contato, g.efeitos.sair);
    resultado = "encerrou";
    motivos.push(`pediu pra sair: ${g.efeitos.sair}`);
  } else if (g.efeitos.encerrar && resultado === "respondeu") {
    await db.from("conversa").update({ status: "encerrada", status_motivo: g.efeitos.encerrar.slice(0, 300), status_em: agoraISO }).eq("id", conversaId);
    resultado = "encerrou";
    motivos.push(`encerrou: ${g.efeitos.encerrar}`);
  }

  await db.from("agente_turno").insert({
    ...base,
    resposta: enviados,
    resultado,
    motivo: motivos.join(" · ") || null,
    custo_usd: g.custoUsd + custoMidia,
    duracao_ms: Date.now() - inicio,
  });
}

async function marcarSaida(db: Db, conversa: Linha, contato: Linha, motivo: string) {
  const agora = new Date().toISOString();
  await db.from("contato").update({ nao_contatar: true, nao_contatar_em: agora }).eq("id", contato.id);
  await db
    .from("conversa")
    .update({ status: "encerrada", status_motivo: motivo.slice(0, 300), status_em: agora, responder_apos: null, aguardando_desde: null })
    .eq("id", conversa.id);
  await criarAlerta({ contatoId: contato.id, tipo: "nao_contatar", motivo });
}

async function registrarErro(db: Db, agente: Agente, conversa: Linha, contato: Linha, entrada: string, erro: unknown, inicio: number, enviados: string[] = []) {
  const msg = (erro as Error)?.message ?? String(erro);
  console.error("[turno] erro:", msg);
  await db.from("agente_turno").insert({
    agente_id: agente.id,
    conversa_id: conversa.id,
    contato_id: contato.id,
    entrada,
    resposta: enviados,
    resultado: "erro",
    motivo: msg.slice(0, 500),
    duracao_ms: Date.now() - inicio,
  });
  // Três erros seguidos na mesma conversa: para de tentar e avisa
  const { data: ultimos } = await db.from("agente_turno").select("resultado").eq("conversa_id", conversa.id).order("criado_em", { ascending: false }).limit(3);
  const tresErros = (ultimos ?? []).length === 3 && (ultimos ?? []).every((t) => t.resultado === "erro");
  if (tresErros) {
    await db.from("conversa").update({ responder_apos: null }).eq("id", conversa.id);
    await criarAlerta({ contatoId: contato.id, tipo: "erro", motivo: `o agente falhou 3 vezes seguidas nessa conversa: ${msg.slice(0, 160)}` });
  } else if (!enviados.length) {
    await db.from("conversa").update({ responder_apos: new Date(Date.now() + 2 * 60_000).toISOString() }).eq("id", conversa.id);
  }
}
