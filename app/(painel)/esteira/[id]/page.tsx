import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dataCurta, haQuanto } from "@/lib/formato";
import { lerPerfil } from "@/lib/config";
import type { Analise, Assistido } from "@/lib/esteira/referencia";
import { roteiroEmTexto, type CopiaCarrossel, type Roteiro } from "@/lib/esteira/criacao";
import { Copiar } from "../../copiar";
import { AutoAtualizar } from "../../editor/atualizar";
import { BaixarTodos, BotaoGerar } from "../botoes";
import { CompletarArquivo } from "../enviar";
import { ETAPAS, ehVideo, estadoDaAnalise } from "../regras";
import { apagarReferencia, buscarDeNovoAcao, copiarCarrosselAcao, criarRoteiro, moverReferencia, reanalisar, salvarReferencia } from "../acoes";

export const dynamic = "force-dynamic";
// Roteiro, cópia de carrossel e "buscar de novo" rodam nas ações desta página (a análise, depois da resposta)
export const maxDuration = 300;

export default async function PaginaReferencia({ params, searchParams }: PageProps<"/esteira/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: r }, { data: cfgPersona }, perfil] = await Promise.all([
    supabase.from("referencia").select("*").eq("id", id).maybeSingle(),
    supabase.from("configuracao").select("valor").eq("chave", "persona").maybeSingle(),
    lerPerfil(),
  ]);
  if (!r) notFound();
  const a = r.analise as Analise | null;
  const assistido = r.assistido as Assistido | null;
  const roteiros = (r.roteiros ?? []) as Roteiro[];
  const copia = r.copia as CopiaCarrossel | null;
  const reel = r.tipo === "reel";
  const estado = estadoDaAnalise(r);
  const temPersona = Boolean((cfgPersona?.valor as { guia?: string } | null)?.guia?.trim());

  // Links assinados (1 h): o arquivo principal e os prints dos slides
  const caminhos = [r.arquivo, ...(r.slides ?? [])].filter((c): c is string => Boolean(c));
  const assinados = new Map<string, string>();
  if (caminhos.length) {
    const { data } = await createAdminClient().storage.from("esteira").createSignedUrls(caminhos, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) assinados.set(s.path, s.signedUrl);
  }
  const url = r.arquivo ? assinados.get(r.arquivo) : undefined;
  const video = ehVideo(r);
  const falta = reel ? "o vídeo deste reel" : r.tipo === "carrossel" ? "os prints deste carrossel" : "o arquivo deste post";

  return (
    <div className="max-w-6xl">
      {estado === "analisando" && <AutoAtualizar segundos={8} />}
      <Link href={`/esteira?aba=${reel ? "reels" : "carrosseis"}`} className="text-xs text-suave hover:text-texto">
        ← Esteira · {reel ? "Reels" : "Carrosséis"}
      </Link>
      {q.erro && <p className="mt-3 rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ── coluna da mídia ── */}
        <div className="space-y-4">
          {url ? (
            video ? (
              <video src={url} controls playsInline className="w-full rounded-xl bg-black" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="w-full rounded-xl" />
            )
          ) : null}

          {estado === "aguardando" ? (
            <div className="card space-y-3 border-morno/60 p-3 text-sm">
              <p className="font-bold">Falta {falta}</p>
              {r.sem_video_motivo && <p className="text-xs text-morno">Por quê: {r.sem_video_motivo}.</p>}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer" className="block text-xs text-marca underline">
                  abrir o post original
                </a>
              )}
              <p className="text-xs text-suave">
                {reel ? "Salva o reel no celular (ou grava a tela) e sobe aqui:" : "Tira print de cada slide e sobe aqui, a capa primeiro:"}
              </p>
              <CompletarArquivo id={r.id} aceita={reel ? "video" : r.tipo === "carrossel" ? "prints" : "ambos"} temImagens={Boolean(r.arquivo) && !video} />
              {r.url && (
                <form action={buscarDeNovoAcao} className="space-y-1 border-t-2 border-linha pt-3">
                  <input type="hidden" name="id" value={r.id} />
                  <BotaoGerar rotulo="Buscar de novo pelo link" gerando="Buscando…" className="btn btn-sm btn-2 w-full" />
                  <p className="text-xs text-apagado">Vale depois de conectar o Facebook (Conexões) ou se a Meta falhou na hora.</p>
                </form>
              )}
            </div>
          ) : !reel ? (
            <div className="card space-y-2 p-3 text-sm">
              {(r.slides ?? []).length > 0 && (
                <div className="grid grid-cols-3 gap-1.5">
                  {(r.slides as string[]).map((s, i) => {
                    const u = assinados.get(s);
                    return u ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={s} src={u} alt={`slide ${i + 2}`} className="aspect-[4/5] w-full rounded-md object-cover" />
                    ) : null;
                  })}
                </div>
              )}
              <p className="text-xs text-suave">
                {(r.slides ?? []).length ? `Capa + ${(r.slides ?? []).length} slides.` : "Só a capa."} Pra cópia ficar fiel, a IA precisa ver todos os slides.
              </p>
              <details>
                <summary className="cursor-pointer text-xs text-marca">Subir prints dos slides</summary>
                <div className="mt-2">
                  <CompletarArquivo id={r.id} aceita="prints" temImagens={Boolean(r.arquivo)} />
                </div>
              </details>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {ETAPAS.map(({ etapa, nome }) => (
              <form key={etapa} action={moverReferencia}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="etapa" value={etapa} />
                <button
                  className={`rounded-md px-2.5 py-1 text-xs ${
                    r.etapa === etapa ? "bg-marca text-[#05070e]" : etapa === "descartada" ? "text-apagado hover:text-quente" : "border border-borda hover:bg-superficie-2"
                  }`}
                >
                  {etapa === "descartada" && r.etapa !== etapa ? "Descartar" : nome}
                </button>
              </form>
            ))}
          </div>
          <form action={salvarReferencia} className="card space-y-2 p-3">
            <input type="hidden" name="id" value={r.id} />
            <input name="autor" defaultValue={r.autor ?? ""} placeholder="@ de quem postou" className="campo" />
            <input name="url" defaultValue={r.url ?? ""} placeholder="link do post" className="campo" />
            <textarea name="notas" rows={4} defaultValue={r.notas ?? ""} placeholder="suas notas: ideia, adaptação, quando gravar…" className="campo" />
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
            {r.origem === "link" ? "Veio pelo link" : "Subido pelo painel"} · {dataCurta(r.criado_em)}
          </p>
          <div className="flex gap-3 text-xs">
            {r.arquivo && estado !== "analisando" && estado !== "aguardando" && (
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
            <div className="card space-y-2 p-4 text-sm text-suave">
              {estado === "aguardando" ? (
                <p>Assim que o arquivo chegar, a IA {reel ? "assiste e ouve o reel inteiro" : "lê os slides"} e desmonta.</p>
              ) : estado === "erro" ? (
                <p className="text-quente">{r.erro}</p>
              ) : estado === "travada" ? (
                <p className="text-quente">A análise começou {haQuanto(r.atualizado_em)} e não terminou. Manda analisar de novo.</p>
              ) : (
                <p>
                  A IA está {reel ? "assistindo e ouvindo o reel" : "lendo os slides"} (1 a 3 min). A página se atualiza sozinha; pode sair e voltar depois.
                </p>
              )}
              {(estado === "erro" || estado === "travada") && (
                <form action={reanalisar}>
                  <input type="hidden" name="id" value={r.id} />
                  <BotaoGerar rotulo="Analisar de novo" gerando="Mandando…" className="btn btn-sm" />
                </form>
              )}
              {r.legenda && <p className="pt-1 text-xs">Legenda: {r.legenda}</p>}
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
                <h2 className="mb-2 rotulo">Por que engajou</h2>
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
                    <span key={g} className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs text-suave">
                      {g}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-2 rotulo">Estrutura</h2>
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
                  <h2 className="rotulo">Esqueleto do formato</h2>
                  <p className="mt-1">{a.esqueleto_do_formato}</p>
                </div>
                <div className="card p-3 text-sm">
                  {reel ? (
                    <>
                      <h2 className="rotulo">Áudio · CTA</h2>
                      <p className="mt-1">{a.audio}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="rotulo">Visual</h2>
                      {a.estilo && (
                        <div className="mt-2 flex items-center gap-2">
                          {[a.estilo.fundo, a.estilo.texto, a.estilo.destaque].map((c, i) => (
                            <span key={`${c}-${i}`} title={c} className="h-6 w-6 rounded-md border-2 border-tinta" style={{ background: c }} />
                          ))}
                          <span className="text-xs text-apagado">
                            título {a.estilo.fonte_titulo}
                            {a.estilo.caixa_alta ? " · caixa alta" : ""}
                          </span>
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
                  <summary className="cursor-pointer rotulo">
                    O que a IA viu e ouviu · {assistido.fala.length} trechos de fala · {assistido.cenas.length} cenas
                  </summary>
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
                  <summary className="cursor-pointer rotulo">O que a IA leu nos slides · {(a.slides_ref ?? []).length}</summary>
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

          {!temPersona && a ? (
            <p className="rounded-lg border-2 border-linha px-3 py-2 text-xs text-suave">
              Você ainda não tem persona: o texto sai numa voz genérica.{" "}
              <Link href="/esteira#persona" className="text-marca underline">
                Gera a sua
              </Link>{" "}
              pra soar como você.
            </p>
          ) : null}

          {/* ── roteiro (reel) ── */}
          {reel && a ? (
            <section id="roteiro" className="card space-y-4 p-4">
              <div>
                <h2 className="font-display text-lg uppercase tracking-wide">Seu roteiro</h2>
                <p className="text-xs text-suave">
                  O formato e o mecanismo dessa referência, com o seu assunto, na sua voz (Minha persona). Número que não dá pra provar vem [entre colchetes]
                  pra você preencher.
                </p>
              </div>
              <form action={criarRoteiro} className="space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <textarea name="pedido" rows={2} placeholder="direção (opcional): ex. fala pra quem está começando · puxa pro meu produto · mais curto" className="campo" />
                <BotaoGerar rotulo={roteiros.length ? "Criar outra versão" : "Criar roteiro"} gerando="Escrevendo… (uns 30 s)" />
              </form>
              {roteiros.map((rt, i) => (
                <details key={rt.gerado_em} open={i === 0} className="rounded-xl border-2 border-linha p-3">
                  <summary className="cursor-pointer text-sm font-bold">
                    {rt.titulo}{" "}
                    <span className="font-normal text-apagado">
                      · {rt.tipo} · ~{rt.duracao_seg ?? "?"}s · comenta {rt.palavra_cta} · {dataCurta(rt.gerado_em)}
                    </span>
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
                      <Link href={`/editor/nova?roteiro=${r.id}&r=${i}`} className="btn btn-sm btn-2">
                        Gravar e editar →
                      </Link>
                    </div>
                  </div>
                </details>
              ))}
            </section>
          ) : null}

          {/* ── cópia do carrossel ── */}
          {!reel && a ? (
            <section id="copia" className="card space-y-4 p-4">
              <div>
                <h2 className="font-display text-lg uppercase tracking-wide">Copiar carrossel</h2>
                <p className="text-xs text-suave">
                  A sua versão: mesmo formato e progressão da referência, com o seu conteúdo e a sua voz. Sai pronto em PNG (1080x1350) com a sua foto e o
                  seu @, mais a legenda.
                </p>
              </div>
              <form action={copiarCarrosselAcao} className="space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="visual" value="referencia" defaultChecked={copia?.visual !== "marca"} /> Igual à referência
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="visual" value="marca" defaultChecked={copia?.visual === "marca"} /> Minha marca
                    <span className="flex gap-1">
                      {[perfil.cores.fundo, perfil.cores.texto, perfil.cores.destaque].map((c, i) => (
                        <span key={`${c}-${i}`} title={c} className="h-4 w-4 rounded border-2 border-tinta" style={{ background: c }} />
                      ))}
                    </span>
                  </label>
                </div>
                <p className="text-xs text-apagado">
                  As cores da sua marca ficam no{" "}
                  <Link href="/perfil" className="underline">
                    Perfil
                  </Link>
                  .
                </p>
                <textarea name="pedido" rows={2} placeholder="direção (opcional): ex. troca o assunto por [tema] · CTA comenta LISTA" className="campo" />
                <BotaoGerar rotulo={copia ? "Gerar outra cópia" : "Copiar carrossel"} gerando="Escrevendo… (uns 30 s)" />
              </form>

              {copia ? (
                <div className="space-y-3">
                  <p className="text-sm font-bold">
                    {copia.titulo}{" "}
                    <span className="font-normal text-apagado">
                      · {copia.slides.length} slides · comenta {copia.palavra_cta} · {dataCurta(copia.gerado_em)}
                    </span>
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
