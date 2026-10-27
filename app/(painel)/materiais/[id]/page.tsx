import Link from "next/link";
import { urlDoApp } from "@/lib/app";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { estacaoLigada, type BatidaEstacao } from "@/lib/editor";
import { normalizarBlocos, pendencias } from "@/lib/entregas/blocos";
import { BotaoGerar } from "../../esteira/botoes";
import { Copiar } from "../../copiar";
import { AutoAtualizar } from "../../editor/atualizar";
import { EditorBlocos } from "../editor-blocos";
import { ajustarEntrega, apagarEntrega, salvarEntrega } from "../acoes";

export const dynamic = "force-dynamic";

const APP_URL = urlDoApp();

export default async function PaginaMaterial({ params, searchParams }: PageProps<"/materiais/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const { data: e } = await supabase.from("entrega").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const [{ data: cfg }, { data: ed }] = await Promise.all([
    supabase.from("configuracao").select("valor").eq("chave", "estacao_roteiros").maybeSingle(),
    e.edicao_id ? supabase.from("edicao").select("id, titulo, versao").eq("id", e.edicao_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const ligada = estacaoLigada(cfg?.valor as BatidaEstacao | null);
  const andando = e.status === "aguardando_estacao" || e.status === "escrevendo";
  const blocos = normalizarBlocos(e.blocos);
  const faltas = pendencias(blocos);
  const url = `${APP_URL}/m/${e.slug}`;

  return (
    <div className="max-w-3xl space-y-5">
      {andando && <AutoAtualizar segundos={5} />}
      <header>
        <Link href="/materiais" className="text-xs text-apagado hover:text-texto">
          ← Materiais
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="titulo">{e.titulo || `/m/${e.slug}`}</h1>
          {e.publicada ? <span className="chip text-ok">no ar</span> : <span className="chip text-suave">não publicado</span>}
        </div>
        <p className="mt-1 text-xs text-apagado">
          {e.palavra ? `comenta ${e.palavra}` : "sem palavra"} · {e.visitas} visita{e.visitas === 1 ? "" : "s"}
          {ed ? (
            <>
              {" · do vídeo "}
              <Link href={`/editor/${ed.id}`} className="text-marca">
                {ed.titulo}
              </Link>
            </>
          ) : null}
        </p>
      </header>
      {q.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      {andando && (
        <section className="card space-y-1 p-4 text-sm">
          <p>{e.etapa ?? "a estação está montando o material"}…</p>
          {!ligada && <p className="text-quente">A estação está desligada: abre o atalho da estação de edição no teu PC que ela monta.</p>}
          <p className="text-xs text-apagado">Leva uns 2 a 4 minutos. Pode sair da página.</p>
        </section>
      )}

      {e.status === "erro" && (
        <section className="card space-y-2 border-quente/60 p-4">
          <h2 className="rotulo text-quente">Deu erro</h2>
          <p className="whitespace-pre-wrap font-mono text-xs text-suave">{e.erro}</p>
          <form action={ajustarEntrega}>
            <input type="hidden" name="id" value={e.id} />
            <BotaoGerar rotulo="Montar de novo" gerando="Mandando…" className="btn btn-sm" />
          </form>
        </section>
      )}

      {!andando && (
        <>
          <section className="card flex flex-wrap items-center gap-2 p-4">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-suave">{url}</span>
            <Copiar texto={url} rotulo="Copiar o link" />
            <a href={`/m/${e.slug}${e.publicada ? "" : "?ver=rascunho"}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-2">
              Ver a página
            </a>
          </section>

          {faltas.length > 0 && (
            <section className="rounded-lg bg-morno/10 px-3 py-2 text-sm text-morno">
              <p className="font-bold">Falta completar ({faltas.length}):</p>
              <ul className="list-disc pl-5 text-xs">
                {faltas.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </section>
          )}

          <form action={salvarEntrega} className="card space-y-4 p-4">
            <input type="hidden" name="id" value={e.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs text-apagado">Título da página</span>
                <input name="titulo" defaultValue={e.titulo} className="campo" maxLength={120} />
              </label>
              <label className="block space-y-1 sm:col-span-2">
                <span className="text-xs text-apagado">Subtítulo</span>
                <input name="subtitulo" defaultValue={e.subtitulo ?? ""} className="campo" maxLength={240} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-apagado">Palavra do comentário</span>
                <input name="palavra" defaultValue={e.palavra ?? ""} className="campo" maxLength={40} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-apagado">Endereço (/m/…)</span>
                <input name="slug" defaultValue={e.slug} className="campo font-mono text-xs" maxLength={40} />
              </label>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="na_dm" defaultChecked={e.na_dm} className="mt-1" />
              <span>
                Mandar na DM de quem comentar <b>{e.palavra ?? "a palavra"}</b> (o link do material e, depois, o convite da comunidade, no lugar da mensagem “o material tá na comunidade”). Só vale com o material no ar.
              </span>
            </label>
            <EditorBlocos inicial={blocos} />
            <div className="flex flex-wrap gap-2 border-t border-borda pt-3">
              <BotaoGerar rotulo="Salvar" gerando="Salvando…" className="btn btn-sm btn-2" />
              {e.publicada ? (
                <button name="publicar" value="0" className="btn btn-sm btn-2 text-quente">
                  Salvar e tirar do ar
                </button>
              ) : (
                <button name="publicar" value="1" className="btn btn-sm">
                  Salvar e publicar
                </button>
              )}
            </div>
          </form>

          <form action={ajustarEntrega} className="card space-y-2 p-4">
            <input type="hidden" name="id" value={e.id} />
            <h2 className="rotulo">Pedir ajuste pra IA</h2>
            <textarea name="ajuste" rows={3} className="campo" placeholder="ex.: troca o passo 2 pelo jeito com a BM nova; põe o prompt do agente inteiro; deixa mais curto" required />
            <BotaoGerar rotulo="Mandar o ajuste" gerando="Mandando pra estação…" className="btn btn-sm" />
            <p className="text-xs text-apagado">A estação muda só o que você pediu (o que você editou à mão vai junto: salve antes).</p>
          </form>

          {e.pedido && (
            <details className="card p-4 text-sm">
              <summary className="rotulo cursor-pointer">O que você pediu</summary>
              <p className="mt-2 whitespace-pre-wrap text-suave">{e.pedido}</p>
            </details>
          )}
        </>
      )}

      <form action={apagarEntrega} className="pt-2">
        <input type="hidden" name="id" value={e.id} />
        <button className="text-xs text-quente">apagar este material (a página sai do ar)</button>
      </form>
    </div>
  );
}
