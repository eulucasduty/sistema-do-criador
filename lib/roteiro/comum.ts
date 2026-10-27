// Roteiros: o que a tela (servidor e navegador) e o processo compartilham.

/** As durações que o criador escolhe (06/10: 30 a 45 s é o padrão; 60 e 90 pra quando pedir mais). */
export const DURACOES = [
  { valor: 45, nome: "30 a 45 s" },
  { valor: 60, nome: "60 s" },
  { valor: 90, nome: "90 s" },
];
export const DURACAO_PADRAO = 45;

export const STATUS_ROTEIRO: Record<string, { nome: string; cor: string }> = {
  subindo: { nome: "Subindo o vídeo", cor: "text-suave" },
  na_fila: { nome: "Na fila", cor: "text-frio" },
  transcrevendo: { nome: "Ouvindo a referência", cor: "text-frio" },
  aguardando_estacao: { nome: "Aguardando a estação", cor: "text-morno" },
  escrevendo: { nome: "Escrevendo", cor: "text-roxo" },
  pronto: { nome: "Pronto", cor: "text-ok" },
  erro: { nome: "Erro", cor: "text-quente" },
};
export const FINAIS_ROTEIRO = ["pronto", "erro"];

/**
 * A estação no PC do criador escreve os roteiros (Claude Code do plano dele, desde 06/10). Ela bate a
 * cada 30 s em configuracao.estacao_roteiros: mais de 90 s sem bater = desligada.
 */
export type BatidaRoteiros = { visto_em: string | null; maquina: string | null; ocupada?: boolean; roteiro_id?: string | null };
export const estacaoDeRoteirosLigada = (b: BatidaRoteiros | null | undefined) => Boolean(b?.visto_em && Date.now() - new Date(b.visto_em).getTime() < 90_000);

/** Sem andar há mais de N minutos (o processo caiu no meio): a tela oferece "Tentar de novo". */
export const parado = (atualizadoEm: string, minutos = 6) => Date.now() - new Date(atualizadoEm).getTime() > minutos * 60_000;

export const ORIGEM_ROTEIRO: Record<string, string> = {
  tema: "tema",
  arquivo: "vídeo de referência",
  link: "link de referência",
  esteira: "reel da esteira",
  monitor: "criador monitorado",
  manual: "colado na esteira",
};

/** Divide a linha em pedaços: texto normal e [colchetes] que o criador preenche antes de gravar. */
export function pedacos(linha: string): Array<{ texto: string; preencher: boolean }> {
  return linha
    .split(/(\[[^\]]{1,80}\])/)
    .filter(Boolean)
    .map((texto) => ({ texto, preencher: /^\[.*\]$/.test(texto) }));
}
