import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuanto } from "@/lib/formato";
import { FINAIS, STATUS_EDICAO, configEditor, estacaoLigada, nomeDoMotor, type BatidaEstacao } from "@/lib/editor";
import { AutoAtualizar } from "./atualizar";
import { EstacaoDesligada } from "./estacao";
import { QuemEdita } from "./motor";

export const dynamic = "force-dynamic";

export default async function PaginaEditor({ searchParams }: PageProps<"/editor">) {
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: edicoes }, { data: cfg }, { data: cfgMotor }] = await Promise.all([
    supabase.from("edicao").select("id, titulo, versao, status, etapa, criado_em, concluido_em, resultado").order("criado_em", { ascending: false }).limit(60),
    supabase.from("configuracao").select("valor").eq("chave", "estacao_edicao").maybeSingle(),
    supabase.from("configuracao").select("valor").eq("chave", "editor").maybeSingle(),
  ]);
  const motor = configEditor(cfgMotor?.valor);
  const erro = typeof q.erro === "string" ? q.erro : null;
  const batida = cfg?.valor as BatidaEstacao | null;
  const ligada = estacaoLigada(batida);
  const andando = (edicoes ?? []).some((e) => !FINAIS.includes(e.status));

  return (
    <div className="space-y-6">
      {andando && <AutoAtualizar segundos={8} />}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Editor de vídeo</h1>
          <p className="mt-1 max-w-2xl text-sm text-suave">
            Sobe o vídeo cru com os prints e gravações do que você mostra. A IA ({nomeDoMotor(motor.motor)}) corta as emendas, põe legenda com a palavra acendendo, tela dividida
            com a coisa de verdade, logos e sons, e devolve o vídeo pronto pra postar.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/editor/sons" className="btn btn-sm btn-2">
            Meus sons
          </Link>
          <Link href="/editor/nova" className="btn btn-sm">
            + Nova edição
          </Link>
        </div>
      </header>

      <section className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${ligada ? "" : "border-quente/60"}`}>
        <div className="min-w-0 flex-1">
          <h2 className="rotulo">Estação de edição · {ligada ? "ligada" : "desligada"}</h2>
          {ligada ? (
            <p className="mt-1 text-sm text-suave">
              Rodando em {batida?.maquina ?? "?"}
              {batida?.ocupada ? ", editando agora" : ", esperando pedido"}
              {batida?.motor_ok === false ? ", mas não consegue editar agora (veja abaixo)" : ""}.
            </p>
          ) : (
            <EstacaoDesligada className="mt-1" />
          )}
        </div>
        <span className={`chip ${ligada ? "text-ok" : "text-quente"}`}>{ligada ? "● ligada" : "○ desligada"}</span>
      </section>

      {erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{erro}</p>}
      <QuemEdita config={motor} batida={batida} salvo={q.motor === "salvo"} />

      {(edicoes ?? []).length === 0 ? (
        <p className="text-sm text-apagado">Nenhuma edição ainda.</p>
      ) : (
        <ul className="space-y-2">
          {(edicoes ?? []).map((e) => {
            const s = STATUS_EDICAO[e.status] ?? { nome: e.status, cor: "text-suave" };
            return (
              <li key={e.id}>
                <Link href={`/editor/${e.id}`} className="card flex flex-wrap items-center justify-between gap-3 p-3 hover:border-marca">
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {e.titulo}
                      {e.versao > 1 && <span className="ml-2 font-mono text-xs text-apagado">v{e.versao}</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-apagado">
                      {haQuanto(e.criado_em)}
                      {!FINAIS.includes(e.status) && e.etapa ? ` · ${e.etapa}` : ""}
                    </p>
                  </div>
                  <span className={`chip ${s.cor}`}>{s.nome}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
