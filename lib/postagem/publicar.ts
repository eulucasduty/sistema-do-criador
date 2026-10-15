import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarContainerReel, ErroInstagram, instagramConfigurado, linkDaMidia, publicarContainer, statusDoContainer } from "@/lib/instagram/api";

// O post do vídeo editado no Instagram (Reel), pelo botão "Postar agora" do editor.
//   pronta → enviando (cria o container com o link assinado do vídeo) → processando (a Meta baixa
//   e processa: de 30 s a uns minutos) → publicando → publicada (com o link do post)
//
// Nada espera dentro de uma requisição (a Vercel corta função longa): o botão só cria o container.
// Quem acompanha o processamento é a página aberta (um passo a cada poucos segundos) e o relógio
// (lib/relogio.ts, a cada 15 s enquanto bate). Cada troca de status é uma trava (update
// condicional): a página e o relógio nunca publicam duas vezes.

const BUCKET = "edicao";
const PRAZO_PROCESSAMENTO_MS = 30 * 60_000;
export const POSTAGEM_ANDANDO = ["enviando", "processando", "publicando"];

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

/** O erro da Meta em português, com o que fazer quando é falta de permissão ou token vencido. */
export function explicarErroDaMeta(e: unknown): string {
  const msg = (e as Error)?.message ?? String(e);
  if (e instanceof ErroInstagram) {
    if (e.codigo === 10 || e.codigo === 200 || /permission/i.test(msg))
      return "o token do Instagram não tem a permissão de publicar. No app da Meta (Casos de uso → Instagram → Personalizar → Permissões e recursos), adicione instagram_business_content_publish, gere o token de novo e troque em Conexões → Instagram.";
    if (e.codigo === 190) return "o token do Instagram venceu ou foi trocado: gere de novo no app da Meta e troque em Conexões → Instagram.";
    if (e.codigo === 9 || /limit/i.test(msg)) return `a Meta limitou os posts por agora (são até 100 por dia pela API): tente mais tarde. (${msg})`;
  }
  return msg;
}

async function marcarErro(id: string, erro: string) {
  await createAdminClient().from("postagem").update({ status: "erro", erro: erro.slice(0, 600), etapa: null }).eq("id", id);
}

/** Cria o container do Reel. Lança se não der (a página mostra a mensagem). */
export async function enviarPostagem(id: string): Promise<void> {
  const db = createAdminClient();
  const { data: p } = await db.from("postagem").select("*").eq("id", id).single<Postagem>();
  if (!p) throw new Error("post não encontrado");
  if (!p.legenda?.trim()) throw new Error("falta a legenda");
  if (!(await instagramConfigurado())) throw new Error("o Instagram não está conectado (Conexões → Instagram)");
  const { data: ed } = await db.from("edicao").select("status, resultado").eq("id", p.edicao_id).single();
  const caminho = (ed?.resultado as { caminho?: string } | null)?.caminho;
  if (ed?.status !== "pronto" || !caminho) throw new Error("o vídeo ainda não está pronto no editor");

  // Trava: só sai de "pronta" ou "erro" (dois cliques não viram dois posts)
  const { data: pegou } = await db
    .from("postagem")
    .update({ status: "enviando", etapa: "mandando o vídeo pro Instagram", erro: null, container_id: null, enviado_em: new Date().toISOString() })
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
    const msg = `o Instagram recusou o envio: ${explicarErroDaMeta(e)}`;
    await marcarErro(id, msg);
    throw new Error(msg);
  }
}

/** Um passo de um post em processamento: confere o container e publica quando estiver pronto. */
export async function avancarPostagem(p: Pick<Postagem, "id" | "container_id" | "enviado_em">): Promise<"publicada" | "esperando" | "erro"> {
  const db = createAdminClient();
  if (!p.container_id) {
    await marcarErro(p.id, "o envio se perdeu (sem container): tente de novo");
    return "erro";
  }
  const vencido = () => Boolean(p.enviado_em && Date.now() - Date.parse(p.enviado_em) > PRAZO_PROCESSAMENTO_MS);
  let st: { status_code?: string; status?: string };
  try {
    st = await statusDoContainer(p.container_id);
  } catch (e) {
    // erro de rede: tenta no próximo passo, até o prazo
    if (vencido()) {
      await marcarErro(p.id, `não consegui conferir o processamento: ${explicarErroDaMeta(e)}`);
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
    if (vencido()) {
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
    return "publicada";
  } catch (e) {
    // Sem nova tentativa sozinha: se a Meta publicou e a resposta se perdeu, repetir viraria dois posts
    await marcarErro(p.id, `não deu pra publicar: ${explicarErroDaMeta(e)} Confira no Instagram antes de tentar de novo.`);
    return "erro";
  }
}

/** Um passo de um post só (a página aberta chama enquanto ele anda). */
export async function passoDaPostagem(id: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: p } = await db.from("postagem").select("id, status, container_id, enviado_em").eq("id", id).maybeSingle();
  if (!p) return null;
  if (p.status !== "processando") return p.status;
  return avancarPostagem(p);
}

/** O passo do relógio: os posts em processamento e os que pararam no meio. */
export async function passoDasPostagens(): Promise<void> {
  const db = createAdminClient();
  const { data, error } = await db.from("postagem").select("id, container_id, enviado_em").eq("status", "processando").order("enviado_em").limit(5);
  if (error) return; // a migration 003 ainda não rodou
  for (const p of data ?? []) await avancarPostagem(p);
  // "enviando" ou "publicando" parado há mais de 10 min (a função caiu no meio): avisa pra conferir
  const parado = new Date(Date.now() - 10 * 60_000).toISOString();
  await db
    .from("postagem")
    .update({ status: "erro", etapa: null, erro: "o envio foi interrompido no meio: confira no Instagram se o post saiu antes de tentar de novo" })
    .in("status", ["enviando", "publicando"])
    .lt("atualizado_em", parado);
}
