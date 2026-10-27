"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { subirParte } from "../editor/envio";
import { linksDosSlides, salvarSlidesSubidos } from "./acoes";

// Nome com número em ordem natural: "slide 2" vem antes de "slide 10"
const natural = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });

/** Fotos e vídeos do carrossel, direto pro storage. Sem `id` cria o carrossel; com `id` completa. */
export function EnviarSlides({ id }: { id?: string }) {
  const router = useRouter();
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [envio, setEnvio] = useState<{ feito: number; total: number } | null>(null);
  const [erro, setErro] = useState("");

  async function enviar(form: FormData) {
    setErro("");
    const r = await linksDosSlides(arquivos.map((f) => ({ tipo: f.type, tamanho: f.size })), id);
    if (r.erro || !r.envios) return setErro(r.erro ?? "Não consegui preparar o envio.");
    const total = arquivos.reduce((n, f) => n + f.size, 0);
    let base = 0;
    setEnvio({ feito: 0, total });
    try {
      for (const [i, f] of arquivos.entries()) {
        for (let tentativa = 1; ; tentativa++) {
          try {
            await subirParte(r.envios[i].url, f, (b) => setEnvio({ feito: base + b, total }));
            break;
          } catch (e) {
            if (tentativa >= 3) throw e;
            await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
          }
        }
        base += f.size;
      }
      const salvo = await salvarSlidesSubidos({
        id,
        caminhos: r.envios.map((e) => e.caminho),
        autor: String(form.get("autor") ?? ""),
        url: String(form.get("url") ?? ""),
        notas: String(form.get("notas") ?? ""),
      });
      if (salvo.erro || !salvo.id) throw new Error(salvo.erro ?? "Não consegui salvar.");
      setArquivos([]);
      if (id) router.refresh();
      else router.push(`/esteira/${salvo.id}`);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnvio(null);
    }
  }

  return (
    <form action={enviar} className="space-y-2">
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,video/*"
        multiple
        required
        disabled={Boolean(envio)}
        onChange={(e) => setArquivos([...(e.target.files ?? [])].sort((a, b) => natural.compare(a.name, b.name)))}
        className="w-full text-xs"
      />
      {arquivos.length > 0 && (
        <ol className="space-y-0.5 text-xs text-suave">
          {arquivos.map((f, i) => (
            <li key={f.name + i} className="flex justify-between gap-2">
              <span className="truncate">
                {(id ? "" : i === 0 ? "capa · " : "") + f.name}
              </span>
              <span className="shrink-0">{f.type.startsWith("video/") ? "vídeo" : "foto"} · {(f.size / 1024 / 1024).toFixed(1)} MB</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-apagado">
        Fotos e vídeos misturados, até 20 no total e 45 MB cada. A ordem segue o nome dos arquivos (01, 02, 03…); depois dá pra reordenar.
      </p>
      {!id && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input name="autor" placeholder="@ de quem postou (opcional)" className="campo" />
          <input name="url" placeholder="link do post (opcional)" className="campo" />
        </div>
      )}
      {envio ? (
        <div className="space-y-1">
          <p className="text-xs">Subindo… {Math.round((envio.feito / Math.max(1, envio.total)) * 100)}%</p>
          <div className="h-1.5 overflow-hidden rounded bg-superficie-2">
            <div className="h-full bg-marca transition-all" style={{ width: `${Math.min(100, (envio.feito / Math.max(1, envio.total)) * 100)}%` }} />
          </div>
        </div>
      ) : (
        <button className={id ? "btn btn-sm btn-2 w-full" : "btn btn-sm"} disabled={!arquivos.length}>
          {id ? "Subir os slides" : `Subir carrossel${arquivos.length ? ` (${arquivos.length})` : ""}`}
        </button>
      )}
      {erro && <p className="text-xs text-quente">{erro}</p>}
    </form>
  );
}
