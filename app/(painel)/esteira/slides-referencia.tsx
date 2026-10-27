"use client";

import { useEffect, useRef, useState } from "react";
import { ordenarSlides } from "./acoes";
import { BotaoGerar } from "./botoes";
import { ehVideo } from "@/lib/carrossel/comum";

/** Todos os slides podem ser abertos em tamanho real, reordenados ou retirados da seleção. */
export function SlidesReferencia({ id, slides }: { id: string; slides: Array<{ caminho: string; url: string }> }) {
  const [ordem, setOrdem] = useState(slides);
  const [aberto, setAberto] = useState<number | null>(null);
  const janela = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (aberto !== null && janela.current && !janela.current.open) janela.current.showModal();
  }, [aberto]);
  const mudou = ordem.map(s => s.caminho).join() !== slides.map(s => s.caminho).join();
  function mover(i: number, delta: number) {
    const proxima = [...ordem];
    [proxima[i], proxima[i + delta]] = [proxima[i + delta], proxima[i]];
    setOrdem(proxima);
  }
  return <div className="space-y-3">
    <p className="text-xs font-bold">{ordem.length} slides disponíveis{ordem.some(s => ehVideo(s.caminho)) ? ` · ${ordem.filter(s => ehVideo(s.caminho)).length} em vídeo` : ""} · clique para ampliar</p>
    <ol className="grid grid-cols-2 gap-2">
      {ordem.map((s, i) => <li key={s.caminho} className="space-y-1">
        <button type="button" onClick={() => setAberto(i)} className="block w-full" aria-label={`Ampliar slide ${i + 1}`}>
          {ehVideo(s.caminho) ? (
            <video src={`${s.url}#t=0.5`} muted playsInline preload="metadata" aria-label={`Referência ${i + 1} em vídeo`} className="aspect-[4/5] w-full rounded-md object-contain bg-superficie-2" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.url} alt={`Referência ${i + 1}${i === 0 ? " · capa" : ""}`} className="aspect-[4/5] w-full rounded-md object-contain bg-superficie-2" />
          )}
        </button>
        <div className="flex items-center justify-between gap-1 text-xs">
          <span>{i + 1}{i === 0 ? " · capa" : ""}{ehVideo(s.caminho) ? " · vídeo" : ""}</span>
          <div className="flex gap-2">
            <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Mover slide ${i + 1} para antes`} className="disabled:opacity-30">←</button>
            <button type="button" disabled={i === ordem.length - 1} onClick={() => mover(i, 1)} aria-label={`Mover slide ${i + 1} para depois`} className="disabled:opacity-30">→</button>
            <button type="button" disabled={ordem.length === 1} onClick={() => setOrdem(ordem.filter((_, j) => j !== i))} aria-label={`Retirar slide ${i + 1}`} className="text-quente disabled:opacity-30">×</button>
          </div>
        </div>
      </li>)}
    </ol>
    {mudou && <form action={ordenarSlides}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="ordem" value={JSON.stringify(ordem.map(s => s.caminho))} />
      <BotaoGerar rotulo="Salvar ordem dos slides" gerando="Salvando…" className="btn btn-sm w-full" />
      <button type="button" onClick={() => setOrdem(slides)} className="mt-2 text-xs underline">Desfazer mudanças</button>
    </form>}
    {aberto !== null && ordem[aberto] && <dialog ref={janela} className="fixed inset-0 z-50 m-auto max-h-[95vh] w-[min(95vw,640px)] overflow-auto rounded-xl border-2 border-borda bg-superficie p-3 backdrop:bg-black/70" onCancel={() => setAberto(null)}>
      <div className="mb-2 flex items-center justify-between text-sm"><span>Slide {aberto + 1} de {ordem.length}</span><button type="button" onClick={() => setAberto(null)} className="btn btn-sm btn-2">Fechar</button></div>
      {ehVideo(ordem[aberto].caminho) ? (
        <video key={ordem[aberto].caminho} src={ordem[aberto].url} controls autoPlay muted loop playsInline className="w-full object-contain" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ordem[aberto].url} alt={`Slide de referência ${aberto + 1} ampliado`} className="w-full object-contain" />
      )}
      <div className="mt-2 flex justify-between"><button type="button" disabled={aberto === 0} onClick={() => setAberto(aberto - 1)} className="btn btn-sm btn-2">← Anterior</button><button type="button" disabled={aberto === ordem.length - 1} onClick={() => setAberto(aberto + 1)} className="btn btn-sm btn-2">Próximo →</button></div>
    </dialog>}
  </div>;
}
