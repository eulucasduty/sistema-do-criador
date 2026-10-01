import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { haQuanto } from "@/lib/formato";
import { FINAIS, PASSO_DA_IA, STATUS_EDICAO, estacaoLigada, nomeDaLegenda, nomeDoEstilo, nomeDoMotor, type BatidaEstacao } from "@/lib/editor";
import { BotaoGerar } from "../../esteira/botoes";
import { apagarEdicao, cancelarEdicao, pedirAjuste, tentarDeNovo } from "../acoes";
import { AutoAtualizar } from "../atualizar";
import { EstacaoDesligada } from "../estacao";
import { nomeDoLook } from "../opcoes";

export const dynamic = "force-dynamic";

type Uso = { motor?: string; modelo?: string; turnos?: number; duracao_s?: number; render_s?: number; equivalente_api_usd?: number | null; custo_usd?: number | null; conserto?: { custo_usd?: number | null } };
type Resultado = { caminho: string; tamanho?: number; duracao?: number; local?: string };
type Linha = { t: string; msg: string };
type Opcoes = { estilo?: string; legenda?: string; cor?: string };

const horaSP = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
const minutos = (s?: number) => (s ? (s < 90 ? `${s} s` : `${Math.round(s / 60)} min`) : "—");
const nomeArquivo = (t: string, v: number) =>
  `${t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "video"}${v > 1 ? `-v${v}` : ""}.mp4`;

export default async function PaginaEdicao({ params, searchParams }: PageProps<"/editor/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const { data: e } = await supabase.from("edicao").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const [{ data: materiais }, { data: filhos }, { data: origem }, { data: cfg }] = await Promise.all([
    supabase.from("edicao_material").select("id, tipo, descricao, url, arquivo").eq("edicao_id", id).order("ordem"),
    supabase.from("edicao").select("id, versao, status, criado_em").eq("origem_id", id).order("criado_em"),
    e.origem_id ? supabase.from("edicao").select("id, versao").eq("id", e.origem_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("configuracao").select("valor").eq("chave", "estacao_edicao").maybeSingle(),
  ]);

  const s = STATUS_EDICAO[e.status] ?? { nome: e.status, cor: "text-suave" };
  const final = FINAIS.includes(e.status);
  const resultado = e.resultado as Resultado | null;
  const uso = e.uso as Uso | null;
  const log = ((e.log ?? []) as Linha[]).slice().reverse();
  const ligada = estacaoLigada(cfg?.valor as BatidaEstacao | null);
  const opcoes = (e.opcoes ?? {}) as Opcoes;
  const escolhas = [`estilo ${nomeDoEstilo(opcoes.estilo)}`, `legenda ${nomeDaLegenda(opcoes.estilo, opcoes.legenda).toLowerCase()}`, nomeDoLook(opcoes.cor) && `look ${nomeDoLook(opcoes.cor)}`].filter(Boolean).join(" · ");

  let assistir: string | null = null;
  let baixar: string | null = null;
  if (resultado?.caminho) {
    const storage = createAdminClient().storage.from("edicao");
    const [a, b] = await Promise.all([storage.createSignedUrl(resultado.caminho, 3600), storage.createSignedUrl(resultado.caminho, 3600, { download: nomeArquivo(e.titulo, e.versao) })]);
    assistir = a.data?.signedUrl ?? null;
    baixar = b.data?.signedUrl ?? null;
  }

  return (
    <div className="max-w-4xl space-y-5">
      {!final && <AutoAtualizar segundos={5} />}
      <header>
        <Link href="/editor" className="text-xs text-apagado hover:text-texto">
          ← Editor de vídeo
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="titulo">{e.titulo}</h1>
          <span className={`chip ${s.cor}`}>{s.nome}</span>
          {e.versao > 1 && <span className="font-mono text-xs text-apagado">versão {e.versao}</span>}
        </div>
        <p className="mt-1 text-xs text-apagado">
          Pedido {haQuanto(e.criado_em)}
          {origem ? (
            <>
              {" · ajuste da "}
              <Link href={`/editor/${origem.id}`} className="text-marca">
                versão {origem.versao}
              </Link>
            </>
          ) : null}
          {escolhas ? ` · ${escolhas}` : ""}
        </p>
      </header>
      {q.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      {!final && (
        <section className="card space-y-2 p-4">
          <p className="text-sm">{e.etapa ?? "…"}</p>
          {!ligada && e.status === "na_fila" && (
            <div className="rounded-lg border-2 border-quente/50 p-3">
              <p className="text-sm font-bold text-quente">A estação está desligada: o pedido espera na fila.</p>
              <EstacaoDesligada className="mt-1" />
            </div>
          )}
          <p className="text-xs text-apagado">A edição leva uns minutos (a IA monta, confere e depois a estação renderiza). Pode sair da página.</p>
          <form action={cancelarEdicao}>
            <input type="hidden" name="id" value={e.id} />
            <button className="text-xs text-quente">cancelar</button>
          </form>
        </section>
      )}

      {e.status === "erro" && (
        <section className="card space-y-2 border-quente/60 p-4">
          <h2 className="rotulo text-quente">Deu erro</h2>
          <p className="whitespace-pre-wrap font-mono text-xs text-suave">{e.erro}</p>
          <form action={tentarDeNovo}>
            <input type="hidden" name="id" value={e.id} />
            <BotaoGerar rotulo="Tentar de novo" gerando="Voltando pra fila…" className="btn btn-sm" />
          </form>
        </section>
      )}

      {e.status === "cancelada" && (
        <form action={tentarDeNovo} className="card flex items-center justify-between gap-3 p-4">
          <input type="hidden" name="id" value={e.id} />
          <p className="text-sm text-suave">Cancelada.</p>
          <BotaoGerar rotulo="Mandar de novo pra fila" gerando="Voltando…" className="btn btn-sm btn-2" />
        </form>
      )}

      {e.status === "pronto" && (
        <section className="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr]">
          <div className="space-y-2">
            {assistir ? (
              <video src={assistir} controls playsInline className="aspect-[9/16] w-full rounded-2xl border-2 border-tinta bg-black" />
            ) : (
              <p className="text-sm text-quente">Não achei o vídeo no storage.</p>
            )}
            {baixar && (
              <a href={baixar} className="btn btn-sm w-full">
                Baixar o vídeo
              </a>
            )}
            {resultado?.local && <p className="break-all text-xs text-apagado">No PC: {resultado.local}</p>}
          </div>
          <div className="space-y-4">
            {e.resumo && (
              <div className="card p-4">
                <h2 className="rotulo">O que o editor fez</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-suave">{e.resumo}</p>
              </div>
            )}
            {uso && (
              <p className="text-xs text-apagado">
                {nomeDoMotor(uso.motor)} ({uso.modelo ?? "opus"}): {uso.turnos ?? "?"} passos em {minutos(uso.duracao_s)} · render {minutos(uso.render_s)}
                {uso.motor === "openrouter"
                  ? typeof uso.custo_usd === "number"
                    ? ` · custou uns US$ ${(uso.custo_usd + (uso.conserto?.custo_usd ?? 0)).toFixed(2)} na OpenRouter`
                    : ""
                  : typeof uso.equivalente_api_usd === "number"
                    ? ` · no plano (se fosse API, uns US$ ${uso.equivalente_api_usd.toFixed(2)})`
                    : " · no plano"}
              </p>
            )}
            <form action={pedirAjuste} className="card space-y-2 p-4">
              <input type="hidden" name="id" value={e.id} />
              <h2 className="rotulo">Pedir ajuste</h2>
              <textarea
                name="ajuste"
                rows={4}
                className="campo"
                placeholder="O que mudar, com o momento se der: 'no 0:12 troca o card por um print do GitHub', 'legenda mais pra cima no final', 'tira o zoom do começo'…"
                required
              />
              <BotaoGerar rotulo="Mandar o ajuste" gerando="Mandando…" className="btn btn-sm" />
              <p className="text-xs text-apagado">Vira a versão {e.versao + 1}: o editor parte desta e muda só o que você pediu.</p>
            </form>
          </div>
        </section>
      )}

      {(filhos ?? []).length > 0 && (
        <section className="text-sm">
          <h2 className="rotulo">Ajustes</h2>
          <ul className="mt-2 space-y-1">
            {(filhos ?? []).map((f) => (
              <li key={f.id}>
                <Link href={`/editor/${f.id}`} className="text-marca">
                  versão {f.versao}
                </Link>{" "}
                <span className="text-xs text-apagado">
                  · {STATUS_EDICAO[f.status]?.nome ?? f.status} · {haQuanto(f.criado_em)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {e.ajuste && (
        <section className="card p-4 text-sm">
          <h2 className="rotulo">Ajuste pedido</h2>
          <p className="mt-2 whitespace-pre-wrap text-suave">{e.ajuste}</p>
        </section>
      )}

      {(materiais ?? []).length > 0 && (
        <section className="card p-4 text-sm">
          <h2 className="rotulo">Materiais</h2>
          <ul className="mt-2 space-y-2">
            {(materiais ?? []).map((m, k) => (
              <li key={m.id} className="flex gap-3">
                <span className="font-mono text-xs text-apagado">{k + 1}</span>
                <div className="min-w-0">
                  <p className="text-suave">{m.descricao}</p>
                  <p className="truncate text-xs text-apagado">{m.tipo === "link" ? m.url : `${m.tipo} · ${(m.arquivo as { nome?: string } | null)?.nome ?? ""}`}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {e.roteiro && (
        <details className="card p-4 text-sm">
          <summary className="rotulo cursor-pointer">Roteiro / contexto</summary>
          <p className="mt-2 whitespace-pre-wrap text-suave">{e.roteiro}</p>
        </details>
      )}

      {log.length > 0 && (
        <details className="card p-4" open={!final}>
          <summary className="rotulo cursor-pointer">Andamento</summary>
          <ol className="mt-2 max-h-80 space-y-1 overflow-y-auto font-mono text-xs">
            {log.map((l, k) => (
              <li key={k} className="flex gap-3">
                <span className="shrink-0 text-apagado">{horaSP(l.t)}</span>
                <span className={PASSO_DA_IA.test(l.msg) ? "text-apagado" : "text-suave"}>{l.msg}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <form action={apagarEdicao} className="pt-2">
        <input type="hidden" name="id" value={e.id} />
        <button className="text-xs text-quente">apagar esta edição (e os arquivos no storage)</button>
      </form>
    </div>
  );
}
