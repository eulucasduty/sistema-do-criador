"use client";

import { startTransition, useActionState, useState } from "react";
import { salvarOfertas } from "./acoes";

type Oferta = { nome: string; link: string; para_quem: string };

const MAX = 5;
const VAZIA: Oferta = { nome: "", link: "", para_quem: "" };

export function EditorOfertas({ iniciais }: { iniciais: Oferta[] }) {
  const [ofertas, setOfertas] = useState<Oferta[]>(iniciais.length ? iniciais : [VAZIA]);
  const [estado, enviar, pendente] = useActionState(salvarOfertas, null);

  const mudar = (i: number, campo: keyof Oferta, valor: string) =>
    setOfertas((xs) => xs.map((o, j) => (j === i ? { ...o, [campo]: valor } : o)));

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => enviar(dados));
      }}
    >
      <ol className="space-y-3">
        {ofertas.map((o, i) => (
          <li key={i} className="rounded-xl border-2 border-linha p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="rotulo">Oferta {i + 1}</span>
              <button
                type="button"
                onClick={() => setOfertas((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : [VAZIA]))}
                className="text-xs text-apagado hover:text-quente"
              >
                Remover
              </button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                name="oferta_nome"
                value={o.nome}
                onChange={(e) => mudar(i, "nome", e.target.value)}
                maxLength={60}
                placeholder="Nome (ex.: Mentoria, Ebook, Grupo VIP)"
                className="campo"
              />
              <input
                name="oferta_link"
                value={o.link}
                onChange={(e) => mudar(i, "link", e.target.value)}
                placeholder="https://… (pra onde o link leva)"
                className="campo"
              />
            </div>
            <input
              name="oferta_para_quem"
              value={o.para_quem}
              onChange={(e) => mudar(i, "para_quem", e.target.value)}
              maxLength={300}
              placeholder="Pra quem é (ex.: quem já tentou sozinho e quer acompanhamento)"
              className="campo mt-2"
            />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        {ofertas.length < MAX && (
          <button type="button" onClick={() => setOfertas((xs) => [...xs, VAZIA])} className="text-sm text-marca hover:underline">
            + Adicionar oferta
          </button>
        )}
        <button disabled={pendente} className="btn btn-sm btn-2">
          {pendente ? "Salvando…" : "Salvar ofertas"}
        </button>
        {!pendente && estado?.erro && <span className="text-xs text-quente">{estado.erro}</span>}
        {!pendente && estado?.ok && <span className="text-xs text-ok">{estado.ok}</span>}
      </div>
    </form>
  );
}
