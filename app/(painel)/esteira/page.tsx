import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { haQuanto } from "@/lib/formato";
import type { Analise } from "@/lib/instagram/esteira";
import { lerVoz } from "@/lib/esteira/voz";
import { atualizarVoz, importarCarrosselLink } from "./acoes";
import { BotaoGerar } from "./botoes";
import { EnviarSlides } from "./enviar-slides";
import { KanbanCarrosseis, capaDaCopia, type EntregaResumo, type RefCarrossel, type TrabalhoResumo } from "./kanban-carrosseis";
import { KanbanReels } from "./kanban-reels";
import { salvarAgendaReels } from "./reels-acoes";
import { AGENDA_REELS_PADRAO, type AgendaReels } from "@/lib/reels";

export const dynamic = "force-dynamic";

// Três abas: Reels (a esteira de reels: roteiro → gravar → editar → review → agenda → postado, desde
// 19/10), Carrosséis e Referências (os reels que chegam pela DM, com a análise e o guia da voz).

const COLUNAS = [
  { etapa: "nova", nome: "Nova" },
  { etapa: "analisada", nome: "Analisada" },
  { etapa: "vou_gravar", nome: "Vou gravar" },
  { etapa: "gravado", nome: "Gravado" },
  { etapa: "postado", nome: "Postado" },
];

const campo = "campo";
const dia = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) : "—");

export default async function PaginaEsteira({ searchParams }: PageProps<"/esteira">) {
  const q = await searchParams;
  const aba = q.aba === "carrosseis" ? "carrosseis" : q.aba === "referencias" ? "referencias" : "reels";
  const supabase = await createClient();
  const [{ data: refs }, voz, { data: cfgAgenda }] = await Promise.all([
    supabase
      .from("referencia")
      .select("id, tipo, etapa, origem, enviado_por, autor, legenda, arquivo, arquivo_tipo, analise, erro, criado_em, aguardando_video, sem_video_motivo, slides, roteiros, copia, copia_cli, numero, palavra_cta")
      .neq("etapa", "descartada")
      .order("criado_em", { ascending: false })
      .limit(300),
    lerVoz(),
    supabase.from("configuracao").select("valor").eq("chave", "agenda_reels").maybeSingle(),
  ]);
  const agenda: AgendaReels = { ...AGENDA_REELS_PADRAO, ...((cfgAgenda?.valor as Partial<AgendaReels> | null) ?? {}) };
  const reels = (refs ?? []).filter((r) => r.tipo === "reel");
  const carrosseis = (refs ?? []).filter((r) => r.tipo !== "reel");
  const lista = aba === "carrosseis" ? carrosseis : aba === "referencias" ? reels : [];

  // Carrosséis: andamento da produção (último trabalho de cada um) e o material de cada palavra
  const trabalhos = new Map<string, TrabalhoResumo>();
  const entregas = new Map<string, EntregaResumo>();
  if (aba === "carrosseis") {
    const [{ data: ts }, { data: es }] = await Promise.all([
      supabase.from("carrossel_trabalho").select("referencia_id, status, etapa, modo_visual, erro, criado_em").order("criado_em", { ascending: false }).limit(500),
      supabase.from("entrega").select("id, palavra, publicada"),
    ]);
    for (const t of ts ?? []) if (!trabalhos.has(t.referencia_id)) trabalhos.set(t.referencia_id, t);
    for (const e of es ?? []) if (e.palavra) entregas.set(e.palavra.toUpperCase(), e);
  }

  // Link assinado (1 h) só pros vídeos/capas que vão aparecer (no carrossel pronto, a capa da nossa versão)
  const caminhos = lista.flatMap((r) => [r.arquivo, aba === "carrosseis" ? capaDaCopia(r as RefCarrossel) : null]).filter((a): a is string => Boolean(a));
  const assinados = new Map<string, string>();
  if (caminhos.length) {
    const { data } = await createAdminClient().storage.from("esteira").createSignedUrls(caminhos, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) assinados.set(s.path, s.signedUrl);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Esteira</h1>
          <p className="mt-1 max-w-2xl text-sm text-suave">
            {aba === "reels"
              ? "Do roteiro ao post: os roteiros dos criadores chegam todo dia, você grava no celular com o teleprompter, escolhe a edição, confere e aprova. O post sai sozinho no horário, com o “Comenta PALAVRA” na legenda, a automação do direct e o material."
              : "Adicione um link ou arquivo em Referências. A IA assiste e ouve o reel inteiro, lê o carrossel, desmonta o porquê de ter engajado, e cria a tua versão: roteiro na tua voz, carrossel pronto pra postar."}
          </p>
        </div>
        <Link href="/referencias" className="btn btn-sm">+ Adicionar referência</Link>
      </header>
      {q.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      <nav className="flex gap-2">
        {(
          [
            ["reels", "Reels", null],
            ["carrosseis", "Carrosséis", carrosseis.length],
            ["referencias", "Referências", reels.length],
          ] as const
        ).map(([valor, nome, n]) => (
          <Link
            key={valor}
            href={`/esteira?aba=${valor}`}
            className={`rounded-xl border-2 px-4 py-2 text-sm font-bold ${
              aba === valor ? "border-tinta bg-marca text-[#05070e] shadow-[0_3px_0_#000]" : "border-linha text-suave hover:text-texto"
            }`}
          >
            {nome} {n != null && <span className="ml-1 font-mono text-xs opacity-70">{n}</span>}
          </Link>
        ))}
      </nav>
      {aba === "carrosseis" && <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-2 p-4">
          <h2 className="text-xs font-bold">Subir carrossel: fotos e vídeos dos slides</h2>
          <EnviarSlides />
        </section>
        <form action={importarCarrosselLink} className="card space-y-2 p-4">
          <label className="block text-xs font-bold">Ou importar todos os slides pelo link<input name="url" type="url" required placeholder="https://www.instagram.com/p/…" className={`${campo} mt-1`} /></label>
          <p className="text-xs text-suave">Usa a conexão do Facebook para buscar a sequência completa, com os slides em vídeo. Se o Instagram não liberar, suba os arquivos ao lado.</p>
          <BotaoGerar rotulo="Importar carrossel completo" gerando="Buscando e salvando todos os slides…" className="btn btn-sm" />
        </form>
      </div>}

      {aba === "reels" && (
        <>
          <form action={salvarAgendaReels} className="card flex flex-wrap items-end gap-3 p-4">
            <label className="block">
              <span className="rotulo">Horários dos reels aprovados</span>
              <input name="horarios" defaultValue={agenda.horarios.join(", ")} placeholder="11:00, 19:00" className={`${campo} mt-1 w-56`} />
            </label>
            <button className="btn btn-sm btn-2">Salvar</button>
            <p className="max-w-md text-xs text-apagado">
              Ao aprovar, o reel ocupa o próximo horário livre (Brasília). Os carrosséis saem das 6h às 16h, de 2 em 2 h: evite esses. Dá pra mudar o horário de cada
              um no card.
            </p>
          </form>
          <KanbanReels />
        </>
      )}

      {aba === "referencias" ? (
        <section className="card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-sm">
              <h2 className="rotulo">Tua voz · o que o roteirista usa</h2>
              <p className="mt-1 text-suave">
                {voz.status === "atualizando"
                  ? "Assistindo e transcrevendo os teus reels… leva uns minutos. Pode sair da página."
                  : voz.guia
                    ? `Guia tirado dos teus ${voz.reels} reels mais recentes (${dia(voz.de)} a ${dia(voz.ate)}) · atualizado ${haQuanto(voz.atualizado_em!)}.`
                    : "Ainda não gerado: por enquanto o roteirista usa o mapa de voz de junho. Gera pra ele aprender com os teus últimos 15 reels."}
              </p>
              {voz.status === "erro" && <p className="mt-1 text-xs text-quente">Deu erro: {voz.erro}</p>}
            </div>
            <form action={atualizarVoz}>
              <BotaoGerar rotulo={voz.guia ? "Atualizar" : "Gerar minha voz"} gerando="Começando…" className="btn btn-sm btn-2" />
            </form>
          </div>
          {voz.guia && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-marca">Ver o guia da tua voz</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-suave">{voz.guia}</p>
            </details>
          )}
        </section>
      ) : null}

      {aba !== "reels" && <p className="text-xs text-apagado">
        {aba === "referencias"
          ? "Reel: com o Facebook conectado (Conexões), o link que você compartilha já busca o vídeo sozinho pela API da Meta. Não vem de conta pessoal nem de reel com música licenciada: nesses, manda o VÍDEO na DM (até 1 h depois do link, ele completa o mesmo card) ou sobe aqui."
          : "Carrossel: sobe as fotos e vídeos dos slides acima, importa pelo link ou compartilha o post na DM e manda os prints logo depois (até 15 min): eles entram no mesmo card. Os carrosséis novos dos criadores monitorados também chegam aqui sozinhos."}
      </p>}

      {aba === "reels" ? null : aba === "carrosseis" ? (
        <KanbanCarrosseis refs={carrosseis as RefCarrossel[]} trabalhos={trabalhos} entregas={entregas} assinados={assinados} />
      ) : (
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUNAS.map((col) => {
          const cards = lista.filter((r) => r.etapa === col.etapa);
          return (
            <section key={col.etapa} className="w-72 shrink-0">
              <h2 className="mb-2 flex items-baseline justify-between rotulo">
                {col.nome} <span className="text-xs text-apagado">{cards.length}</span>
              </h2>
              <ul className="space-y-2">
                {cards.map((r) => {
                  const a = r.analise as Analise | null;
                  const url = r.arquivo ? assinados.get(r.arquivo) : undefined;
                  const video = r.arquivo_tipo?.includes("video") || r.arquivo?.endsWith(".mp4");
                  const roteiros = Array.isArray(r.roteiros) ? r.roteiros.length : 0;
                  const slides = (r.slides ?? []).length;
                  return (
                    <li key={r.id}>
                      <Link href={`/esteira/${r.id}`} className="card block overflow-hidden hover:border-suave/40">
                        {url &&
                          (video ? (
                            <video src={`${url}#t=0.5`} preload="metadata" muted className="aspect-[9/12] w-full bg-black object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt="" className="aspect-[4/5] w-full object-cover" />
                          ))}
                        <div className="p-3 text-sm">
                          {r.aguardando_video ? (
                            <p className="text-xs text-morno">
                              Falta o vídeo{r.sem_video_motivo ? `: ${r.sem_video_motivo}` : ": manda o arquivo na DM ou abre e sobe aqui"}.
                            </p>
                          ) : a ? (
                            <>
                              <p className="line-clamp-3 font-medium">“{a.gancho?.texto_ou_fala || a.resumo}”</p>
                              <p className="mt-1 text-xs text-suave">{a.formato}</p>
                            </>
                          ) : r.erro ? (
                            <p className="text-xs text-quente">{r.erro.slice(0, 120)}</p>
                          ) : (
                            <p className="text-xs text-apagado">{r.arquivo ? "a IA está assistindo…" : "sem arquivo"}</p>
                          )}
                          {r.legenda && !a && <p className="mt-1 line-clamp-2 text-xs text-apagado">{r.legenda}</p>}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {roteiros > 0 && <span className="chip">{roteiros} roteiro{roteiros > 1 ? "s" : ""}</span>}
                            {slides > 0 && <span className="chip">capa + {slides} slide{slides > 1 ? "s" : ""}</span>}
                            {r.copia && <span className="chip bg-marca text-[#05070e]">cópia pronta</span>}
                          </div>
                          <p className="mt-2 text-[11px] text-apagado">
                            {r.autor ? `@${r.autor} · ` : ""}
                            {r.origem === "dm" ? `DM de ${r.enviado_por}` : "subido aqui"} · {haQuanto(r.criado_em)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
                {!cards.length && <li className="rounded-xl border border-dashed border-borda p-4 text-center text-xs text-apagado">vazio</li>}
              </ul>
            </section>
          );
        })}
      </div>
      )}
    </div>
  );
}
