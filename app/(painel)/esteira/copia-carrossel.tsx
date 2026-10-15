import { Copiar } from "../copiar";
import { AutoAtualizar } from "../editor/atualizar";
import { BaixarTodos } from "./botoes";
import { STATUS_ATIVOS, ehVideo, type PedidoCarrossel, type ResultadoCarrossel } from "@/lib/esteira/carrossel";
import { dataCurta } from "@/lib/formato";
import { nomeDoMotor } from "@/lib/editor";

/** O andamento do pedido na estação e a cópia pronta (PNG, e MP4 nos slides em vídeo). */
export function CopiaCarrossel({ id, trabalho, resultado, ligada }: { id: string; trabalho: PedidoCarrossel | null; resultado: ResultadoCarrossel | null; ligada: boolean }) {
  const ativo = Boolean(trabalho && STATUS_ATIVOS.includes(trabalho.status));
  const emVideo = resultado?.arquivos.filter(ehVideo).length ?? 0;
  const src = (i: number) => `/esteira/${id}/slide/${i + 1}?v=${encodeURIComponent(resultado?.gerado_em ?? "")}`;
  const nome = (c: string, i: number) => `carrossel-${String(i + 1).padStart(2, "0")}.${ehVideo(c) ? "mp4" : "png"}`;
  const titulo = !trabalho
    ? null
    : trabalho.status === "pronto"
      ? "Carrossel pronto"
      : trabalho.status === "erro"
        ? "A cópia deu erro"
        : trabalho.status === "aguardando_estacao"
          ? ligada
            ? "Na fila da estação"
            : "Esperando a estação ligar no seu PC"
          : "A estação está fazendo o carrossel";
  return (
    <div className="space-y-3">
      {ativo && <AutoAtualizar segundos={6} />}
      {trabalho && trabalho.status !== "pronto" && (
        <div aria-live="polite" className="rounded-lg bg-superficie-2 p-3 text-sm">
          <p className="font-bold">
            {titulo}
            {trabalho.motor ? <span className="font-normal text-apagado"> · {nomeDoMotor(trabalho.motor)}</span> : null}
          </p>
          {trabalho.etapa && <p className="mt-1 text-xs text-suave">{trabalho.etapa}</p>}
          {trabalho.erro && <p className="mt-1 whitespace-pre-wrap text-xs text-quente">{trabalho.erro.slice(0, 600)}</p>}
          {ativo && !ligada && <p className="mt-1 text-xs text-suave">O pedido está salvo: sai assim que a estação ligar.</p>}
        </div>
      )}
      {resultado && (
        <>
          <p className="text-sm font-bold">
            {resultado.titulo}{" "}
            <span className="font-normal text-apagado">
              · {resultado.arquivos.length} slides{emVideo ? ` (${emVideo} em vídeo)` : ""} · {nomeDoMotor(resultado.motor)} · {dataCurta(resultado.gerado_em)}
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {resultado.arquivos.map((c, i) =>
              ehVideo(c) ? (
                <video
                  key={c}
                  src={src(i)}
                  poster={`${src(i)}&capa=1`}
                  controls
                  muted
                  loop
                  playsInline
                  preload="none"
                  aria-label={`slide ${i + 1} em vídeo`}
                  className="aspect-[4/5] w-full rounded-lg border-2 border-tinta bg-black object-cover"
                />
              ) : (
                <a key={c} href={src(i)} target="_blank" rel="noreferrer" className="block" aria-label={`Abrir o slide ${i + 1} em tamanho real`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(i)} alt={`slide ${i + 1}`} loading="lazy" className="aspect-[4/5] w-full rounded-lg border-2 border-tinta object-cover" />
                </a>
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <BaixarTodos arquivos={resultado.arquivos.map((c, i) => ({ url: src(i), nome: nome(c, i) }))} />
            <Copiar texto={resultado.legenda} rotulo="Copiar legenda" className="btn btn-sm btn-2" />
          </div>
          <div className="rounded-lg bg-superficie-2 p-3 text-sm">
            <p className="text-xs font-bold text-apagado">LEGENDA</p>
            <p className="mt-1 whitespace-pre-wrap">{resultado.legenda}</p>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-xs text-marca">Conferir o texto de cada slide</summary>
            <ol className="mt-2 space-y-2">
              {resultado.textos.map((s) => (
                <li key={s.n}>
                  <span className="text-xs font-bold">Slide {s.n}</span>
                  <p className="whitespace-pre-wrap text-suave">{s.ptbr}</p>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </div>
  );
}
