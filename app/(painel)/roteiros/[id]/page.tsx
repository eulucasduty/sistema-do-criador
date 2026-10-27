import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dataCurta } from "@/lib/formato";
import { DURACOES, FINAIS_ROTEIRO, ORIGEM_ROTEIRO, STATUS_ROTEIRO, estacaoDeRoteirosLigada, parado, pedacos, type BatidaRoteiros } from "@/lib/roteiro/comum";
import { textoTeleprompter, type VersaoRoteiro } from "@/lib/roteiro/escrever";
import type { AnaliseReferencia, Transcricao } from "@/lib/roteiro/referencia";
import { Copiar } from "../../copiar";
import { AutoAtualizar } from "../../editor/atualizar";
import { BotaoGerar } from "../../esteira/botoes";
import { apagarRoteiro, gerarPelaApi, novaVersao, tentarDeNovo } from "../acoes";
import { salvarRoteiroEditado } from "../../esteira/reels-acoes";

export const dynamic = "force-dynamic";

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

export default async function PaginaRoteiro({ params, searchParams }: PageProps<"/roteiros/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: r }, { data: automacoes }, { data: cfg }] = await Promise.all([
    supabase.from("roteiro").select("*, criador:criador_id (usuario, rede)").eq("id", id).maybeSingle(),
    supabase.from("ig_automacao").select("nome, palavras, ativa").eq("ativa", true),
    supabase.from("configuracao").select("valor").eq("chave", "estacao_roteiros").maybeSingle(),
  ]);
  if (!r) notFound();
  const estacao = cfg?.valor as BatidaRoteiros | null;
  const ligada = estacaoDeRoteirosLigada(estacao);
  const naEstacao = r.via !== "api";
  const versoes = (r.versoes ?? []) as VersaoRoteiro[];
  const n = Math.min(Math.max(0, Number(q.v ?? 0) || 0), Math.max(0, versoes.length - 1));
  const v = versoes[n] as VersaoRoteiro | undefined;
  const analise = r.analise as AnaliseReferencia | null;
  const transcricao = r.transcricao as Transcricao | null;
  const andando = !FINAIS_ROTEIRO.includes(r.status);
  const s = STATUS_ROTEIRO[r.status] ?? { nome: r.status, cor: "text-suave" };
  const travado = andando && !["subindo", "aguardando_estacao"].includes(r.status) && parado(r.atualizado_em);
  const automacao = v?.palavra_cta
    ? (automacoes ?? []).find((a) => !(a.palavras ?? []).length || (a.palavras ?? []).some((p: string) => semAcento(p) === semAcento(v.palavra_cta)))
    : null;
  const c = v?.checagem;
  const criador = (Array.isArray(r.criador) ? r.criador[0] : r.criador) as { usuario: string; rede: string } | null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {andando && <AutoAtualizar segundos={4} />}
      <Link href="/roteiros" className="text-xs text-suave hover:text-texto">
        ← Roteiros
      </Link>

      <header className="space-y-1">
        <p className="text-xs text-apagado">
          {criador ? `de @${criador.usuario}` : ORIGEM_ROTEIRO[r.origem]}
          {r.origem === "monitor" && r.link ? (
            <>
              {" "}
              ·{" "}
              <a href={r.link} target="_blank" rel="noreferrer" className="underline">
                ver o post original
              </a>
            </>
          ) : null}
          {r.referencia_id ? (
            <>
              {" "}
              ·{" "}
              <Link href={`/esteira/${r.referencia_id}`} className="underline">
                abrir na esteira
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
            <p className="text-sm">
              {r.status === "erro" ? <span className="text-quente">{r.erro ?? "deu erro"}</span> : <>{r.etapa ?? s.nome}…</>}
            </p>
            <span className={`chip shrink-0 ${s.cor}`}>{s.nome}</span>
          </div>
          {r.status === "aguardando_estacao" ? (
            ligada ? (
              <p className="text-xs text-apagado">
                A estação no teu PC ({estacao?.maquina}) {estacao?.ocupada && estacao.roteiro_id !== r.id ? "está terminando outro roteiro: este é o próximo" : "vai pegar em segundos"}. O
                Claude do teu plano escreve, sem custo de API. Pode sair da página.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-morno">
                  A estação está desligada. Abre o atalho &ldquo;Estacao de edicao (criador)&rdquo; da Área de Trabalho e ela escreve este roteiro sozinha, no teu
                  plano do Claude. O pedido fica guardado na fila até lá.
                </p>
                <form action={gerarPelaApi}>
                  <input type="hidden" name="id" value={r.id} />
                  <BotaoGerar rotulo="Gerar agora pela API (uns US$ 0,15)" gerando="Mandando…" className="btn btn-sm btn-2" />
                </form>
              </div>
            )
          ) : andando && !travado ? (
            <p className="text-xs text-apagado">
              {r.status === "escrevendo" && naEstacao
                ? "A estação no teu PC está escrevendo (uns 2 a 5 minutos): o Claude escreve, a checagem anti-IA confere e, se reprovar, ele reescreve."
                : r.status === "escrevendo"
                  ? "Escrevendo pela API (uns 2 minutos)."
                  : "Ouvindo a referência e tirando o assunto e a estrutura (menos de 1 minuto). Depois a estação no teu PC escreve."}{" "}
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
              A palavra {v.palavra_cta} ainda não tem automação ativa no Instagram: cria em{" "}
              <Link href="/instagram" className="underline">
                Instagram
              </Link>{" "}
              antes de postar, senão ninguém recebe no direct.
            </p>
          )}
          {c?.preencher.length ? (
            <p className="rounded-lg bg-marca-fundo px-3 py-2 text-xs">
              Preenche antes de gravar: {c.preencher.join(" · ")}
            </p>
          ) : null}

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Link href={`/gravar/${r.id}?v=${n}`} className="btn col-span-2 text-center sm:col-span-1">
              Iniciar vídeo
            </Link>
            <Link href={`/teleprompter/${r.id}?v=${n}`} className="btn btn-2 col-span-2 text-center sm:col-span-1">
              Só o teleprompter
            </Link>
            <Copiar texto={textoTeleprompter(v)} rotulo="Copiar texto" className="btn btn-sm btn-2" />
            <Copiar texto={textoTeleprompter(v, true)} rotulo="Copiar com as partes" className="btn btn-sm btn-2" />
          </div>

          <details id="editar" className="card p-4" open={q.editar === "1"}>
            <summary className="rotulo cursor-pointer">Editar o roteiro</summary>
            <form action={salvarRoteiroEditado} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="v" value={n} />
              <input type="hidden" name="volta" value={`/roteiros/${r.id}`} />
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <label className="block">
                  <span className="text-xs text-apagado">Título</span>
                  <input name="titulo" defaultValue={v.titulo} className="campo mt-1" maxLength={120} />
                </label>
                <label className="block">
                  <span className="text-xs text-apagado">Palavra do comenta</span>
                  <input name="palavra" defaultValue={v.palavra_cta} className="campo mt-1 font-mono uppercase" maxLength={40} />
                </label>
              </div>
              {(
                [
                  ["gancho", "Gancho", v.gancho, 3],
                  ["corpo", "Corpo", v.corpo, 8],
                  ["cta", "CTA", v.cta, 3],
                ] as const
              ).map(([nome, rotulo, ls, linhas]) => (
                <label key={nome} className="block">
                  <span className="text-xs text-apagado">{rotulo} (uma ideia por linha, como aparece no teleprompter)</span>
                  <textarea name={nome} rows={Math.max(linhas, ls.length + 1)} defaultValue={ls.join("\n")} className="campo mt-1 text-sm" />
                </label>
              ))}
              <BotaoGerar rotulo="Salvar como versão nova" gerando="Salvando…" className="btn btn-sm" />
              <p className="text-xs text-apagado">A edição vira a versão mais nova (as outras ficam aqui em cima). O gravador e o teleprompter usam ela.</p>
            </form>
          </details>

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
            <summary className="cursor-pointer rotulo">Checagem anti-IA</summary>
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
                {v.modelo.startsWith("claude-code")
                  ? `${v.modelo} · sem custo de API${v.equivalente_api_usd ? ` (na API seria US$ ${v.equivalente_api_usd})` : ""}`
                  : v.modelo.includes("/")
                    ? `${v.modelo.split("/").pop()} pela API · US$ ${v.custo_usd}`
                    : `${v.modelo} · sem IA`}{" "}
                · {dataCurta(v.gerado_em)}
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
          <summary className="cursor-pointer rotulo">A referência: assunto e estrutura</summary>
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
                <summary className="cursor-pointer text-xs text-marca">
                  O que a IA ouviu ({transcricao.fonte}) · o roteiro não usa essas falas
                </summary>
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
          <input name="direcao" defaultValue={r.direcao ?? ""} placeholder="direção: ex. gancho mais polêmico · mais curto · fala pra dono de negócio" className="campo" />
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              name="palavra"
              defaultValue={r.palavra_cta ?? v?.palavra_cta ?? ""}
              placeholder="PALAVRA do comenta"
              className="campo uppercase"
              autoCapitalize="characters"
            />
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
