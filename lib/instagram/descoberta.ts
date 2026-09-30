import "server-only";
import { lerConfig, salvarConfig } from "@/lib/config";

// Post de OUTRA conta (reel ou carrossel), pela API oficial da Meta.
//
// A API do Instagram (login do Instagram) não entrega mídia de outra conta. A saída
// oficial é a "Business Discovery" da API do Instagram com login do FACEBOOK: a sua conta
// (via token da página ligada ao seu Instagram) lista os posts públicos de qualquer conta
// de criador/empresa, com o link do vídeo ou das imagens. O autor sai da prévia do link
// (o mesmo metadado público que os apps de mensagem usam pra montar a prévia).
// Limites da Meta: conta pessoal não aparece; reel com música licenciada vem sem o vídeo
// (direito autoral). Nesses casos, você sobe o arquivo (ou os prints) pelo painel.

const GRAPH = "https://graph.facebook.com/v25.0";

export type ContaFacebook = {
  page_token?: string;
  page_nome?: string;
  ig_business_id?: string;
  ig_username?: string;
  expira_em?: string | null; // null = não expira (token de página tirado de um token longo)
  conectado_em?: string;
  erro?: string;
};

export const lerFacebook = () => lerConfig<ContaFacebook>("facebook", {});

class ErroFacebook extends Error {
  constructor(
    public codigo: number | null,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

async function fb<T>(caminho: string, token: string): Promise<T> {
  const url = `${GRAPH}${caminho}${caminho.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`;
  const r = await fetch(url, { signal: AbortSignal.timeout(25_000), cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j?.error) throw new ErroFacebook(j?.error?.code ?? r.status, `${j?.error?.code ?? r.status} ${j?.error?.message ?? r.statusText}`.slice(0, 300));
  return j as T;
}

/**
 * Recebe o token de usuário do Facebook (de preferência o "estendido", de 60 dias), acha a
 * página ligada ao seu Instagram e guarda o token DA PÁGINA — que, tirado de um token
 * longo, não expira. Testa na hora com uma consulta pública.
 */
export async function conectarFacebook(tokenUsuario: string): Promise<ContaFacebook> {
  const { data: paginas } = await fb<{ data: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }> }>(
    "/me/accounts?fields=name,access_token,instagram_business_account{id,username}&limit=100",
    tokenUsuario,
  );
  const meu = String((await lerConfig<{ username?: string }>("instagram", {})).username ?? "").toLowerCase();
  const pagina =
    (meu ? paginas.find((p) => p.instagram_business_account?.username?.toLowerCase() === meu) : undefined) ??
    paginas.find((p) => p.instagram_business_account);
  if (!pagina?.instagram_business_account) {
    throw new Error(
      paginas.length
        ? "achei páginas nesse login, mas nenhuma com o Instagram ligado: no login, marque a página ligada ao seu Instagram"
        : "esse login não deu acesso a nenhuma página: no login, marque a página ligada ao seu Instagram",
    );
  }
  const ig = pagina.instagram_business_account;
  // Prova que a consulta pública funciona (na própria conta)
  await fb(`/${ig.id}?fields=business_discovery.username(${ig.username ?? meu}){username,media_count}`, pagina.access_token);
  // Validade do token da página (0 = não expira). Se não der pra saber, segue.
  let expiraEm: string | null = null;
  try {
    const d = await fb<{ data: { expires_at?: number } }>(`/debug_token?input_token=${encodeURIComponent(pagina.access_token)}`, tokenUsuario);
    expiraEm = d.data.expires_at ? new Date(d.data.expires_at * 1000).toISOString() : null;
  } catch {}
  const conta: ContaFacebook = {
    page_token: pagina.access_token,
    page_nome: pagina.name,
    ig_business_id: ig.id,
    ig_username: ig.username ?? meu,
    expira_em: expiraEm,
    conectado_em: new Date().toISOString(),
  };
  await salvarConfig("facebook", conta);
  return conta;
}

/** O @ do autor pelo link ("instagram.com/<autor>/reel/…") ou pela prévia dele (og:url, "(@autor)"). */
export async function autorDoLink(url: string): Promise<string | null> {
  const doLink = url.match(/instagram\.com\/([A-Za-z0-9._]+)\/(?:reel|reels|p)\//)?.[1];
  if (doLink) return doLink;
  const r = await fetch(url, {
    headers: { "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) return null;
  const html = await r.text();
  const ogUrl = html.match(/<meta property="og:url" content="https:\/\/www\.instagram\.com\/([A-Za-z0-9._]+)\/(?:reel|p)\//)?.[1];
  if (ogUrl) return ogUrl;
  const titulo = html.match(/\((?:&#064;|@)([A-Za-z0-9._]+)\)\s*(?:&#x2022;|•)\s*Instagram/)?.[1];
  return titulo ?? null;
}

export type PostPublico = {
  id: string;
  autor: string;
  tipo: string; // VIDEO | IMAGE | CAROUSEL_ALBUM
  media_url: string | null;
  thumbnail_url: string | null;
  /** Carrossel: as imagens/vídeos na ordem (quando a Meta entrega). */
  filhos: Array<{ tipo: string; media_url: string | null }>;
  permalink: string | null;
  legenda: string | null;
  curtidas: number | null;
  comentarios: number | null;
  publicado_em: string | null;
};

type Midia = {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  caption?: string;
  like_count?: number;
  comments_count?: number;
  timestamp?: string;
  children?: { data?: Array<{ media_type?: string; media_url?: string }> };
};

type Pagina = { business_discovery?: { media?: { data?: Midia[]; paging?: { cursors?: { after?: string } } } } };

/**
 * Acha o post público (reel ou carrossel) pelo link: descobre o autor e procura o post nos
 * últimos ~200 dele pelo código do link. `motivo` explica quando não deu.
 */
export async function acharPostPublico(url: string): Promise<{ post: PostPublico | null; motivo: string | null }> {
  const conta = await lerFacebook();
  if (!conta.page_token || !conta.ig_business_id) {
    return { post: null, motivo: "o Facebook não está conectado (Conexões → Facebook), então a Meta não libera post de outra conta: suba o arquivo" };
  }
  const codigo = url.match(/\/(?:reel|reels|p)\/([^/?#]+)/)?.[1] ?? null;
  if (!codigo) return { post: null, motivo: "esse link não parece de um post do Instagram (instagram.com/reel/… ou /p/…)" };
  const autor = await autorDoLink(url).catch(() => null);
  if (!autor) return { post: null, motivo: "não consegui ver de quem é o post pelo link" };
  const base = "id,media_type,media_url,thumbnail_url,permalink,caption,like_count,comments_count,timestamp";
  let campos = `${base},children{media_type,media_url}`;
  let depois: string | null = null;
  const pedir = (edge: string) =>
    fb<Pagina>(`/${conta.ig_business_id}?fields=${encodeURIComponent(`business_discovery.username(${autor}){${edge}{${campos}}}`)}`, conta.page_token!);
  try {
    for (let pagina = 0; pagina < 4; pagina++) {
      const edge: string = depois ? `media.after(${depois}).limit(50)` : "media.limit(50)";
      let r: Pagina;
      try {
        r = await pedir(edge);
      } catch (e) {
        // Se a API recusar os filhos do carrossel aqui, tenta sem eles
        if (pagina > 0 || campos === base || !(e instanceof ErroFacebook) || e.codigo !== 100) throw e;
        campos = base;
        r = await pedir(edge);
      }
      const lista = r.business_discovery?.media?.data ?? [];
      const achado = lista.find((m) => m.permalink?.includes(`/${codigo}`));
      if (achado) {
        const post: PostPublico = {
          id: achado.id,
          autor,
          tipo: achado.media_type ?? "IMAGE",
          media_url: achado.media_url ?? null,
          thumbnail_url: achado.thumbnail_url ?? null,
          filhos: (achado.children?.data ?? []).map((f) => ({ tipo: f.media_type ?? "IMAGE", media_url: f.media_url ?? null })),
          permalink: achado.permalink ?? null,
          legenda: achado.caption ?? null,
          curtidas: achado.like_count ?? null,
          comentarios: achado.comments_count ?? null,
          publicado_em: achado.timestamp ?? null,
        };
        const semMidia = post.tipo === "VIDEO" && !post.media_url;
        return { post, motivo: semMidia ? "o reel usa música licenciada: a Meta não libera o vídeo, suba o arquivo" : null };
      }
      depois = r.business_discovery?.media?.paging?.cursors?.after ?? null;
      if (!depois || lista.length === 0) break;
    }
    return { post: null, motivo: `não achei esse post nos posts recentes de @${autor}` };
  } catch (e) {
    const msg = (e as Error).message;
    if (e instanceof ErroFacebook && e.codigo === 190) {
      await salvarConfig("facebook", { ...conta, erro: `token do Facebook parou de valer: ${msg.slice(0, 120)}` });
      return { post: null, motivo: "o token do Facebook parou de valer (Conexões → Facebook)" };
    }
    if (/business discovery|110/i.test(msg) || (e instanceof ErroFacebook && e.codigo === 110)) {
      return { post: null, motivo: `@${autor} é conta pessoal: a Meta só abre conta de criador ou empresa, suba o arquivo` };
    }
    return { post: null, motivo: `a Meta não respondeu: ${msg.slice(0, 120)}` };
  }
}
