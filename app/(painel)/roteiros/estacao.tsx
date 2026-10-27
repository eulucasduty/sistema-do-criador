import Link from "next/link";
import { estacaoLigada, nomeDoMotor, type BatidaEstacao, type ConfigEditor } from "@/lib/editor";
import { estacaoDeRoteirosLigada, type BatidaRoteiros } from "@/lib/roteiro/comum";

/** Quem escreve e quanto custa, pela IA escolhida em Editor de vídeo → Quem edita. */
export function quemEscreve(c: ConfigEditor) {
  const nome = nomeDoMotor(c.motor);
  if (c.motor === "openrouter") return `${nome} (com a sua chave, paga por uso, bem menos que uma edição)`;
  return `${nome}${c.modelo ? ` · ${c.modelo}` : ""} (no plano que você já assina, sem custo)`;
}

/** A situação da estação pros roteiros: ligada, desatualizada ou desligada. */
export function situacaoDaEstacao(roteiros: BatidaRoteiros | null, edicao: BatidaEstacao | null) {
  if (estacaoDeRoteirosLigada(roteiros)) return "ligada" as const;
  if (estacaoLigada(edicao)) return "antiga" as const;
  return "desligada" as const;
}

/** O cartão da estação na página dos roteiros. */
export function EstacaoRoteiros({ roteiros, edicao, config }: { roteiros: BatidaRoteiros | null; edicao: BatidaEstacao | null; config: ConfigEditor }) {
  const situacao = situacaoDaEstacao(roteiros, edicao);
  const ligada = situacao === "ligada";
  const iaComProblema = ligada && edicao?.motor_ok === false;
  return (
    <section className={`card flex items-center justify-between gap-3 p-3 ${ligada && !iaComProblema ? "" : "border-morno/60"}`}>
      <p className="text-sm">
        <span className="rotulo">Estação · {situacao === "ligada" ? "ligada" : situacao === "antiga" ? "precisa atualizar" : "desligada"}</span>
        <span className="mt-1 block text-xs text-suave">
          {situacao === "ligada" ? (
            <>
              Quem escreve no {roteiros?.maquina ?? "seu PC"}: {quemEscreve(config)}
              {roteiros?.ocupada ? ". Escrevendo agora." : "."}
              {iaComProblema ? <span className="block text-morno">Mas a IA não está pronta: {edicao?.motor_erro ?? "confira em Editor de vídeo → Quem edita"}.</span> : null}
            </>
          ) : situacao === "antiga" ? (
            <>
              A estação está ligada numa versão que ainda não escreve roteiros. Rode o comando da instalação de novo pra atualizar (
              <Link href="/#estacao" className="text-marca underline">
                passo da estação no Início
              </Link>
              ) e abra o atalho de novo.
            </>
          ) : (
            <>
              Os roteiros são escritos no seu PC, pela mesma IA que edita os seus vídeos ({quemEscreve(config)}). Abra o atalho <b>Estação de edição</b>{" "}
              (ainda não instalou? veja o{" "}
              <Link href="/#estacao" className="text-marca underline">
                passo a passo do Início
              </Link>
              ). Pedido feito com ela desligada espera na fila.
            </>
          )}
        </span>
      </p>
      <span className={`chip shrink-0 ${ligada && !iaComProblema ? "text-ok" : "text-morno"}`}>{ligada ? "● ligada" : "○ desligada"}</span>
    </section>
  );
}
