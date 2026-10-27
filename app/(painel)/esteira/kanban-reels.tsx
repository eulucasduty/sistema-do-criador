import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { haQuanto } from "@/lib/formato";
import { STATUS_EDICAO } from "@/lib/editor";
import { palavraNormal } from "@/lib/entregas/blocos";
import { legendaDoReel } from "@/lib/postagem/legenda-carrossel";
import { ETAPAS_REELS, etapaDaEdicao, type EtapaReel } from "@/lib/reels";
import type { VersaoRoteiro } from "@/lib/roteiro/escrever";
import { BotaoGerar } from "./botoes";
import { aprovarReel, arquivarRoteiro, colarRoteiro, desagendarReel, reagendarReel } from "./reels-acoes";

// A esteira de reels (pedido do Duty, 19/10), em 6 colunas tiradas do andamento:
//   Roteiros (prontos, ainda não gravados) → Pra editar (gravado, escolher o estilo) → Editando
//   (estação) → Review (pronto, falta aprovar) → Postagem (aprovado, na agenda) → Postados.
// Um card por roteiro gravado: vale a edição mais nova dele (o ajuste vira a versão seguinte).

const ESTEIRA = "/esteira?aba=reels";
const MAX_ROTEIROS = 40;

type Edicao = { id: string; roteiro_id: string; titulo: string; status: string; versao: number; aprovada_em: string | null; etapa: string | null; erro: string | null; cta_palavra: string | null; resultado: { caminho?: string } | null; video: { takes?: unknown[] } | null; criado_em: string };
type Postagem = { id: string; edicao_id: string; status: string; legenda: string | null; palavra: string | null; publicar_em: string | null; publicado_em: string | null; permalink: string | null; erro: string | null; etapa: string | null };

const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
/** O valor do campo datetime-local no horário de Brasília. */
const campoHora = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16);

export async function KanbanReels() {
  const supabase = await createClient();
  const [{ data: roteiros }, { data: edicoes }, { data: criadores }] = await Promise.all([
    supabase
      .from("roteiro")
      .select("id, titulo, status, versoes, palavra_cta, origem, criador_id, criado_em")
      .eq("status", "pronto")
      .is("arquivado_em", null)
      .order("criado_em", { ascending: false })
      .limit(300),
    supabase
      .from("edicao")
      .select("id, roteiro_id, titulo, status, versao, aprovada_em, etapa, erro, cta_palavra, resultado, video, criado_em")
      .not("roteiro_id", "is", null)
      .neq("status", "cancelada")
      .order("criado_em", { ascending: false })
      .limit(500),
    supabase.from("criador").select("id, usuario"),
  ]);
  const { count: escrevendo } = await supabase.from("roteiro").select("id", { count: "exact", head: true }).in("status", ["na_fila", "transcrevendo", "aguardando_estacao", "escrevendo"]).is("arquivado_em", null);

  // a edição mais nova de cada roteiro gravado
  const atual = new Map<string, Edicao>();
  for (const e of (edicoes ?? []) as Edicao[]) if (!atual.has(e.roteiro_id)) atual.set(e.roteiro_id, e);
  const ids = [...atual.values()].map((e) => e.id);
  const { data: posts } = ids.length ? await supabase.from("postagem").select("id, edicao_id, status, legenda, palavra, publicar_em, publicado_em, permalink, erro, etapa").in("edicao_id", ids) : { data: [] };
  const postDe = new Map<string, Postagem>(((posts ?? []) as Postagem[]).map((p) => [p.edicao_id, p]));
  const { data: entregas } = await supabase.from("entrega").select("id, palavra, publicada, status").not("palavra", "is", null).limit(500);
  const entregaDe = (palavra: string | null) => (palavra ? (entregas ?? []).find((x) => palavraNormal(x.palavra) === palavraNormal(palavra)) : undefined);
  const arroba = new Map((criadores ?? []).map((c) => [c.id, c.usuario]));

  // vídeo pronto (Review): link assinado pra ver no card
  const prontos = [...atual.values()].filter((e) => e.status === "pronto" && !e.aprovada_em && e.resultado?.caminho);
  const assinados = new Map<string, string>();
  if (prontos.length) {
    const { data } = await createAdminClient()
      .storage.from("edicao")
      .createSignedUrls(
        prontos.map((e) => e.resultado!.caminho!),
        3600,
      );
    for (const s of data ?? []) if (s.path && s.signedUrl) assinados.set(s.path, s.signedUrl);
  }

  const gravados = new Set(atual.keys());
  const paraGravar = (roteiros ?? []).filter((r) => !gravados.has(r.id));
  const porEtapa = new Map<EtapaReel, Edicao[]>(ETAPAS_REELS.map((c) => [c.id, []]));
  for (const e of atual.values()) porEtapa.get(etapaDaEdicao(e, postDe.get(e.id) ?? null))!.push(e);
  // Postagem: na ordem da agenda; Postados: o mais recente primeiro
  porEtapa.get("postagem")!.sort((a, b) => (postDe.get(a.id)?.publicar_em ?? "9").localeCompare(postDe.get(b.id)?.publicar_em ?? "9"));
  porEtapa.get("postados")!.sort((a, b) => (postDe.get(b.id)?.publicado_em ?? "").localeCompare(postDe.get(a.id)?.publicado_em ?? ""));

  const vazio = <li className="rounded-xl border border-dashed border-borda p-4 text-center text-xs text-apagado">vazio</li>;

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ETAPAS_REELS.map((col) => {
        const n = col.id === "roteiros" ? paraGravar.length : porEtapa.get(col.id)!.length;
        return (
          <section key={col.id} className="w-72 shrink-0">
            <h2 className="mb-0.5 flex items-baseline justify-between rotulo">
              {col.nome} <span className="text-xs text-apagado">{n}</span>
            </h2>
            <p className="mb-2 text-[11px] text-apagado">
              {col.dica}
              {col.id === "roteiros" && escrevendo ? ` · ${escrevendo} sendo escritos` : ""}
            </p>
            <ul className="space-y-2">
              {col.id === "roteiros" && (
                <li>
                  <details className="card p-3 text-sm">
                    <summary className="cursor-pointer font-bold text-marca">+ Colar roteiro</summary>
                    <form action={colarRoteiro} className="mt-2 space-y-2">
                      <input name="titulo" placeholder="título (opcional)" maxLength={120} className="campo w-full py-1.5 text-xs" />
                      <input name="palavra" placeholder="palavra do comenta (opcional)" maxLength={40} className="campo w-full py-1.5 font-mono text-xs uppercase" />
                      <textarea
                        name="texto"
                        required
                        rows={8}
                        placeholder={"cola o roteiro aqui\n\ndá pra separar com GANCHO, CORPO e CTA (cada um numa linha); sem isso, a 1ª frase vira o gancho e o fim que pede o comenta vira o CTA"}
                        className="campo w-full text-xs"
                      />
                      <BotaoGerar rotulo="Pôr na esteira" gerando="Salvando…" className="btn btn-sm w-full" />
                    </form>
                  </details>
                </li>
              )}
              {col.id === "roteiros" &&
                (paraGravar.length
                  ? paraGravar.slice(0, MAX_ROTEIROS).map((r) => {
                      const v = ((r.versoes ?? []) as VersaoRoteiro[])[0];
                      return (
                        <li key={r.id} className="card space-y-2 p-3 text-sm">
                          <Link href={`/roteiros/${r.id}`} className="block font-bold leading-snug hover:underline">
                            {r.titulo || v?.titulo || "roteiro"}
                          </Link>
                          {v?.gancho?.[0] && <p className="line-clamp-3 text-xs text-suave">“{v.gancho[0]}”</p>}
                          <div className="flex flex-wrap gap-1">
                            {(v?.palavra_cta || r.palavra_cta) && <span className="chip font-mono font-bold">{v?.palavra_cta || r.palavra_cta}</span>}
                            {v?.checagem?.segundos ? <span className="chip">~{v.checagem.segundos} s</span> : null}
                            {r.criador_id && arroba.get(r.criador_id) && <span className="chip">ref. @{arroba.get(r.criador_id)}</span>}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <Link href={`/gravar/${r.id}`} className="btn btn-sm">
                              Iniciar vídeo
                            </Link>
                            <Link href={`/roteiros/${r.id}#editar`} className="btn btn-sm btn-2">
                              Editar
                            </Link>
                            <form action={arquivarRoteiro}>
                              <input type="hidden" name="id" value={r.id} />
                              <input type="hidden" name="volta" value={ESTEIRA} />
                              <button className="btn btn-sm btn-2" title="Tira da esteira (continua em Roteiros)">
                                Tirar
                              </button>
                            </form>
                          </div>
                          <p className="text-[11px] text-apagado">{haQuanto(r.criado_em)}</p>
                        </li>
                      );
                    })
                  : vazio)}
              {col.id === "roteiros" && paraGravar.length > MAX_ROTEIROS && (
                <li className="text-center text-xs">
                  <Link href="/roteiros?de=prontos" className="text-marca">
                    + {paraGravar.length - MAX_ROTEIROS} em Roteiros
                  </Link>
                </li>
              )}

              {col.id !== "roteiros" &&
                (porEtapa.get(col.id)!.length
                  ? porEtapa.get(col.id)!.map((e) => {
                      const p = postDe.get(e.id) ?? null;
                      const palavra = p?.palavra ?? e.cta_palavra;
                      const entrega = entregaDe(palavra);
                      const st = STATUS_EDICAO[e.status] ?? { nome: e.status, cor: "text-suave" };
                      const url = e.resultado?.caminho ? assinados.get(e.resultado.caminho) : undefined;
                      return (
                        <li key={e.id} className={`card space-y-2 p-3 text-sm ${e.status === "erro" || p?.status === "erro" ? "border-quente/60" : ""}`}>
                          {col.id === "review" && url && <video src={`${url}#t=0.5`} preload="metadata" controls playsInline className="aspect-[9/16] w-full rounded-lg bg-black object-cover" />}
                          <Link href={`/editor/${e.id}`} className="block font-bold leading-snug hover:underline">
                            {e.titulo}
                            {e.versao > 1 && <span className="ml-1 font-mono text-xs font-normal text-apagado">v{e.versao}</span>}
                          </Link>
                          <div className="flex flex-wrap gap-1">
                            {palavra && <span className="chip font-mono font-bold">{palavra}</span>}
                            {col.id === "pra_editar" && <span className="chip">{e.video?.takes?.length ?? 0} take(s)</span>}
                            {col.id === "editando" && <span className={`chip ${st.cor}`}>{st.nome}</span>}
                          </div>

                          {col.id === "pra_editar" &&
                            (e.status === "subindo" ? (
                              <p className="text-xs text-morno">os takes não terminaram de subir: grave de novo pelo roteiro ou apague</p>
                            ) : (
                              <Link href={`/editor/${e.id}`} className="btn btn-sm w-full">
                                Escolher a edição
                              </Link>
                            ))}
                          {col.id === "editando" && <p className={`text-xs ${e.status === "erro" ? "text-quente" : "text-suave"}`}>{e.status === "erro" ? e.erro?.slice(0, 120) : e.etapa}</p>}
                          {col.id === "review" && (
                            <div className="flex flex-wrap gap-1.5">
                              <form action={aprovarReel}>
                                <input type="hidden" name="id" value={e.id} />
                                <input type="hidden" name="volta" value={ESTEIRA} />
                                <BotaoGerar rotulo="Aprovar e agendar" gerando="Agendando…" className="btn btn-sm" />
                              </form>
                              <Link href={`/editor/${e.id}#ajuste`} className="btn btn-sm btn-2">
                                Pedir ajuste
                              </Link>
                            </div>
                          )}
                          {col.id === "postagem" && p && (
                            <div className="space-y-2">
                              <p className={`text-xs ${p.status === "erro" ? "text-quente" : "text-suave"}`}>
                                {p.status === "erro"
                                  ? p.erro
                                  : ["enviando", "processando", "publicando"].includes(p.status)
                                    ? `${p.etapa ?? "subindo pro Instagram"}…`
                                    : p.publicar_em
                                      ? `sai ${quando(p.publicar_em)}${p.status === "pronta" ? "" : " · a legenda ainda está sendo escrita"}`
                                      : "fora da agenda: escolha um horário ou poste pelo vídeo"}
                              </p>
                              {p.legenda && <p className="line-clamp-3 whitespace-pre-line rounded-lg bg-black/20 p-2 text-[11px] text-suave">{legendaDoReel(palavra, p.legenda)}</p>}
                              {!["enviando", "processando", "publicando"].includes(p.status) && (
                                <form action={reagendarReel} className="flex gap-1.5">
                                  <input type="hidden" name="id" value={p.id} />
                                  <input type="hidden" name="volta" value={ESTEIRA} />
                                  <input type="datetime-local" name="quando" defaultValue={p.publicar_em ? campoHora(p.publicar_em) : ""} className="campo min-w-0 flex-1 py-1 text-xs" required />
                                  <BotaoGerar rotulo={p.status === "erro" ? "Reagendar" : "Mudar"} gerando="Salvando…" className="btn btn-sm btn-2" />
                                </form>
                              )}
                              {p.publicar_em && ["pronta", "aguardando_estacao", "escrevendo", "erro"].includes(p.status) && (
                                <form action={desagendarReel}>
                                  <input type="hidden" name="id" value={p.id} />
                                  <input type="hidden" name="volta" value={ESTEIRA} />
                                  <button className="text-xs text-suave underline">tirar da agenda</button>
                                </form>
                              )}
                            </div>
                          )}
                          {(col.id === "postagem" || col.id === "postados") && palavra && (
                            <p className={`text-xs ${entrega?.publicada ? "text-marca" : "text-morno"}`}>
                              {!entrega
                                ? "sem material dessa palavra"
                                : entrega.publicada
                                  ? col.id === "postados"
                                    ? "material no ar · automação do post criada"
                                    : "material no ar"
                                  : entrega.status === "pronta"
                                    ? "material pronto: entra no ar quando o post sair"
                                    : "a estação está montando o material"}
                            </p>
                          )}
                          {col.id === "postados" && p && (
                            <p className="text-xs text-suave">
                              {p.publicado_em ? `postado ${haQuanto(p.publicado_em)}` : "postado"}
                              {p.permalink && (
                                <>
                                  {" · "}
                                  <a href={p.permalink} target="_blank" rel="noreferrer" className="text-marca underline">
                                    ver post
                                  </a>
                                </>
                              )}
                            </p>
                          )}
                          {col.id !== "postados" && <p className="text-[11px] text-apagado">{haQuanto(e.criado_em)}</p>}
                        </li>
                      );
                    })
                  : vazio)}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
