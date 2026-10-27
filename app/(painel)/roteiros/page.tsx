import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuanto } from "@/lib/formato";
import { FINAIS_ROTEIRO, ORIGEM_ROTEIRO, STATUS_ROTEIRO, estacaoDeRoteirosLigada, type BatidaRoteiros } from "@/lib/roteiro/comum";
import { AutoAtualizar } from "../editor/atualizar";
import { NovoRoteiroForm } from "./novo";

export const dynamic = "force-dynamic";

// Com o monitor de criadores (18/10) entram até ~150 roteiros por dia: a lista separa os feitos à mão
// dos automáticos e filtra por criador
const FILTROS = [
  { de: "", nome: "Todos" },
  { de: "prontos", nome: "Prontos pra gravar" },
  { de: "mao", nome: "Feitos à mão" },
  { de: "monitor", nome: "Dos criadores" },
];

export default async function PaginaRoteiros({ searchParams }: PageProps<"/roteiros">) {
  const q = await searchParams;
  const de = String(q.de ?? "");
  const criadorId = typeof q.criador === "string" && /^[0-9a-f-]{36}$/.test(q.criador) ? q.criador : null;
  const supabase = await createClient();
  let consulta = supabase
    .from("roteiro")
    .select("id, titulo, tema, origem, status, etapa, criado_em, palavra:versoes->0->>palavra_cta, segundos:versoes->0->checagem->>segundos, criador:criador_id (usuario)")
    .order("criado_em", { ascending: false })
    .limit(criadorId || de ? 150 : 60);
  if (criadorId) consulta = consulta.eq("criador_id", criadorId);
  else if (de === "mao") consulta = consulta.eq("automatico", false);
  else if (de === "monitor") consulta = consulta.eq("automatico", true);
  else if (de === "prontos") consulta = consulta.eq("status", "pronto");
  const [{ data: roteiros }, { data: cfg }, { count: criadores }] = await Promise.all([
    consulta,
    supabase.from("configuracao").select("valor").eq("chave", "estacao_roteiros").maybeSingle(),
    supabase.from("criador").select("id", { count: "exact", head: true }).eq("ativo", true),
  ]);
  const andando = (roteiros ?? []).some((r) => !FINAIS_ROTEIRO.includes(r.status));
  const estacao = cfg?.valor as BatidaRoteiros | null;
  const ligada = estacaoDeRoteirosLigada(estacao);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {andando && <AutoAtualizar segundos={5} />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Roteiros</h1>
          <p className="mt-1 text-sm text-suave">
            Roteiro pronto pra ler no teleprompter, no padrão dos vídeos que viralizaram e sem cara de texto de IA. Sobre um tema, ou a partir de um vídeo de
            referência: a IA ouve, pega o assunto e a estrutura e escreve um roteiro novo, sem as falas do outro criador.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/roteiros/criadores" className="btn btn-sm btn-2">
            Criadores{criadores ? ` · ${criadores}` : ""}
          </Link>
          <Link href="/roteiros/padrao" className="btn btn-sm btn-2">
            Padrão viral
          </Link>
        </div>
      </header>

      <section className={`card flex items-center justify-between gap-3 p-3 ${ligada ? "" : "border-morno/60"}`}>
        <p className="text-sm">
          <span className="rotulo">Estação · {ligada ? "ligada" : "desligada"}</span>
          <span className="mt-1 block text-xs text-suave">
            {ligada
              ? `O Claude do teu plano escreve os roteiros no ${estacao?.maquina ?? "teu PC"}${estacao?.ocupada ? ", escrevendo agora" : ""}. Sem custo de API.`
              : "Os roteiros são escritos no teu PC, pelo Claude do teu plano: abre o atalho “Estacao de edicao (criador)” da Área de Trabalho. Pedido feito com ela desligada espera na fila."}
          </span>
        </p>
        <span className={`chip shrink-0 ${ligada ? "text-ok" : "text-morno"}`}>{ligada ? "● ligada" : "○ desligada"}</span>
      </section>

      <NovoRoteiroForm />

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="rotulo">Teus roteiros</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTROS.map((f) => (
              <Link
                key={f.de}
                href={f.de ? `/roteiros?de=${f.de}` : "/roteiros"}
                className={`chip ${!criadorId && de === f.de ? "border-marca text-marca" : "text-suave"}`}
              >
                {f.nome}
              </Link>
            ))}
          </div>
        </div>
        {criadorId ? (
          <p className="text-xs text-suave">
            Só os de um criador ·{" "}
            <Link href="/roteiros" className="underline">
              ver todos
            </Link>
          </p>
        ) : null}
        {(roteiros ?? []).length === 0 ? (
          <p className="text-sm text-apagado">Nenhum roteiro ainda.</p>
        ) : (
          <ul className="space-y-2">
            {(roteiros ?? []).map((r) => {
              const s = STATUS_ROTEIRO[r.status] ?? { nome: r.status, cor: "text-suave" };
              const criador = (Array.isArray(r.criador) ? r.criador[0] : r.criador) as { usuario: string } | null;
              const origem = criador ? `de @${criador.usuario}` : ORIGEM_ROTEIRO[r.origem];
              return (
                <li key={r.id}>
                  <Link href={`/roteiros/${r.id}`} className="card flex items-center justify-between gap-3 p-3 hover:border-marca">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{r.titulo || r.tema || origem}</p>
                      <p className="mt-0.5 truncate text-xs text-apagado">
                        {origem} · {haQuanto(r.criado_em)}
                        {r.palavra ? ` · comenta ${r.palavra}` : ""}
                        {r.segundos ? ` · ~${r.segundos} s` : ""}
                        {!FINAIS_ROTEIRO.includes(r.status) && r.etapa ? ` · ${r.etapa}` : ""}
                      </p>
                    </div>
                    <span className={`chip shrink-0 ${s.cor}`}>{s.nome}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
