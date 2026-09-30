"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarraEnvio, mb, subirArquivo, type Andamento } from "../editor/envio";
import { completarReferencia, linksDeEnvio, novaReferenciaPorArquivo } from "./acoes";
import { MAX_MB, MAX_PRINTS, TIPOS_PRINT } from "./regras";

// Envio de arquivo da Esteira: vídeo do reel (1) ou prints do carrossel (até 12, na ordem).
// Vai do navegador direto pro bucket (link assinado); o servidor só recebe os caminhos.

type Modo = "video" | "prints";
type Escolhido = { arquivo: File; previa: string };

const aba = (ativo: boolean) =>
  `rounded-xl border-2 px-3 py-1.5 text-sm font-bold ${ativo ? "border-tinta bg-marca text-[#05070e] shadow-[0_3px_0_#000]" : "border-linha text-suave hover:text-texto"}`;

/** Sobe o lote e devolve os caminhos no bucket, na ordem. */
async function subirLote(arquivos: File[], aoAndar: (a: Andamento) => void): Promise<{ caminhos: string[]; tipos: string[] }> {
  const total = arquivos.reduce((s, a) => s + a.size, 0);
  aoAndar({ feito: 0, total, texto: "Preparando o envio…" });
  const r = await linksDeEnvio(arquivos.map((a) => ({ tipo: a.type, tamanho: a.size })));
  if ("erro" in r) throw new Error(r.erro);
  let feito = 0;
  for (const [i, a] of arquivos.entries()) {
    const texto = arquivos.length > 1 ? `Subindo o print ${i + 1} de ${arquivos.length}…` : "Subindo o arquivo…";
    await subirArquivo(a, [r.envios[i]], (b) => aoAndar({ feito: feito + b, total, texto }));
    feito += a.size;
  }
  aoAndar({ feito: total, total, texto: "Mandando analisar…" });
  return { caminhos: r.envios.map((e) => e.caminho), tipos: arquivos.map((a) => a.type) };
}

/** Escolha do vídeo ou dos prints, com prévia e a ordem dos slides. */
function useEscolha(modoInicial: Modo) {
  const [modo, setModoBruto] = useState<Modo>(modoInicial);
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  const [problema, setProblema] = useState<string | null>(null);
  const [rodada, setRodada] = useState(0); // troca a chave do campo de arquivo pra limpar ele

  function limpar() {
    escolhidos.forEach((e) => URL.revokeObjectURL(e.previa));
    setEscolhidos([]);
  }
  function setModo(m: Modo) {
    limpar();
    setProblema(null);
    setModoBruto(m);
    setRodada((n) => n + 1);
  }
  function escolher(lista: FileList | null) {
    limpar();
    setProblema(null);
    const arquivos = Array.from(lista ?? []);
    if (!arquivos.length) return;
    const grande = arquivos.find((a) => a.size > MAX_MB * 1048576);
    if (grande) return setProblema(`${grande.name} tem ${mb(grande.size)}: o limite é ${MAX_MB} MB${modo === "video" ? " (exporte em 1080p)" : ""}.`);
    if (modo === "prints") {
      if (arquivos.some((a) => !TIPOS_PRINT.split(",").includes(a.type))) return setProblema("Os prints têm que ser PNG, JPG ou WEBP.");
      if (arquivos.length > MAX_PRINTS) return setProblema(`No máximo ${MAX_PRINTS} prints.`);
      // Na ordem do nome (IMG_0001, IMG_0002…); dá pra trocar a ordem depois
      arquivos.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    } else if (!arquivos[0].type.startsWith("video/")) return setProblema("Escolha um vídeo.");
    setEscolhidos(arquivos.slice(0, modo === "video" ? 1 : MAX_PRINTS).map((arquivo) => ({ arquivo, previa: URL.createObjectURL(arquivo) })));
  }
  function mover(i: number, passo: -1 | 1) {
    setEscolhidos((es) => {
      const j = i + passo;
      if (j < 0 || j >= es.length) return es;
      const novo = es.slice();
      [novo[i], novo[j]] = [novo[j], novo[i]];
      return novo;
    });
  }
  return { modo, setModo, escolhidos, problema, escolher, mover, rodada };
}

function Escolha({ e, ocupado, rotuloVideo = "Vídeo do reel", rotuloPrints = "Prints do carrossel", soUm }: { e: ReturnType<typeof useEscolha>; ocupado: boolean; rotuloVideo?: string; rotuloPrints?: string; soUm?: Modo }) {
  return (
    <div className="space-y-2">
      {!soUm && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={aba(e.modo === "video")} onClick={() => e.setModo("video")} disabled={ocupado}>
            {rotuloVideo}
          </button>
          <button type="button" className={aba(e.modo === "prints")} onClick={() => e.setModo("prints")} disabled={ocupado}>
            {rotuloPrints}
          </button>
        </div>
      )}
      <input
        key={e.rodada}
        type="file"
        accept={e.modo === "video" ? "video/*" : TIPOS_PRINT}
        multiple={e.modo === "prints"}
        onChange={(ev) => e.escolher(ev.target.files)}
        disabled={ocupado}
        className="block w-full text-xs"
      />
      <p className="text-xs text-apagado">
        {e.modo === "video" ? `Um vídeo, até ${MAX_MB} MB.` : `Até ${MAX_PRINTS} prints (PNG, JPG ou WEBP), a capa primeiro. Confere a ordem abaixo.`}
      </p>
      {e.problema && <p className="text-xs text-quente">{e.problema}</p>}
      {e.modo === "video" && e.escolhidos[0] && (
        <p className="text-xs text-suave">
          {e.escolhidos[0].arquivo.name} · {mb(e.escolhidos[0].arquivo.size)}
        </p>
      )}
      {e.modo === "prints" && e.escolhidos.length > 0 && (
        <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
          {e.escolhidos.map((x, i) => (
            <li key={x.previa} className="space-y-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.previa} alt={`print ${i + 1}`} className="aspect-[4/5] w-full rounded-md border-2 border-linha object-cover" />
              <div className="flex items-center justify-between font-mono text-[10px] text-apagado">
                <button type="button" onClick={() => e.mover(i, -1)} disabled={ocupado || i === 0} className="px-1 hover:text-texto disabled:opacity-30" aria-label="mover pra antes">
                  ←
                </button>
                {i === 0 ? "capa" : i + 1}
                <button type="button" onClick={() => e.mover(i, 1)} disabled={ocupado || i === e.escolhidos.length - 1} className="px-1 hover:text-texto disabled:opacity-30" aria-label="mover pra depois">
                  →
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Referência nova a partir do arquivo (quando o link não serve). */
export function NovaPorArquivo() {
  const router = useRouter();
  const e = useEscolha("video");
  const [notas, setNotas] = useState("");
  const [autor, setAutor] = useState("");
  const [url, setUrl] = useState("");
  const [envio, setEnvio] = useState<Andamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!e.escolhidos.length) return setErro(e.modo === "video" ? "Escolha o vídeo." : "Escolha os prints.");
    try {
      const subidos = await subirLote(
        e.escolhidos.map((x) => x.arquivo),
        setEnvio,
      );
      const r = await novaReferenciaPorArquivo({ ...subidos, notas, autor, url });
      if ("erro" in r) throw new Error(r.erro);
      router.push(`/esteira/${r.id}`);
    } catch (e2) {
      setErro((e2 as Error).message);
      setEnvio(null);
    }
  }

  const ocupado = Boolean(envio);
  return (
    <form onSubmit={enviar} className="space-y-2">
      <h3 className="rotulo">Subindo o arquivo</h3>
      <Escolha e={e} ocupado={ocupado} />
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={autor} onChange={(x) => setAutor(x.target.value)} placeholder="@ de quem postou (opcional)" className="campo" disabled={ocupado} />
        <input value={url} onChange={(x) => setUrl(x.target.value)} placeholder="link do post (opcional)" className="campo" disabled={ocupado} />
      </div>
      <textarea value={notas} onChange={(x) => setNotas(x.target.value)} rows={2} placeholder="por que salvou (opcional)" className="campo" disabled={ocupado} />
      {erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{erro}</p>}
      {envio ? <BarraEnvio envio={envio} /> : <button className="btn btn-sm">Subir e analisar</button>}
    </form>
  );
}

/** O arquivo que faltava numa referência que já existe (ou prints novos pra um carrossel). */
export function CompletarArquivo({ id, aceita, temImagens = false }: { id: string; aceita: "video" | "prints" | "ambos"; temImagens?: boolean }) {
  const router = useRouter();
  const e = useEscolha(aceita === "prints" ? "prints" : "video");
  const [substituir, setSubstituir] = useState(false);
  const [envio, setEnvio] = useState<Andamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    if (!e.escolhidos.length) return setErro(e.modo === "video" ? "Escolha o vídeo." : "Escolha os prints.");
    try {
      const subidos = await subirLote(
        e.escolhidos.map((x) => x.arquivo),
        setEnvio,
      );
      const r = await completarReferencia({ id, ...subidos, substituir });
      if ("erro" in r) throw new Error(r.erro);
      setEnvio(null);
      e.setModo(e.modo); // limpa a escolha
      router.refresh();
    } catch (e2) {
      setErro((e2 as Error).message);
      setEnvio(null);
    }
  }

  const ocupado = Boolean(envio);
  return (
    <form onSubmit={enviar} className="space-y-2">
      <Escolha e={e} ocupado={ocupado} soUm={aceita === "ambos" ? undefined : aceita} rotuloVideo="É um vídeo" rotuloPrints="São prints" />
      {e.modo === "prints" && temImagens && (
        <label className="flex items-center gap-2 text-xs text-suave">
          <input type="checkbox" checked={substituir} onChange={(x) => setSubstituir(x.target.checked)} disabled={ocupado} />
          substituir as imagens que já estão (a capa inclusa)
        </label>
      )}
      {erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{erro}</p>}
      {envio ? <BarraEnvio envio={envio} /> : <button className="btn btn-sm w-full">{e.modo === "video" ? "Subir o vídeo" : "Subir os prints"}</button>}
    </form>
  );
}
