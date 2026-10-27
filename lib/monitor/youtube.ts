import "server-only";

// YouTube do monitor de criadores (18/10): o feed RSS público do canal, sem chave de API.
//   · o canal sai do @handle pela página dele (link canônico /channel/UC…);
//   · o feed traz os 15 vídeos mais recentes, Shorts e longos misturados;
//   · Short de verdade: /shorts/<id> responde 200; vídeo longo redireciona (303) pro /watch.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";
const CABECALHO = { "User-Agent": UA, Cookie: "CONSENT=YES+1", "Accept-Language": "pt-BR,pt;q=0.9" };
const CANAL = /^UC[A-Za-z0-9_-]{22}$/;

export type VideoYoutube = {
  id: string;
  titulo: string;
  link: string;
  descricao: string | null;
  views: number | null;
  publicado_em: string;
};

const desfazer = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Tira o @handle ou o id do canal do que o criador colou (link, @handle ou UC…). */
export function entradaDoCanal(texto: string): { canal_id: string | null; handle: string | null } {
  const t = texto.trim();
  if (CANAL.test(t)) return { canal_id: t, handle: null };
  const id = t.match(/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/)?.[1];
  if (id) return { canal_id: id, handle: null };
  const handle = t.match(/youtube\.com\/@([A-Za-z0-9._-]+)/)?.[1] ?? t.match(/^@?([A-Za-z0-9._-]{3,30})$/)?.[1] ?? null;
  return { canal_id: null, handle };
}

async function feed(canalId: string): Promise<{ nome: string | null; videos: VideoYoutube[] }> {
  // O feed oscila: o mesmo canal responde 404 em metade das vezes (medido em 19/10). Tenta até 8 vezes.
  let r: Response | null = null;
  for (let tentativa = 1; tentativa <= 8; tentativa++) {
    r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canalId}`, { headers: CABECALHO, signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (r.ok || (r.status !== 404 && r.status < 500)) break;
    await new Promise((ok) => setTimeout(ok, 800 * tentativa));
  }
  if (!r?.ok) throw new Error(`o feed do YouTube não respondeu (${r?.status}): confere de novo daqui a pouco`);
  const xml = await r.text();
  const nome = xml.match(/<feed[^]*?<title>([^<]*)<\/title>/)?.[1] ?? null;
  const videos = [...xml.matchAll(/<entry>([^]*?)<\/entry>/g)].map(([, e]) => {
    const id = e.match(/<yt:videoId>([^<]+)/)?.[1] ?? "";
    const views = e.match(/<media:statistics views="(\d+)"/)?.[1];
    return {
      id,
      titulo: desfazer(e.match(/<title>([^<]*)<\/title>/)?.[1] ?? ""),
      link: `https://www.youtube.com/shorts/${id}`,
      descricao: desfazer(e.match(/<media:description>([^]*?)<\/media:description>/)?.[1] ?? "").trim() || null,
      views: views ? Number(views) : null,
      publicado_em: e.match(/<published>([^<]+)/)?.[1] ?? "",
    };
  });
  return { nome: nome ? desfazer(nome) : null, videos: videos.filter((v) => v.id && v.publicado_em) };
}

/** Acha o canal (id e nome) a partir do @handle, do link ou do id. */
export async function resolverCanal(texto: string): Promise<{ canal_id: string; nome: string | null; handle: string | null }> {
  const { canal_id, handle } = entradaDoCanal(texto);
  let id = canal_id;
  if (!id) {
    if (!handle) throw new Error("cola o @ do canal, o link dele ou o id que começa com UC");
    const r = await fetch(`https://www.youtube.com/@${encodeURIComponent(handle)}`, { headers: CABECALHO, signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (r.status === 404) throw new Error(`não achei o canal @${handle} no YouTube`);
    const html = await r.text();
    id = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/)?.[1] ?? html.match(/"externalId":"(UC[A-Za-z0-9_-]{22})"/)?.[1] ?? null;
    if (!id) throw new Error(`não consegui ler o canal @${handle} (o YouTube respondeu ${r.status})`);
  }
  const { nome } = await feed(id);
  return { canal_id: id, nome, handle };
}

/** É Short? /shorts/<id> responde 200; vídeo longo redireciona pro /watch. */
async function ehShort(id: string): Promise<boolean> {
  try {
    const r = await fetch(`https://www.youtube.com/shorts/${id}`, { method: "HEAD", redirect: "manual", headers: CABECALHO, signal: AbortSignal.timeout(15_000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

/**
 * Os vídeos do canal publicados depois de `desde` (e até `ate`), o mais novo primeiro. Com
 * `soShorts`, confere só os novos (uma consulta por vídeo) e deixa o longo de fora.
 */
export async function videosNovos(canalId: string, desde: Date, soShorts: boolean, ate?: Date): Promise<{ nome: string | null; maisNovo: string | null; videos: VideoYoutube[] }> {
  const { nome, videos } = await feed(canalId);
  const ordenados = videos.sort((a, b) => b.publicado_em.localeCompare(a.publicado_em));
  const novos = ordenados.filter((v) => new Date(v.publicado_em) > desde && (!ate || new Date(v.publicado_em) <= ate));
  const escolhidos: VideoYoutube[] = [];
  for (const v of novos) {
    if (!soShorts) escolhidos.push({ ...v, link: `https://www.youtube.com/watch?v=${v.id}` });
    else if (await ehShort(v.id)) escolhidos.push(v);
  }
  return { nome, maisNovo: ordenados[0]?.publicado_em ?? null, videos: escolhidos };
}
