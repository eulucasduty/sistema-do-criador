"use client";

import { useEffect, useRef, useState } from "react";
import { ehVideo } from "@/lib/esteira/carrossel";
import { ordenarSlides } from "./acoes";
import { BotaoGerar } from "./botoes";

/** Os slides da referência: abre cada um em tamanho real, troca a ordem e tira o que não é do carrossel. */
export function SlidesReferencia({ id, slides }: { id: string; slides: Array<{ caminho: string; url: string }> }) {
  const [ordem, setOrdem] = useState(slides);
  const [aberto, setAberto] = useState<number | null>(null);
  const janela = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (aberto !== null && janela.current && !janela.current.open) janela.current.showModal();
  }, [aberto]);
  const mudou = ordem.map((s) => s.caminho).join() !== slides.map((s) => s.caminho).join();
  const videos = ordem.filter((s) => ehVideo(s.caminho)).length;
  function mover(i: number, passo: number) {
    const proxima = [...ordem];
    [proxima[i], proxima[i + passo]] = [proxima[i + passo], proxima[i]];
    setOrdem(proxima);
  }
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold">
        {ordem.length} {ordem.length === 1 ? "slide" : "slides"}
        {videos ? ` · ${videos} em vídeo` : ""} · clique pra ampliar
      </p>
      <ol className="grid grid-cols-3 gap-1.5">
        {ordem.map((s, i) => (
          <li key={s.caminho} className="space-y-0.5">
            <button type="button" onClick={() => setAberto(i)} className="block w-full" aria-label={`Ampliar o slide ${i + 1}`}>
              {ehVideo(s.caminho) ? (
                <video src={`${s.url}#t=0.5`} muted playsInline preload="metadata" aria-label={`slide ${i + 1} em vídeo`} className="aspect-[4/5] w-full rounded-md bg-black object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt={`slide ${i + 1}${i === 0 ? " (capa)" : ""}`} className="aspect-[4/5] w-full rounded-md object-cover" />
              )}
            </button>
            <div className="flex items-center justify-between font-mono text-[10px] text-apagado">
              <button type="button" disabled={i === 0} onClick={() => mover(i, -1)} aria-label={`Mover o slide ${i + 1} pra antes`} className="px-1 hover:text-texto disabled:opacity-30">
                ←
              </button>
              <span>
                {i === 0 ? "capa" : i + 1}
                {ehVideo(s.caminho) ? " ▶" : ""}
              </span>
              <span className="flex">
                <button type="button" disabled={i === ordem.length - 1} onClick={() => mover(i, 1)} aria-label={`Mover o slide ${i + 1} pra depois`} className="px-1 hover:text-texto disabled:opacity-30">
                  →
                </button>
                <button type="button" disabled={ordem.length === 1} onClick={() => setOrdem(ordem.filter((_, j) => j !== i))} aria-label={`Tirar o slide ${i + 1}`} className="px-1 text-quente disabled:opacity-30">
                  ×
                </button>
              </span>
            </div>
          </li>
        ))}
      </ol>
      {mudou && (
        <form action={ordenarSlides} className="space-y-1">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="ordem" value={JSON.stringify(ordem.map((s) => s.caminho))} />
          <BotaoGerar rotulo="Salvar a ordem dos slides" gerando="Salvando…" className="btn btn-sm w-full" />
          <button type="button" onClick={() => setOrdem(slides)} className="text-xs text-apagado underline">
            desfazer
          </button>
        </form>
      )}
      {aberto !== null && ordem[aberto] && (
        <dialog
          ref={janela}
          className="fixed inset-0 z-50 m-auto max-h-[95vh] w-[min(95vw,640px)] overflow-auto rounded-xl border-2 border-borda bg-superficie p-3 backdrop:bg-black/70"
          onClose={() => setAberto(null)}
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span>
              Slide {aberto + 1} de {ordem.length}
            </span>
            <button type="button" onClick={() => janela.current?.close()} className="btn btn-sm btn-2">
              Fechar
            </button>
          </div>
          {ehVideo(ordem[aberto].caminho) ? (
            <video key={ordem[aberto].caminho} src={ordem[aberto].url} controls autoPlay muted loop playsInline className="w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ordem[aberto].url} alt={`slide ${aberto + 1} ampliado`} className="w-full object-contain" />
          )}
          <div className="mt-2 flex justify-between">
            <button type="button" disabled={aberto === 0} onClick={() => setAberto(aberto - 1)} className="btn btn-sm btn-2">
              ← Anterior
            </button>
            <button type="button" disabled={aberto === ordem.length - 1} onClick={() => setAberto(aberto + 1)} className="btn btn-sm btn-2">
              Próximo →
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
