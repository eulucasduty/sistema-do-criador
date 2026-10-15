import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuanto } from "@/lib/formato";
import { configEditor, type BatidaEstacao } from "@/lib/editor";
import { FINAIS_ROTEIRO, ORIGEM_ROTEIRO, STATUS_ROTEIRO, semTabela, type BatidaRoteiros } from "@/lib/roteiro/comum";
import { MIGRACOES } from "@/lib/passos";
import { AtualizarBanco } from "../atualizar-banco";
import { AutoAtualizar } from "../editor/atualizar";
import { EstacaoRoteiros } from "./estacao";
import { NovoRoteiroForm } from "./novo";

export const dynamic = "force-dynamic";
// A transcrição da referência roda depois da resposta (after): até 5 min na Vercel
export const maxDuration = 300;

export default async function PaginaRoteiros() {
  const supabase = await createClient();
  const [{ data: roteiros, error }, { data: cfgs }, { data: automacoes }] = await Promise.all([
    supabase
      .from("roteiro")
      .select("id, titulo, tema, origem, status, etapa, criado_em, palavra:versoes->0->>palavra_cta, segundos:versoes->0->checagem->>segundos")
      .order("criado_em", { ascending: false })
      .limit(60),
    supabase.from("configuracao").select("chave, valor").in("chave", ["estacao_roteiros", "estacao_edicao", "editor"]),
    supabase.from("ig_automacao").select("palavras").eq("ativa", true),
  ]);
  const cfg = Object.fromEntries((cfgs ?? []).map((c) => [c.chave, c.valor])) as Record<string, unknown>;
  const lista = roteiros ?? [];
  const andando = lista.some((r) => !FINAIS_ROTEIRO.includes(r.status));
  const palavras = [...new Set((automacoes ?? []).flatMap((a) => (a.palavras ?? []) as string[]).map((p) => p.trim()).filter(Boolean))];

  return (
    <div className="max-w-3xl space-y-6">
      {andando && <AutoAtualizar segundos={5} />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Roteiros</h1>
          <p className="mt-1 text-sm text-suave">
            Roteiro pronto pra ler no teleprompter, na sua voz, no padrão dos vídeos que viralizam e sem cara de texto de IA. Sobre um tema, ou a partir de um
            vídeo de referência: a IA ouve, pega o assunto e a estrutura e escreve um roteiro novo, sem as falas do outro criador.
          </p>
        </div>
        <Link href="/roteiros/padrao" className="btn btn-sm btn-2">
          Padrão viral
        </Link>
      </header>

      {semTabela(error) ? (
        <section className="card space-y-3 border-morno/60 p-4">
          <h2 className="rotulo text-morno">Falta atualizar o banco</h2>
          <p className="text-sm text-suave">Os roteiros chegaram nesta versão do sistema e precisam de uma tabela nova. Leva 1 minuto:</p>
          <AtualizarBanco faltando={MIGRACOES.filter((m) => m.tabela === "roteiro")} />
        </section>
      ) : (
        <>
          <EstacaoRoteiros roteiros={(cfg.estacao_roteiros ?? null) as BatidaRoteiros | null} edicao={(cfg.estacao_edicao ?? null) as BatidaEstacao | null} config={configEditor(cfg.editor)} />

          <NovoRoteiroForm palavras={palavras} />

          <section className="space-y-2">
            <h2 className="rotulo">Seus roteiros</h2>
            {lista.length === 0 ? (
              <p className="text-sm text-apagado">Nenhum roteiro ainda.</p>
            ) : (
              <ul className="space-y-2">
                {lista.map((r) => {
                  const s = STATUS_ROTEIRO[r.status] ?? { nome: r.status, cor: "text-suave" };
                  return (
                    <li key={r.id}>
                      <Link href={`/roteiros/${r.id}`} className="card flex items-center justify-between gap-3 p-3 hover:border-marca">
                        <div className="min-w-0">
                          <p className="truncate font-bold">{r.titulo || r.tema || ORIGEM_ROTEIRO[r.origem]}</p>
                          <p className="mt-0.5 truncate text-xs text-apagado">
                            {ORIGEM_ROTEIRO[r.origem]} · {haQuanto(r.criado_em)}
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
        </>
      )}
    </div>
  );
}
