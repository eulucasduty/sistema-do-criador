import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { haQuanto, nomeDoContato } from "@/lib/formato";
import { marcarNaoContatar, resolverAlerta, salvarObservacoes } from "../../acoes";
import { salvarTags } from "../acoes";

export const dynamic = "force-dynamic";

export default async function Lead({ params }: PageProps<"/contatos/[id]">) {
  const { id } = await params;
  const db = await createClient();
  const { data: contato } = await db.from("contato").select("*").eq("id", id).maybeSingle();
  if (!contato) notFound();
  const [{ data: mensagens }, { data: fluxos }, { data: alertas }] = await Promise.all([
    db.from("mensagem").select("id, direcao, conteudo, tipo, enviada_em, status").eq("contato_id", id).order("enviada_em", { ascending: false }).limit(80),
    db.from("ig_fluxo").select("id, etapa, criado_em, automacao:automacao_id(nome)").eq("contato_id", id).order("criado_em", { ascending: false }).limit(20),
    db.from("alerta").select("id, motivo, criado_em").eq("contato_id", id).eq("resolvido", false).limit(20),
  ]);
  return <div className="max-w-5xl space-y-6">
    <Link href="/contatos" className="text-sm text-suave">← Leads</Link>
    <header className="card studio-hero space-y-3 p-6"><p className="kicker">Sua audiência</p><h1 className="titulo">{nomeDoContato(contato)}</h1><p className="text-sm text-suave">Chegou {haQuanto(contato.criado_em)}{contato.instagram_usuario ? ` · @${contato.instagram_usuario}` : ""}</p>{contato.nao_contatar && <span className="chip text-quente">Não contatar</span>}{contato.instagram_usuario && <a href={`https://www.instagram.com/${encodeURIComponent(contato.instagram_usuario)}/`} target="_blank" rel="noreferrer" className="btn btn-sm btn-2 ml-3">Abrir no Instagram ↗</a>}</header>
    {(alertas ?? []).map(a=><div key={a.id} className="card flex flex-wrap items-center justify-between gap-3 border-morno/40 p-4"><p className="text-sm">{a.motivo}</p><form action={resolverAlerta}><input type="hidden" name="id" value={a.id} /><button className="btn btn-sm btn-2">Resolver</button></form></div>)}
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <section className="card space-y-4 p-5"><h2 className="rotulo">Conversa no direct</h2><p className="text-xs text-suave">Para responder pessoalmente, use o aplicativo do Instagram.</p>{!(mensagens ?? []).length && <p className="text-sm text-apagado">Nenhuma mensagem ainda.</p>}<ol className="space-y-3">{[...(mensagens ?? [])].reverse().map(m=><li key={m.id} className={`rounded-xl p-3 text-sm ${m.direcao === "saida" ? "ml-6 bg-marca-fundo" : "mr-6 bg-superficie-2"}`}><p className="whitespace-pre-wrap break-words">{m.conteudo || `Mensagem de ${m.tipo}`}</p><p className="mt-2 text-xs text-apagado">{m.direcao === "saida" ? "Você / automação" : "Contato"} · {haQuanto(m.enviada_em)}{m.status === "falhou" ? " · envio falhou" : ""}</p></li>)}</ol></section>
      <aside className="space-y-4">
        <section className="card space-y-3 p-5"><h2 className="rotulo">Automações</h2>{!(fluxos ?? []).length && <p className="text-sm text-apagado">Nenhuma participação ainda.</p>}{(fluxos ?? []).map(f=>{const a=Array.isArray(f.automacao)?f.automacao[0]:f.automacao;return <p key={f.id} className="text-sm"><b>{a?.nome || "Automação"}</b><span className="block text-xs text-suave">{f.etapa === "entregue" || f.etapa === "com_agente" ? "Material entregue" : f.etapa === "abertura" ? "Primeira mensagem enviada" : "Aguardando seguir"} · {haQuanto(f.criado_em)}</span></p>;})}</section>
        <form action={salvarTags} className="card space-y-3 p-5"><input type="hidden" name="contato_id" value={id} /><label className="rotulo block" htmlFor="tags">Etiquetas</label><input id="tags" name="tags" defaultValue={(contato.tags ?? []).join(", ")} className="campo" placeholder="Separadas por vírgula" /><button className="btn btn-sm btn-2">Salvar etiquetas</button></form>
        <form action={salvarObservacoes} className="card space-y-3 p-5"><input type="hidden" name="contato_id" value={id} /><label className="rotulo block" htmlFor="notas">Suas observações</label><textarea id="notas" name="observacoes" rows={4} defaultValue={contato.observacoes ?? ""} className="campo" /><button className="btn btn-sm btn-2">Salvar observações</button></form>
        <form action={marcarNaoContatar} className="card space-y-3 p-5"><input type="hidden" name="contato_id" value={id} /><input type="hidden" name="valor" value={contato.nao_contatar ? "nao" : "sim"} /><p className="text-xs text-suave">Bloqueia as mensagens automáticas para esta pessoa.</p><button className="btn btn-sm btn-2">{contato.nao_contatar ? "Permitir automações" : "Não contatar"}</button></form>
      </aside>
    </div>
  </div>;
}
