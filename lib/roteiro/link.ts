import "server-only";
import { acharPostPublico } from "@/lib/instagram/descoberta";

// Vídeo de referência por LINK do Instagram: a mesma busca da Esteira (Business Discovery, a API
// oficial da Meta; precisa do Facebook conectado e o reel tem que ser de conta de criador ou
// empresa, sem música licenciada). Não deu: suba o arquivo (o caminho garantido).
// Nada vai pro Storage: o vídeo de terceiro só passa pela memória até virar transcrição.

export const MAX_BYTES = 45 * 1024 * 1024;

const LINK_INSTAGRAM = /^https?:\/\/(www\.)?instagram\.com\/([A-Za-z0-9._]+\/)?(reel|reels|p)\/[\w-]+/i;

/** Link aceito: um reel ou post do Instagram. */
export const linkValido = (url: string) => LINK_INSTAGRAM.test(url.trim());

/** Baixa o vídeo do reel. Erro com o motivo em português (o painel mostra). */
export async function baixarDoLink(url: string): Promise<{ buf: Buffer; mime: string; fonte: string; legenda: string | null }> {
  if (!linkValido(url)) throw new Error("link não aceito: use o link de um reel do Instagram (instagram.com/reel/…)");
  const { post, motivo } = await acharPostPublico(url.trim().split("?")[0]).catch((e) => ({ post: null, motivo: (e as Error).message }));
  if (!post) throw new Error(`não consegui pegar o vídeo pelo link: ${motivo ?? "a Meta não achou o post"}. Baixe o vídeo e suba o arquivo.`);
  if (post.tipo !== "VIDEO" || !post.media_url) throw new Error(`${motivo ?? "esse post não é um reel com vídeo"}. Baixe o vídeo e suba o arquivo.`);
  const r = await fetch(post.media_url, { signal: AbortSignal.timeout(90_000) });
  if (!r.ok) throw new Error(`não consegui baixar o vídeo do reel (${r.status}). Baixe o vídeo e suba o arquivo.`);
  const tamanho = Number(r.headers.get("content-length") ?? 0);
  if (tamanho > MAX_BYTES) throw new Error(`o vídeo do reel passa de 45 MB (${Math.round(tamanho / 1e6)} MB). Baixe e suba o arquivo.`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`o vídeo do reel passa de 45 MB (${Math.round(buf.length / 1e6)} MB). Baixe e suba o arquivo.`);
  const mime = (r.headers.get("content-type") ?? "video/mp4").split(";")[0].trim() || "video/mp4";
  return { buf, mime, fonte: `instagram (@${post.autor}, API da Meta)`, legenda: post.legenda };
}
