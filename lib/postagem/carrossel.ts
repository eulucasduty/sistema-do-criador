import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { criarAutomacaoDoPost } from "@/lib/instagram/automacao-post";
import { criarContainerCarrossel, criarItemCarrossel, linkDaMidia, publicarContainer, statusDoContainer } from "@/lib/instagram/api";

// A agenda dos carrosséis (pedido do criador, 18/10): 6 por dia, de 2 em 2 h a partir das 6h.
//   agendado (chegou a hora) → enviando (um container por slide + o do carrossel) → processando
//   (o relógio confere) → publicando → publicada. Quando sai: o carrossel vai pra "Postados" e o
//   material da palavra é publicado (quem comentar já recebe).
// Cada troca de status é uma trava (update condicional): dois passos nunca publicam duas vezes.

const BUCKET = "esteira";
const PRAZO_PROCESSAMENTO_MS = 30 * 60_000;

type Post = { id: string; referencia_id: string; palavra: string | null; legenda: string; imagens: string[]; filhos: string[] | null; container_id: string | null; enviado_em: string | null };
const ehVideo = (caminho: string) => /\.mp4$/i.test(caminho);

async function marcarErro(id: string, erro: string) {
  await createAdminClient().from("carrossel_post").update({ status: "erro", erro: erro.slice(0, 600), etapa: null }).eq("id", id);
}

/** Manda os slides pro Instagram (um container por slide). Erro fica no post, não lança. */
async function enviar(p: Post): Promise<void> {
  const db = createAdminClient();
  const { data: pegou } = await db
    .from("carrossel_post")
    .update({ status: "enviando", etapa: "mandando os slides pro Instagram", erro: null, filhos: null, container_id: null })
    .eq("id", p.id)
    .eq("status", "agendado")
    .select("id");
  if (!pegou?.length) return;
  try {
    const { data: links, error } = await db.storage.from(BUCKET).createSignedUrls(p.imagens, 6 * 3600);
    if (error || !links?.length || links.some((l) => !l.signedUrl)) throw new Error(`não consegui os links dos slides: ${error?.message ?? "algum slide sumiu do storage"}`);
    const filhos: string[] = [];
    for (let i = 0; i < links.length; i++) filhos.push(await criarItemCarrossel(links[i].signedUrl!, ehVideo(p.imagens[i])));
    await db
      .from("carrossel_post")
      .update({ status: "processando", filhos, enviado_em: new Date().toISOString(), etapa: "o Instagram está processando os slides" })
      .eq("id", p.id);
  } catch (e) {
    await marcarErro(p.id, `o Instagram recusou o envio: ${(e as Error).message}`);
  }
}

/** Fase 1: espera os slides (vídeo demora) e cria o container do carrossel. Fase 2: espera ele e publica. */
async function avancar(p: Post): Promise<void> {
  const db = createAdminClient();
  const vencido = p.enviado_em != null && Date.now() - Date.parse(p.enviado_em) > PRAZO_PROCESSAMENTO_MS;
  if (!p.container_id) {
    if (!p.filhos?.length) return marcarErro(p.id, "o envio se perdeu (sem os slides): reagende");
    try {
      for (const f of p.filhos) {
        const s = await statusDoContainer(f);
        if (s.status_code === "ERROR" || s.status_code === "EXPIRED") return marcarErro(p.id, `o Instagram não aceitou um slide (${s.status_code}${s.status ? `: ${s.status}` : ""})`);
        if (s.status_code && s.status_code !== "FINISHED") {
          if (vencido) await marcarErro(p.id, "o Instagram demorou mais de 30 min pra processar os slides: reagende");
          return;
        }
      }
      const container = await criarContainerCarrossel(p.filhos, p.legenda);
      await db.from("carrossel_post").update({ container_id: container, etapa: "o Instagram está processando o carrossel" }).eq("id", p.id).eq("status", "processando");
    } catch (e) {
      if (vencido) await marcarErro(p.id, `não consegui montar o carrossel: ${(e as Error).message}`);
    }
    return;
  }
  let st: { status_code?: string; status?: string };
  try {
    st = await statusDoContainer(p.container_id);
  } catch (e) {
    if (vencido) await marcarErro(p.id, `não consegui conferir o processamento: ${(e as Error).message}`);
    return;
  }
  const codigo = st.status_code ?? "";
  if (codigo === "ERROR" || codigo === "EXPIRED") return marcarErro(p.id, `o Instagram não aceitou o carrossel (${codigo}${st.status ? `: ${st.status}` : ""})`);
  if (codigo !== "FINISHED" && codigo !== "PUBLISHED") {
    if (vencido) await marcarErro(p.id, "o Instagram demorou mais de 30 min pra processar: reagende");
    return;
  }
  const { data: pegou } = await db.from("carrossel_post").update({ status: "publicando", etapa: "publicando" }).eq("id", p.id).eq("status", "processando").select("id");
  if (!pegou?.length) return;
  try {
    const midia = await publicarContainer(p.container_id);
    const permalink = await linkDaMidia(midia);
    const agora = new Date().toISOString();
    await db.from("carrossel_post").update({ status: "publicada", media_id: midia, permalink, publicado_em: agora, etapa: null, erro: null }).eq("id", p.id);
    // O carrossel vai pra coluna "Postados" e o material da palavra entra no ar
    await db.from("referencia").update({ etapa: "postado" }).eq("id", p.referencia_id);
    if (p.palavra) {
      await db.from("entrega").update({ publicada: true, publicada_em: agora }).ilike("palavra", p.palavra).eq("status", "pronta").eq("publicada", false);
      // A automação só deste post (19/10): a palavra dele, só nesta mídia
      const { data: ref } = await db.from("referencia").select("numero").eq("id", p.referencia_id).maybeSingle();
      await criarAutomacaoDoPost(db, { postId: p.id, mediaId: midia, palavra: p.palavra, numero: ref?.numero });
    }
  } catch (e) {
    // Sem nova tentativa sozinha: se a Meta publicou e a resposta se perdeu, repetir viraria dois posts
    await marcarErro(p.id, `não deu pra publicar: ${(e as Error).message}. Confira no Instagram antes de reagendar.`);
  }
}

/** O passo do relógio (a cada 30 s): manda o que chegou a hora (1 por vez) e confere os que estão processando. */
export async function passoDosCarrosseis(): Promise<void> {
  const db = createAdminClient();
  const campos = "id, referencia_id, palavra, legenda, imagens, filhos, container_id, enviado_em";
  const { data: emAndamento } = await db.from("carrossel_post").select(campos).eq("status", "processando").order("enviado_em").limit(5);
  for (const p of (emAndamento ?? []) as Post[]) await avancar(p);
  const { data: daVez } = await db.from("carrossel_post").select(campos).eq("status", "agendado").lte("publicar_em", new Date().toISOString()).order("publicar_em").limit(1);
  for (const p of (daVez ?? []) as Post[]) await enviar(p);
  // "enviando"/"publicando" parado há mais de 10 min (o servidor caiu no meio): avisa pra conferir
  const parado = new Date(Date.now() - 10 * 60_000).toISOString();
  await db
    .from("carrossel_post")
    .update({ status: "erro", etapa: null, erro: "a publicação foi interrompida no meio: confira no Instagram se o post saiu antes de reagendar" })
    .in("status", ["enviando", "publicando"])
    .lt("atualizado_em", parado);
}
