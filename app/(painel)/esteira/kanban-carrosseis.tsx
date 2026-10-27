import Link from "next/link";
import { haQuanto } from "@/lib/formato";
import { STATUS_ATIVOS, type ResultadoCarrossel } from "@/lib/carrossel/comum";

// Kanban da aba Carrosséis (pedido do criador, 18/10): mostra onde cada carrossel está, com o número
// fixo (#01…) e a palavra do CTA. A coluna sai do andamento da produção; só "Postados" é manual
// (botão na página do carrossel).

export type RefCarrossel = {
  id: string;
  etapa: string;
  numero: number | null;
  palavra_cta: string | null;
  autor: string | null;
  legenda: string | null;
  arquivo: string | null;
  slides: string[] | null;
  copia_cli: unknown;
  criado_em: string;
};
export type TrabalhoResumo = { referencia_id: string; status: string; etapa: string | null; modo_visual: string | null; erro: string | null };
export type EntregaResumo = { id: string; palavra: string | null; publicada: boolean };

type Coluna = "referencias" | "fila" | "produzindo" | "prontos" | "postados";
const COLUNAS: Array<{ id: Coluna; nome: string; dica: string }> = [
  { id: "referencias", nome: "Referências", dica: "importados, ainda sem cópia" },
  { id: "fila", nome: "Na fila", dica: "esperando a estação" },
  { id: "produzindo", nome: "Produzindo", dica: "a estação está fazendo agora" },
  { id: "prontos", nome: "Prontos", dica: "pra revisar e postar" },
  { id: "postados", nome: "Postados", dica: "já no feed" },
];

export const capaDaCopia = (r: RefCarrossel) => {
  const arq = (r.copia_cli as ResultadoCarrossel | null)?.arquivos?.[0];
  return arq ? arq.replace(/\.mp4$/i, ".png") : null; // slide em vídeo tem o PNG do mesmo slide como capa
};

function colunaDe(r: RefCarrossel, t: TrabalhoResumo | undefined): Coluna {
  if (r.etapa === "postado") return "postados";
  if (t && t.status === "aguardando_estacao") return "fila";
  if (t && STATUS_ATIVOS.includes(t.status)) return "produzindo";
  if (r.copia_cli) return "prontos";
  return "referencias";
}

export const numeroFmt = (n: number) => `#${String(n).padStart(2, "0")}`;

export function KanbanCarrosseis({ refs, trabalhos, entregas, assinados }: {
  refs: RefCarrossel[];
  trabalhos: Map<string, TrabalhoResumo>;
  entregas: Map<string, EntregaResumo>;
  assinados: Map<string, string>;
}) {
  const porColuna = new Map<Coluna, RefCarrossel[]>(COLUNAS.map(c => [c.id, []]));
  for (const r of refs) porColuna.get(colunaDe(r, trabalhos.get(r.id)))!.push(r);
  // Numerados em ordem de número; o resto (referências novas) do mais recente pro mais antigo
  for (const lista of porColuna.values()) lista.sort((a, b) => (a.numero ?? 1e9) - (b.numero ?? 1e9) || b.criado_em.localeCompare(a.criado_em));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {COLUNAS.map(col => {
        const cards = porColuna.get(col.id)!;
        return (
          <section key={col.id} className="w-72 shrink-0">
            <h2 className="mb-0.5 flex items-baseline justify-between rotulo">
              {col.nome} <span className="text-xs text-apagado">{cards.length}</span>
            </h2>
            <p className="mb-2 text-[11px] text-apagado">{col.dica}</p>
            <ul className="space-y-2">
              {cards.map(r => {
                const t = trabalhos.get(r.id);
                const capa = capaDaCopia(r);
                const url = (capa && assinados.get(capa)) || (r.arquivo ? assinados.get(r.arquivo) : undefined);
                const video = !capa && r.arquivo?.endsWith(".mp4");
                const entrega = r.palavra_cta ? entregas.get(r.palavra_cta.toUpperCase()) : undefined;
                const slides = 1 + (r.slides ?? []).length;
                return (
                  <li key={r.id}>
                    <Link href={`/esteira/${r.id}`} className="card block overflow-hidden hover:border-suave/40">
                      <div className="relative">
                        {url &&
                          (video ? (
                            <video src={`${url}#t=0.5`} preload="metadata" muted className="aspect-[4/5] w-full bg-black object-cover" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt="" className="aspect-[4/5] w-full object-cover" />
                          ))}
                        {r.numero != null && (
                          <span className="absolute left-2 top-2 rounded-lg border-2 border-tinta bg-marca px-2 py-0.5 font-mono text-sm font-bold text-[#05070e] shadow-[0_2px_0_#000]">
                            {numeroFmt(r.numero)}
                          </span>
                        )}
                        {capa && <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-white">nossa versão</span>}
                      </div>
                      <div className="space-y-2 p-3 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {r.palavra_cta && <span className="chip font-mono font-bold">{r.palavra_cta}</span>}
                          {t?.modo_visual && <span className="chip">{t.modo_visual === "recriar" ? "recriado" : "copiado"}</span>}
                          <span className="chip">{slides} slides</span>
                        </div>
                        {col.id === "produzindo" && t?.etapa && <p className="text-xs text-morno">{t.etapa}</p>}
                        {t?.status === "erro" && col.id === "referencias" && <p className="text-xs text-quente">a cópia deu erro: {t.erro?.slice(0, 90)}</p>}
                        {(col.id === "prontos" || col.id === "postados") && r.palavra_cta && (
                          <p className={`text-xs ${entrega?.publicada ? "text-marca" : "text-morno"}`}>
                            {!entrega ? "sem material dessa palavra" : entrega.publicada ? "material publicado" : "material pronto, falta publicar"}
                          </p>
                        )}
                        <p className="text-[11px] text-apagado">
                          {r.autor ? `ref. @${r.autor} · ` : ""}
                          {haQuanto(r.criado_em)}
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
  );
}
