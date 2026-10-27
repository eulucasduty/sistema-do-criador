import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarAutomacaoDoPost } from "@/lib/instagram/automacao-post";
import { criarContainerReel, linkDaMidia, publicarContainer, statusDoContainer } from "@/lib/instagram/api";
import { legendaDoReel } from "@/lib/postagem/legenda-carrossel";

// O post do vídeo editado no Instagram (Reel), pelo botão "Postar agora" do editor.
//   pronta → enviando (cria o container com o link assinado do vídeo) → processando (a Meta baixa
//   e processa; o relógio confere a cada 15 s) → publicando → publicada (com o link do post)
// Cada troca de status é uma trava (update condicional): o relógio e o botão nunca publicam duas vezes.
// Esteira de reels (19/10): o reel aprovado tem `publicar_em` e o relógio manda sozinho na hora, com a
// legenda começando por "Comenta PALAVRA…". Quando sai, o material da palavra entra no ar e nasce a
// automação só daquele post.

const BUCKET = "edicao";
const PRAZO_PROCESSAMENTO_MS = 30 * 60_000;

type Postagem = {
  id: string;
  edicao_id: string;
  status: string;
  legenda: string | null;
  compartilhar_feed: boolean;
  capa_s: number | null;
  container_id: string | null;
  enviado_em: string | null;
};

async function marcarErro(id: string, erro: string) {
  await createAdminClient().from("postagem").update({ status: "erro", erro: erro.slice(0, 600), etapa: null }).eq("id", id);
}

/** Cria o container do Reel. Lança se não der (o botão mostra a mensagem). */
export async function enviarPostagem(id: string): Promise<void> {
  const db = createAdminClient();
  const { data: p } = await db.from("postagem").select("*").eq("id", id).single<Postagem>();
  if (!p) throw new Error("post não encontrado");
  if (!p.legenda?.trim()) throw new Error("falta a legenda");
  const { data: ed } = await db.from("edicao").select("status, resultado").eq("id", p.edicao_id).single();
  const caminho = (ed?.resultado as { caminho?: string } | null)?.caminho;
  if (ed?.status !== "pronto" || !caminho) throw new Error("o vídeo ainda não está pronto no editor");

  // Trava: só sai de "pronta" ou "erro" (dois cliques não viram dois posts)
  const { data: pegou } = await db
    .from("postagem")
    .update({ status: "enviando", etapa: "mandando o vídeo pro Instagram", erro: null, container_id: null })
    .eq("id", id)
    .in("status", ["pronta", "erro"])
    .select("id");
  if (!pegou?.length) throw new Error("esse post já está sendo enviado");

  try {
    // A Meta baixa o vídeo por esse link (vale 6 h; o processamento leva de segundos a minutos)
    const { data: link, error } = await db.storage.from(BUCKET).createSignedUrl(caminho, 6 * 3600);
    if (error || !link?.signedUrl) throw new Error(`não consegui o link do vídeo no storage: ${error?.message ?? "sem link"}`);
    const container = await criarContainerReel({
      videoUrl: link.signedUrl,
      legenda: p.legenda.trim(),
      feed: p.compartilhar_feed,
      capaMs: p.capa_s != null ? Number(p.capa_s) * 1000 : null,
    });
    await db
      .from("postagem")
      .update({ status: "processando", container_id: container, enviado_em: new Date().toISOString(), etapa: "o Instagram está processando o vídeo (leva de 30 s a uns minutos)" })
      .eq("id", id);
  } catch (e) {
    await marcarErro(id, `o Instagram recusou o envio: ${(e as Error).message}`);
    throw e;
  }
}

/** Um passo de um post em processamento: confere o container e publica quando estiver pronto. */
export async function avancarPostagem(p: Pick<Postagem, "id" | "container_id" | "enviado_em">): Promise<"publicada" | "esperando" | "erro"> {
  const db = createAdminClient();
  if (!p.container_id) {
    await marcarErro(p.id, "o envio se perdeu (sem container): tente de novo");
    return "erro";
  }
  let st: { status_code?: string; status?: string };
  try {
    st = await statusDoContainer(p.container_id);
  } catch (e) {
    // erro de rede: tenta no próximo passo, até o prazo
    if (p.enviado_em && Date.now() - Date.parse(p.enviado_em) > PRAZO_PROCESSAMENTO_MS) {
      await marcarErro(p.id, `não consegui conferir o processamento: ${(e as Error).message}`);
      return "erro";
    }
    return "esperando";
  }
  const codigo = st.status_code ?? "";
  if (codigo === "ERROR" || codigo === "EXPIRED") {
    await marcarErro(p.id, `o Instagram não aceitou o vídeo (${codigo}${st.status ? `: ${st.status}` : ""})`);
    return "erro";
  }
  if (codigo !== "FINISHED" && codigo !== "PUBLISHED") {
    if (p.enviado_em && Date.now() - Date.parse(p.enviado_em) > PRAZO_PROCESSAMENTO_MS) {
      await marcarErro(p.id, "o Instagram demorou mais de 30 min pra processar o vídeo: tente de novo");
      return "erro";
    }
    return "esperando";
  }

  // Trava da publicação: só um passo publica
  const { data: pegou } = await db.from("postagem").update({ status: "publicando", etapa: "publicando" }).eq("id", p.id).eq("status", "processando").select("id");
  if (!pegou?.length) return "esperando";
  try {
    const midia = await publicarContainer(p.container_id);
    const permalink = await linkDaMidia(midia);
    await db
      .from("postagem")
      .update({ status: "publicada", media_id: midia, permalink, publicado_em: new Date().toISOString(), etapa: null, erro: null })
      .eq("id", p.id);
    // O material da palavra entra no ar e nasce a automação só deste Reel (19/10), se ele tem palavra de CTA
    const { data: pp } = await db.from("postagem").select("palavra").eq("id", p.id).single();
    if (pp?.palavra) {
      await db.from("entrega").update({ publicada: true, publicada_em: new Date().toISOString() }).ilike("palavra", pp.palavra).eq("status", "pronta").eq("publicada", false);
      await criarAutomacaoDoPost(db, { mediaId: midia, palavra: pp.palavra, tipo: "Reel" }).catch((e) => console.error("[automacao-post]", (e as Error).message));
    }
    return "publicada";
  } catch (e) {
    // Sem nova tentativa sozinha: se a Meta publicou e a resposta se perdeu, repetir viraria dois posts
    await marcarErro(p.id, `não deu pra publicar: ${(e as Error).message}. Confira no Instagram antes de tentar de novo.`);
    return "erro";
  }
}

/**
 * Os reels aprovados que chegaram na hora (um por passada). Sem legenda pronta ainda (a estação não
 * escreveu), espera: o card mostra o aviso. Erro no envio fica no post (o card mostra e reagenda).
 */
async function enviarAgendados(): Promise<void> {
  const db = createAdminClient();
  // Aprovado com a estação desligada, o status fica "aguardando_estacao"/"escrevendo" mesmo com a
  // legenda já no texto: a hora chegou e a legenda existe, então sai igual.
  await db
    .from("postagem")
    .update({ status: "pronta", etapa: null })
    .in("status", ["aguardando_estacao", "escrevendo"])
    .not("publicar_em", "is", null)
    .lte("publicar_em", new Date().toISOString())
    .not("legenda", "is", null)
    .neq("legenda", "");
  const { data } = await db
    .from("postagem")
    .select("id, palavra, legenda")
    .eq("status", "pronta")
    .not("publicar_em", "is", null)
    .lte("publicar_em", new Date().toISOString())
    .order("publicar_em")
    .limit(1);
  for (const p of data ?? []) {
    const legenda = legendaDoReel(p.palavra, p.legenda);
    if (!legenda) {
      await marcarErro(p.id, "chegou a hora, mas a legenda está vazia: escreva e reagende");
      continue;
    }
    if (legenda !== (p.legenda ?? "")) await db.from("postagem").update({ legenda }).eq("id", p.id).eq("status", "pronta");
    await enviarPostagem(p.id).catch((e) => console.error("[postagem agendada]", p.id, (e as Error).message));
  }
}

/**
 * Material que ficou pronto DEPOIS do post sair: entra no ar agora (o publicar do post só pega o que
 * já estava pronto). Vale pros reels e pros carrosséis publicados.
 */
async function publicarMateriaisDosPostsNoAr(): Promise<void> {
  const db = createAdminClient();
  const { data: ent } = await db.from("entrega").select("id, palavra").eq("status", "pronta").eq("publicada", false).limit(20);
  if (!ent?.length) return;
  const [{ data: reels }, { data: carrosseis }] = await Promise.all([
    db.from("postagem").select("palavra").eq("status", "publicada").not("palavra", "is", null),
    db.from("carrossel_post").select("palavra").eq("status", "publicada").not("palavra", "is", null),
  ]);
  const noAr = new Set([...(reels ?? []), ...(carrosseis ?? [])].map((r) => String(r.palavra).toLowerCase()));
  for (const e of ent) {
    if (e.palavra && noAr.has(String(e.palavra).toLowerCase()))
      await db.from("entrega").update({ publicada: true, publicada_em: new Date().toISOString() }).eq("id", e.id).eq("publicada", false);
  }
}

/** O passo do relógio: os reels agendados que chegaram na hora e os posts em processamento (a cada 15 s). */
export async function passoDasPostagens(): Promise<void> {
  await enviarAgendados();
  await publicarMateriaisDosPostsNoAr().catch((e) => console.error("[material do post]", (e as Error).message));
  const db = createAdminClient();
  const { data } = await db.from("postagem").select("id, container_id, enviado_em").eq("status", "processando").order("enviado_em").limit(5);
  for (const p of data ?? []) await avancarPostagem(p);
  // "publicando" parado há mais de 10 min (o servidor caiu no meio): avisa pra conferir
  const parado = new Date(Date.now() - 10 * 60_000).toISOString();
  await db
    .from("postagem")
    .update({ status: "erro", etapa: null, erro: "a publicação foi interrompida no meio: confira no Instagram se o post saiu antes de tentar de novo" })
    .eq("status", "publicando")
    .lt("atualizado_em", parado);
}
