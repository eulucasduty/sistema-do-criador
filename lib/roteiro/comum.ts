// Roteiros: o que a tela (servidor e navegador), as ações e o processo compartilham.
// O escritor e a checagem anti-IA ficam em lib/roteiro/*.mjs (a estação no PC usa os mesmos).

import type { Checagem } from "./anti-ia.mjs";

export type { Checagem };

/** As durações pra escolher: 30 a 45 s é o padrão; 60 e 90 pra quando pedir mais. */
export const DURACOES = [
  { valor: 45, nome: "30 a 45 s" },
  { valor: 60, nome: "60 s" },
  { valor: 90, nome: "90 s" },
];
export const DURACAO_PADRAO = 45;
export const duracaoValida = (d: unknown) => (DURACOES.some((x) => x.valor === Number(d)) ? Number(d) : DURACAO_PADRAO);

export const STATUS_ROTEIRO: Record<string, { nome: string; cor: string }> = {
  subindo: { nome: "Subindo o vídeo", cor: "text-suave" },
  na_fila: { nome: "Na fila", cor: "text-frio" },
  transcrevendo: { nome: "Ouvindo a referência", cor: "text-frio" },
  aguardando_estacao: { nome: "Esperando a estação", cor: "text-morno" },
  escrevendo: { nome: "Escrevendo", cor: "text-roxo" },
  pronto: { nome: "Pronto", cor: "text-ok" },
  erro: { nome: "Erro", cor: "text-quente" },
};
export const FINAIS_ROTEIRO = ["pronto", "erro"];

export const ORIGEM_ROTEIRO: Record<string, string> = {
  tema: "tema",
  arquivo: "vídeo de referência",
  link: "link de referência",
  esteira: "reel da Esteira",
};

/**
 * A parte da estação que escreve os roteiros bate a cada 30 s em configuracao "estacao_roteiros":
 * mais de 90 s sem bater = desligada.
 */
export type BatidaRoteiros = { visto_em: string | null; maquina: string | null; ocupada?: boolean; roteiro_id?: string | null };
export const estacaoDeRoteirosLigada = (b: BatidaRoteiros | null | undefined) => Boolean(b?.visto_em && Date.now() - new Date(b.visto_em).getTime() < 90_000);

/** Sem andar há mais de N minutos (o processo caiu no meio): a tela oferece "Tentar de novo". */
export const parado = (atualizadoEm: string, minutos = 7) => Date.now() - new Date(atualizadoEm).getTime() > minutos * 60_000;

export type Leitura = { linha: string; por_que: string; sugestao?: string | null };

/** Uma versão do roteiro (o que lib/roteiro/escritor.mjs devolve e a estação grava). */
export type VersaoRoteiro = {
  titulo: string;
  palavra_cta: string;
  gancho: string[];
  corpo: string[];
  cta: string[];
  /** pra gravar (o que mostrar na tela): fora do texto lido */
  dicas: string[];
  legenda: string;
  de_onde_veio: string | null;
  checagem: Checagem;
  /** o que o leitor ainda achou com cara de IA na versão final */
  leitor: Leitura[];
  /** o que foi barrado em cada rodada de reescrita */
  reescritas: Array<{ motivos: string[] }>;
  duracao_alvo: number;
  direcao: string | null;
  gerado_em: string;
  /** quem escreveu e por onde (ex.: "Claude · opus (plano do Claude, estação PC-da-Ana)") */
  modelo: string;
  /** o que foi cobrado (no plano do Claude ou do ChatGPT, 0) */
  custo_usd: number;
  /** no plano: quanto seria na API (referência, não é cobrado) */
  equivalente_api_usd?: number;
};

/** Divide a linha em pedaços: texto normal e [colchetes] que o criador preenche antes de gravar. */
export function pedacos(linha: string): Array<{ texto: string; preencher: boolean }> {
  return linha
    .split(/(\[[^\]]{1,80}\])/)
    .filter(Boolean)
    .map((texto) => ({ texto, preencher: /^\[.*\]$/.test(texto) }));
}

/** O banco ainda não tem a tabela (falta rodar o SQL 002). */
export const semTabela = (e: { code?: string; message?: string } | null | undefined) =>
  Boolean(e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|Could not find the table/i.test(e.message ?? "")));
