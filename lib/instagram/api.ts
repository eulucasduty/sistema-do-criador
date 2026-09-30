import "server-only";
import { lerConfig, lerPerfil, salvarConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";

// Cliente da Instagram API com login do Instagram (graph.instagram.com), pelo app Meta
// do próprio criador. O token da conta é de longa duração (60 dias): fica na configuração
// (nunca vai pra tela) e a rotina renova quando passa de 7 dias.

const VERSAO = process.env.IG_GRAPH_VERSION || "v25.0";
const BASE = `https://graph.instagram.com/${VERSAO}`;

export type ContaInstagram = {
  token?: string;
  ig_user_id?: string;
  username?: string;
  renovado_em?: string;
  expira_em?: string;
  inscrito_em?: string;
  erro?: string | null;
};

export class ErroInstagram extends Error {
  constructor(public status: number, public codigo: number | null, mensagem: string) {
    super(mensagem);
  }
}

// IG_SIMULADO=1: teste local da automação sem mandar nada pro Instagram. As chamadas viram
// log com id falso; "quem segue" vem de IG_SIMULADO_SEGUIDORES (IGSIDs separados por vírgula).
// NUNCA em produção.
const SIMULADO = process.env.IG_SIMULADO === "1";

function simulado<T>(metodo: string, caminho: string, corpo?: unknown): T {
  console.log(`[ig simulado] ${metodo} ${caminho} ${corpo ? JSON.stringify(corpo).slice(0, 200) : ""}`);
  if (caminho.includes("is_user_follow_business")) {
    const igsid = decodeURIComponent(caminho.split("?")[0].split("/").pop() ?? "");
    const seguidores = (process.env.IG_SIMULADO_SEGUIDORES ?? "").split(",").map((s) => s.trim());
    return { id: igsid, username: `sim_${igsid}`, is_user_follow_business: seguidores.includes(igsid) } as T;
  }
  if (caminho.startsWith("/me/media")) return { data: [] } as T;
  return { id: `sim_${Date.now()}`, message_id: `sim_ig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` } as T;
}

export async function contaInstagram(): Promise<ContaInstagram> {
  if (SIMULADO) return { token: "simulado", ig_user_id: "conta_simulada", username: "criador_simulado" };
  const c = await lerConfig<ContaInstagram>("instagram", {});
  if (!c.token && process.env.IG_ACCESS_TOKEN) return { token: process.env.IG_ACCESS_TOKEN };
  return c;
}

export async function instagramConfigurado(): Promise<boolean> {
  return Boolean((await contaInstagram()).token);
}

async function chamar<T>(metodo: "GET" | "POST" | "DELETE", caminho: string, corpo?: unknown, token?: string): Promise<T> {
  if (SIMULADO) return simulado<T>(metodo, caminho, corpo);
  const tk = token ?? (await contaInstagram()).token;
  if (!tk) throw new ErroInstagram(0, null, "Instagram não conectado (falta o token em Conexões)");
  const url = caminho.startsWith("http") ? caminho : BASE + caminho;
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${tk}`, ...(corpo ? { "Content-Type": "application/json" } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) {
    const e = j?.error ?? {};
    throw new ErroInstagram(r.status, e.code ?? null, `${e.code ?? r.status} ${e.message ?? r.statusText}`.slice(0, 300));
  }
  return j as T;
}

// ── conta e token ───────────────────────────────────────────────────

/** Valida um token colado no painel, guarda, e inscreve a conta nos webhooks. */
export async function conectarToken(token: string): Promise<ContaInstagram> {
  const eu = await chamar<{ user_id?: string; id?: string; username: string }>("GET", "/me?fields=user_id,username", undefined, token);
  const conta: ContaInstagram = {
    token,
    ig_user_id: String(eu.user_id ?? eu.id),
    username: eu.username,
    renovado_em: new Date().toISOString(),
    expira_em: new Date(Date.now() + 60 * 86400e3).toISOString(),
    erro: null,
  };
  await salvarConfig("instagram", conta);
  try {
    await inscreverWebhooks();
    conta.inscrito_em = new Date().toISOString();
  } catch (e) {
    conta.erro = `inscrição no webhook: ${(e as Error).message}`;
  }
  await salvarConfig("instagram", conta);
  await sincronizarPerfil().catch((e) => console.warn("[instagram] perfil:", (e as Error).message));
  return conta;
}

/**
 * Traz o seu @, nome e foto do Instagram pro Perfil. A foto do CDN da Meta expira: ela vai
 * pro bucket público "perfil" (o editor e o carrossel usam de lá). Roda ao conectar e 1x/dia.
 */
export async function sincronizarPerfil(): Promise<void> {
  if (SIMULADO) return;
  const eu = await chamar<{ username?: string; name?: string; profile_picture_url?: string }>("GET", "/me?fields=username,name,profile_picture_url");
  const perfil = await lerPerfil();
  let foto = perfil.foto_url;
  if (eu.profile_picture_url) {
    const r = await fetch(eu.profile_picture_url, { signal: AbortSignal.timeout(20_000) });
    if (r.ok) {
      const db = createAdminClient();
      const tipo = (r.headers.get("content-type") ?? "image/jpeg").split(";")[0];
      const up = await db.storage.from("perfil").upload("foto.jpg", Buffer.from(await r.arrayBuffer()), { contentType: tipo, upsert: true });
      if (!up.error) foto = `${db.storage.from("perfil").getPublicUrl("foto.jpg").data.publicUrl}?v=${Date.now()}`;
    }
  }
  await salvarConfig("perfil", {
    ...perfil,
    usuario: eu.username ?? perfil.usuario,
    nome: perfil.nome ?? (eu.name?.trim().split(/\s+/)[0] || null),
    foto_url: foto,
  });
}

/** Liga os webhooks da conta pro app (comentário, DM, clique de botão, reação). */
export async function inscreverWebhooks(): Promise<void> {
  const campos = ["comments", "messages", "messaging_postbacks", "message_reactions", "messaging_seen", "messaging_referral"].join(",");
  await chamar("POST", `/me/subscribed_apps?subscribed_fields=${campos}`);
}

/** Renova o token de longa duração (a Meta só aceita depois de 24 h de vida). */
export async function renovarToken(): Promise<boolean> {
  const c = await contaInstagram();
  if (!c.token) return false;
  const idade = c.renovado_em ? Date.now() - Date.parse(c.renovado_em) : Infinity;
  if (idade < 7 * 86400e3) return false;
  try {
    const r = await chamar<{ access_token: string; expires_in: number }>(
      "GET",
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(c.token)}`,
      undefined,
      c.token,
    );
    await salvarConfig("instagram", {
      ...c,
      token: r.access_token,
      renovado_em: new Date().toISOString(),
      expira_em: new Date(Date.now() + (r.expires_in ?? 60 * 86400) * 1000).toISOString(),
      erro: null,
    });
    return true;
  } catch (e) {
    await salvarConfig("instagram", { ...c, erro: `renovação do token: ${(e as Error).message}` });
    return false;
  }
}

// ── mídias ─────────────────────────────────────────────────────────

export type Midia = {
  id: string;
  caption?: string;
  media_type: string; // VIDEO | IMAGE | CAROUSEL_ALBUM
  media_product_type?: string; // REELS | FEED
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp: string;
  comments_count?: number;
  like_count?: number;
};

export async function midiasRecentes(limite = 30): Promise<Midia[]> {
  const campos = "id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp,comments_count,like_count";
  const r = await chamar<{ data: Midia[] }>("GET", `/me/media?fields=${campos}&limit=${limite}`);
  return r.data ?? [];
}

/** Os últimos reels da própria conta, com o link do mp4 (expira em horas: baixar na hora). */
export async function meusReels(quantidade = 15): Promise<Midia[]> {
  const campos = "id,caption,media_type,media_product_type,permalink,media_url,timestamp,comments_count,like_count";
  const todos: Midia[] = [];
  let caminho: string | undefined = `/me/media?fields=${campos}&limit=50`;
  for (let pagina = 0; pagina < 8 && caminho; pagina++) {
    const r: { data?: Midia[]; paging?: { next?: string } } = await chamar("GET", caminho);
    todos.push(...(r.data ?? []));
    if (todos.filter((m) => m.media_product_type === "REELS").length >= quantidade) break;
    caminho = r.paging?.next;
  }
  return todos
    .filter((m) => m.media_product_type === "REELS" && m.media_url)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, quantidade);
}

// ── comentários e DMs ──────────────────────────────────────────────

/** Resposta pública embaixo do comentário. */
export async function responderComentario(comentarioId: string, texto: string): Promise<void> {
  await chamar("POST", `/${encodeURIComponent(comentarioId)}/replies`, { message: texto });
}

export type RespostaRapida = { titulo: string; payload: string };

function mensagem(texto: string, rapidas?: RespostaRapida[]) {
  return {
    text: texto,
    ...(rapidas?.length
      ? { quick_replies: rapidas.map((q) => ({ content_type: "text", title: q.titulo.slice(0, 20), payload: q.payload })) }
      : {}),
  };
}

/**
 * Resposta PRIVADA ao comentário (a 1ª DM). A Meta deixa uma por comentário, em até 7
 * dias. Tenta com botão; se a Meta recusar botão nesse tipo de envio, manda só o texto.
 */
export async function respostaPrivada(comentarioId: string, texto: string, rapidas?: RespostaRapida[]): Promise<string | null> {
  const enviar = (m: unknown) =>
    chamar<{ message_id?: string }>("POST", "/me/messages", { recipient: { comment_id: comentarioId }, message: m });
  try {
    return (await enviar(mensagem(texto, rapidas))).message_id ?? null;
  } catch (e) {
    if (!rapidas?.length) throw e;
    return (await enviar(mensagem(texto))).message_id ?? null;
  }
}

/** DM pra quem já está numa conversa aberta (24 h desde a última mensagem da pessoa). */
export async function enviarDM(igsid: string, texto: string, rapidas?: RespostaRapida[]): Promise<string | null> {
  const r = await chamar<{ message_id?: string }>("POST", "/me/messages", { recipient: { id: igsid }, message: mensagem(texto, rapidas) });
  return r.message_id ?? null;
}

export type Botao = { titulo: string; url: string };

/**
 * DM com botão de link (o "acessar drive"). Template de botão; se a Meta recusar, cai pro
 * template genérico; se recusar de novo, manda o texto com o link no fim.
 */
export async function enviarDMComBotoes(igsid: string, texto: string, botoes: Botao[]): Promise<string | null> {
  const btns = botoes.slice(0, 3).map((b) => ({ type: "web_url", url: b.url, title: b.titulo.slice(0, 20) }));
  const enviar = (message: unknown) => chamar<{ message_id?: string }>("POST", "/me/messages", { recipient: { id: igsid }, message });
  try {
    return (await enviar({ attachment: { type: "template", payload: { template_type: "button", text: texto.slice(0, 640), buttons: btns } } })).message_id ?? null;
  } catch {
    try {
      return (
        await enviar({ attachment: { type: "template", payload: { template_type: "generic", elements: [{ title: texto.slice(0, 80), buttons: btns }] } } })
      ).message_id ?? null;
    } catch {
      return enviarDM(igsid, `${texto}\n${botoes.map((b) => b.url).join("\n")}`);
    }
  }
}

export type Perfil = { id: string; username?: string; name?: string; is_user_follow_business?: boolean; follower_count?: number };

/** Perfil de quem falou com a conta (só funciona depois que a pessoa mandou mensagem). */
export async function perfilDe(igsid: string): Promise<Perfil | null> {
  try {
    return await chamar<Perfil>("GET", `/${encodeURIComponent(igsid)}?fields=username,name,is_user_follow_business,follower_count`);
  } catch {
    return null;
  }
}

/** "digitando…" na DM (a Meta derruba sozinho depois de uns segundos ou quando a mensagem sai). */
export async function digitandoIG(igsid: string): Promise<void> {
  try {
    await chamar("POST", "/me/messages", { recipient: { id: igsid }, sender_action: "typing_on" });
  } catch {}
}
