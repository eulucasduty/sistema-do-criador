"use client";

import { useFormStatus } from "react-dom";

/** Botão de enviar que avisa enquanto a IA trabalha (roteiro e carrossel levam uns 30 s). */
export function BotaoGerar({ rotulo, gerando = "Gerando… (uns 30 s)", className = "btn", disabled = false }: { rotulo: string; gerando?: string; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending || disabled}>
      {pending ? gerando : rotulo}
    </button>
  );
}

/** Baixa todos os slides do carrossel (PNG e MP4), um atrás do outro. */
export function BaixarTodos({ arquivos }: { arquivos: Array<{ url: string; nome: string }> }) {
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={async () => {
        for (const a of arquivos) {
          const blob = await (await fetch(a.url)).blob();
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = a.nome;
          link.click();
          URL.revokeObjectURL(link.href);
          await new Promise((r) => setTimeout(r, 400));
        }
      }}
    >
      Baixar todos
    </button>
  );
}
