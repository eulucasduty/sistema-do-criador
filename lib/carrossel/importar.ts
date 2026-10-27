import "server-only";
import { autorDoLink, lerFacebook } from "@/lib/instagram/descoberta";
import { MAX_SLIDES_CARROSSEL } from "./comum";

type Midia = { media_type?: string; media_url?: string; permalink?: string; caption?: string; children?: { data?: Array<{ media_url?: string; media_type?: string }> } };
export async function obterCarrosselPorLink(entrada: string) {
  const link = new URL(entrada);
  const codigo = link.pathname.match(/^\/p\/([A-Za-z0-9_-]+)\/?$/)?.[1];
  if (link.protocol !== "https:" || !["www.instagram.com", "instagram.com"].includes(link.hostname) || !codigo) throw new Error("Use o link https://www.instagram.com/p/… do carrossel.");
  const url = `https://www.instagram.com/p/${codigo}/`;
  const conta = await lerFacebook();
  if (!conta.page_token || !conta.ig_business_id) throw new Error("Conecte o Facebook em Conexões ou envie os prints completos.");
  const autor = await autorDoLink(url).catch(() => null);
  if (!autor || !/^[A-Za-z0-9._]+$/.test(autor)) throw new Error("Não consegui ler o autor desse post. Envie os prints completos.");
  let cursor: string | null = null;
  for (let pagina = 0; pagina < 4; pagina++) {
    const edge = cursor ? `media.after(${cursor}).limit(100)` : "media.limit(100)";
    const api = new URL(`https://graph.facebook.com/v25.0/${conta.ig_business_id}`);
    api.searchParams.set("fields", `business_discovery.username(${autor}){${edge}{media_type,media_url,permalink,caption,children{media_type,media_url}}}`);
    const resposta = await fetch(api, { headers: { Authorization: `Bearer ${conta.page_token}` }, signal: AbortSignal.timeout(25_000), cache: "no-store" });
    const j = await resposta.json();
    if (!resposta.ok || j.error) throw new Error("A conexão da Meta não liberou esse carrossel. Envie os prints completos ou confira Conexões.");
    const midias = (j.business_discovery?.media?.data ?? []) as Midia[];
    const post = midias.find(m => m.permalink?.includes(`/${codigo}/`));
    if (post) {
      const slides = post.children?.data ?? [];
      if (slides.length < 2 || slides.length > MAX_SLIDES_CARROSSEL || slides.some(s => !s.media_url)) throw new Error("A Meta não liberou todos os slides desse carrossel. Suba as fotos e os vídeos em \"Subir carrossel\".");
      // Slide em vídeo vem como MP4: a cópia monta a parte estática + o motion
      return { url, autor, legenda: post.caption ?? null, midias: slides.map(s => ({ url: s.media_url!, video: s.media_type === "VIDEO" })) };
    }
    cursor = j.business_discovery?.media?.paging?.cursors?.after ?? null;
    if (!cursor || !midias.length) break;
  }
  throw new Error("Não encontrei esse post nos posts recentes do autor. Envie os prints completos.");
}
