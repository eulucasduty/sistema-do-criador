import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuanto } from "@/lib/formato";
import { estacaoLigada, type BatidaEstacao } from "@/lib/editor";
import { BotaoGerar } from "../esteira/botoes";
import { AutoAtualizar } from "../editor/atualizar";
import { criarEntrega } from "./acoes";

export const dynamic = "force-dynamic";

// Materiais: as entregas dos CTAs ("comenta X que eu te mando"). Cada uma é uma página no ar em
// /m/<endereço>, com passo a passo, prompts, links e templates. Quem comenta a palavra recebe o link
// na DM. A estação escreve o rascunho; você revisa e publica.

const STATUS: Record<string, { nome: string; cor: string }> = {
  rascunho: { nome: "rascunho", cor: "text-suave" },
  aguardando_estacao: { nome: "na fila da estação", cor: "text-morno" },
  escrevendo: { nome: "escrevendo", cor: "text-morno" },
  pronta: { nome: "pronta", cor: "text-ok" },
  erro: { nome: "erro", cor: "text-quente" },
};

export default async function PaginaMateriais({ searchParams }: PageProps<"/materiais">) {
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: entregas }, { data: edicoes }, { data: cfgEstacao }] = await Promise.all([
    supabase.from("entrega").select("id, slug, palavra, titulo, status, publicada, na_dm, visitas, criado_em, etapa").order("criado_em", { ascending: false }).limit(100),
    supabase.from("edicao").select("id, titulo, versao, cta_palavra, criado_em").eq("status", "pronto").order("criado_em", { ascending: false }).limit(30),
    supabase.from("configuracao").select("valor").eq("chave", "estacao_roteiros").maybeSingle(),
  ]);
  const ligada = estacaoLigada(cfgEstacao?.valor as BatidaEstacao | null);
  const andando = (entregas ?? []).some((e) => e.status === "aguardando_estacao" || e.status === "escrevendo");

  return (
    <div className="max-w-4xl space-y-5">
      {andando && <AutoAtualizar segundos={6} />}
      <header>
        <h1 className="titulo">Materiais</h1>
        <p className="mt-1 text-sm text-suave">
          O que você entrega no “comenta X”: uma página no celular com o passo a passo, os prompts (com botão de copiar), os links e os templates. Quem comenta a palavra recebe o link na DM.
        </p>
      </header>
      {q.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      <form action={criarEntrega} className="card space-y-3 p-4">
        <h2 className="rotulo">Novo material</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs text-apagado">Palavra do comentário</span>
            <input name="palavra" className="campo" placeholder="ex.: MANYCHAT" maxLength={40} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-apagado">Do vídeo (opcional: a estação lê o que você falou)</span>
            <select name="edicao_id" className="campo" defaultValue="">
              <option value="">nenhum</option>
              {(edicoes ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.titulo}
                  {e.versao > 1 ? ` (v${e.versao})` : ""}
                  {e.cta_palavra ? ` · ${e.cta_palavra}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-apagado">Título (opcional)</span>
          <input name="titulo" className="campo" maxLength={120} placeholder="a estação dá um se ficar vazio" />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-apagado">O que entregar</span>
          <textarea
            name="pedido"
            rows={6}
            className="campo"
            placeholder={"Cola aqui o que já tem e escreva o que não pode faltar. Ex.:\n- o prompt que eu uso pra criar o ManyChat (colar)\n- o link do repositório: https://github.com/…\n- passo a passo de criar o app na BM\nOs links que você colar entram como estão; a estação nunca inventa link."}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <BotaoGerar rotulo="Montar o material" gerando="Mandando pra estação…" className="btn" />
          {!ligada && <span className="text-xs text-quente">a estação está desligada: o pedido espera ela ligar</span>}
        </div>
      </form>

      <section className="space-y-2">
        <h2 className="rotulo">Os materiais</h2>
        {!(entregas ?? []).length && <p className="text-sm text-apagado">Nenhum ainda.</p>}
        <ul className="space-y-2">
          {(entregas ?? []).map((e) => {
            const s = STATUS[e.status] ?? { nome: e.status, cor: "text-suave" };
            return (
              <li key={e.id} className="card flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <Link href={`/materiais/${e.id}`} className="font-bold hover:text-marca">
                    {e.titulo || `/m/${e.slug}`}
                  </Link>
                  <p className="text-xs text-apagado">
                    {e.palavra ? `comenta ${e.palavra} · ` : ""}/m/{e.slug} · {haQuanto(e.criado_em)}
                    {e.publicada ? ` · ${e.visitas} visita${e.visitas === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`chip ${s.cor}`}>{s.nome}</span>
                  {e.publicada && <span className="chip text-ok">no ar{e.na_dm ? " · na DM" : ""}</span>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>


    </div>
  );
}
