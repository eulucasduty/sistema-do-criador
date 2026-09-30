import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { haQuanto, nomeDoContato } from "@/lib/formato";
import { alternarAutomacao, apagarAutomacao } from "../acoes";
import { FormularioAutomacao, type AutomacaoForm } from "../formulario";
import { midiasParaEscolher } from "../midias";

export const dynamic = "force-dynamic";

const ETAPA: Record<string, string> = {
  abertura: "recebeu a 1ª DM",
  aguardando_seguir: "esperando seguir",
  entregue: "recebeu o material",
  com_agente: "conversando com o agente",
};

type Um<T> = T | T[] | null;
const um = <T,>(v: Um<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

export default async function PaginaAutomacao({ params, searchParams }: PageProps<"/instagram/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: a } = await supabase.from("ig_automacao").select("*").eq("id", id).maybeSingle();
  if (!a) notFound();

  const cabeca = { count: "exact" as const, head: true };
  const [{ data: fluxos }, { count: comentarios }, { count: dms }, { count: entregues }, { count: cliques }, { data: agente }, { midias, erro: erroMidias }] =
    await Promise.all([
      supabase
        .from("ig_fluxo")
        .select("id, etapa, atualizado_em, comentario_texto, contato:contato_id (id, nome, instagram_usuario)")
        .eq("automacao_id", id)
        .order("atualizado_em", { ascending: false })
        .limit(40),
      supabase.from("ig_comentario").select("id", cabeca).eq("automacao_id", id),
      supabase.from("ig_fluxo").select("id", cabeca).eq("automacao_id", id),
      supabase.from("ig_fluxo").select("id", cabeca).eq("automacao_id", id).in("etapa", ["entregue", "com_agente"]),
      supabase.from("clique").select("id", cabeca).eq("automacao_id", id),
      supabase.from("agente").select("ativo").order("criado_em").limit(1).maybeSingle(),
      midiasParaEscolher(),
    ]);

  const numeros = [
    { rotulo: "comentários", valor: comentarios ?? 0, dica: "comentaram a palavra" },
    { rotulo: "DMs", valor: dms ?? 0, dica: "receberam a 1ª DM" },
    { rotulo: "entregues", valor: entregues ?? 0, dica: dms ? `${Math.round(((entregues ?? 0) / dms) * 100)}% de quem recebeu a DM` : "receberam o material" },
    { rotulo: "cliques", valor: cliques ?? 0, dica: "nos links da entrega" },
  ];

  return (
    <div className="max-w-6xl">
      <Link href="/instagram" className="text-xs text-suave hover:text-texto">
        ← Automações
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="titulo">{a.nome}</h1>
          <p className="mt-1 text-sm">
            {a.ativa ? <span className="text-ok">Ligada: respondendo os comentários.</span> : <span className="text-suave">Desligada.</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <form action={alternarAutomacao}>
            <input type="hidden" name="id" value={a.id} />
            <input type="hidden" name="ativa" value={a.ativa ? "nao" : "sim"} />
            <button className={`btn btn-sm ${a.ativa ? "btn-2" : ""}`}>{a.ativa ? "Desligar" : "Ligar"}</button>
          </form>
          <details className="relative">
            <summary className="btn btn-sm btn-perigo cursor-pointer list-none">Apagar</summary>
            <form action={apagarAutomacao} className="card absolute right-0 z-10 mt-2 w-64 space-y-2 p-3 text-sm">
              <input type="hidden" name="id" value={a.id} />
              <p className="text-suave">Apaga a automação e o histórico de quem passou por ela. Os leads continuam.</p>
              <button className="btn btn-sm btn-perigo w-full">Apagar de vez</button>
            </form>
          </details>
        </div>
      </header>
      {q.salvo && (
        <p className="mt-3 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">Salvo.{a.ativa ? "" : " Ela está desligada: ligue quando quiser que comece."}</p>
      )}
      {q.erro && <p className="mt-3 rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card p-4 lg:col-span-2">
          <FormularioAutomacao a={a as AutomacaoForm} midias={midias} erroMidias={erroMidias} agenteLigado={Boolean(agente?.ativo)} />
        </section>
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-2">
            {numeros.map((x) => (
              <div key={x.rotulo} className="card p-3">
                <p className="rotulo">{x.rotulo}</p>
                <p className="mt-1 font-display text-2xl">{x.valor.toLocaleString("pt-BR")}</p>
                <p className="mt-1 text-[11px] text-apagado">{x.dica}</p>
              </div>
            ))}
          </section>
          <section>
            <h2 className="mb-3 rotulo">Quem entrou</h2>
            {!fluxos?.length ? (
              <p className="card p-4 text-sm text-suave">Ninguém ainda.</p>
            ) : (
              <ul className="card divide-y divide-borda overflow-hidden">
                {fluxos.map((f) => {
                  const c = um(f.contato as Um<{ id: string; nome: string | null; instagram_usuario: string | null }>);
                  return (
                    <li key={f.id} className="px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        {c ? (
                          <Link href={`/contatos/${c.id}`} className="truncate hover:text-marca">
                            {nomeDoContato(c)}
                          </Link>
                        ) : (
                          <span className="text-apagado">—</span>
                        )}
                        <span className="shrink-0 text-xs text-apagado">{haQuanto(f.atualizado_em)}</span>
                      </div>
                      <p className="text-xs text-suave">
                        {ETAPA[f.etapa] ?? f.etapa}
                        {f.comentario_texto && <span className="text-apagado"> · “{f.comentario_texto.slice(0, 60)}”</span>}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
