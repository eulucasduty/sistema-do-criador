import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { ENTREGAS_PADRAO, lerConfig, lerPerfil, PERFIL_PADRAO, type ConfigEntregas, type Perfil } from "@/lib/config";
import { normalizarBlocos, SLUG_VALIDO, type Bloco } from "@/lib/entregas/blocos";
import { CopiarMaterial } from "./copiar";

// A página pública do material de um CTA (/m/<endereço>): quem comentou a palavra recebe este link
// na DM. Sem login. Só aparece o que está publicado (rascunho só com ?ver=rascunho e você logado).
// Feita pro celular, dentro do navegador do Instagram, com o seu @, a sua foto e as cores da sua
// marca (Meu perfil).

export const dynamic = "force-dynamic";

type Linha = { id: string; slug: string; titulo: string; subtitulo: string | null; blocos: unknown; publicada: boolean; palavra: string | null };

async function carregar(slug: string, rascunho: boolean): Promise<Linha | null> {
  if (!SLUG_VALIDO.test(slug)) return null;
  const { data, error } = await createAdminClient().from("entrega").select("id, slug, titulo, subtitulo, blocos, publicada, palavra").eq("slug", slug).maybeSingle<Linha>();
  if (error || !data) return null;
  if (data.publicada) return data;
  if (!rascunho) return null;
  // rascunho: só pra quem é da equipe e está logado no painel
  try {
    await exigirEquipe();
    return data;
  } catch {
    return null;
  }
}

async function perfil(): Promise<Perfil> {
  try {
    return await lerPerfil();
  } catch {
    return PERFIL_PADRAO;
  }
}

const quem = (p: Perfil) => (p.usuario ? `@${p.usuario}` : (p.nome ?? ""));

export async function generateMetadata({ params }: PageProps<"/m/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [e, p] = await Promise.all([carregar(slug, false), perfil()]);
  const assinatura = quem(p);
  if (!e) return { title: "material", robots: { index: false, follow: false } };
  const descricao = e.subtitulo ?? (assinatura ? `o material do vídeo de ${assinatura}` : "o material do vídeo");
  return {
    title: assinatura ? `${e.titulo} · ${assinatura}` : e.titulo,
    description: descricao,
    openGraph: { title: e.titulo, description: descricao, ...(p.foto_url ? { images: [p.foto_url] } : {}) },
    robots: { index: false, follow: false },
  };
}

// ── as cores da sua marca (só #hex; qualquer outra coisa volta pro padrão) ──
const cor = (v: unknown, padrao: string) => (typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()) ? v.trim() : padrao);
function textoSobre(hex: string): string {
  const h = hex.length === 4 ? hex.slice(1).replace(/./g, (c) => c + c) : hex.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? "#000000" : "#ffffff";
}

const CSS = `
.material{background:var(--m-fundo);color:var(--m-texto);min-height:100vh}
.material .m-forte{color:var(--m-texto)}
.material .m-suave{color:color-mix(in srgb,var(--m-texto) 76%,var(--m-fundo))}
.material .m-apagado{color:color-mix(in srgb,var(--m-texto) 52%,var(--m-fundo))}
.material .m-cartao{background:color-mix(in srgb,var(--m-texto) 6%,var(--m-fundo));border:2px solid color-mix(in srgb,var(--m-texto) 14%,var(--m-fundo))}
.material .m-linha{border-color:color-mix(in srgb,var(--m-texto) 14%,var(--m-fundo))}
.material .m-botao{background:var(--m-destaque);color:var(--m-sobre);border:2px solid #000;box-shadow:0 4px 0 #000}
.material .m-botao:active{box-shadow:none}
.material .m-ok{background:#7dff3d;color:#000}
.material .m-aviso{background:color-mix(in srgb,var(--m-destaque) 12%,var(--m-fundo));border:2px solid color-mix(in srgb,var(--m-destaque) 60%,var(--m-fundo))}
.material .m-foto{border:2px solid #000;box-shadow:0 3px 0 #000}
`;

/** **negrito** → <strong>; o resto é texto puro (o React escapa). */
function Rico({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <strong key={i} className="m-forte">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function CaixaDeTexto({ texto, rotulo }: { texto: string; rotulo?: string }) {
  return (
    <div className="m-cartao overflow-hidden rounded-2xl">
      <div className="m-linha flex items-center justify-between gap-3 border-b px-4 py-2">
        <span className="m-apagado font-mono text-[11px] uppercase tracking-[0.18em]">{rotulo ?? "prompt"}</span>
        <CopiarMaterial texto={texto} />
      </div>
      <pre className="m-forte max-h-[420px] overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[13px] leading-relaxed">{texto}</pre>
    </div>
  );
}

function Botao({ titulo, url }: { titulo: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="m-botao flex items-center justify-between gap-3 rounded-2xl px-5 py-4 font-extrabold active:translate-y-[2px]">
      <span>{titulo}</span>
      <span aria-hidden>↗</span>
    </a>
  );
}

function UmBloco({ b }: { b: Bloco }) {
  switch (b.tipo) {
    case "texto":
      return (
        <p className="m-suave whitespace-pre-wrap text-[16px] leading-relaxed">
          <Rico texto={b.texto} />
        </p>
      );
    case "aviso":
      return (
        <div className="m-aviso rounded-2xl px-4 py-3 text-[15px] leading-relaxed">
          <Rico texto={b.texto} />
        </div>
      );
    case "prompt":
      return (
        <div className="space-y-2">
          {b.titulo && <h2 className="m-forte font-display text-2xl">{b.titulo}</h2>}
          <CaixaDeTexto texto={b.texto} />
          {b.dica && <p className="m-apagado text-sm">{b.dica}</p>}
        </div>
      );
    case "link":
      if (!b.url) return null;
      return (
        <div className="space-y-1">
          <Botao titulo={b.titulo} url={b.url} />
          {b.descricao && <p className="m-apagado px-1 text-sm">{b.descricao}</p>}
        </div>
      );
    case "template":
      return (
        <div className="space-y-2">
          <h2 className="m-forte font-display text-2xl">{b.titulo}</h2>
          {b.descricao && <p className="m-apagado text-sm">{b.descricao}</p>}
          {b.texto && <CaixaDeTexto texto={b.texto} rotulo="template" />}
          {b.url && <Botao titulo="abrir o template" url={b.url} />}
        </div>
      );
    case "passos":
      return (
        <div className="space-y-3">
          {b.titulo && <h2 className="m-forte font-display text-2xl">{b.titulo}</h2>}
          <ol className="space-y-3">
            {b.itens.map((p, k) => (
              <li key={k} className="m-cartao rounded-2xl p-4">
                <div className="flex gap-3">
                  <span className="m-botao flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-display text-lg">{k + 1}</span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="m-forte pt-0.5 text-[16px] font-extrabold leading-snug">{p.titulo}</p>
                    {p.texto && (
                      <p className="m-suave whitespace-pre-wrap text-[15px] leading-relaxed">
                        <Rico texto={p.texto} />
                      </p>
                    )}
                    {p.prompt && <CaixaDeTexto texto={p.prompt} />}
                    {p.link?.url && <Botao titulo={p.link.titulo || "abrir"} url={p.link.url} />}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      );
  }
}

export default async function PaginaDoMaterial({ params, searchParams }: PageProps<"/m/[slug]">) {
  const { slug } = await params;
  const q = await searchParams;
  const rascunho = q.ver === "rascunho";
  const e = await carregar(slug, rascunho);
  if (!e) notFound();
  if (e.publicada && !rascunho) await createAdminClient().rpc("contar_visita_entrega", { p_slug: e.slug }).then(() => {}, () => {});
  const [p, salvo] = await Promise.all([perfil(), lerConfig<Partial<ConfigEntregas>>("entregas", {}).catch(() => ({}))]);
  const convite = { ...ENTREGAS_PADRAO, ...salvo };
  const blocos = normalizarBlocos(e.blocos);
  const destaque = cor(p.cores?.destaque, PERFIL_PADRAO.cores.destaque);
  const estilo = {
    "--m-fundo": cor(p.cores?.fundo, PERFIL_PADRAO.cores.fundo),
    "--m-texto": cor(p.cores?.texto, PERFIL_PADRAO.cores.texto),
    "--m-destaque": destaque,
    "--m-sobre": textoSobre(destaque),
  } as React.CSSProperties;
  const perfilUrl = p.usuario ? `https://instagram.com/${encodeURIComponent(p.usuario)}` : null;
  const assinatura = quem(p);

  return (
    <main className="material" style={estilo}>
      <style>{CSS}</style>
      <div className="mx-auto max-w-xl space-y-7 px-4 pb-16 pt-6">
        {!e.publicada && <p className="m-aviso rounded-xl px-3 py-2 text-center text-xs font-bold">RASCUNHO · só você está vendo</p>}
        {assinatura && (
          <a href={perfilUrl ?? undefined} className="flex items-center gap-3">
            {p.foto_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.foto_url} alt="" width={44} height={44} className="m-foto h-11 w-11 rounded-[14px] object-cover" />
            )}
            <span className="leading-tight">
              <span className="block text-sm font-extrabold">{assinatura}</span>
              <span className="m-apagado block text-xs">material do vídeo{e.palavra ? ` · ${e.palavra.toLowerCase()}` : ""}</span>
            </span>
          </a>
        )}

        <header className="space-y-2">
          <h1 className="m-forte font-display text-[40px] leading-[1.02]">{e.titulo}</h1>
          {e.subtitulo && <p className="m-suave text-[17px] leading-relaxed">{e.subtitulo}</p>}
        </header>

        {blocos.map((b, i) => (
          <UmBloco key={i} b={b} />
        ))}

        {convite.convite_texto.trim() && /^https:\/\//i.test(convite.convite_link) && (
          <section className="m-cartao space-y-3 rounded-3xl p-5">
            <p className="m-suave text-[16px] leading-relaxed">{convite.convite_texto}</p>
            <Botao titulo={convite.convite_botao || "entrar"} url={convite.convite_link} />
          </section>
        )}

        {assinatura && (
          <footer className="m-apagado pt-4 text-center text-xs">
            feito por{" "}
            {perfilUrl ? (
              <a href={perfilUrl} className="underline">
                {assinatura}
              </a>
            ) : (
              assinatura
            )}
          </footer>
        )}
      </div>
    </main>
  );
}
