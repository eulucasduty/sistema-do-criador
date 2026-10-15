import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dataCurta } from "@/lib/formato";
import { configEditor, type BatidaEstacao } from "@/lib/editor";
import { DURACOES, FINAIS_ROTEIRO, ORIGEM_ROTEIRO, STATUS_ROTEIRO, parado, pedacos, type BatidaRoteiros, type VersaoRoteiro } from "@/lib/roteiro/comum";
import { textoTeleprompter } from "@/lib/roteiro/escritor.mjs";
import type { AnaliseReferencia, Transcricao } from "@/lib/roteiro/referencia";
import { Copiar } from "../../copiar";
import { AutoAtualizar } from "../../editor/atualizar";
import { BotaoGerar } from "../../esteira/botoes";
import { apagarRoteiro, novaVersao, tentarDeNovo } from "../acoes";
import { EstacaoRoteiros, situacaoDaEstacao } from "../estacao";

export const dynamic = "force-dynamic";
// "Tentar de novo" e "outra versão" podem ouvir a referência de novo (after): até 5 min na Vercel
export const maxDuration = 300;

const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function Linhas({ linhas }: { linhas: string[] }) {
  return (
    <div className="space-y-1.5">
      {linhas.map((l, i) => (
        <p key={i} className="text-lg leading-snug sm:text-xl">
          {pedacos(l).map((p, j) =>
            p.preencher ? (
              <mark key={j} className="rounded bg-marca px-1 text-[#05070e]">
                {p.texto}
              </mark>
            ) : (
              <span key={j}>{p.texto}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}

function Parte({ nome, linhas, destaque = false }: { nome: string; linhas: string[]; destaque?: boolean }) {
  return (
    <section className={`rounded-xl border-2 p-3 sm:p-4 ${destaque ? "border-marca/50 bg-marca-fundo" : "border-linha"}`}>
      <h3 className={`mb-2 font-mono text-[11px] font-bold tracking-widest ${destaque ? "text-marca" : "text-apagado"}`}>{nome}</h3>
      <Linhas linhas={linhas} />
    </section>
  );
}

/** Quanto custou a versão: no plano, nada (com a referência de quanto seria na API). */
function custoDa(v: VersaoRoteiro): string {
  if (typeof v.equivalente_api_usd === "number") return `sem custo${v.equivalente_api_usd ? ` (na API seria US$ ${v.equivalente_api_usd})` : ""}`;
  return v.custo_usd ? `US$ ${v.custo_usd}` : "sem custo";
}

export default async function PaginaRoteiro({ params, searchParams }: PageProps<"/roteiros/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: r }, { data: automacoes }, { data: cfgs }] = await Promise.all([
    supabase.from("roteiro").select("*").eq("id", id).maybeSingle(),
    supabase.from("ig_automacao").select("nome, palavras, ativa").eq("ativa", true),
    supabase.from("configuracao").select("chave, valor").in("chave", ["estacao_roteiros", "estacao_edicao", "editor"]),
  ]);
  if (!r) notFound();
  const cfg = Object.fromEntries((cfgs ?? []).map((c) => [c.chave, c.valor])) as Record<string, unknown>;
  const batida = (cfg.estacao_roteiros ?? null) as BatidaRoteiros | null;
  const batidaEdicao = (cfg.estacao_edicao ?? null) as BatidaEstacao | null;
  const estacao = situacaoDaEstacao(batida, batidaEdicao);
  const versoes = (r.versoes ?? []) as VersaoRoteiro[];
  const n = Math.min(Math.max(0, Number(q.v ?? 0) || 0), Math.max(0, versoes.length - 1));
  const v = versoes[n] as VersaoRoteiro | undefined;
  const analise = r.analise as AnaliseReferencia | null;
  const transcricao = r.transcricao as Transcricao | null;
  const andando = !FINAIS_ROTEIRO.includes(r.status);
  const s = STATUS_ROTEIRO[r.status] ?? { nome: r.status, cor: "text-suave" };
  // Esperando a estação não trava (ela pode estar desligada). Ouvindo a referência parado há 7 min
  // travou; escrevendo, a estação pode levar mais (cada rodada da IA tem até 10 min)
  const travado = andando && !["subindo", "aguardando_estacao"].includes(r.status) && parado(r.atualizado_em, r.status === "escrevendo" ? 25 : 7);
  const automacao = v?.palavra_cta
    ? (automacoes ?? []).find((a) => !((a.palavras ?? []) as string[]).length || ((a.palavras ?? []) as string[]).some((p) => semAcento(p) === semAcento(v.palavra_cta)))
    : null;
  const c = v?.checagem;

  return (
    <div className="max-w-3xl space-y-5">
      {andando && <AutoAtualizar segundos={4} />}
      <Link href="/roteiros" className="text-xs text-suave hover:text-texto">
        ← Roteiros
      </Link>

      <header className="space-y-1">
        <p className="text-xs text-apagado">
          {ORIGEM_ROTEIRO[r.origem]}
          {r.referencia_id ? (
            <>
              {" "}
              ·{" "}
              <Link href={`/esteira/${r.referencia_id}`} className="underline">
                abrir na Esteira
              </Link>
            </>
          ) : null}{" "}
          · {dataCurta(r.criado_em)}
        </p>
        <h1 className="text-2xl font-bold leading-tight">{v?.titulo || r.titulo || r.tema || "Roteiro"}</h1>
        {r.tema && (v?.titulo || r.titulo) ? <p className="text-sm text-suave">{r.tema}</p> : null}
      </header>

      {andando || r.status === "erro" ? (
        <section className={`card space-y-3 p-4 ${r.status === "erro" ? "border-quente/60" : ""}`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">{r.status === "erro" ? <span className="text-quente">{r.erro ?? "deu erro"}</span> : <>{r.etapa ?? s.nome}…</>}</p>
            <span className={`chip shrink-0 ${s.cor}`}>{s.nome}</span>
          </div>
          {r.status === "aguardando_estacao" ? (
            estacao === "ligada" ? (
              <p className="text-xs text-apagado">
                A estação no seu PC ({batida?.maquina}) {batida?.ocupada && batida.roteiro_id !== r.id ? "está terminando outro roteiro: este é o próximo" : "vai pegar em segundos"}.
                Pode sair da página.
              </p>
            ) : (
              <EstacaoRoteiros roteiros={batida} edicao={batidaEdicao} config={configEditor(cfg.editor)} />
            )
          ) : andando && !travado ? (
            <p className="text-xs text-apagado">
              {r.status === "escrevendo"
                ? "A estação no seu PC está escrevendo (uns 2 a 5 minutos): a IA escreve, a checagem anti-IA confere e, se reprovar, ela reescreve."
                : "Ouvindo a referência e tirando o assunto e a estrutura (uns 1 a 2 minutos). Depois a estação no seu PC escreve."}{" "}
              Pode sair da página.
            </p>
          ) : null}
          {(r.status === "erro" || travado) && (
            <form action={tentarDeNovo}>
              <input type="hidden" name="id" value={r.id} />
              <BotaoGerar rotulo="Tentar de novo" gerando="Mandando…" className="btn btn-sm" />
            </form>
          )}
        </section>
      ) : null}

      {v ? (
        <>
          {versoes.length > 1 && (
            <nav className="flex flex-wrap gap-1.5">
              {versoes.map((x, i) => (
                <Link
                  key={x.gerado_em}
                  href={`/roteiros/${r.id}?v=${i}`}
                  className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold ${i === n ? "border-tinta bg-marca text-[#05070e]" : "border-linha text-suave"}`}
                >
                  versão {versoes.length - i}
                  {i === 0 ? " (nova)" : ""}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="font-bold">~{c?.segundos ?? "?"} s</span>
            <span className="text-apagado">{c?.palavras} palavras</span>
            <span className="text-apagado">
              comenta <b className="text-texto">{v.palavra_cta}</b>
            </span>
            <span className={c?.aprovado && !v.leitor.length ? "text-ok" : "text-morno"}>
              {c?.aprovado && !v.leitor.length ? "✓ passou na checagem anti-IA" : "⚠ checagem anti-IA com ressalvas"}
            </span>
          </div>
          {automacao === undefined && (
            <p className="rounded-lg bg-morno/10 px-3 py-2 text-xs text-morno">
              A palavra {v.palavra_cta} ainda não tem automação ativa: crie em{" "}
              <Link href="/instagram" className="underline">
                Automações
              </Link>{" "}
              antes de postar, senão ninguém recebe no direct.
            </p>
          )}
          {c?.preencher.length ? <p className="rounded-lg bg-marca-fundo px-3 py-2 text-xs">Preencha antes de gravar: {c.preencher.join(" · ")}</p> : null}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href={`/teleprompter/${r.id}?v=${n}`} className="btn col-span-2 text-center sm:col-span-1">
              Abrir teleprompter
            </Link>
            <Copiar texto={textoTeleprompter(v)} rotulo="Copiar texto" className="btn btn-sm btn-2" />
            <Copiar texto={textoTeleprompter(v, true)} rotulo="Copiar com as partes" className="btn btn-sm btn-2" />
          </div>

          <div className="space-y-3">
            <Parte nome="GANCHO · 0 a 3 s" linhas={v.gancho} destaque />
            <Parte nome="CORPO" linhas={v.corpo} />
            <Parte nome="CTA" linhas={v.cta} destaque />
          </div>

          {v.dicas.length ? (
            <section className="card p-4 text-sm">
              <h2 className="rotulo">Pra gravar (não vai pro teleprompter)</h2>
              <ul className="mt-2 space-y-1">
                {v.dicas.map((d) => (
                  <li key={d} className="flex gap-2">
                    <span className="text-marca">→</span>
                    {d}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="card space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="rotulo">Legenda</h2>
              <Copiar texto={v.legenda} rotulo="Copiar legenda" className="btn btn-sm btn-2" />
            </div>
            <p className="whitespace-pre-wrap text-suave">{v.legenda}</p>
          </section>

          <details className="card p-4 text-sm">
            <summary className="rotulo cursor-pointer">Checagem anti-IA</summary>
            <div className="mt-3 space-y-3">
              {v.reescritas.length ? (
                <div>
                  <p className="text-xs font-bold text-apagado">O QUE FOI BARRADO E REESCRITO</p>
                  {v.reescritas.map((rr, i) => (
                    <ul key={i} className="mt-1 space-y-0.5 text-xs text-suave">
                      <li className="font-bold text-apagado">rodada {i + 1}</li>
                      {rr.motivos.map((m) => (
                        <li key={m}>· {m}</li>
                      ))}
                    </ul>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-suave">Passou de primeira, sem reescrita.</p>
              )}
              {c && [...c.graves, ...c.leves].length ? (
                <div>
                  <p className="text-xs font-bold text-morno">AINDA FICOU</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {[...c.graves, ...c.leves].map((p, i) => (
                      <li key={i}>
                        · {p.regra}
                        {p.trecho ? `: ${p.trecho}` : ""} <span className="text-apagado">({p.dica})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {v.leitor.length ? (
                <div>
                  <p className="text-xs font-bold text-morno">O LEITOR AINDA ACHOU COM CARA DE IA</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {v.leitor.map((l, i) => (
                      <li key={i}>
                        · &ldquo;{l.linha}&rdquo; <span className="text-apagado">({l.por_que})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="text-xs text-apagado">
                {v.modelo} · {custoDa(v)} · {dataCurta(v.gerado_em)}
                {v.direcao ? ` · direção: ${v.direcao}` : ""}
                {v.de_onde_veio ? ` · ${v.de_onde_veio}` : ""}
              </p>
              <Link href="/roteiros/padrao" className="text-xs text-marca underline">
                Ver o que a checagem barra e o padrão viral
              </Link>
            </div>
          </details>
        </>
      ) : null}

      {analise ? (
        <details className="card p-4 text-sm">
          <summary className="rotulo cursor-pointer">A referência: assunto e estrutura</summary>
          <div className="mt-3 space-y-2">
            <p>
              <span className="text-apagado">Assunto:</span> {analise.assunto}
            </p>
            <p>
              <span className="text-apagado">Ângulo:</span> {analise.angulo}
            </p>
            {analise.gancho && (
              <p>
                <span className="text-apagado">Gancho ({analise.gancho.tipo}):</span> {analise.gancho.mecanismo}
              </p>
            )}
            <ol className="overflow-hidden rounded-xl border border-borda">
              {analise.estrutura.map((e, i) => (
                <li key={i} className="flex gap-3 border-b border-borda bg-superficie px-3 py-2 last:border-b-0">
                  <span className="w-20 shrink-0 font-mono text-xs text-apagado">{e.parte}</span>
                  <span>{e.funcao}</span>
                </li>
              ))}
            </ol>
            {transcricao?.fala.length ? (
              <details className="pt-1">
                <summary className="cursor-pointer text-xs text-marca">O que a IA ouviu ({transcricao.fonte}) · o roteiro não usa essas falas</summary>
                <ol className="mt-2 space-y-1 text-xs text-suave">
                  {transcricao.fala.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-10 shrink-0 font-mono text-apagado">{f.t}</span>
                      <span>{f.texto}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </div>
        </details>
      ) : null}

      {FINAIS_ROTEIRO.includes(r.status) && (r.status === "pronto" || r.transcricao || r.origem === "tema") ? (
        <form action={novaVersao} className="card space-y-3 p-4">
          <input type="hidden" name="id" value={r.id} />
          <h2 className="rotulo">Gerar outra versão</h2>
          <input name="direcao" defaultValue={r.direcao ?? ""} placeholder="direção: ex. gancho mais polêmico · mais curto · fala pra quem tá começando" className="campo" />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input name="palavra" defaultValue={r.palavra_cta ?? v?.palavra_cta ?? ""} placeholder="PALAVRA do comenta" className="campo uppercase" autoCapitalize="characters" />
            <select name="duracao" defaultValue={String(r.duracao_alvo)} className="campo">
              {DURACOES.map((d) => (
                <option key={d.valor} value={d.valor}>
                  {d.nome}
                </option>
              ))}
            </select>
          </div>
          <BotaoGerar rotulo="Gerar outra versão" gerando="Mandando…" className="btn btn-sm w-full sm:w-auto" />
        </form>
      ) : null}

      <form action={apagarRoteiro}>
        <input type="hidden" name="id" value={r.id} />
        <button className="text-xs text-apagado hover:text-quente">Apagar roteiro</button>
      </form>
    </div>
  );
}
