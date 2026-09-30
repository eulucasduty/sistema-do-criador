import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dataCurta, haQuanto, nomeDoContato } from "@/lib/formato";
import { ROTULO_ALERTA, type TipoAlerta } from "@/lib/alertas";
import { marcarNaoContatar, pausarAgente, resolverAlerta, salvarObservacoes } from "../../acoes";
import { salvarTags } from "../acoes";

export const dynamic = "force-dynamic";

type Um<T> = T | T[] | null;
const um = <T,>(v: Um<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
type Meta = Record<string, unknown> & { botoes?: Array<{ titulo?: string; url?: string }> };
const noFuturo = (iso: string | null | undefined) => (iso ? Date.parse(iso) > Date.now() : false);

const STATUS_CONVERSA: Record<string, string> = {
  aberta: "aberta",
  com_voce: "com você (o agente não responde)",
  encerrada: "encerrada (reabre se a pessoa escrever)",
};

const ETAPA: Record<string, string> = {
  abertura: "recebeu a 1ª DM",
  aguardando_seguir: "esperando seguir você",
  entregue: "recebeu o material",
  com_agente: "conversando com o agente",
};

const COMENTARIO: Record<string, string> = {
  respondido: "respondido",
  ignorado: "sem automação",
  erro: "erro",
  recebido: "recebido",
};

const RESULTADO: Record<string, string> = {
  respondeu: "respondeu",
  escalou: "passou pra você",
  encerrou: "encerrou",
  bloqueado: "barrado",
  pulou: "pulou",
  erro: "erro",
};

/** Quem mandou a mensagem, do jeito que você entende. */
function autorDe(autor: string, meta: Meta): string {
  if (autor === "criador") return "você";
  if (autor === "sistema") return "sistema";
  if (meta.turno) return "agente de IA";
  if (meta.followup || meta.followup_agente) return "toque automático";
  if (meta.automacao) return meta.abertura ? "automação · 1ª DM" : meta.portao ? "automação · pediu pra seguir" : "automação";
  return "sistema";
}

function conteudoDe(m: { tipo: string; conteudo: string | null; transcricao: string | null }): string {
  switch (m.tipo) {
    case "audio":
      return `[áudio] ${m.transcricao ?? "(ainda não transcrito)"}`;
    case "imagem":
      return `[imagem] ${m.conteudo ?? ""}`.trim();
    case "video":
      return `[vídeo] ${m.conteudo ?? ""}`.trim();
    case "documento":
      return `[arquivo] ${m.conteudo ?? ""}`.trim();
    case "botao":
      return `[tocou no botão] ${m.conteudo ?? ""}`.trim();
    case "reacao":
      return `[reagiu] ${m.conteudo ?? ""}`.trim();
    default:
      return m.conteudo || m.transcricao || `[${m.tipo}]`;
  }
}

export default async function PaginaLead({ params }: PageProps<"/contatos/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: c } = await supabase.from("contato").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ data: conversa }, { data: recentes }, { data: alertas }, { data: fluxos }, { data: comentarios }, { data: cliques }, { data: turnos }, { data: eco }] =
    await Promise.all([
      supabase.from("conversa").select("id, status, status_motivo, mensagens_do_agente, janela_ate, responder_apos").eq("contato_id", id).maybeSingle(),
      supabase
        .from("mensagem")
        .select("id, direcao, autor, tipo, conteudo, transcricao, status, erro, metadados, enviada_em")
        .eq("contato_id", id)
        .order("enviada_em", { ascending: false })
        .limit(200),
      supabase.from("alerta").select("id, tipo, motivo, resolvido, resolvido_em, criado_em").eq("contato_id", id).order("criado_em", { ascending: false }).limit(30),
      supabase
        .from("ig_fluxo")
        .select("id, etapa, comentario_texto, criado_em, entregue_em, followups_enviados, lembrete_em, lembrete_texto, automacao:automacao_id (id, nome, modo)")
        .eq("contato_id", id)
        .order("criado_em", { ascending: false }),
      supabase.from("ig_comentario").select("id, texto, status, criado_em").eq("contato_id", id).order("criado_em", { ascending: false }).limit(10),
      supabase
        .from("clique")
        .select("id, destino, criado_em, automacao:automacao_id (id, nome)")
        .eq("contato_id", id)
        .order("criado_em", { ascending: false })
        .limit(30),
      supabase
        .from("agente_turno")
        .select("id, resultado, motivo, custo_usd, criado_em")
        .eq("contato_id", id)
        .eq("simulacao", false)
        .order("criado_em", { ascending: false })
        .limit(10),
      supabase.from("configuracao").select("valor").eq("chave", "pausa_por_eco_horas").maybeSingle(),
    ]);

  const mensagens = (recentes ?? []).reverse();
  const abertos = (alertas ?? []).filter((a) => !a.resolvido);
  const resolvidos = (alertas ?? []).filter((a) => a.resolvido);
  const pausadoAte = c.agente_pausado_ate as string | null;
  const pausado = pausadoAte === "infinity" || noFuturo(pausadoAte);
  const janelaAberta = noFuturo(conversa?.janela_ate);
  const horasEco = Number(eco?.valor ?? 48) || 48;
  const custoAgente = (turnos ?? []).reduce((s, t) => s + Number(t.custo_usd ?? 0), 0);
  const usuario = c.instagram_usuario as string | null;

  return (
    <div className="max-w-5xl">
      <Link href="/contatos" className="text-xs text-suave hover:text-texto">
        ← Leads
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="titulo">{nomeDoContato(c)}</h1>
          <p className="mt-1 text-sm text-suave">
            {usuario && c.nome !== `@${usuario}` && <>@{usuario} · </>}
            chegou {haQuanto(c.criado_em)} · código {c.codigo}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(c.tags as string[]).map((t) => (
              <span key={t} className="rounded-full bg-superficie-2 px-2 py-0.5 text-xs text-suave">
                {t.replace(/_/g, " ")}
              </span>
            ))}
            {c.nao_contatar && <span className="rounded-full bg-quente/15 px-2 py-0.5 text-xs text-quente">não contatar</span>}
            {pausado && <span className="rounded-full bg-morno/15 px-2 py-0.5 text-xs text-morno">agente pausado</span>}
          </div>
        </div>
        {usuario && (
          <a href={`https://instagram.com/${usuario}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-2">
            Abrir o perfil
          </a>
        )}
      </header>

      {abertos.length > 0 && (
        <section className="mt-6 space-y-2">
          {abertos.map((a) => (
            <div key={a.id} className="card flex flex-wrap items-start justify-between gap-3 border-marca/40 p-3 text-sm">
              <div className="min-w-0">
                <span className="chip text-marca">{ROTULO_ALERTA[a.tipo as TipoAlerta] ?? a.tipo}</span>
                {a.motivo && <p className="mt-1.5 text-suave">{a.motivo}</p>}
                <p className="mt-1 text-xs text-apagado">{haQuanto(a.criado_em)}</p>
              </div>
              <form action={resolverAlerta}>
                <input type="hidden" name="id" value={a.id} />
                <button className="btn btn-sm">Resolver</button>
              </form>
            </div>
          ))}
        </section>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-5">
        <div className="space-y-6 md:col-span-3">
          <section>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="rotulo">Conversa no direct</h2>
              {conversa && <span className="text-xs text-apagado">{STATUS_CONVERSA[conversa.status] ?? conversa.status}</span>}
            </div>
            {!mensagens.length ? (
              <p className="card p-4 text-sm text-suave">Nenhuma mensagem ainda.</p>
            ) : (
              <ol className="card space-y-2 p-3">
                {mensagens.map((m) => {
                  const meta = (m.metadados ?? {}) as Meta;
                  const saida = m.direcao === "saida";
                  return (
                    <li key={m.id} className={`flex ${saida ? "justify-end" : ""}`}>
                      <div
                        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          !saida ? "bg-superficie-2" : m.autor === "criador" || meta.turno ? "bg-marca-fundo" : "border border-borda bg-superficie"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{conteudoDe(m)}</p>
                        {m.tipo === "imagem" && m.transcricao && <p className="mt-1 text-xs text-suave">{m.transcricao}</p>}
                        {!!meta.botoes?.length && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {meta.botoes.map((b, i) => (
                              <span key={i} className="rounded border border-borda px-1.5 py-0.5 text-[11px] text-suave">
                                {b.titulo ?? "botão"}
                              </span>
                            ))}
                          </div>
                        )}
                        {m.status === "falhou" && <p className="mt-1 text-xs text-quente">não foi entregue{m.erro ? `: ${m.erro}` : ""}</p>}
                        <p className="mt-1 text-[11px] text-apagado">
                          {saida ? `${autorDe(m.autor, meta)} · ` : ""}
                          {dataCurta(m.enviada_em)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-2 text-xs text-apagado">
              Pra responder, use o app do Instagram: a mensagem aparece aqui e o agente sai da conversa por {horasEco} h sozinho.
              {conversa?.janela_ate &&
                (janelaAberta
                  ? ` Dá pra mandar mensagem até ${dataCurta(conversa.janela_ate)} (janela de 24 h do Instagram).`
                  : " A janela de 24 h fechou: só dá pra mandar mensagem quando a pessoa escrever de novo.")}
            </p>
          </section>

          {!!turnos?.length && (
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="rotulo">O que o agente fez</h2>
                <span className="text-xs text-apagado">US$ {custoAgente.toFixed(4)}</span>
              </div>
              <ul className="card divide-y divide-borda overflow-hidden text-xs">
                {turnos.map((t) => (
                  <li key={t.id} className="px-3 py-2">
                    <span className={t.resultado === "erro" || t.resultado === "bloqueado" ? "text-quente" : "text-texto"}>
                      {RESULTADO[t.resultado] ?? t.resultado}
                    </span>
                    <span className="text-apagado"> · {haQuanto(t.criado_em)}</span>
                    {t.motivo && <p className="mt-0.5 text-suave">{t.motivo}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6 md:col-span-2">
          <section className="card p-4">
            <h2 className="font-display text-base uppercase tracking-wide">Agente de IA</h2>
            <p className="mt-1 text-xs text-suave">
              {pausado
                ? pausadoAte === "infinity"
                  ? "Pausado pra esta pessoa até você devolver."
                  : `Pausado pra esta pessoa até ${dataCurta(pausadoAte)}.`
                : "Pode responder esta pessoa (se ela veio de uma automação no modo agente e ele estiver ligado)."}
              {pausado && c.agente_pausa_motivo && <> Motivo: {c.agente_pausa_motivo}</>}
            </p>
            {conversa && (
              <p className="mt-1 text-xs text-apagado">
                {conversa.mensagens_do_agente} {conversa.mensagens_do_agente === 1 ? "resposta" : "respostas"} do agente
                {conversa.status_motivo && <> · {conversa.status_motivo}</>}
              </p>
            )}
            <form action={pausarAgente} className="mt-3 space-y-2">
              <input type="hidden" name="contato_id" value={c.id} />
              <select name="opcao" defaultValue={pausado ? "retomar" : "24h"} className="campo">
                <option value="1h">Pausar 1 hora</option>
                <option value="24h">Pausar 24 horas</option>
                <option value="7d">Pausar 7 dias</option>
                <option value="data">Pausar até a data abaixo</option>
                <option value="sempre">Pausar até eu devolver</option>
                <option value="retomar">Devolver pro agente agora</option>
              </select>
              <input type="date" name="data" className="campo" />
              <input name="motivo" placeholder="Motivo (opcional)" className="campo" />
              <button className="btn btn-sm btn-2 w-full">Aplicar</button>
            </form>
            <form action={marcarNaoContatar} className="mt-3 border-t border-borda pt-3">
              <input type="hidden" name="contato_id" value={c.id} />
              <input type="hidden" name="valor" value={c.nao_contatar ? "nao" : "sim"} />
              <button className="text-xs text-suave hover:text-quente">
                {c.nao_contatar ? "Voltar a contatar" : "Marcar como não contatar (o sistema não manda mais nada)"}
              </button>
              {c.nao_contatar && c.nao_contatar_em && <p className="mt-1 text-[11px] text-apagado">desde {dataCurta(c.nao_contatar_em)}</p>}
            </form>
          </section>

          <section>
            <h2 className="mb-3 rotulo">De onde veio</h2>
            {!fluxos?.length && !comentarios?.length ? (
              <p className="card p-3 text-sm text-suave">Chegou pelo direct, sem automação.</p>
            ) : (
              <ul className="space-y-2">
                {(fluxos ?? []).map((f) => {
                  const a = um(f.automacao as Um<{ id: string; nome: string; modo: string }>);
                  return (
                    <li key={f.id} className="card p-3 text-sm">
                      {a ? (
                        <Link href={`/instagram/${a.id}`} className="font-medium hover:text-marca">
                          {a.nome}
                        </Link>
                      ) : (
                        <span className="font-medium text-apagado">automação apagada</span>
                      )}
                      <p className="mt-0.5 text-xs text-suave">
                        {ETAPA[f.etapa] ?? f.etapa} · entrou {haQuanto(f.criado_em)}
                        {f.entregue_em && <> · material {dataCurta(f.entregue_em)}</>}
                      </p>
                      {f.comentario_texto && <p className="mt-1 text-xs text-apagado">comentou: “{f.comentario_texto}”</p>}
                      {f.followups_enviados > 0 && <p className="mt-0.5 text-xs text-apagado">{f.followups_enviados} toque(s) de quem sumiu</p>}
                      {f.lembrete_texto && <p className="mt-0.5 text-xs text-apagado">lembrete no comentário: {f.lembrete_texto}</p>}
                    </li>
                  );
                })}
                {!!comentarios?.length && (
                  <li className="card p-3 text-xs">
                    <p className="rotulo">Comentários</p>
                    <ul className="mt-1.5 space-y-1">
                      {comentarios.map((k) => (
                        <li key={k.id} className="text-suave">
                          “{k.texto}” <span className="text-apagado">· {COMENTARIO[k.status] ?? k.status} · {haQuanto(k.criado_em)}</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 rotulo">Cliques</h2>
            {!cliques?.length ? (
              <p className="text-sm text-apagado">Não clicou em nenhum link ainda.</p>
            ) : (
              <ul className="card divide-y divide-borda overflow-hidden text-xs">
                {cliques.map((k) => {
                  const a = um(k.automacao as Um<{ id: string; nome: string }>);
                  return (
                    <li key={k.id} className="px-3 py-2">
                      <p className="truncate text-suave" title={k.destino ?? ""}>
                        {k.destino ?? "—"}
                      </p>
                      <p className="text-apagado">
                        {a ? a.nome : "oferta do agente"} · {haQuanto(k.criado_em)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 rotulo">Etiquetas</h2>
            <form action={salvarTags} className="flex gap-2">
              <input type="hidden" name="contato_id" value={c.id} />
              <input
                name="tags"
                defaultValue={(c.tags as string[]).join(", ")}
                placeholder="cliente, parceria (separe por vírgula)"
                className="campo min-w-0 flex-1"
              />
              <button className="btn btn-sm btn-2">Salvar</button>
            </form>
          </section>

          <section>
            <h2 className="mb-3 rotulo">Suas anotações</h2>
            <form action={salvarObservacoes} className="space-y-2">
              <input type="hidden" name="contato_id" value={c.id} />
              <textarea
                name="observacoes"
                defaultValue={c.observacoes ?? ""}
                rows={4}
                placeholder="O agente lê isto antes de responder."
                className="card w-full p-3 text-sm outline-none focus:border-marca"
              />
              <button className="btn btn-sm btn-2">Salvar</button>
            </form>
          </section>

          {resolvidos.length > 0 && (
            <section>
              <h2 className="mb-3 rotulo">Avisos resolvidos</h2>
              <ul className="space-y-1 text-xs text-suave">
                {resolvidos.map((a) => (
                  <li key={a.id}>
                    ✓ {ROTULO_ALERTA[a.tipo as TipoAlerta] ?? a.tipo}
                    {a.motivo && <>: {a.motivo}</>} <span className="text-apagado">· {haQuanto(a.criado_em)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
