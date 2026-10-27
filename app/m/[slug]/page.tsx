import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarBlocos } from "@/lib/entregas/blocos";
import { Copiar } from "../../(painel)/copiar";
export const dynamic = "force-dynamic";
export default async function Material({ params }: PageProps<"/m/[slug]">) {
  const {slug} = await params;
  const db = createAdminClient();
  const { data } = await db.from("entrega").select("titulo, subtitulo, blocos").eq("slug", slug).eq("publicada", true).eq("status", "pronta").maybeSingle();
  if (!data) notFound();
  return <main className="mx-auto max-w-2xl space-y-6 px-5 py-12"><p className="kicker">Material do criador</p><h1 className="titulo">{data.titulo}</h1>{data.subtitulo && <p className="text-suave">{data.subtitulo}</p>}{normalizarBlocos(data.blocos).map((b,i)=><section key={i} className={`card space-y-3 p-5 ${b.tipo === "aviso" ? "border-marca/50" : ""}`}>
    {"titulo" in b && b.titulo && <h2 className="font-bold">{b.titulo}</h2>}
    {"texto" in b && b.texto && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{b.texto}</p>}
    {"descricao" in b && b.descricao && <p className="text-sm text-suave">{b.descricao}</p>}
    {"url" in b && b.url && <a href={b.url} target="_blank" rel="noreferrer" className="btn btn-sm">Abrir link ↗</a>}
    {(b.tipo === "prompt" || b.tipo === "template") && b.texto && <Copiar texto={b.texto} rotulo="Copiar texto" className="btn btn-sm btn-2" />}
    {b.tipo === "prompt" && b.dica && <p className="text-xs text-suave">{b.dica}</p>}
    {b.tipo === "passos" && <ol className="list-decimal space-y-4 pl-5">{b.itens.map((passo,n)=><li key={n} className="space-y-2 text-sm"><h3 className="font-bold">{passo.titulo}</h3>{passo.texto && <p className="whitespace-pre-wrap text-suave">{passo.texto}</p>}{passo.prompt && <><pre className="overflow-auto whitespace-pre-wrap rounded-lg bg-campo p-3 text-xs">{passo.prompt}</pre><Copiar texto={passo.prompt} rotulo="Copiar prompt" className="btn btn-sm btn-2" /></>}{passo.link?.url && <a href={passo.link.url} target="_blank" rel="noreferrer" className="text-frio underline">{passo.link.titulo} ↗</a>}</li>)}</ol>}
  </section>)}</main>;
}
