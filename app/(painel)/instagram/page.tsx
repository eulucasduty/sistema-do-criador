import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuanto } from "@/lib/formato";
import { instagramConfigurado } from "@/lib/instagram/api";
import type { LembreteComentario } from "@/lib/config";
import { alternarAutomacao, salvarLembrete } from "./acoes";
import { FormAcao } from "../agente/form-acao";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { rotulo: string; cor: string }> = {
  respondido: { rotulo: "respondido", cor: "text-ok" },
  ignorado: { rotulo: "sem automação", cor: "text-apagado" },
  erro: { rotulo: "erro", cor: "text-quente" },
  recebido: { rotulo: "recebido", cor: "text-suave" },
};

const LEMBRETE_PADRAO: LembreteComentario = { ativo: true, horas: 12, por_minuto: 5, textos: ["{arroba} chegou lá? te mandei na dm 👀"] };

const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;

export default async function PaginaAutomacoes({ searchParams }: PageProps<"/instagram">) {
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: automacoes }, { data: comentarios }, { data: agente }, { data: lembreteSalvo }, conectado] = await Promise.all([
    supabase
      .from("ig_automacao")
      .select("id, nome, ativa, modo, palavras, todas_as_midias, midias, exigir_seguir, criado_em")
      .order("criado_em", { ascending: false }),
    supabase.from("ig_comentario").select("id, usuario, texto, status, erro, criado_em, automacao_id, contato_id").order("criado_em", { ascending: false }).limit(25),
    supabase.from("agente").select("ativo").order("criado_em").limit(1).maybeSingle(),
    supabase.from("configuracao").select("valor").eq("chave", "lembrete_comentario").maybeSingle(),
    instagramConfigurado().catch(() => false),
  ]);
  const lembrete = { ...LEMBRETE_PADRAO, ...((lembreteSalvo?.valor as Partial<LembreteComentario> | null) ?? {}) };

  const n = async (consulta: PromiseLike<{ count: number | null }>) => (await consulta).count ?? 0;
  const cabeca = { count: "exact" as const, head: true };
  const stats = new Map<string, { comentarios: number; dms: number; entregues: number; cliques: number }>();
  await Promise.all(
    (automacoes ?? []).map(async (a) => {
      const [comentariosN, dms, entregues, cliques] = await Promise.all([
        n(supabase.from("ig_comentario").select("id", cabeca).eq("automacao_id", a.id)),
        n(supabase.from("ig_fluxo").select("id", cabeca).eq("automacao_id", a.id)),
        n(supabase.from("ig_fluxo").select("id", cabeca).eq("automacao_id", a.id).in("etapa", ["entregue", "com_agente"])),
        n(supabase.from("clique").select("id", cabeca).eq("automacao_id", a.id)),
      ]);
      stats.set(a.id, { comentarios: comentariosN, dms, entregues, cliques });
    }),
  );
  const nomeDa = new Map((automacoes ?? []).map((a) => [a.id, a.nome]));
  const agenteLigado = Boolean(agente?.ativo);

  return (
    <div className="max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="titulo">Automações</h1>
          <p className="mt-1 text-sm text-suave">
            O seu ManyChat grátis: a pessoa comenta a palavra no post → resposta pública + DM com botão → toca no botão e recebe o material. Sem IA e
            sem custo. Se quiser que a conversa continue depois, ligue o <Link href="/agente" className="text-marca underline">agente</Link>.
          </p>
        </div>
        <Link href="/instagram/nova" className="btn btn-sm">
          + Nova automação
        </Link>
      </header>

      {!conectado && (
        <p className="rounded-lg border border-morno/40 bg-morno/10 px-3 py-2 text-sm text-morno">
          O Instagram ainda não está conectado: as automações só rodam depois disso. <Link href="/conexoes" className="underline">Conexões</Link> tem o
          passo a passo.
        </p>
      )}
      {q.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      {!automacoes?.length ? (
        <div className="card p-6 text-sm">
          <p className="font-display text-lg uppercase tracking-wide">Nenhuma automação ainda</p>
          <p className="mt-2 max-w-xl text-suave">
            Escolha um post, a palavra que a pessoa tem que comentar e o link do material. A nova já vem com as mensagens prontas: é só ajustar e ligar.
          </p>
          <Link href="/instagram/nova" className="btn btn-sm mt-4">
            Criar a primeira
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {automacoes.map((a) => {
            const s = stats.get(a.id)!;
            return (
              <li key={a.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/instagram/${a.id}`} className="font-medium hover:text-marca">
                    {a.nome}
                  </Link>
                  <form action={alternarAutomacao}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="ativa" value={a.ativa ? "nao" : "sim"} />
                    <button
                      title={a.ativa ? "Desligar" : "Ligar"}
                      className={`rounded-full px-2.5 py-0.5 text-xs ${a.ativa ? "bg-ok/15 text-ok" : "bg-superficie-2 text-suave"}`}
                    >
                      {a.ativa ? "ligada" : "desligada"}
                    </button>
                  </form>
                </div>
                <p className="mt-1 text-xs text-apagado">
                  {a.palavras.length ? `palavra: ${a.palavras.join(", ")}` : "qualquer comentário"} ·{" "}
                  {a.todas_as_midias ? "todos os posts" : `${a.midias.length} ${a.midias.length === 1 ? "post" : "posts"}`}
                  {a.exigir_seguir && " · só pra quem segue"}
                  {a.modo === "agente" && (agenteLigado ? " · o agente continua" : <span className="text-morno"> · modo agente (desligado)</span>)}
                </p>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {[
                    { rotulo: "comentários", valor: s.comentarios },
                    { rotulo: "DMs", valor: s.dms },
                    { rotulo: "entregues", valor: s.entregues, extra: s.dms ? pct(s.entregues, s.dms) : null },
                    { rotulo: "cliques", valor: s.cliques },
                  ].map((x) => (
                    <div key={x.rotulo} className="rounded-lg bg-superficie-2 px-1 py-2">
                      <p className="font-mono text-base">{x.valor.toLocaleString("pt-BR")}</p>
                      <p className="text-[11px] text-apagado">
                        {x.rotulo}
                        {x.extra ? ` · ${x.extra}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 rotulo">Últimos comentários</h2>
          {!comentarios?.length ? (
            <p className="card p-4 text-sm text-suave">Nenhum comentário chegou ainda.</p>
          ) : (
            <ul className="card divide-y divide-borda overflow-hidden">
              {comentarios.map((c) => {
                const st = STATUS[c.status] ?? { rotulo: c.status, cor: "" };
                return (
                  <li key={c.id} className="px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="min-w-0">
                        {c.contato_id ? (
                          <Link href={`/contatos/${c.contato_id}`} className="font-medium hover:text-marca">
                            @{c.usuario ?? "?"}
                          </Link>
                        ) : (
                          <span className="font-medium">@{c.usuario ?? "?"}</span>
                        )}{" "}
                        <span className="text-suave">{c.texto}</span>
                      </span>
                      <span className="text-xs">
                        <span className={st.cor}>{st.rotulo}</span>
                        {c.automacao_id && <span className="text-apagado"> · {nomeDa.get(c.automacao_id) ?? "apagada"}</span>}
                        <span className="text-apagado"> · {haQuanto(c.criado_em)}</span>
                      </span>
                    </div>
                    {c.erro && <p className="mt-0.5 text-xs text-quente">{c.erro}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card h-fit p-4">
          <h2 className="font-display text-base uppercase tracking-wide">Lembrete no comentário</h2>
          <p className="mt-1 text-xs text-suave">
            Muita gente comenta e não abre a DM. O Instagram não deixa mandar outra DM antes de a pessoa responder, então o sistema responde o comentário
            dela de novo, em público, uma vez só. {"{arroba}"} vira o @ da pessoa (ela recebe a notificação).
          </p>
          <FormAcao acao={salvarLembrete} className="mt-3 space-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="ativo" defaultChecked={lembrete.ativo} /> Ligado
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs text-apagado">Depois de (horas)</span>
                <input name="horas" type="number" min="1" max="47" defaultValue={lembrete.horas} className="campo mt-1" />
              </label>
              <label className="block">
                <span className="text-xs text-apagado">No máximo por minuto</span>
                <input name="por_minuto" type="number" min="1" max="10" defaultValue={lembrete.por_minuto} className="campo mt-1" />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-apagado">Textos (um por linha, sorteia um)</span>
              <textarea name="textos" rows={4} defaultValue={lembrete.textos.join("\n")} className="campo mt-1" />
            </label>
          </FormAcao>
        </section>
      </div>
    </div>
  );
}
