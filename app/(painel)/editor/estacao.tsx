import Link from "next/link";

/** O aviso de estação desligada: a edição roda no PC do criador, não no servidor. */
export function EstacaoDesligada({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-suave ${className}`}>
      A edição roda no seu PC, com o Claude Code no seu próprio plano do Claude (sem pagar API por vídeo).
      <br />
      Liga a estação uma vez seguindo o{" "}
      <Link href="/#estacao" className="text-marca underline">
        passo a passo do Início
      </Link>{" "}
      e deixa a janela aberta enquanto tiver vídeo na fila.
    </p>
  );
}
