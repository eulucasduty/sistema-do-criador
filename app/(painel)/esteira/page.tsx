import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { haQuanto } from "@/lib/formato";
import type { Persona } from "@/lib/config";
import { lerFacebook } from "@/lib/instagram/descoberta";
import { AutoAtualizar } from "../editor/atualizar";
import { adicionarPorLink, atualizarPersonaAcao, salvarGuia } from "./acoes";
import { BotaoGerar } from "./botoes";
import { NovaPorArquivo } from "./enviar";
import { ETAPAS, ehVideo, estadoDaAnalise, personaRodando } from "./regras";

export const dynamic = "force-dynamic";
// Buscar o post pelo link e atualizar a persona rodam nas ações desta página (a análise, depois da resposta)
export const maxDuration = 300;

const dia = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) : "—");

export default async function PaginaEsteira({ searchParams }: PageProps<"/esteira">) {
  const q = await searchParams;
  const aba = q.aba === "carrosseis" ? "carrosseis" : "reels";
  const verDescartadas = q.descartadas === "1";
  const supabase = await createClient();
  const [{ data: refs }, { data: cfgPersona }, facebook] = await Promise.all([
    supabase
      .from("referencia")
      .select(
        "id, tipo, etapa, origem, autor, legenda, arquivo, arquivo_tipo, erro, criado_em, atualizado_em, aguardando_video, sem_video_motivo, slides, " +
          "resumo:analise->>resumo, formato:analise->>formato, gancho:analise->gancho->>texto_ou_fala, roteiro_em:roteiros->0->>gerado_em, copia_em:copia->>gerado_em",
      )
      .order("criado_em", { ascending: false })
      .limit(300),
    supabase.from("configuracao").select("valor, atualizado_em").eq("chave", "persona").maybeSingle(),
    lerFacebook(),
  ]);
  const todas = ((refs ?? []) as unknown as Card[]).map((r) => ({ ...r, analise: r.resumo ?? r.formato ?? r.gancho }));
  const reels = todas.filter((r) => r.tipo === "reel");
  const carrosseis = todas.filter((r) => r.tipo !== "reel");
  const lista = aba === "reels" ? reels : carrosseis;
  const descartadas = lista.filter((r) => r.etapa === "descartada").length;
  const colunas = ETAPAS.filter((c) => c.etapa !== "descartada" || verDescartadas);
  const analisando = todas.some((r) => estadoDaAnalise(r) === "analisando");

  const persona = (cfgPersona?.valor ?? {}) as Persona;
  const rodando = personaRodando(persona.status, cfgPersona?.atualizado_em);
  const personaTravou = persona.status === "atualizando" && !rodando;
  const fbConectado = Boolean(facebook.page_token && facebook.ig_business_id);

  // Link assinado (1 h) só pros vídeos/capas que vão aparecer
  const caminhos = lista.filter((r) => colunas.some((c) => c.etapa === r.etapa)).map((r) => r.arquivo).filter((a): a is string => Boolean(a));
  const assinados = new Map<string, string>();
  if (caminhos.length) {
    const { data } = await createAdminClient().storage.from("esteira").createSignedUrls(caminhos, 3600);
    for (const s of data ?? []) if (s.path && s.signedUrl) assinados.set(s.path, s.signedUrl);
  }
  const link = (mudar: Record<string, string | null>) => {
    const p = new URLSearchParams({ aba, ...(verDescartadas ? { descartadas: "1" } : {}) });
    for (const [k, v] of Object.entries(mudar)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    return `/esteira?${p}`;
  };

  return (
    <div className="space-y-6">
      {(analisando || rodando) && <AutoAtualizar segundos={10} />}
      <header>
        <h1 className="titulo">Esteira</h1>
        <p className="mt-1 max-w-2xl text-sm text-suave">
          Reels e carrosséis de outros perfis que performaram. A IA assiste, ouve e lê, desmonta por que engajou e cria a sua versão: roteiro na sua voz ou
          carrossel pronto pra postar.
        </p>
      </header>
      {q.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      {/* ── nova referência ── */}
      <section className="card space-y-4 p-4">
        <div>
          <h2 className="rotulo">Nova referência</h2>
          <p className="mt-1 text-xs text-apagado">
            O link só busca o post com o Facebook conectado (
            <Link href="/conexoes" className="text-marca underline">
              Conexões
            </Link>
            ) e não funciona com conta pessoal nem com reel de música licenciada: nesses casos, sobe o arquivo.
          </p>
          {!fbConectado && <p className="mt-1 text-xs text-morno">O Facebook ainda não está conectado: o link cria o card e ele fica esperando o arquivo.</p>}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <form action={adicionarPorLink} className="space-y-2">
            <h3 className="rotulo">Colando o link</h3>
            <input name="url" type="url" required placeholder="https://www.instagram.com/reel/…" className="campo" />
            <textarea name="notas" rows={2} placeholder="por que salvou (opcional)" className="campo" />
            <BotaoGerar rotulo="Buscar e analisar" gerando="Buscando o post… (até 1 min)" className="btn btn-sm" />
          </form>
          <NovaPorArquivo />
        </div>
      </section>

      {/* ── persona ── */}
      <section id="persona" className="card space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl text-sm">
            <h2 className="rotulo">Minha persona</h2>
            <p className="mt-1 text-suave">
              Os roteiros e carrosséis saem escritos nesta voz. A IA assiste os seus últimos 15 reels (precisa do Instagram conectado) e anota como você
              abre, os bordões, o ritmo e o CTA. Dá pra editar à mão.
            </p>
            <p className="mt-2 text-xs text-apagado">
              {rodando
                ? "Assistindo e transcrevendo os seus reels… leva uns 3 min. Pode sair da página."
                : personaTravou
                  ? "A última atualização não terminou. Tenta de novo."
                  : persona.guia && persona.reels
                    ? `Tirado dos seus ${persona.reels} reels mais recentes (${dia(persona.de)} a ${dia(persona.ate)}) · atualizado ${haQuanto(persona.atualizado_em)}.`
                    : persona.guia
                      ? "Escrito à mão."
                      : "Ainda não tem: por enquanto os roteiros usam uma base genérica de vídeo curto."}
            </p>
            {persona.status === "erro" && persona.erro && <p className="mt-1 text-xs text-quente">Deu erro: {persona.erro}</p>}
          </div>
          {!rodando && (
            <form action={atualizarPersonaAcao}>
              <BotaoGerar rotulo={persona.guia ? "Atualizar pelos meus reels" : "Gerar pelos meus reels"} gerando="Começando…" className="btn btn-sm btn-2" />
            </form>
          )}
        </div>
        <details open={!persona.guia && !rodando}>
          <summary className="cursor-pointer text-xs text-marca">{persona.guia ? "Ver e editar o guia" : "Escrever à mão"}</summary>
          <form action={salvarGuia} className="mt-2 space-y-2">
            <textarea
              name="guia"
              rows={persona.guia ? 16 : 6}
              defaultValue={persona.guia ?? ""}
              placeholder="Como você fala: como abre o vídeo, bordões, gírias, ritmo, o que nunca fala, como pede o comentário…"
              className="campo text-sm leading-relaxed"
            />
            <div className="flex flex-wrap items-center gap-3">
              <BotaoGerar rotulo="Salvar o guia" gerando="Salvando…" className="btn btn-sm btn-2" />
              {rodando && <span className="text-xs text-morno">A atualização em andamento vai reescrever o guia.</span>}
            </div>
          </form>
        </details>
      </section>

      {/* ── o quadro ── */}
      <nav className="flex flex-wrap items-center gap-2">
        {(
          [
            ["reels", "Reels", reels.length],
            ["carrosseis", "Carrosséis", carrosseis.length],
          ] as const
        ).map(([valor, nome, n]) => (
          <Link
            key={valor}
            href={link({ aba: valor })}
            className={`rounded-xl border-2 px-4 py-2 text-sm font-bold ${
              aba === valor ? "border-tinta bg-marca text-[#05070e] shadow-[0_3px_0_#000]" : "border-linha text-suave hover:text-texto"
            }`}
          >
            {nome} <span className="ml-1 font-mono text-xs opacity-70">{n}</span>
          </Link>
        ))}
        {descartadas > 0 && (
          <Link href={link({ descartadas: verDescartadas ? null : "1" })} className="ml-auto text-xs text-apagado hover:text-texto">
            {verDescartadas ? "esconder descartadas" : `ver descartadas (${descartadas})`}
          </Link>
        )}
      </nav>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {colunas.map((col) => {
          const cards = lista.filter((r) => r.etapa === col.etapa);
          return (
            <section key={col.etapa} className={`w-72 shrink-0 ${col.etapa === "descartada" ? "opacity-60" : ""}`}>
              <h2 className="mb-2 flex items-baseline justify-between rotulo">
                {col.nome} <span className="text-xs text-apagado">{cards.length}</span>
              </h2>
              <ul className="space-y-2">
                {cards.map((r) => {
                  const url = r.arquivo ? assinados.get(r.arquivo) : undefined;
                  const estado = estadoDaAnalise(r);
                  const slides = (r.slides ?? []).length;
                  return (
                    <li key={r.id}>
                      <Link href={`/esteira/${r.id}`} className="card block overflow-hidden hover:border-suave/40">
                        {url &&
                          (ehVideo(r) ? (
                            <video src={`${url}#t=0.5`} preload="metadata" muted playsInline className="aspect-[9/12] w-full bg-black object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt="" className="aspect-[4/5] w-full object-cover" />
                          ))}
                        <div className="p-3 text-sm">
                          {estado === "aguardando" ? (
                            <p className="text-xs text-morno">Falta o arquivo{r.sem_video_motivo ? `: ${r.sem_video_motivo}` : ""}.</p>
                          ) : estado === "pronta" ? (
                            <>
                              <p className="line-clamp-3 font-medium">“{r.gancho || r.resumo}”</p>
                              <p className="mt-1 text-xs text-suave">{r.formato}</p>
                            </>
                          ) : estado === "erro" ? (
                            <p className="text-xs text-quente">{r.erro!.slice(0, 120)}</p>
                          ) : estado === "travada" ? (
                            <p className="text-xs text-quente">A análise não terminou: abre e manda analisar de novo.</p>
                          ) : (
                            <p className="text-xs text-apagado">{r.tipo === "reel" ? "a IA está assistindo…" : "a IA está lendo…"}</p>
                          )}
                          {r.legenda && estado !== "pronta" && <p className="mt-1 line-clamp-2 text-xs text-apagado">{r.legenda}</p>}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.roteiro_em && <span className="chip">roteiro</span>}
                            {slides > 0 && <span className="chip">capa + {slides}</span>}
                            {r.copia_em && <span className="chip bg-marca text-[#05070e]">cópia pronta</span>}
                          </div>
                          <p className="mt-2 text-[11px] text-apagado">
                            {r.autor ? `@${r.autor} · ` : ""}
                            {r.origem === "link" ? "pelo link" : "subido"} · {haQuanto(r.criado_em)}
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
    </div>
  );
}

type Card = {
  id: string;
  tipo: string;
  etapa: string;
  origem: string;
  autor: string | null;
  legenda: string | null;
  arquivo: string | null;
  arquivo_tipo: string | null;
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
  aguardando_video: boolean;
  sem_video_motivo: string | null;
  slides: string[] | null;
  resumo: string | null;
  formato: string | null;
  gancho: string | null;
  roteiro_em: string | null;
  copia_em: string | null;
};
