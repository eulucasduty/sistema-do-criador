"use client";

import { useState } from "react";
import { TIPOS_BLOCO, type Bloco, type Passo } from "@/lib/entregas/blocos";

// Editor dos blocos de uma entrega. Vive dentro do formulário de salvar: manda tudo num campo
// escondido "blocos" (JSON), que o servidor limpa e confere (lib/entregas/blocos.ts).

const NOVO: Record<Bloco["tipo"], Bloco> = {
  texto: { tipo: "texto", texto: "" },
  passos: { tipo: "passos", titulo: "Passo a passo", itens: [{ titulo: "" }] },
  prompt: { tipo: "prompt", titulo: "", texto: "" },
  link: { tipo: "link", titulo: "", url: "" },
  template: { tipo: "template", titulo: "", texto: "" },
  aviso: { tipo: "aviso", texto: "" },
};

function Campo({ rotulo, valor, onChange, linhas = 1, placeholder, mono = false }: { rotulo: string; valor: string | undefined; onChange: (v: string) => void; linhas?: number; placeholder?: string; mono?: boolean }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-apagado">{rotulo}</span>
      {linhas > 1 ? (
        <textarea rows={linhas} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`campo ${mono ? "font-mono text-xs" : ""}`} />
      ) : (
        <input value={valor ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`campo ${mono ? "font-mono text-xs" : ""}`} />
      )}
    </label>
  );
}

export function EditorBlocos({ inicial }: { inicial: Bloco[] }) {
  const [blocos, setBlocos] = useState<Bloco[]>(inicial);
  const [novo, setNovo] = useState<Bloco["tipo"]>("texto");
  const mudar = (i: number, b: Bloco) => setBlocos((l) => l.map((x, k) => (k === i ? b : x)));
  const mover = (i: number, d: number) =>
    setBlocos((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const c = [...l];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const tirar = (i: number) => setBlocos((l) => l.filter((_, k) => k !== i));

  return (
    <div className="space-y-3">
      <input type="hidden" name="blocos" value={JSON.stringify(blocos)} />
      {blocos.map((b, i) => (
        <div key={i} className="rounded-xl border border-borda p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="rotulo">
              {i + 1} · {TIPOS_BLOCO.find((t) => t.tipo === b.tipo)?.nome}
            </span>
            <span className="flex gap-1 text-xs">
              <button type="button" className="btn btn-sm btn-2" onClick={() => mover(i, -1)} aria-label="subir">
                ↑
              </button>
              <button type="button" className="btn btn-sm btn-2" onClick={() => mover(i, 1)} aria-label="descer">
                ↓
              </button>
              <button type="button" className="btn btn-sm btn-2 text-quente" onClick={() => tirar(i)}>
                tirar
              </button>
            </span>
          </div>
          {b.tipo === "texto" && <Campo rotulo="Texto (aceita **negrito**)" linhas={3} valor={b.texto} onChange={(v) => mudar(i, { ...b, texto: v })} />}
          {b.tipo === "aviso" && <Campo rotulo="Aviso" linhas={2} valor={b.texto} onChange={(v) => mudar(i, { ...b, texto: v })} />}
          {b.tipo === "prompt" && (
            <div className="space-y-2">
              <Campo rotulo="Título" valor={b.titulo} onChange={(v) => mudar(i, { ...b, titulo: v })} />
              <Campo rotulo="O prompt (a pessoa copia com um toque)" linhas={8} mono valor={b.texto} onChange={(v) => mudar(i, { ...b, texto: v })} />
              <Campo rotulo="Dica de uso (opcional)" valor={b.dica} onChange={(v) => mudar(i, { ...b, dica: v })} />
            </div>
          )}
          {b.tipo === "link" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Campo rotulo="Texto do botão" valor={b.titulo} onChange={(v) => mudar(i, { ...b, titulo: v })} />
              <Campo rotulo="Endereço (https://…)" valor={b.url} onChange={(v) => mudar(i, { ...b, url: v })} placeholder="https://" />
              <div className="sm:col-span-2">
                <Campo rotulo="Pra que serve (opcional)" valor={b.descricao} onChange={(v) => mudar(i, { ...b, descricao: v })} />
              </div>
              {!b.url && <p className="text-xs text-quente sm:col-span-2">falta o endereço: sem ele o botão não aparece na página</p>}
            </div>
          )}
          {b.tipo === "template" && (
            <div className="space-y-2">
              <Campo rotulo="Título" valor={b.titulo} onChange={(v) => mudar(i, { ...b, titulo: v })} />
              <Campo rotulo="Texto pra copiar e adaptar" linhas={6} mono valor={b.texto} onChange={(v) => mudar(i, { ...b, texto: v })} />
              <Campo rotulo="Ou um link (Notion, Docs, Drive…)" valor={b.url} onChange={(v) => mudar(i, { ...b, url: v })} placeholder="https://" />
              <Campo rotulo="Descrição (opcional)" valor={b.descricao} onChange={(v) => mudar(i, { ...b, descricao: v })} />
            </div>
          )}
          {b.tipo === "passos" && (
            <div className="space-y-2">
              <Campo rotulo="Título do passo a passo" valor={b.titulo} onChange={(v) => mudar(i, { ...b, titulo: v })} />
              {b.itens.map((p, k) => {
                const mudarPasso = (q: Passo) => mudar(i, { ...b, itens: b.itens.map((x, j) => (j === k ? q : x)) });
                return (
                  <div key={k} className="space-y-2 rounded-lg bg-black/10 p-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-apagado">passo {k + 1}</span>
                      <button type="button" className="text-xs text-quente" onClick={() => mudar(i, { ...b, itens: b.itens.filter((_, j) => j !== k) })}>
                        tirar o passo
                      </button>
                    </div>
                    <Campo rotulo="O que fazer" valor={p.titulo} onChange={(v) => mudarPasso({ ...p, titulo: v })} />
                    <Campo rotulo="Explicação (opcional)" linhas={2} valor={p.texto} onChange={(v) => mudarPasso({ ...p, texto: v })} />
                    <Campo rotulo="Prompt deste passo (opcional)" linhas={3} mono valor={p.prompt} onChange={(v) => mudarPasso({ ...p, prompt: v })} />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Campo rotulo="Link: texto do botão (opcional)" valor={p.link?.titulo} onChange={(v) => mudarPasso({ ...p, link: { titulo: v, url: p.link?.url ?? "" } })} />
                      <Campo rotulo="Link: endereço" valor={p.link?.url} onChange={(v) => mudarPasso({ ...p, link: { titulo: p.link?.titulo ?? "abrir", url: v } })} placeholder="https://" />
                    </div>
                  </div>
                );
              })}
              <button type="button" className="btn btn-sm btn-2" onClick={() => mudar(i, { ...b, itens: [...b.itens, { titulo: "" }] })}>
                + passo
              </button>
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <select value={novo} onChange={(e) => setNovo(e.target.value as Bloco["tipo"])} className="campo w-auto">
          {TIPOS_BLOCO.map((t) => (
            <option key={t.tipo} value={t.tipo}>
              {t.nome}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-sm btn-2" onClick={() => setBlocos((l) => [...l, structuredClone(NOVO[novo])])}>
          + bloco
        </button>
      </div>
    </div>
  );
}
