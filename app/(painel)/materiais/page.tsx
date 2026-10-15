import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuanto } from "@/lib/formato";
import { estacaoLigada, type BatidaEstacao } from "@/lib/editor";
import { ENTREGAS_PADRAO, type ConfigEntregas } from "@/lib/config";
import { AVISO_MIGRACAO, faltaMigracao } from "@/lib/entregas/servidor";
import { BotaoGerar } from "../esteira/botoes";
import { AutoAtualizar } from "../editor/atualizar";
import { criarEntrega, criarEntregaEmBranco, salvarConvite } from "./acoes";

export const dynamic = "force-dynamic";

// Materiais: as entregas dos CTAs ("comenta X que eu te mando"). Cada uma é uma página no ar em
// /m/<endereço>, com passo a passo, prompts, links e templates. Quem comenta a palavra recebe o link
// na DM (com o convite depois, se você quiser). A estação escreve o rascunho; você revisa e publica.

const STATUS: Record<string, { nome: string; cor: string }> = {
  rascunho: { nome: "rascunho", cor: "text-suave" },
  aguardando_estacao: { nome: "na fila da estação", cor: "text-morno" },
  escrevendo: { nome: "escrevendo", cor: "text-morno" },
  pronta: { nome: "pronto", cor: "text-ok" },
  erro: { nome: "erro", cor: "text-quente" },
};

export default async function PaginaMateriais({ searchParams }: PageProps<"/materiais">) {
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: entregas, error }, { data: edicoes }, { data: cfgEstacao }, { data: cfgEntregas }] = await Promise.all([
    supabase.from("entrega").select("id, slug, palavra, titulo, status, publicada, na_dm, visitas, criado_em").order("criado_em", { ascending: false }).limit(100),
    supabase.from("edicao").select("id, titulo, versao, cta_palavra").eq("status", "pronto").order("criado_em", { ascending: false }).limit(30),
    supabase.from("configuracao").select("valor").eq("chave", "estacao_edicao").maybeSingle(),
    supabase.from("configuracao").select("valor").eq("chave", "entregas").maybeSingle(),
  ]);
  const ligada = estacaoLigada(cfgEstacao?.valor as BatidaEstacao | null);
  const cfg = { ...ENTREGAS_PADRAO, ...((cfgEntregas?.valor as Partial<ConfigEntregas> | null) ?? {}) };
  const andando = (entregas ?? []).some((e) => e.status === "aguardando_estacao" || e.status === "escrevendo");

  return (
    <div className="max-w-4xl space-y-5">
      {andando && <AutoAtualizar segundos={6} />}
      <header>
        <h1 className="titulo">Materiais</h1>
        <p className="mt-1 text-sm text-suave">
          O que você entrega no “comenta X”: uma página no celular com o passo a passo, os prompts (com botão de copiar), os links e os templates. Quem
          comenta a palavra recebe o link na DM, pela sua <Link href="/instagram" className="text-marca underline">automação</Link>.
        </p>
      </header>
      {q.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}
      {error && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{faltaMigracao(error) ? AVISO_MIGRACAO : error.message}</p>}

      <form action={criarEntrega} className="card space-y-3 p-4">
        <h2 className="rotulo">Novo material</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs text-apagado">Palavra do comentário</span>
            <input name="palavra" className="campo" placeholder="ex.: PLANILHA" maxLength={40} />
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
            placeholder={"Cole aqui o que você já tem e escreva o que não pode faltar. Ex.:\n- o prompt que eu uso no vídeo (colar)\n- o link da ferramenta: https://…\n- o passo a passo de configurar\nOs links que você colar entram como estão; a estação nunca inventa link."}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <BotaoGerar rotulo="Montar o material" gerando="Mandando pra estação…" className="btn" />
          <button formAction={criarEntregaEmBranco} className="btn btn-sm btn-2">
            Escrever à mão
          </button>
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

      <form action={salvarConvite} className="card space-y-3 p-4">
        <h2 className="rotulo">Na DM</h2>
        <p className="text-xs text-apagado">
          Quando o material está no ar com “mandar na DM”, quem comenta a palavra recebe esta mensagem com o botão do material, no lugar das mensagens de
          entrega da automação (a abertura e o portão de seguidor continuam iguais).
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <label className="block space-y-1">
            <span className="text-xs text-apagado">Mensagem</span>
            <input name="dm_texto" className="campo" defaultValue={cfg.dm_texto} maxLength={600} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-apagado">Texto do botão (até 20 letras)</span>
            <input name="dm_botao" className="campo" defaultValue={cfg.dm_botao} maxLength={20} />
          </label>
        </div>
        <h3 className="rotulo pt-2">Convite depois do material (opcional)</h3>
        <p className="text-xs text-apagado">
          Vai na DM logo depois do link do material e aparece no fim de toda página de material: seu grupo, sua lista, seu produto. Sem texto ou sem link,
          não vai.
        </p>
        <label className="block space-y-1">
          <span className="text-xs text-apagado">Mensagem</span>
          <textarea name="convite_texto" rows={2} className="campo" defaultValue={cfg.convite_texto} placeholder="e se quiser mais material assim antes de todo mundo, entra no meu grupo 👇" />
        </label>
        <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
          <label className="block space-y-1">
            <span className="text-xs text-apagado">Texto do botão (até 20 letras)</span>
            <input name="convite_botao" className="campo" defaultValue={cfg.convite_botao} maxLength={20} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-apagado">Link (https://…)</span>
            <input name="convite_link" className="campo" defaultValue={cfg.convite_link} placeholder="https://" />
          </label>
        </div>
        <BotaoGerar rotulo="Salvar" gerando="Salvando…" className="btn btn-sm btn-2" />
      </form>
    </div>
  );
}
