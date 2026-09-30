import "server-only";
import { after } from "next/server";
import { createAdminClient, type Db } from "@/lib/supabase/admin";
import { lerConfig } from "@/lib/config";
import { criarAlerta } from "@/lib/alertas";
import { urlDoApp } from "@/lib/app";
import { ehDeTeste } from "@/lib/agente/turno";
import { contaInstagram, digitandoIG, ErroInstagram, perfilDe, responderComentario } from "./api";
import { enviarRegistrado } from "./enviar";

// Webhook do Instagram (o app Meta do criador) → o que o sistema faz, igual ManyChat:
//   comentário com a palavra → resposta pública sorteada + 1ª DM (resposta privada)
//   resposta / clique        → portão de seguidor (se a automação exige) → entrega picotada
//   depois da entrega        → no modo "agente", o agente de IA conversa (se estiver ligado)
//   o criador digitando no app → o agente sai daquela conversa por um tempo

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export async function receberInstagram(corpo: unknown, opcoes: { verificado: boolean }) {
  const db = createAdminClient();
  const c = corpo as Json;
  if (c?.object !== "instagram") return;
  for (const entrada of c.entry ?? []) {
    const contaId = String(entrada.id ?? "");
    for (const mudanca of entrada.changes ?? []) {
      if (mudanca.field !== "comments" && mudanca.field !== "live_comments") continue;
      const v = mudanca.value ?? {};
      if (!v.id) continue;
      if (!(await registrar(db, `ig_comentario:${v.id}`, "ig_comentario", v))) continue;
      if (opcoes.verificado) await processar(db, `ig_comentario:${v.id}`, () => processarComentario(db, v, contaId));
    }
    for (const m of entrada.messaging ?? []) {
      const tipo = m.message ? "ig_mensagem" : m.postback ? "ig_postback" : m.reaction ? "ig_reacao" : m.read ? "ig_lida" : "ig_outro";
      const id = m.message?.mid ?? m.postback?.mid ?? `${m.sender?.id}:${m.timestamp}:${tipo}`;
      if (!(await registrar(db, `${tipo}:${id}`, tipo, m))) continue;
      if (opcoes.verificado && (tipo === "ig_mensagem" || tipo === "ig_postback")) {
        await processar(db, `${tipo}:${id}`, () => processarMensagem(db, m, contaId));
      }
    }
  }
}

/** Guarda o evento; false = já tinha chegado (a Meta reentrega). */
async function registrar(db: Db, eventoId: string, tipo: string, corpo: unknown): Promise<boolean> {
  const { error } = await db.from("evento_recebido").insert({ evento_id: eventoId, tipo, corpo });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw new Error(error.message);
}

async function processar(db: Db, eventoId: string, fn: () => Promise<void>) {
  try {
    await fn();
    await db.from("evento_recebido").update({ processado_em: new Date().toISOString() }).eq("evento_id", eventoId);
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    console.error("[instagram]", eventoId, msg);
    await db.from("evento_recebido").update({ erro: msg.slice(0, 500) }).eq("evento_id", eventoId);
    if (e instanceof ErroInstagram && (e.codigo === 190 || e.status === 401)) {
      await criarAlerta({ contatoId: null, tipo: "erro", motivo: `O token do Instagram parou de valer: ${msg.slice(0, 120)}. Gere outro em Conexões.` });
    }
  }
}

// ── contato ────────────────────────────────────────────────────────

async function contatoDoInstagram(db: Db, igsid: string, usuario?: string | null) {
  const { data: existente } = await db.from("contato").select("*").eq("instagram_id", igsid).maybeSingle();
  if (existente) {
    if (usuario && existente.instagram_usuario !== usuario) {
      await db.from("contato").update({ instagram_usuario: usuario }).eq("id", existente.id);
      existente.instagram_usuario = usuario;
    }
    return existente;
  }
  const { data: novo, error } = await db
    .from("contato")
    .insert({ instagram_id: igsid, instagram_usuario: usuario ?? null, nome: usuario ? `@${usuario}` : null })
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return (await db.from("contato").select("*").eq("instagram_id", igsid).single()).data;
    throw new Error(`contato: ${error.message}`);
  }
  return novo;
}

async function conversaDoInstagram(db: Db, contatoId: string) {
  const { data: c } = await db.from("conversa").select("id").eq("contato_id", contatoId).maybeSingle();
  if (c) return c.id as string;
  const { data: nova, error } = await db.from("conversa").insert({ contato_id: contatoId }).select("id").single();
  if (error) {
    const { data: de } = await db.from("conversa").select("id").eq("contato_id", contatoId).single();
    return de!.id as string;
  }
  return nova!.id as string;
}

// ── comentário → automação ─────────────────────────────────────────

export function normalizar(t: string): string {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

type Automacao = {
  id: string;
  nome: string;
  modo: "agente" | "botao";
  todas_as_midias: boolean;
  midias: string[];
  palavras: string[];
  respostas_publicas: string[];
  dm_abertura: string;
  botao_abertura: string;
  exigir_seguir: boolean;
  dm_nao_segue: string | null;
  botao_seguir: string | null;
  entrega_mensagens: Array<{ texto?: string; botao_titulo?: string; botao_url?: string }>;
  dm_entrega: string | null;
  link_entrega: string | null;
  tag: string | null;
};

/** Distância de edição com troca de vizinhas ("rpompt" → "prompt" = 1). Para no teto. */
function distancia(a: string, b: string, teto: number): number {
  if (Math.abs(a.length - b.length) > teto) return teto + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * O comentário tem a palavra? Palavra inteira, sem acento nem maiúscula ("VÍDEO" = "video").
 * Tolerâncias (um em cada cinco comentários vem digitado errado):
 *   · plural com "s" ("skills", "sites")
 *   · palavra de 6+ letras com um erro ("promprt", "rpompt", "carrosel"); curta não,
 *     senão "sete" viraria "site"
 *   · comentário curto lido sem os símbolos ("Pro@pt" → "propt", "3 D" → "3d")
 */
export function casaComentario(a: Pick<Automacao, "todas_as_midias" | "midias" | "palavras">, midiaId: string, texto: string): boolean {
  if (!a.todas_as_midias && !a.midias.includes(midiaId)) return false;
  if (!a.palavras.length) return true;
  const limpo = normalizar(texto).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const t = ` ${limpo} `;
  const tokens = limpo.split(" ").filter(Boolean);
  const junto = limpo.replace(/ /g, "");
  if (junto.length && junto.length <= 14) tokens.push(junto);
  return a.palavras.some((p) => {
    const w = normalizar(p).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (!w) return false;
    if (t.includes(` ${w} `)) return true;
    if (w.includes(" ")) return false; // frase: só exata
    return tokens.some((k) => k === w || (w.length >= 3 && k === `${w}s`) || (w.length >= 6 && distancia(k, w, 1) <= 1));
  });
}

const sortear = <T,>(xs: T[]): T | undefined => xs[Math.floor(Math.random() * xs.length)];

/** Troca {nome} e {link}; sem {link} no texto, o link vai no fim. */
function preencher(texto: string, dados: { nome: string; link: string | null }): string {
  let t = texto.replaceAll("{nome}", dados.nome);
  const temLink = t.includes("{link}");
  t = t.replaceAll("{link}", dados.link ?? "");
  if (!temLink && dados.link) t += `\n\n${dados.link}`;
  return t.trim();
}

async function processarComentario(db: Db, v: Json, contaId: string) {
  const conta = await contaInstagram();
  const deQuem = v.from ?? {};
  const igsid = String(deQuem.id ?? "");
  const usuario = deQuem.username ? String(deQuem.username) : null;
  // A própria conta respondendo não dispara nada
  if (!igsid || igsid === contaId || igsid === conta.ig_user_id || (usuario && usuario === conta.username)) return;

  const contato = await contatoDoInstagram(db, igsid, usuario);
  const midiaId = String(v.media?.id ?? "");
  const texto = String(v.text ?? "");
  const { data: comentario } = await db
    .from("ig_comentario")
    .insert({ comentario_id: String(v.id), midia_id: midiaId, contato_id: contato.id, igsid, usuario, texto })
    .select("id")
    .single();

  await aplicarAutomacao(db, { id: comentario!.id, comentarioId: String(v.id), midiaId, texto, usuario, contatoId: contato.id });
}

/**
 * Comentário já gravado → a automação que casar: resposta pública + 1ª DM (resposta
 * privada). Também serve pra responder depois quem ficou de fora (palavra cadastrada
 * depois do comentário): a Meta aceita a resposta privada até 7 dias depois.
 */
export async function aplicarAutomacao(
  db: Db,
  c: { id: string; comentarioId: string; midiaId: string; texto: string; usuario: string | null; contatoId: string },
): Promise<"ignorado" | "respondido" | "erro"> {
  const { midiaId, texto, usuario } = c;
  const { data: ativas } = await db.from("ig_automacao").select("*").eq("ativa", true);
  const candidatas = ((ativas ?? []) as Automacao[])
    .filter((a) => casaComentario(a, midiaId, texto))
    .sort((a, b) => Number(a.todas_as_midias) - Number(b.todas_as_midias)); // a do post específico ganha da geral
  const auto = candidatas[0];
  if (!auto) {
    await db.from("ig_comentario").update({ status: "ignorado" }).eq("id", c.id);
    return "ignorado";
  }

  const nome = usuario ?? "";
  const resposta = sortear(auto.respostas_publicas.filter(Boolean));
  const erros: unknown[] = [];
  if (resposta) {
    try {
      await responderComentario(c.comentarioId, preencher(resposta, { nome, link: null }));
    } catch (e) {
      erros.push(e);
    }
  }

  // DM na primeira vez que a pessoa entra nessa automação. Se ela comentar de novo sem nunca
  // ter respondido a 1ª DM, a DM de abertura vai de novo pelo comentário novo (a Meta aceita
  // uma resposta privada por comentário). Comentário repetido em menos de 10 min não gera outra.
  const { data: fluxo } = await db.from("ig_fluxo").select("id, etapa").eq("contato_id", c.contatoId).eq("automacao_id", auto.id).maybeSingle();
  let reenviar = false;
  if (fluxo?.etapa === "abertura") {
    const { data: ultima } = await db
      .from("mensagem")
      .select("enviada_em")
      .eq("contato_id", c.contatoId)
      .contains("metadados", { abertura: true })
      .order("enviada_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    reenviar = !ultima || Date.now() - Date.parse(ultima.enviada_em) > 10 * 60_000;
  }
  if (!fluxo || reenviar) {
    try {
      const conversaId = await conversaDoInstagram(db, c.contatoId);
      await enviarRegistrado(db, {
        conversaId,
        contatoId: c.contatoId,
        comentarioId: c.comentarioId,
        texto: preencher(auto.dm_abertura, { nome, link: null }),
        metadados: { automacao: auto.id, abertura: true, ...(reenviar ? { reenvio: true } : {}) },
        // No modo agente a pessoa responde com texto; no modo botão vai o botão
        rapidas: auto.modo === "botao" ? [{ titulo: auto.botao_abertura || "quero", payload: `AUTO:${auto.id}` }] : undefined,
      });
      if (fluxo) {
        await db.from("ig_fluxo").update({ comentario_id: c.comentarioId, comentario_texto: texto.slice(0, 300) }).eq("id", fluxo.id);
      } else {
        await db.from("ig_fluxo").insert({ contato_id: c.contatoId, automacao_id: auto.id, etapa: "abertura", comentario_id: c.comentarioId, comentario_texto: texto.slice(0, 300) });
      }
    } catch (e) {
      erros.push(e);
    }
  }
  await db
    .from("ig_comentario")
    .update({
      automacao_id: auto.id,
      resposta_publica: resposta ?? null,
      status: erros.length ? "erro" : "respondido",
      erro: erros.length ? erros.map((e) => (e as Error).message).join(" · ").slice(0, 500) : null,
    })
    .eq("id", c.id);
  const tokenCaiu = erros.find((e) => e instanceof ErroInstagram && (e.codigo === 190 || e.status === 401));
  if (tokenCaiu) throw tokenCaiu;
  return erros.length ? "erro" : "respondido";
}

// ── DM ─────────────────────────────────────────────────────────────

const TIPO_ANEXO: Record<string, string> = {
  image: "imagem",
  video: "video",
  audio: "audio",
  file: "documento",
  ig_reel: "video",
  reel: "video",
  share: "outro",
  story_mention: "outro",
};

async function processarMensagem(db: Db, m: Json, contaId: string) {
  const conta = await contaInstagram();
  const eco = Boolean(m.message?.is_echo);
  const igsid = String(eco ? m.recipient?.id : m.sender?.id);
  if (!igsid || igsid === contaId || igsid === conta.ig_user_id) return;

  let contato = await contatoDoInstagram(db, igsid);
  if (!contato.instagram_usuario && !eco) {
    const p = await perfilDe(igsid);
    if (p?.username) contato = await contatoDoInstagram(db, igsid, p.username);
  }

  const conversaId = await conversaDoInstagram(db, contato.id);
  const agora = new Date().toISOString();
  const quando = m.timestamp ? new Date(Number(m.timestamp)).toISOString() : agora;
  const anexo = (m.message?.attachments ?? [])[0] as Json | undefined;
  const payload: string | null = m.message?.quick_reply?.payload ?? m.postback?.payload ?? null;
  const texto: string | null = m.message?.text ?? m.postback?.title ?? null;
  if (eco) return void (await tratarEco(db, contato, conversaId, m, quando));

  await db.from("mensagem").upsert(
    {
      conversa_id: conversaId,
      contato_id: contato.id,
      direcao: "entrada",
      autor: "contato",
      tipo: payload ? "botao" : anexo ? (TIPO_ANEXO[anexo.type] ?? "outro") : "texto",
      conteudo: texto,
      midia_url: anexo?.payload?.url ?? null,
      externo_id: m.message?.mid ?? m.postback?.mid ?? null,
      status: "recebida",
      metadados: { payload, anexo: anexo?.type ?? null },
      enviada_em: quando,
    },
    { onConflict: "externo_id", ignoreDuplicates: true },
  );
  await db.from("conversa").update({ janela_ate: new Date(Date.parse(quando) + 24 * 3600e3).toISOString(), ultima_mensagem_em: agora }).eq("id", conversaId);
  await db.from("contato").update({ ultima_mensagem_em: agora }).eq("id", contato.id);

  // De qual automação ela veio: o botão diz (AUTO:<id>); senão, o fluxo mais recente dela
  const doBotao = payload?.startsWith("AUTO:") ? payload.slice(5) : null;
  let consulta = db.from("ig_fluxo").select("id, etapa, atualizado_em, automacao:automacao_id (*)").eq("contato_id", contato.id);
  if (doBotao) consulta = consulta.eq("automacao_id", doBotao);
  const { data: fluxo } = await consulta.order("atualizado_em", { ascending: false }).limit(1).maybeSingle();
  const a = (Array.isArray(fluxo?.automacao) ? fluxo?.automacao[0] : fluxo?.automacao) as Automacao | null | undefined;
  if (!fluxo || !a) return; // DM solta, fora de automação: fica pra você responder

  // 1ª resposta ou clique no "Já segui": a sequência automática (portão → entrega), sem agente.
  // Roda depois de responder a Meta (são várias mensagens com "digitando…" no meio).
  if (fluxo.etapa === "abertura" || fluxo.etapa === "aguardando_seguir") {
    after(() => avancarAutomacao(db, contato, fluxo, a, Boolean(doBotao)).catch((e) => console.error("[instagram] sequência da automação:", (e as Error).message)));
    return;
  }

  // Material entregue: no modo agente (e com o agente ligado), daqui pra frente quem conversa é ele
  if (a.modo === "agente") {
    await agendarAgente(db, conversaId, agora, contato);
    if (fluxo.etapa === "entregue") await db.from("ig_fluxo").update({ etapa: "com_agente" }).eq("id", fluxo.id);
  }
}

/** Agenda o turno do agente (debounce: cada mensagem nova empurra a espera). Desligado = só os perfis de teste. */
async function agendarAgente(db: Db, conversaId: string, agora: string, contato: Json) {
  const { data: agente } = await db.from("agente").select("ativo, espera_segundos").order("criado_em").limit(1).maybeSingle();
  if (!agente) return;
  if (!agente.ativo && !(await ehDeTeste(contato))) return;
  const espera = (agente.espera_segundos ?? 40) + Math.round(Math.random() * 15);
  const { data: conv } = await db.from("conversa").select("status, aguardando_desde").eq("id", conversaId).single();
  await db
    .from("conversa")
    .update({
      responder_apos: new Date(Date.now() + espera * 1000).toISOString(),
      aguardando_desde: conv?.aguardando_desde ?? agora,
      ...(conv?.status === "encerrada" ? { status: "aberta", status_motivo: null, status_em: agora } : {}),
    })
    .eq("id", conversaId);
}

const PORTAO_PADRAO = "Pra te enviar o material preciso que você esteja me seguindo! Me segue e toca no botão aqui embaixo 👇";
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Troca {nome} e {link}, sem acrescentar nada no fim (a sequência é exata). */
function substituir(texto: string, dados: { nome: string; link: string | null }): string {
  return texto.replaceAll("{nome}", dados.nome).replaceAll("{link}", dados.link ?? "").trim();
}

/**
 * A sequência igual ManyChat, antes do agente:
 *   portão de seguidor — se não segue, manda o portão com o botão "Já segui ✅"; enquanto não
 *   seguir de fato, a mesma mensagem volta a cada clique (ou resposta)
 *   entrega — as mensagens picotadas, na ordem, com "digitando…" no meio
 * Quem não dá pra conferir (a Meta não respondeu) passa: melhor entregar que travar o lead.
 */
async function avancarAutomacao(db: Db, contato: Json, fluxo: Json, a: Automacao, doBotao: boolean) {
  const igsid = contato.instagram_id as string;
  const conversaId = await conversaDoInstagram(db, contato.id);
  const nome = contato.instagram_usuario ?? "";

  if (a.exigir_seguir) {
    const segue = (await perfilDe(igsid))?.is_user_follow_business;
    if (segue === false) {
      // Duas mensagens seguidas da pessoa não viram dois portões (o clique no botão sempre vale)
      if (fluxo.etapa === "aguardando_seguir" && !doBotao && Date.now() - Date.parse(fluxo.atualizado_em) < 15_000) return;
      await enviarRegistrado(db, {
        conversaId,
        contatoId: contato.id,
        igsid,
        texto: substituir(a.dm_nao_segue || PORTAO_PADRAO, { nome, link: null }),
        rapidas: [{ titulo: a.botao_seguir || "Já segui ✅", payload: `AUTO:${a.id}` }],
        metadados: { automacao: a.id, portao: true },
      });
      await db.from("ig_fluxo").update({ etapa: "aguardando_seguir" }).eq("id", fluxo.id);
      return;
    }
  }

  // Pega a vez: só um evento entrega, mesmo se a pessoa mandar duas mensagens juntas
  const { data: pegou } = await db
    .from("ig_fluxo")
    .update({ etapa: "entregue", entregue_em: new Date().toISOString() })
    .eq("id", fluxo.id)
    .in("etapa", ["abertura", "aguardando_seguir"])
    .select("id");
  if (!pegou?.length) return;

  const sequencia = (a.entrega_mensagens ?? []).filter((m) => (m.texto ?? "").trim() || m.botao_url);
  const mensagens = sequencia.length ? sequencia : [{ texto: a.dm_entrega || "tá aqui 👇 {link}" }];
  const app = urlDoApp();
  for (const [i, m] of mensagens.entries()) {
    const texto = substituir(m.texto ?? "", { nome, link: a.link_entrega }) || (m.botao_titulo ?? "👇");
    await digitandoIG(igsid);
    await dormir(Math.min(900 + texto.length * 20, 3500));
    await enviarRegistrado(db, {
      conversaId,
      contatoId: contato.id,
      igsid,
      texto,
      // O link do botão passa pelo /r pra contar o clique
      botoes: m.botao_url ? [{ titulo: m.botao_titulo || "abrir", url: `${app}/r/${contato.codigo}?a=${a.id}&ir=${i}` }] : undefined,
      metadados: { automacao: a.id, entrega: i },
    });
  }

  if (a.tag) {
    const tags = new Set<string>(contato.tags ?? []);
    tags.add(a.tag);
    await db.from("contato").update({ tags: [...tags] }).eq("id", contato.id);
  }
}

/**
 * Eco = mensagem que a PRÓPRIA conta mandou. O que o sistema mandou já está gravado
 * (lib/instagram/enviar.ts grava antes de enviar): reconhece pelo id, ou pelo texto nos
 * últimos minutos (o eco pode chegar antes da resposta da API). O que sobrar foi você
 * digitando no app → entra na conversa e o agente sai dela por `pausa_por_eco_horas`.
 */
async function tratarEco(db: Db, contato: Json, conversaId: string, m: Json, quando: string) {
  const mid: string | null = m.message?.mid ?? null;
  const texto: string = m.message?.text ?? "";
  const ehNosso = async () => {
    if (mid) {
      const { data } = await db.from("mensagem").select("id").eq("externo_id", mid).maybeSingle();
      if (data) return true;
    }
    if (!texto) return false;
    const { data: recente } = await db
      .from("mensagem")
      .select("id, externo_id")
      .eq("conversa_id", conversaId)
      .eq("direcao", "saida")
      .in("autor", ["agente", "sistema"])
      .eq("conteudo", texto)
      .gte("enviada_em", new Date(Date.now() - 5 * 60_000).toISOString())
      .order("enviada_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!recente) return false;
    if (mid && !recente.externo_id) await db.from("mensagem").update({ externo_id: mid }).eq("id", recente.id);
    return true;
  };
  if (await ehNosso()) return;
  if ((m.message?.attachments ?? []).some((x: Json) => x.type === "template")) return;
  // O eco às vezes chega antes da API responder: dá um respiro e confere de novo
  await dormir(2500);
  if (await ehNosso()) return;

  const anexo = (m.message?.attachments ?? [])[0] as Json | undefined;
  await db.from("mensagem").upsert(
    {
      conversa_id: conversaId,
      contato_id: contato.id,
      direcao: "saida",
      autor: "criador",
      tipo: anexo ? (TIPO_ANEXO[anexo.type] ?? "outro") : "texto",
      conteudo: texto || null,
      midia_url: anexo?.payload?.url ?? null,
      externo_id: mid,
      status: "enviada",
      metadados: { eco: true },
      enviada_em: quando,
    },
    { onConflict: "externo_id", ignoreDuplicates: true },
  );
  const horas = await lerConfig<number>("pausa_por_eco_horas", 48);
  const agora = new Date().toISOString();
  await db
    .from("contato")
    .update({ agente_pausado_ate: new Date(Date.now() + horas * 3600e3).toISOString(), agente_pausa_motivo: "você respondeu pelo Instagram" })
    .eq("id", contato.id);
  await db
    .from("conversa")
    .update({ status: "com_voce", status_motivo: "você respondeu pelo Instagram", status_em: agora, responder_apos: null, aguardando_desde: null })
    .eq("id", conversaId);
}
