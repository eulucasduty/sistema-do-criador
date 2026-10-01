import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lerPerfil } from "@/lib/config";
import { estacaoLigada, estiloValido, legendaValida, type BatidaEstacao } from "@/lib/editor";
import { roteiroEmTexto, type Roteiro } from "@/lib/esteira/criacao";
import { EstacaoDesligada } from "../estacao";
import { lookValido } from "../opcoes";
import { FormularioEdicao } from "./formulario";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaNovaEdicao({ searchParams }: PageProps<"/editor/nova">) {
  const q = await searchParams;
  // Vindo da Esteira: /editor/nova?roteiro=<id da referência>&r=<qual roteiro>
  const refId = typeof q.roteiro === "string" && UUID.test(q.roteiro) ? q.roteiro : null;
  const indice = Math.max(0, Math.floor(Number(q.r) || 0));
  const supabase = await createClient();
  const [perfil, { data: cfg }, { data: ref }] = await Promise.all([
    lerPerfil(),
    supabase.from("configuracao").select("valor").eq("chave", "estacao_edicao").maybeSingle(),
    refId ? supabase.from("referencia").select("id, roteiros").eq("id", refId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const roteiro = ((ref?.roteiros ?? []) as Roteiro[])[indice] ?? null;
  const ligada = estacaoLigada(cfg?.valor as BatidaEstacao | null);

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <Link href="/editor" className="text-xs text-apagado hover:text-texto">
          ← Editor de vídeo
        </Link>
        <h1 className="titulo mt-1">Nova edição</h1>
        <p className="mt-1 text-sm text-suave">
          O vídeo cru, mais os prints e as gravações de tela do que você fala (cada um com a descrição do que é). O resto o editor decide: cortes, ângulos,
          motions, logos, sons e legenda.
        </p>
      </header>

      {!ligada && (
        <div className="card border-quente/60 p-4">
          <h2 className="rotulo text-quente">A estação está desligada</h2>
          <EstacaoDesligada className="mt-1" />
          <p className="mt-1 text-xs text-apagado">Pode mandar mesmo assim: o pedido espera na fila até a estação ligar.</p>
        </div>
      )}

      {refId && !roteiro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">Não achei esse roteiro na Esteira. Cola o texto à mão.</p>}
      {roteiro && ref && (
        <p className="text-xs text-suave">
          Roteiro da Esteira: <b>{roteiro.titulo}</b> ·{" "}
          <Link href={`/esteira/${ref.id}#roteiro`} className="text-marca underline">
            ver a referência
          </Link>
        </p>
      )}

      <FormularioEdicao
        inicial={{
          titulo: roteiro?.titulo ?? "",
          roteiro: roteiro ? roteiroEmTexto(roteiro) : "",
          estilo: estiloValido(perfil.estilo),
          legenda: legendaValida(perfil.estilo, perfil.legenda),
          cor: lookValido(perfil.cor) ?? "natural",
        }}
      />
    </div>
  );
}
