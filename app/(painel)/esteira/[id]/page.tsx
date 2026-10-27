import Link from "next/link";
import { agendarCarrossel } from "../../agenda/acoes";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dataCurta } from "@/lib/formato";
import type { Analise, Assistido } from "@/lib/instagram/esteira";
import { roteiroEmTexto, type CopiaCarrossel, type Roteiro } from "@/lib/esteira/criacao";
import { Copiar } from "../../copiar";
import { BaixarTodos, BotaoGerar } from "../botoes";
import { SlidesReferencia } from "../slides-referencia";
import { CopiaCLI } from "../copia-cli";
import { EnviarSlides } from "../enviar-slides";
import { referenciasDoCarrossel, estacaoCarrosselLigada, STATUS_ATIVOS, type PedidoCarrossel, type ResultadoCarrossel, type BatidaCarrossel } from "@/lib/carrossel/comum";
import { DURACAO_PADRAO, DURACOES, STATUS_ROTEIRO } from "@/lib/roteiro/comum";
import { roteiroDaEsteira } from "../../roteiros/acoes";
import {
  apagarReferencia,
  buscarVideoAcao,
  copiarCarrosselAcao,
  moverReferencia,
  reanalisar,
  salvarReferencia,
  subirVideoDaReferencia,
} from "../acoes";

export const dynamic = "force-dynamic";

const ETAPAS = [
  ["nova", "Nova"],
  ["analisada", "Analisada"],
  ["vou_gravar", "Vou gravar"],
  ["gravado", "Gravado"],
  ["postado", "Postado"],
  ["descartada", "Descartar"],
] as const;

const campo = "campo";

export default async function PaginaReferencia({ params, searchParams }: PageProps<"/esteira/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: r }, { data: feitosDaqui }, { data: trabalhos }, { data: cfgEstacao }] = await Promise.all([
    supabase.from("referencia").select("*").eq("id", id).maybeSingle(),
    supabase.from("roteiro").select("id, titulo, status, criado_em").eq("referencia_id", id).order("criado_em", { ascending: false }).limit(10),
    supabase.from("carrossel_trabalho").select("*").eq("referencia_id", id).order("criado_em", { ascending: false }).limit(1),
    supabase.from("configuracao").select("valor").eq("chave", "estacao_carrosseis").maybeSingle(),
  ]);
  if (!r) notFound();
  const feitos = feitosDaqui ?? [];
  const a = r.analise as Analise | null;
  const assistido = r.assistido as Assistido | null;
  const roteiros = (r.roteiros ?? []) as Roteiro[];
  const copia = r.copia as CopiaCarrossel | null;
  const copiaCli = r.copia_cli as ResultadoCarrossel | null;
  const trabalho = (trabalhos?.[0] ?? null) as PedidoCarrossel | null;
  const ligada = estacaoCarrosselLigada(cfgEstacao?.valor as BatidaCarrossel | null);
  const produzindo = Boolean(trabalho && STATUS_ATIVOS.includes(trabalho.status));
  const referencias = referenciasDoCarrossel(r);
  const reel = r.tipo === "reel";
  // Carrossel: o material da palavra do CTA (pra lembrar de publicar no dia do post)
  const { data: material } = !reel && r.palavra_cta
    ? await supabase.from("entrega").select("id, slug, publicada").eq("palavra", r.palavra_cta).limit(1).maybeSingle()
    : { data: null };

  // Links assinados (1 h): o arquivo principal e os prints dos slides
  const caminhos = [r.arquivo, ...(r.slides ?? [])].filter((c): c is string => Boolean(c));
  const assinados = new Map<string, string>();
  if (caminhos.length) {
    const { data } = await createAdminClient().storage.from("esteira").createSignedUrls(caminhos, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) assinados.set(s.path, s.signedUrl);
  }
  const url = r.arquivo ? assinados.get(r.arquivo) : undefined;
  const video = r.arquivo_tipo?.includes("video") || r.arquivo?.endsWith(".mp4");

  return (
    <div className="max-w-6xl">
      <Link href={`/esteira?aba=${reel ? "referencias" : "carrosseis"}`} className="text-xs text-suave hover:text-texto">
        ← Esteira · {reel ? "Reels" : "Carrosséis"}
      </Link>
      {q.erro && <p className="mt-3 rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      {!reel && copiaCli && r.etapa !== "postado" && <form action={agendarCarrossel} className="card mt-5 space-y-3 border-frio/40 p-4">
        <h2 className="rotulo text-frio">Revisou? Agende a publicação</h2>
        <input type="hidden" name="referencia_id" value={id} />
        <label className="block text-sm">Dia e horário de Brasília<input name="publicar_em" type="datetime-local" required className="campo mt-1 max-w-xs" /></label>
        <label className="block text-sm">Legenda<textarea name="legenda" maxLength={2200} rows={3} defaultValue={copiaCli.legenda} className="campo mt-1" /></label>
        <p className="text-xs text-suave">O relógio publica nesse horário. Confira os slides, a legenda e o material do CTA antes de agendar.</p>
        <BotaoGerar rotulo="Agendar carrossel" gerando="Preparando slides…" className="btn btn-sm" />
      </form>}

      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── coluna da mídia ── */}
        <div className="space-y-4">
          {url && reel ? (
            video ? (
              <video src={url} controls playsInline className="w-full rounded-xl bg-black" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="w-full rounded-xl" />
            )
          ) : null}

          {reel && (r.aguardando_video || !r.arquivo) ? (
            <div className="card space-y-2 p-3 text-sm">
              <p className="font-bold">Falta o vídeo deste reel</p>
              {r.sem_video_motivo && <p className="text-xs text-morno">Por quê: {r.sem_video_motivo}.</p>}
              <form action={buscarVideoAcao}>
                <input type="hidden" name="id" value={r.id} />
                <BotaoGerar rotulo="Buscar o vídeo de novo" gerando="Buscando…" className="btn btn-sm btn-2 w-full" />
              </form>
              <p className="text-xs text-suave">
                Se não vier: salva o reel no celular e manda o <b>vídeo</b> na DM (em até 1 h ele completa este card), ou sobe aqui:
              </p>
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" className="block text-xs text-marca underline">
                  abrir o reel original
                </a>
              )}
              <form action={subirVideoDaReferencia} className="space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <input type="file" name="arquivo" accept="video/*" required className="w-full text-xs" />
                <BotaoGerar rotulo="Subir o vídeo" gerando="Subindo…" className="btn btn-sm w-full" />
              </form>
            </div>
          ) : null}

          {!reel && (
            <div className="card space-y-2 p-3 text-sm">
              <SlidesReferencia key={referencias.join()} id={id} slides={referencias.map(caminho => ({ caminho, url: assinados.get(caminho) ?? "" }))} />
              <p className="text-xs text-suave">
                {referencias.length < 2 ? "Faltam os slides depois da capa. " : "Confira a ordem e se todos os slides estão aqui. "}
                Adicione as fotos e vídeos que faltam (até 20 no total); os novos entram no fim. Salve mudanças de ordem antes de copiar.
              </p>
              <EnviarSlides id={r.id} />
            </div>
          )}

          {!reel && (
            <div className="card space-y-2 p-3 text-sm">
              <p className="flex items-center gap-2">
                {r.numero != null && <span className="rounded-lg border-2 border-tinta bg-marca px-2 py-0.5 font-mono font-bold text-[#05070e]">#{String(r.numero).padStart(2, "0")}</span>}
                {r.palavra_cta && <span className="chip font-mono font-bold">{r.palavra_cta}</span>}
                <span className="text-xs text-suave">{r.etapa === "postado" ? "postado" : produzindo ? "em produção" : copiaCli ? "pronto pra postar" : "referência"}</span>
              </p>
              {r.palavra_cta && (
                material ? (
                  <p className="text-xs">
                    Material /m/{material.slug}: {material.publicada ? <span className="text-marca">publicado</span> : <span className="text-morno">pronto, falta publicar</span>} ·{" "}
                    <Link href={`/materiais/${material.id}`} className="text-marca underline">abrir</Link>
                  </p>
                ) : <p className="text-xs text-morno">Ainda não tem material com a palavra {r.palavra_cta}.</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <form action={moverReferencia}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="etapa" value={r.etapa === "postado" ? "analisada" : "postado"} />
                  <button className={`btn btn-sm ${r.etapa === "postado" ? "btn-2" : ""}`} disabled={!copiaCli && r.etapa !== "postado"}>
                    {r.etapa === "postado" ? "Desfazer: não foi postado" : "Marcar como postado"}
                  </button>
                </form>
                <form action={moverReferencia}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="etapa" value="descartada" />
                  <button className="rounded-md px-2.5 py-1 text-xs text-apagado hover:text-quente">Descartar</button>
                </form>
              </div>
              {r.etapa !== "postado" && copiaCli && material && !material.publicada && (
                <p className="text-[11px] text-apagado">Ao postar, publique o material: senão quem comentar {r.palavra_cta} recebe a sequência normal da automação.</p>
              )}
            </div>
          )}

          {reel && <div className="flex flex-wrap gap-1.5">
            {ETAPAS.map(([etapa, nome]) => (
              <form key={etapa} action={moverReferencia}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="etapa" value={etapa} />
                <button
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    r.etapa === etapa ? "bg-marca text-[#05070e]" : etapa === "descartada" ? "text-apagado hover:text-quente" : "border border-borda hover:bg-superficie-2"
                  }`}
                >
                  {nome}
                </button>
              </form>
            ))}
          </div>}
          <form action={salvarReferencia} className="card space-y-2 p-3">
            <input type="hidden" name="id" value={r.id} />
            {!reel && <input name="palavra_cta" defaultValue={r.palavra_cta ?? ""} placeholder="palavra do CTA da nossa versão (ex.: SITE)" className={campo} />}
            <input name="autor" defaultValue={r.autor ?? ""} placeholder="@ de quem postou" className={campo} />
            <input name="url" defaultValue={r.url ?? ""} placeholder="link do post" className={campo} />
            <textarea name="notas" rows={4} defaultValue={r.notas ?? ""} placeholder="tuas notas: ideia, adaptação, quando gravar…" className={campo} />
            <button className="btn btn-sm btn-2 w-full">Salvar</button>
          </form>
          {r.metricas && (
            <p className="text-xs text-suave">
              {r.autor ? `@${r.autor} · ` : ""}
              {typeof r.metricas.curtidas === "number" ? `${r.metricas.curtidas.toLocaleString("pt-BR")} curtidas · ` : ""}
              {typeof r.metricas.comentarios === "number" ? `${r.metricas.comentarios.toLocaleString("pt-BR")} comentários` : ""}
              {r.metricas.publicado_em ? ` · postado ${dataCurta(r.metricas.publicado_em)}` : ""}
            </p>
          )}
          <p className="text-xs text-apagado">
            {r.origem === "dm" ? `Veio por DM de ${r.enviado_por}` : "Subido pelo painel"} · {dataCurta(r.criado_em)}
          </p>
          <div className="flex gap-3 text-xs">
            {r.arquivo && (
              <form action={reanalisar}>
                <input type="hidden" name="id" value={r.id} />
                <button className="text-marca underline">Analisar de novo</button>
              </form>
            )}
            <form action={apagarReferencia}>
              <input type="hidden" name="id" value={r.id} />
              <button className="text-apagado hover:text-quente">Apagar</button>
            </form>
          </div>
        </div>

        {/* ── análise e criação ── */}
        <div className="space-y-8">
          {!a ? (
            <div className="card p-4 text-sm text-suave">
              {r.aguardando_video ? (
                <p>Assim que o vídeo chegar, a IA assiste e ouve o reel inteiro e desmonta.</p>
              ) : r.erro ? (
                <p className="text-quente">{r.erro}</p>
              ) : (
                <p>A IA está {reel ? "assistindo e ouvindo" : "lendo"} (leva menos de um minuto).</p>
              )}
              {r.legenda && <p className="mt-3 text-xs">Legenda: {r.legenda}</p>}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-xs text-apagado">
                  {a.tema} · {a.formato}
                  {a.duracao_seg ? ` · ${a.duracao_seg}s` : ""}
                  {!reel && a.quantidade_slides ? ` · ${a.quantidade_slides} slides` : ""}
                </p>
                <h1 className="mt-1 text-xl font-semibold">{a.resumo}</h1>
              </div>

              <section className="rounded-xl border border-marca/40 bg-marca-fundo p-4">
                <h2 className="text-xs font-bold text-marca">
                  {reel ? "GANCHO" : "CAPA"} · {a.gancho?.tipo}
                </h2>
                <p className="mt-2 text-lg">“{a.gancho?.texto_ou_fala}”</p>
                <p className="mt-2 text-sm text-suave">{a.gancho?.o_que_acontece}</p>
                <p className="mt-2 text-sm">
                  <span className="text-apagado">Por que prende:</span> {a.gancho?.por_que_prende}
                </p>
              </section>

              <section>
                <h2 className="mb-2 rotulo">POR QUE ENGAJOU</h2>
                <ul className="space-y-1.5 text-sm">
                  {(a.por_que_engajou ?? []).map((m) => (
                    <li key={m} className="flex gap-2">
                      <span className="text-marca">→</span>
                      {m}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(a.gatilhos ?? []).map((g) => (
                    <span key={g} className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs text-suave">{g}</span>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-2 rotulo">ESTRUTURA</h2>
                <ol className="overflow-hidden rounded-xl border border-borda">
                  {(a.estrutura ?? []).map((e, i) => (
                    <li key={i} className="flex gap-3 border-b border-borda bg-superficie px-3 py-2 text-sm last:border-b-0">
                      <span className="w-16 shrink-0 font-mono text-xs text-apagado">{e.trecho}</span>
                      <span>{e.o_que_acontece}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <div className="card p-3 text-sm">
                  <h2 className="rotulo">ESQUELETO DO FORMATO</h2>
                  <p className="mt-1">{a.esqueleto_do_formato}</p>
                </div>
                <div className="card p-3 text-sm">
                  {reel ? (
                    <>
                      <h2 className="rotulo">ÁUDIO · CTA</h2>
                      <p className="mt-1">{a.audio}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="rotulo">VISUAL</h2>
                      {a.estilo && (
                        <div className="mt-2 flex items-center gap-2">
                          {[a.estilo.fundo, a.estilo.texto, a.estilo.destaque].map((c) => (
                            <span key={c} title={c} className="h-6 w-6 rounded-md border-2 border-tinta" style={{ background: c }} />
                          ))}
                          <span className="text-xs text-apagado">título {a.estilo.fonte_titulo}{a.estilo.caixa_alta ? " · caixa alta" : ""}</span>
                        </div>
                      )}
                      <p className="mt-1 text-suave">{a.estilo?.descricao}</p>
                    </>
                  )}
                  {a.cta && <p className="mt-1 text-suave">CTA: {a.cta}</p>}
                </div>
              </section>

              {reel && assistido ? (
                <details className="card p-3 text-sm" open>
                  <summary className="cursor-pointer rotulo">O QUE A IA VIU E OUVIU · {assistido.fala.length} trechos de fala · {assistido.cenas.length} cenas</summary>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-1 text-xs font-bold text-apagado">FALA (palavra por palavra)</h3>
                      <ol className="space-y-1">
                        {assistido.fala.map((f, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="w-11 shrink-0 font-mono text-xs text-apagado">{f.t}</span>
                            <span>{f.texto}</span>
                          </li>
                        ))}
                        {!assistido.fala.length && <li className="text-apagado">sem fala</li>}
                      </ol>
                    </div>
                    <div>
                      <h3 className="mb-1 text-xs font-bold text-apagado">CENAS</h3>
                      <ol className="space-y-1.5">
                        {assistido.cenas.map((c, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="w-11 shrink-0 font-mono text-xs text-apagado">{c.t}</span>
                            <span>
                              {c.o_que_aparece}
                              {c.texto_na_tela ? <span className="block text-xs text-marca">na tela: {c.texto_na_tela}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ol>
                      {assistido.audio && <p className="mt-2 text-xs text-suave">Áudio: {assistido.audio}</p>}
                    </div>
                  </div>
                </details>
              ) : null}

              {!reel && (a.slides_ref ?? []).length > 0 ? (
                <details className="card p-3 text-sm">
                  <summary className="cursor-pointer rotulo">O QUE A IA LEU NOS SLIDES · {(a.slides_ref ?? []).length}</summary>
                  <ol className="mt-2 space-y-1.5">
                    {(a.slides_ref ?? []).map((s) => (
                      <li key={s.n} className="flex gap-2">
                        <span className="w-8 shrink-0 font-mono text-xs text-apagado">{s.n}</span>
                        <span>
                          {s.texto}
                          <span className="block text-xs text-apagado">{s.visual}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </div>
          )}

          {/* ── roteiro (reel) ── */}
          {reel && a ? (
            <section id="roteiro" className="card space-y-4 p-4">
              <div>
                <h2 className="font-display text-lg uppercase tracking-wide">Roteiro pro teleprompter</h2>
                <p className="text-xs text-suave">
                  O assunto e a estrutura dessa referência num roteiro teu, no padrão viral, sem as falas do outro criador e com a checagem anti-IA. Número
                  que não dá pra provar vem [entre colchetes] pra você preencher.
                </p>
              </div>
              <form action={roteiroDaEsteira} className="space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <textarea
                  name="pedido"
                  rows={2}
                  placeholder="direção (opcional): ex. fala de Claude Code pra quem nunca programou · puxa pra comunidade · mais curto"
                  className={campo}
                />
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <input name="palavra" placeholder="PALAVRA do comenta (opcional)" className={`${campo} uppercase`} autoCapitalize="characters" />
                  <select name="duracao" defaultValue={String(DURACAO_PADRAO)} className={campo}>
                    {DURACOES.map((d) => (
                      <option key={d.valor} value={d.valor}>
                        {d.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <BotaoGerar rotulo="Criar roteiro" gerando="Mandando…" />
              </form>
              {feitos.length ? (
                <ul className="space-y-1.5">
                  {feitos.map((f) => (
                    <li key={f.id}>
                      <Link href={`/roteiros/${f.id}`} className="flex items-center justify-between gap-2 rounded-xl border-2 border-linha px-3 py-2 text-sm hover:border-marca">
                        <span className="truncate font-bold">{f.titulo || "roteiro"}</span>
                        <span className="shrink-0 text-xs text-apagado">{f.status === "pronto" ? dataCurta(f.criado_em) : (STATUS_ROTEIRO[f.status]?.nome ?? f.status)} →</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {roteiros.length ? <p className="pt-2 text-xs font-bold text-apagado">ROTEIROS ANTIGOS (antes do teleprompter)</p> : null}
              {roteiros.map((rt) => (
                <details key={rt.gerado_em} className="rounded-xl border-2 border-linha p-3">
                  <summary className="cursor-pointer text-sm font-bold">
                    {rt.titulo} <span className="font-normal text-apagado">· {rt.tipo} · ~{rt.duracao_seg ?? "?"}s · comenta {rt.palavra_cta} · {dataCurta(rt.gerado_em)}</span>
                  </summary>
                  <div className="mt-3 space-y-3 text-sm">
                    <div className="rounded-lg border border-marca/40 bg-marca-fundo p-3">
                      <p className="text-xs font-bold text-marca">GANCHO</p>
                      <p className="mt-1 text-base">{rt.gancho.fala}</p>
                      {rt.gancho.na_tela && <p className="mt-1 text-xs">na tela: {rt.gancho.na_tela}</p>}
                      {rt.gancho.visual && <p className="text-xs text-suave">visual: {rt.gancho.visual}</p>}
                    </div>
                    <ol className="overflow-hidden rounded-xl border border-borda">
                      {rt.blocos.map((b, j) => (
                        <li key={j} className="flex gap-3 border-b border-borda bg-superficie px-3 py-2 last:border-b-0">
                          <span className="w-14 shrink-0 font-mono text-xs text-apagado">{b.tempo}</span>
                          <span>
                            {b.fala}
                            {b.na_tela && <span className="block text-xs text-marca">na tela: {b.na_tela}</span>}
                            {b.visual && <span className="block text-xs text-apagado">visual: {b.visual}</span>}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="rounded-lg bg-superficie-2 p-3">
                      <p className="text-xs font-bold text-apagado">LEGENDA</p>
                      <p className="mt-1 whitespace-pre-wrap">{rt.legenda}</p>
                    </div>
                    {rt.gancho_continuidade && <p className="text-xs text-suave">Continuidade: {rt.gancho_continuidade}</p>}
                    <p className="text-xs text-apagado">
                      Da referência: {rt.de_onde_veio}
                      {rt.pedido ? ` · direção: ${rt.pedido}` : ""} · {rt.modelo.split("/").pop()} · US$ {rt.custo_usd}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Copiar texto={roteiroEmTexto(rt)} rotulo="Copiar roteiro" />
                      <Copiar texto={rt.legenda} rotulo="Copiar legenda" className="btn btn-sm btn-2" />
                    </div>
                  </div>
                </details>
              ))}
            </section>
          ) : null}

          {/* ── cópia do carrossel ── */}
          {!reel ? (
            <section id="copia" className="card space-y-4 p-4">
              <div>
                <h2 className="font-display text-lg uppercase tracking-wide">Copiar carrossel</h2>
                <p className="text-xs text-suave">
                  Todos os slides em PT-BR, mantendo a mensagem, as cores, fotos e composição da referência. Troque a headline da capa abaixo.
                  Sua foto e seu perfil entram em todas as artes (PNG 1080×1350). Slide em vídeo na referência sai em MP4: a parte estática traduzida e o motion do original.
                </p>
              </div>
              <p className="text-xs text-suave">{ligada ? "Estação de carrosséis ligada no PC." : "Abra a estação no PC para produzir. O pedido fica salvo na fila."} A estação do editor de vídeo também abre a produção de carrosséis.</p>
              {!ligada && <Copiar texto="npm run carrossel:estacao" rotulo="Copiar comando para abrir a estação" className="btn btn-sm btn-2" />}
              <form action={copiarCarrosselAcao} className="space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <label className="block text-xs font-bold">Quantidade de slides do original (incluindo a capa)<input name="total_esperado" type="number" min={2} max={20} required defaultValue={a?.quantidade_slides && a.quantidade_slides >= 2 ? Math.min(20, a.quantidade_slides) : Math.max(2, referencias.length)} className={`${campo} mt-1 max-w-32`} /></label>
                <label className="block text-xs font-bold">Headline da capa (opcional)<textarea name="headline" rows={2} maxLength={500} defaultValue={trabalho?.headline ?? ""} placeholder="Sem preencher: traduz a headline original para PT-BR." className={`${campo} mt-1`} /></label>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-bold">Quem produz<select name="agente" defaultValue={trabalho?.agente ?? "codex"} className={`${campo} mt-1`}><option value="codex">Codex CLI</option><option value="claude">Claude Code</option></select></label>
                  <label className="text-xs font-bold">Slides a partir do segundo<select name="modo_texto" defaultValue={trabalho?.modo_texto ?? "reformular"} className={`${campo} mt-1`}><option value="reformular">Reescrever com outras palavras, mesma mensagem (como a headline)</option><option value="traduzir">Traduzir fielmente para PT-BR</option></select></label>
                </div>
                <textarea
                  name="pedido"
                  rows={2}
                  placeholder="Ajustes visuais opcionais: ex. marca no canto superior · manter a cor laranja da referência."
                  className={campo}
                />
                <BotaoGerar rotulo={produzindo ? "Carrossel na fila / em produção" : copiaCli ? "Criar outra cópia pelo CLI" : "Copiar carrossel pelo CLI"} gerando="Enviando para a estação…" disabled={produzindo || referencias.length < 2} />
                {referencias.length < 2 && <p className="text-xs text-morno">Envie os outros slides para copiar o carrossel completo.</p>}
              </form>
              <CopiaCLI id={id} trabalho={trabalho} resultado={copiaCli} ligada={ligada} />

              {copia && !copiaCli ? (
                <div className="space-y-3">
                  <p className="text-sm font-bold">
                    {copia.titulo} <span className="font-normal text-apagado">· {copia.slides.length} slides · comenta {copia.palavra_cta} · {dataCurta(copia.gerado_em)}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {copia.slides.map((_, i) => {
                      const src = `/esteira/${r.id}/slide/${i + 1}?v=${encodeURIComponent(copia.gerado_em)}`;
                      return (
                        <a key={i} href={src} download={`carrossel-${String(i + 1).padStart(2, "0")}.png`} className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`slide ${i + 1}`} loading="lazy" className="aspect-[4/5] w-full rounded-lg border-2 border-tinta object-cover" />
                        </a>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <BaixarTodos
                      arquivos={copia.slides.map((_, i) => ({
                        url: `/esteira/${r.id}/slide/${i + 1}?v=${encodeURIComponent(copia.gerado_em)}`,
                        nome: `carrossel-${String(i + 1).padStart(2, "0")}.png`,
                      }))}
                    />
                    <Copiar texto={copia.legenda} rotulo="Copiar legenda" className="btn btn-sm btn-2" />
                  </div>
                  <div className="rounded-lg bg-superficie-2 p-3 text-sm">
                    <p className="text-xs font-bold text-apagado">LEGENDA</p>
                    <p className="mt-1 whitespace-pre-wrap">{copia.legenda}</p>
                  </div>
                  <p className="text-xs text-apagado">
                    Da referência: {copia.de_onde_veio}
                    {copia.pedido ? ` · direção: ${copia.pedido}` : ""} · {copia.modelo.split("/").pop()} · US$ {copia.custo_usd}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
