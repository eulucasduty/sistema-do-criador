"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";

// Formulário que mostra "salvo" ou o erro que a ação devolveu (a ação nunca lança:
// em produção o Next esconde a mensagem de erro). Envia pelo onSubmit pra o React não
// limpar os campos: com erro, o que você digitou fica lá. `limpar` = limpa depois de salvar.

export type Estado = { ok?: string; erro?: string } | null;

export function FormAcao({
  acao,
  children,
  className = "space-y-3",
  botao = "Salvar",
  classeBotao = "btn btn-sm btn-2",
  extra,
  limpar = false,
}: {
  acao: (anterior: Estado, dados: FormData) => Promise<Estado>;
  children: React.ReactNode;
  className?: string;
  botao?: string;
  classeBotao?: string;
  extra?: React.ReactNode;
  limpar?: boolean;
}) {
  const [estado, enviar, pendente] = useActionState(acao, null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (limpar && estado?.ok) form.current?.reset();
  }, [estado, limpar]);

  return (
    <form
      ref={form}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        startTransition(() => enviar(dados));
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pendente} className={classeBotao}>
          {pendente ? "Salvando…" : botao}
        </button>
        {extra}
        {!pendente && estado?.erro && <span className="text-xs text-quente">{estado.erro}</span>}
        {!pendente && estado?.ok && <span className="text-xs text-ok">{estado.ok}</span>}
      </div>
    </form>
  );
}
