import Link from "next/link";

/** O aviso de estação desligada: a edição roda no PC do criador, não no servidor. */
export function EstacaoDesligada({ className = "" }: { className?: string }) {
  return (
    <p className={`text-sm text-suave ${className}`}>
      A edição roda no seu PC, com a IA que você escolher: o Claude ou o ChatGPT no plano que você já paga (sem custo por vídeo), ou a OpenRouter
      (paga por vídeo).
      <br />
      Instale a estação uma vez seguindo o{" "}
      <Link href="/#estacao" className="text-marca underline">
        passo a passo do Início
      </Link>{" "}
      e abra o atalho <b>Estação de edição</b> quando tiver vídeo na fila.
    </p>
  );
}
