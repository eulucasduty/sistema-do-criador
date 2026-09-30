"use client";

import { useState } from "react";

/** Botão que copia um texto (linha do repasse, roteiro, legenda) sem selecionar na mão. */
export function Copiar({ texto, rotulo = "Copiar", className = "btn btn-sm" }: { texto: string; rotulo?: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setOk(true);
          setTimeout(() => setOk(false), 2500);
        } catch {}
      }}
    >
      {ok ? "Copiado ✓" : rotulo}
    </button>
  );
}
