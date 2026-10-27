import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AutoAtualizar } from "../editor/atualizar";
import { pausarPost, retomarPost } from "./acoes";

export const dynamic = "force-dynamic";

// Agenda dos carrosséis (pedido do criador, 18/10): 6 por dia, de 2 em 2 h a partir das 6h. O relógio
// do servidor publica sozinho na hora marcada (não precisa do PC ligado) e, quando sai, publica o
// material da palavra.

const STATUS: Record<string, { nome: string; cor: string }> = {
  agendado: { nome: "agendado", cor: "text-suave" },
  enviando: { nome: "enviando", cor: "text-morno" },
  processando: { nome: "processando", cor: "text-morno" },
  publicando: { nome: "publicando", cor: "text-morno" },
  publicada: { nome: "publicado", cor: "text-ok" },
  erro: { nome: "erro", cor: "text-quente" },
  pausado: { nome: "pausado", cor: "text-apagado" },
};

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit" });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

export default async function PaginaAgenda() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("carrossel_post")
    .select("id, palavra, legenda, publicar_em, status, permalink, erro, etapa, referencia:referencia_id(numero)")
    .order("publicar_em")
    .limit(300);
  const { data: reels } = await supabase.from("postagem").select("id, edicao_id, status, legenda, publicar_em, permalink, erro, etapa").not("publicar_em", "is", null).order("publicar_em").limit(300);
  const posts = data ?? [];
  const andando = posts.some((p) => ["enviando", "processando", "publicando"].includes(p.status));
  const dias = new Map<string, typeof posts>();
  for (const p of posts) {
    const d = dia(p.publicar_em);
    dias.set(d, [...(dias.get(d) ?? []), p]);
  }
  const contar = (s: string) => posts.filter((p) => p.status === s).length;

  return (
    <div className="space-y-6">
      {andando && <AutoAtualizar segundos={15} />}
      <header>
        <h1 className="titulo">Agenda</h1>
        <p className="mt-1 max-w-2xl text-sm text-suave">
          Reels e carrosséis saem nos horários aprovados por você. Confira o andamento, abra o post publicado e revise qualquer erro antes de retomar. Horários de Brasília.
        </p>
        <p className="mt-2 text-xs text-apagado">
          {contar("agendado")} agendados · {contar("publicada")} publicados · {contar("pausado")} pausados · {contar("erro")} com erro
        </p>
      </header>

      <section className="card space-y-3 p-4"><h2 className="rotulo text-roxo">Reels</h2>{!(reels ?? []).length && <p className="text-sm text-apagado">Aprove um vídeo na Esteira para agendar seu primeiro reel.</p>}{(reels ?? []).map(p=><article key={p.id} className="flex flex-wrap items-start justify-between gap-3 border-t border-borda pt-3 text-sm"><div><p className="font-bold">{dia(p.publicar_em)} · {hora(p.publicar_em)} <span className="chip ml-2">{p.status}</span></p><p className="mt-1 line-clamp-2 text-suave">{p.legenda || p.etapa || "Aguardando legenda da estação"}</p>{p.erro && <p className="mt-1 text-quente">{p.erro}</p>}</div><div className="flex gap-3 text-xs"><Link href={`/editor/${p.edicao_id}`} className="text-marca underline">Ver vídeo</Link>{p.permalink && <a href={p.permalink} target="_blank" rel="noreferrer" className="text-frio underline">Ver no Instagram ↗</a>}</div></article>)}</section>
      <h2 className="rotulo text-frio">Carrosséis</h2>
      {!posts.length && <p className="text-sm text-apagado">Nenhum carrossel agendado ainda.</p>}

      {[...dias.entries()].map(([d, lista]) => (
        <section key={d} className="space-y-2">
          <h2 className="text-sm font-bold capitalize">{d}</h2>
          <ul className="divide-y divide-borda rounded-xl border border-borda">
            {lista.map((p) => {
              const st = STATUS[p.status] ?? { nome: p.status, cor: "text-suave" };
              const ref = p.referencia as unknown as { numero: number | null } | null;
              return (
                <li key={p.id} className="flex flex-wrap items-start gap-3 p-3 text-sm">
                  <span className="w-12 shrink-0 font-mono">{hora(p.publicar_em)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {ref?.numero ? `#${String(ref.numero).padStart(2, "0")} · ` : ""}
                      {p.palavra}
                      <span className={`ml-2 text-xs font-normal ${st.cor}`}>{st.nome}{p.etapa ? ` · ${p.etapa}` : ""}</span>
                    </p>
                    <p className="truncate text-xs text-suave">{p.legenda.split("\n").filter(Boolean).slice(1, 2).join(" ")}</p>
                    {p.erro && <p className="mt-1 text-xs text-quente">{p.erro}</p>}
                  </div>
                  {p.permalink && (
                    <a href={p.permalink} target="_blank" rel="noreferrer" className="text-xs underline">
                      ver post
                    </a>
                  )}
                  {p.status === "agendado" && (
                    <form action={pausarPost}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-xs text-suave underline">pausar</button>
                    </form>
                  )}
                  {(p.status === "pausado" || p.status === "erro") && (
                    <form action={retomarPost}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="text-xs underline">{p.status === "erro" ? "tentar de novo" : "voltar pra agenda"}</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
