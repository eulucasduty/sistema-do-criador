import { PARTE_BYTES, type EnvioParte } from "@/lib/editor";

// Envio direto do navegador pro Storage, pelo link assinado que a ação do servidor cria.
// O arquivo nunca passa pelo servidor (a Vercel recusa corpo acima de ~4,5 MB).
// Só roda no navegador: importar apenas em componente "use client".

/** Sobe um arquivo (ou uma parte dele) pelo link assinado, com progresso. */
export function subirParte(url: string, parte: Blob, aoProgresso: (bytes: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.upload.onprogress = (e) => aoProgresso(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`o envio falhou (${xhr.status}) ${xhr.responseText.slice(0, 160)}`)));
    xhr.onerror = () => reject(new Error("a conexão caiu no envio"));
    const corpo = new FormData();
    corpo.append("cacheControl", "3600");
    corpo.append("", parte);
    xhr.send(corpo);
  });
}

/** Sobe o arquivo em partes de 45 MB (uma parte por link), tentando cada parte até 3 vezes. */
export async function subirArquivo(arquivo: File, envios: EnvioParte[], aoProgresso: (bytes: number) => void) {
  let base = 0;
  for (const [i, envio] of envios.entries()) {
    // Arquivo de uma parte só vai inteiro (com o tipo dele: o navegador precisa pra tocar)
    const parte = envios.length === 1 ? arquivo : arquivo.slice(i * PARTE_BYTES, Math.min(arquivo.size, (i + 1) * PARTE_BYTES));
    for (let tentativa = 1; ; tentativa++) {
      try {
        await subirParte(envio.url, parte, (b) => aoProgresso(base + b));
        break;
      } catch (e) {
        if (tentativa >= 3) throw e;
        await new Promise((r) => setTimeout(r, 2000 * tentativa));
      }
    }
    base += parte.size;
  }
}

export const mb = (b: number) => `${(b / 1048576).toFixed(b > 10 * 1048576 ? 0 : 1)} MB`;

export type Andamento = { feito: number; total: number; texto: string };

/** A barra de progresso do envio. */
export function BarraEnvio({ envio }: { envio: Andamento }) {
  return (
    <div className="card space-y-2 p-4">
      <div className="flex justify-between gap-3 text-sm">
        <span>{envio.texto}</span>
        <span className="shrink-0 font-mono text-xs text-suave">
          {mb(envio.feito)} de {mb(envio.total)}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-full border-2 border-tinta bg-fundo">
        <div className="h-full bg-marca transition-all" style={{ width: `${Math.min(100, (envio.feito / Math.max(1, envio.total)) * 100)}%` }} />
      </div>
      <p className="text-xs text-apagado">Não feche a página até terminar de subir.</p>
    </div>
  );
}
