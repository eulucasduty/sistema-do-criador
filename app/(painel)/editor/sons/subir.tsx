"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FUNCOES_SOM, VOLUMES_SOM } from "@/lib/editor";
import { subirParte } from "../envio";
import { prepararSom, registrarSom, type PedidoSom } from "./acoes";

/** Subir um som: o arquivo vai direto pro storage; o servidor só confere e registra. */
export function SubirSom() {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [andamento, setAndamento] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    const d = new FormData(e.currentTarget);
    const arquivo = d.get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size) return setMsg({ ok: false, texto: "escolha o arquivo do som" });
    const pedido: PedidoSom = {
      nome: String(d.get("nome") ?? ""),
      arquivo: arquivo.name,
      tipo: arquivo.type,
      tamanho: arquivo.size,
      funcao: String(d.get("funcao") ?? ""),
      descricao: String(d.get("descricao") ?? ""),
      volume: String(d.get("volume") ?? "1"),
      principal: d.get("principal") === "on",
    };
    try {
      setAndamento("Conferindo…");
      const link = await prepararSom(pedido);
      if ("erro" in link) throw new Error(link.erro);
      setAndamento("Subindo…");
      await subirParte(link.url, arquivo, () => {});
      setAndamento("Guardando…");
      const r = await registrarSom(pedido);
      if ("erro" in r) throw new Error(r.erro);
      setMsg({ ok: true, texto: r.ok });
      form.current?.reset();
      router.refresh();
    } catch (e2) {
      setMsg({ ok: false, texto: (e2 as Error).message });
    } finally {
      setAndamento(null);
    }
  }

  const ocupado = Boolean(andamento);
  return (
    <form ref={form} onSubmit={enviar} className="card space-y-3 p-4">
      <h2 className="rotulo">Subir um som</h2>
      <input type="file" name="arquivo" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" required className="block w-full text-sm" disabled={ocupado} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="nome" className="campo" placeholder="nome (ex.: clique-camera); vazio = nome do arquivo" maxLength={40} disabled={ocupado} />
        <select name="funcao" className="campo" defaultValue="" disabled={ocupado}>
          <option value="">Extra (o editor usa pela descrição)</option>
          {FUNCOES_SOM.filter((f) => f.funcao).map((f) => (
            <option key={f.funcao} value={f.funcao!}>
              {f.nome}: {f.quando}
            </option>
          ))}
        </select>
      </div>
      <textarea name="descricao" rows={2} className="campo" placeholder="quando usar (ex.: riser metálico, antes de um corte ou de um suspense)" required maxLength={300} disabled={ocupado} />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="principal" disabled={ocupado} /> usar como o principal dessa função
        </label>
        <label className="flex items-center gap-2">
          volume
          <select name="volume" className="campo w-auto py-1" defaultValue="1" disabled={ocupado}>
            {VOLUMES_SOM.map((v) => (
              <option key={v.valor} value={v.valor}>
                {v.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-ok/10 text-ok" : "bg-quente/10 text-quente"}`}>{msg.texto}</p>}
      <button className="btn btn-sm" disabled={ocupado}>
        {andamento ?? "Subir"}
      </button>
    </form>
  );
}
