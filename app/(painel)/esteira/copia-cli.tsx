import { AutoAtualizar } from "../editor/atualizar";
import { Copiar } from "../copiar";
import { BaixarTodos } from "./botoes";
import { STATUS_ATIVOS, ehVideo, type PedidoCarrossel, type ResultadoCarrossel } from "@/lib/carrossel/comum";

export function CopiaCLI({ id, trabalho, resultado, ligada }: { id: string; trabalho: PedidoCarrossel | null; resultado: ResultadoCarrossel | null; ligada: boolean }) {
  const ativo = trabalho && STATUS_ATIVOS.includes(trabalho.status);
  const nome = (c: string, i: number) => `carrossel-${String(i + 1).padStart(2, "0")}.${ehVideo(c) ? "mp4" : "png"}`;
  const emVideo = resultado?.arquivos.filter(ehVideo).length ?? 0;
  return <div className="space-y-3">
    {ativo && <AutoAtualizar segundos={5} />}
    {trabalho && <div aria-live="polite" className="rounded-lg bg-superficie-2 p-3 text-sm">
      <p className="font-bold">{trabalho.status === "pronto" ? "Carrossel pronto" : trabalho.status === "erro" ? "A produção precisa de ajuste" : trabalho.status === "aguardando_estacao" ? (ligada ? "Na fila da estação" : "Aguardando abrir a estação no PC") : "Produzindo o carrossel"} · {trabalho.agente === "codex" ? "Codex" : "Claude Code"}</p>
      {trabalho.etapa && <p className="mt-1 text-xs text-suave">{trabalho.etapa}</p>}
      {trabalho.erro && <p className="mt-1 text-xs text-quente">{trabalho.erro}</p>}
      {ativo && !ligada && <p className="mt-1 text-xs text-suave">Abra a estação no PC para continuar. Seu pedido está salvo.</p>}
    </div>}
    {resultado && <>
      <p className="text-sm font-bold">{resultado.titulo} <span className="font-normal text-apagado">· {resultado.arquivos.length} slides{emVideo ? ` (${emVideo} em vídeo)` : ""} · PT-BR · foto + @ em todos</span></p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {resultado.arquivos.map((c, i) => {
          const src = `/esteira/${id}/slide/${i + 1}?v=${encodeURIComponent(resultado.gerado_em)}`;
          if (ehVideo(c)) return <video key={i} src={src} poster={`${src}&capa=1`} controls muted loop playsInline preload="none" aria-label={`Arte ${i + 1} em vídeo`} className="aspect-[4/5] w-full rounded-lg border-2 border-tinta bg-black object-contain" />;
          return <a key={i} href={src} target="_blank" rel="noreferrer" className="block" aria-label={`Abrir arte ${i + 1} em tamanho real`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Arte ${i + 1} em português do Brasil`} loading="lazy" className="aspect-[4/5] w-full rounded-lg border-2 border-tinta object-contain" />
          </a>;
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <BaixarTodos arquivos={resultado.arquivos.map((c, i) => ({ url: `/esteira/${id}/slide/${i + 1}?v=${encodeURIComponent(resultado.gerado_em)}`, nome: nome(c, i) }))} />
        <Copiar texto={resultado.legenda} rotulo="Copiar legenda" className="btn btn-sm btn-2" />
      </div>
      <div className="rounded-lg bg-superficie-2 p-3 text-sm"><p className="text-xs font-bold text-apagado">LEGENDA · PT-BR</p><p className="mt-1 whitespace-pre-wrap">{resultado.legenda}</p></div>
      <details className="text-sm"><summary className="cursor-pointer text-xs text-marca">Conferir o texto de cada slide</summary><ol className="mt-2 space-y-2">{resultado.textos.map(s => <li key={s.n}><span className="font-bold">Slide {s.n}</span><p className="whitespace-pre-wrap text-suave">{s.ptbr}</p></li>)}</ol></details>
    </>}
  </div>;
}
