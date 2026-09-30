"use server";

import { revalidatePath } from "next/cache";
import { createClient, exigirEquipe } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esquecerConfig, type FollowupAgente, type Oferta } from "@/lib/config";
import { carregarAgente, contatoParaModelo, gerarResposta, ofertasDoContato, type Agente } from "@/lib/agente/turno";
import { pediuPraSair, perguntouSeEhIA } from "@/lib/agente/gatilhos";
import { PROMPT_PADRAO } from "@/lib/agente/prompt";
import { iaConfigurada } from "@/lib/ia/openrouter";
import type { ContextoInstagram, MsgModelo } from "@/lib/agente/contexto";
import type { Estado } from "./form-acao";

// Ações da tela do Agente. Escrita pelo cliente da sessão (a RLS vale); o simulador usa
// a chave secreta e gasta na OpenRouter, então confere a equipe antes (exigirEquipe).

const CAMINHO = "/agente";
const MAX_OFERTAS = 5;

type ChaveDoAgente = "ofertas" | "perfis_teste" | "followup_agente" | "pausa_por_eco_horas";

async function gravarConfig(chave: ChaveDoAgente, valor: unknown): Promise<string | null> {
  const supabase = await createClient();
  const { error } = await supabase.from("configuracao").upsert({ chave, valor }, { onConflict: "chave" });
  esquecerConfig(chave);
  return error ? error.message : null;
}

async function idDoAgente(): Promise<{ id: string; modelo: string; temperatura: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("agente").select("id, modelo, temperatura").order("criado_em").limit(1).maybeSingle();
  return data;
}

const numero = (v: FormDataEntryValue | null) => Number(String(v ?? "").replace(",", "."));
const limitar = (v: number, min: number, max: number, padrao: number) => (Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao);

// ── Liga, desliga e pausa ─────────────────────────────────────────────

export async function alternarAgente(formData: FormData) {
  const agente = await idDoAgente();
  if (!agente) return;
  const supabase = await createClient();
  await supabase.from("agente").update({ ativo: formData.get("ativo") === "sim" }).eq("id", agente.id);
  revalidatePath("/", "layout");
}

export async function pausarGeral(formData: FormData) {
  const opcao = String(formData.get("opcao"));
  let ate: string | null = null;
  if (opcao === "1h") ate = new Date(Date.now() + 3600e3).toISOString();
  else if (opcao === "3h") ate = new Date(Date.now() + 3 * 3600e3).toISOString();
  else if (opcao === "amanha") {
    const amanha = new Date(Date.now() + 86400e3).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    ate = new Date(`${amanha}T09:00:00-03:00`).toISOString();
  } else if (opcao === "sempre") ate = "infinity";
  const agente = await idDoAgente();
  if (!agente) return;
  const supabase = await createClient();
  await supabase.from("agente").update({ pausado_ate: ate }).eq("id", agente.id);
  revalidatePath(CAMINHO);
}

// ── Como ele trabalha ─────────────────────────────────────────────────

export async function salvarConfigAgente(_: Estado, formData: FormData): Promise<Estado> {
  const agente = await idDoAgente();
  if (!agente) return { erro: "o agente não existe no banco" };
  const hora = (k: string, padrao: string) => {
    const v = String(formData.get(k) ?? "");
    return /^\d{2}:\d{2}$/.test(v) ? v : padrao;
  };
  const modelo = String(formData.get("modelo") ?? "").trim();
  if (!/^[\w.-]+\/[\w.:-]+$/.test(modelo)) return { erro: "modelo no formato empresa/modelo (ex.: openai/gpt-6-luna)" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("agente")
    .update({
      modelo,
      temperatura: limitar(numero(formData.get("temperatura")), 0, 2, 0.7),
      limite_mensagens: Math.round(limitar(numero(formData.get("limite_mensagens")), 1, 50, 30)),
      espera_segundos: Math.round(limitar(numero(formData.get("espera_segundos")), 0, 900, 90)),
      horario_inicio: hora("horario_inicio", "08:00"),
      horario_fim: hora("horario_fim", "23:30"),
    })
    .eq("id", agente.id);
  if (error) return { erro: error.message };
  revalidatePath(CAMINHO);
  return { ok: "Salvo." };
}

// ── Prompt e versões ──────────────────────────────────────────────────

/** Salva o prompt e grava a versão (dá pra voltar). Vazio = o padrão do sistema. */
export async function salvarPrompt(prompt: string, nota: string): Promise<{ ok: boolean; erro?: string }> {
  let usuarioId: string;
  try {
    ({ usuarioId } = await exigirEquipe());
  } catch {
    return { ok: false, erro: "sem acesso: entre de novo no painel" };
  }
  const agente = await idDoAgente();
  if (!agente) return { ok: false, erro: "o agente não existe no banco" };
  // Igual ao padrão = vazio: assim ele acompanha as melhorias do padrão
  const texto = prompt.trim() === PROMPT_PADRAO.trim() ? "" : prompt.trim();
  const supabase = await createClient();
  const { error } = await supabase.from("agente").update({ prompt: texto }).eq("id", agente.id);
  if (error) return { ok: false, erro: error.message };
  await supabase.from("agente_versao").insert({
    agente_id: agente.id,
    prompt: texto,
    modelo: agente.modelo,
    temperatura: agente.temperatura,
    criado_por: usuarioId,
    nota: nota.trim().slice(0, 200) || (texto ? null : "voltou pro padrão"),
  });
  revalidatePath(CAMINHO);
  return { ok: true };
}

export async function restaurarVersao(formData: FormData) {
  let usuarioId: string;
  try {
    ({ usuarioId } = await exigirEquipe());
  } catch {
    return;
  }
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("agente_versao")
    .select("agente_id, prompt, modelo, temperatura, criado_em")
    .eq("id", String(formData.get("versao_id")))
    .maybeSingle();
  if (!v) return;
  await supabase.from("agente").update({ prompt: v.prompt }).eq("id", v.agente_id);
  await supabase.from("agente_versao").insert({
    agente_id: v.agente_id,
    prompt: v.prompt,
    modelo: v.modelo,
    temperatura: v.temperatura,
    criado_por: usuarioId,
    nota: `voltou pra versão de ${new Date(v.criado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
  });
  revalidatePath(CAMINHO);
}

// ── Ofertas ───────────────────────────────────────────────────────────

export async function salvarOfertas(_: Estado, formData: FormData): Promise<Estado> {
  const nomes = formData.getAll("oferta_nome").map((v) => String(v).trim().slice(0, 60));
  const links = formData.getAll("oferta_link").map((v) => String(v).trim());
  const paraQuem = formData.getAll("oferta_para_quem").map((v) => String(v).trim().slice(0, 300));
  const ofertas: Oferta[] = [];
  for (let i = 0; i < nomes.length; i++) {
    if (!nomes[i] && !links[i] && !paraQuem[i]) continue;
    if (!nomes[i]) return { erro: `a oferta ${i + 1} está sem nome` };
    if (!/^https:\/\/\S+$/i.test(links[i] ?? "")) return { erro: `o link de “${nomes[i]}” precisa começar com https://` };
    ofertas.push({ nome: nomes[i], link: links[i], para_quem: paraQuem[i] ?? "" });
  }
  if (ofertas.length > MAX_OFERTAS) return { erro: `no máximo ${MAX_OFERTAS} ofertas` };
  const repetido = ofertas.find((o, i) => ofertas.findIndex((x) => x.nome.toLowerCase() === o.nome.toLowerCase()) !== i);
  if (repetido) return { erro: `duas ofertas com o nome “${repetido.nome}”` };
  const erro = await gravarConfig("ofertas", ofertas);
  if (erro) return { erro };
  revalidatePath(CAMINHO);
  return { ok: ofertas.length ? "Salvo." : "Salvo: sem ofertas, ele só ajuda." };
}

// ── Base de conhecimento ──────────────────────────────────────────────

export async function salvarConhecimento(_: Estado, formData: FormData): Promise<Estado> {
  const id = String(formData.get("id") ?? "");
  const dados = {
    titulo: String(formData.get("titulo") ?? "").trim().slice(0, 120),
    conteudo: String(formData.get("conteudo") ?? "").trim().slice(0, 8000),
    ativo: formData.get("ativo") === "on",
  };
  if (!dados.titulo || !dados.conteudo) return { erro: "preencha o título e o conteúdo" };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("conhecimento").update(dados).eq("id", id)
    : await supabase.from("conhecimento").insert(dados);
  if (error) return { erro: error.message };
  revalidatePath(CAMINHO);
  return { ok: id ? "Salvo." : "Adicionado." };
}

export async function apagarConhecimento(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("conhecimento").delete().eq("id", String(formData.get("id")));
  revalidatePath(CAMINHO);
}

// ── Perfis de teste e toques ──────────────────────────────────────────

export async function salvarPerfisTeste(_: Estado, formData: FormData): Promise<Estado> {
  const perfis = String(formData.get("perfis") ?? "")
    .split(/[\n,;\s]+/)
    .map((p) => p.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "").toLowerCase())
    .filter((p) => /^[a-z0-9._]{1,30}$/.test(p));
  const erro = await gravarConfig("perfis_teste", [...new Set(perfis)].slice(0, 20));
  if (erro) return { erro };
  revalidatePath(CAMINHO);
  return { ok: perfis.length ? "Salvo." : "Salvo: sem perfis de teste." };
}

export async function salvarToques(_: Estado, formData: FormData): Promise<Estado> {
  const followup: FollowupAgente = {
    horas: limitar(numero(formData.get("horas")), 1, 23.5, 23),
    antes_da_oferta: String(formData.get("antes_da_oferta") ?? "").trim().slice(0, 300),
    depois_da_oferta: String(formData.get("depois_da_oferta") ?? "").trim().slice(0, 300),
  };
  const eco = Math.round(limitar(numero(formData.get("pausa_por_eco_horas")), 1, 720, 48));
  const erro = (await gravarConfig("followup_agente", followup)) ?? (await gravarConfig("pausa_por_eco_horas", eco));
  if (erro) return { erro };
  revalidatePath(CAMINHO);
  return { ok: "Salvo." };
}

// ── Simulador ─────────────────────────────────────────────────────────

/** `automacao` = mensagem da sequência da automação (não conta como resposta do agente). */
export type MensagemSimulada = { autor: "contato" | "agente"; texto: string; automacao?: boolean };

export type ResultadoSimulado = {
  ok: boolean;
  erro?: string;
  baloes: string[];
  passagens: Array<{ tipo: string; motivo: string }>;
  encerrou: string | null;
  saiu: string | null;
  oferta: { nome: string; resumo: string } | null;
  ferramentas: string[];
  motivos: string[];
  avisos: string[];
  tentativas: number;
  bloqueado: boolean;
  gatilho: string | null;
  custoUsd: number;
  segundos: number;
};

/** Roda o agente de verdade (prompt, base, ofertas, auditor, ferramentas) sem mandar nada pro Instagram. */
export async function simular(opcoes: {
  prompt: string | null; // o texto do editor, mesmo sem salvar (null = o salvo)
  mensagens: MensagemSimulada[];
  contatoId: string | null;
  automacaoId: string | null;
}): Promise<ResultadoSimulado> {
  const inicio = Date.now();
  const segundos = () => Math.round((Date.now() - inicio) / 100) / 10;
  const vazio: ResultadoSimulado = {
    ok: false, baloes: [], passagens: [], encerrou: null, saiu: null, oferta: null, ferramentas: [], motivos: [], avisos: [],
    tentativas: 0, bloqueado: false, gatilho: null, custoUsd: 0, segundos: 0,
  };
  try {
    await exigirEquipe();
  } catch {
    return { ...vazio, erro: "sem acesso: entre de novo no painel" };
  }
  if (!(await iaConfigurada())) return { ...vazio, erro: "falta a chave da OpenRouter (Conexões)" };

  try {
    const db = createAdminClient();
    const salvo = await carregarAgente(db);
    if (!salvo) return { ...vazio, erro: "o agente não existe no banco" };
    const agente: Agente = { ...salvo, prompt: opcoes.prompt ?? salvo.prompt };

    let contato = contatoParaModelo({ tags: [] });
    if (opcoes.contatoId) {
      const { data: c } = await db.from("contato").select("*").eq("id", opcoes.contatoId).maybeSingle();
      if (c) contato = contatoParaModelo(c);
    }

    // O lote é o que a pessoa mandou depois da última fala do agente
    const msgs = opcoes.mensagens.filter((m) => m.texto.trim()).slice(-60);
    let corte = -1;
    msgs.forEach((m, i) => {
      if (m.autor === "agente") corte = i;
    });
    const agora = new Date().toISOString();
    const paraModelo = (m: MensagemSimulada): MsgModelo => ({ autor: m.autor, tipo: "texto", texto: m.texto, em: agora });
    const doLote = msgs.slice(corte + 1);
    if (!doLote.length) return { ...vazio, erro: "escreva uma mensagem como se fosse a pessoa" };
    const textoDoLote = doLote.map((m) => m.texto).join("\n");
    // Cada bloco de balões do agente é uma resposta (a sequência da automação não conta)
    const respostasFeitas = msgs.filter((m, i) => m.autor === "agente" && !m.automacao && !(msgs[i - 1]?.autor === "agente" && !msgs[i - 1]?.automacao)).length;

    const registrar = (linha: Record<string, unknown>) =>
      db.from("agente_turno").insert({ agente_id: agente.id, contato_id: opcoes.contatoId, simulacao: true, entrada: textoDoLote, ...linha });

    // Pediu pra sair: na vida real o agente nem é chamado
    if (doLote.some((m) => pediuPraSair(m.texto))) {
      await registrar({ resultado: "encerrou", motivo: "pediu pra sair (gatilho), sem resposta", duracao_ms: Date.now() - inicio });
      return {
        ...vazio,
        ok: true,
        saiu: "pediu pra sair",
        gatilho: "pediu pra sair: o agente não responde, a pessoa vira “não contatar” e você recebe um aviso",
        segundos: segundos(),
      };
    }

    // Veio de uma automação: o agente só entra depois da entrega
    let instagram: ContextoInstagram | null = null;
    if (opcoes.automacaoId) {
      const { data: au } = await db
        .from("ig_automacao")
        .select("nome, palavras, contexto, link_entrega, exigir_seguir")
        .eq("id", opcoes.automacaoId)
        .maybeSingle();
      if (au) {
        instagram = {
          automacao: au.nome,
          comentario: au.palavras?.[0] ?? null,
          material: au.contexto ?? null,
          link: au.link_entrega ?? null,
          entregue: true,
          exigeSeguir: Boolean(au.exigir_seguir),
        };
      }
    }

    const g = await gerarResposta({
      agente,
      contato,
      historico: msgs.slice(0, corte + 1).map(paraModelo),
      lote: doLote.map(paraModelo),
      respostasFeitas,
      instagram,
      ofertas: await ofertasDoContato("TESTE0"),
      verificarSeSegue: async () => true,
    });

    const passagens = [...g.efeitos.passagens];
    if (perguntouSeEhIA(textoDoLote) && !passagens.some((p) => p.tipo === "perguntou_se_e_ia")) {
      passagens.push({ tipo: "perguntou_se_e_ia", motivo: "perguntou se é IA (o sistema passa pra você mesmo sem a ferramenta)" });
    }
    const resultado = g.bloqueado ? "bloqueado" : passagens.length ? "escalou" : g.efeitos.sair || g.efeitos.encerrar ? "encerrou" : "respondeu";
    await registrar({
      resposta: g.bloqueado ? [] : g.baloes,
      resultado,
      motivo: g.bloqueado ? g.auditoria.motivos.join("; ") : passagens.map((p) => `${p.tipo}: ${p.motivo}`).join(" · ") || null,
      ferramentas: g.ferramentas,
      auditoria: { ...g.auditoria, tentativas: g.tentativas },
      modelo: g.modelo,
      tokens_entrada: g.tokensEntrada,
      tokens_saida: g.tokensSaida,
      custo_usd: g.custoUsd,
      duracao_ms: Date.now() - inicio,
    });

    return {
      ok: true,
      baloes: g.bloqueado ? [] : g.baloes,
      passagens,
      encerrou: g.efeitos.encerrar,
      saiu: g.efeitos.sair,
      oferta: g.efeitos.oferta,
      ferramentas: [...new Set(g.ferramentas.map((f) => f.nome))],
      motivos: g.auditoria.motivos,
      avisos: g.auditoria.avisos,
      tentativas: g.tentativas,
      bloqueado: g.bloqueado,
      gatilho: null,
      custoUsd: g.custoUsd,
      segundos: segundos(),
    };
  } catch (e) {
    return { ...vazio, erro: (e as Error).message?.slice(0, 300) || "falhou", segundos: segundos() };
  }
}
