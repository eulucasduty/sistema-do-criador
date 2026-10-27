"use client";

import { useState } from "react";

/** Botão de copiar da página do material (prompt, template). Funciona no navegador do Instagram. */
export function CopiarMaterial({ texto, rotulo = "copiar" }: { texto: string; rotulo?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      className={`m-botao shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold transition-transform active:translate-y-[2px] ${ok ? "m-ok" : ""}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
        } catch {
          // navegador embutido sem acesso à área de transferência: seleciona um campo escondido
          const t = document.createElement("textarea");
          t.value = texto;
          t.style.position = "fixed";
          t.style.opacity = "0";
          document.body.appendChild(t);
          t.select();
          try {
            document.execCommand("copy");
          } catch {}
          t.remove();
        }
        setOk(true);
        setTimeout(() => setOk(false), 2500);
      }}
    >
      {ok ? "copiado ✓" : rotulo}
    </button>
  );
}
