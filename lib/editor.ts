// Editor de vídeo: tipos e constantes que o painel e as ações do servidor compartilham.
// A edição em si roda na estação, no PC do criador (scripts/estacao-edicao.mjs).

/** Partes de 45 MB: o storage aceita até 50 MB por arquivo. */
export const PARTE_BYTES = 45 * 1024 * 1024;
export const partesDe = (tamanho: number) => Math.max(1, Math.ceil(tamanho / PARTE_BYTES));

export type ArquivoPedido = { nome: string; tamanho: number; tipo: string; partes: number };
export type PedidoEdicao = {
  titulo: string;
  roteiro?: string;
  legenda: "bangers" | "labs";
  cor?: "natural" | "quente" | "duty"; // o look do vídeo (vazio = o do perfil)
  video: ArquivoPedido;
  materiais: Array<{ tipo: "imagem" | "video" | "link"; descricao: string; url?: string; arquivo?: ArquivoPedido }>;
};
export type EnvioParte = { caminho: string; url: string };

export const STATUS_EDICAO: Record<string, { nome: string; cor: string }> = {
  subindo: { nome: "Subindo arquivos", cor: "text-suave" },
  na_fila: { nome: "Na fila", cor: "text-frio" },
  preparando: { nome: "Preparando", cor: "text-frio" },
  editando: { nome: "Claude editando", cor: "text-roxo" },
  renderizando: { nome: "Renderizando", cor: "text-morno" },
  enviando: { nome: "Subindo o vídeo", cor: "text-morno" },
  pronto: { nome: "Pronto", cor: "text-ok" },
  erro: { nome: "Erro", cor: "text-quente" },
  cancelada: { nome: "Cancelada", cor: "text-apagado" },
};
export const FINAIS = ["pronto", "erro", "cancelada"];

export type BatidaEstacao = { visto_em: string | null; maquina: string | null; ocupada?: boolean; edicao_id?: string | null };
/** A estação bate a cada 30 s: mais de 90 s sem bater = desligada. */
export const estacaoLigada = (b: BatidaEstacao | null | undefined) => Boolean(b?.visto_em && Date.now() - new Date(b.visto_em).getTime() < 90_000);

/** "Meus sons": o papel de cada som no padrão de edição. O principal de cada função entra sozinho. */
export const FUNCOES_SOM: Array<{ funcao: string | null; nome: string; quando: string }> = [
  { funcao: "obturador", nome: "Clique das emendas", quando: "toda troca de tomada, junto com a onda de calor" },
  { funcao: "ding", nome: "Ding de dica", quando: "dica e momento de valor" },
  { funcao: "teclado", nome: "Teclado", quando: "o “comenta X” digitando e o terminal" },
  { funcao: "tecla", nome: "Tecla / tick", quando: "o contador subindo" },
  { funcao: "whoosh", nome: "Whoosh", quando: "transição, de vez em quando" },
  { funcao: "riser", nome: "Riser", quando: "antes de um corte ou de um suspense" },
  { funcao: "pop", nome: "Pop", quando: "card, item, comentário e mensagem entrando" },
  { funcao: "click", nome: "Click de destaque", quando: "a caixa dourada marcando algo no print" },
  { funcao: "impacto", nome: "Impacto", quando: "a palavra em tela cheia" },
  { funcao: "notificacao", nome: "Notificação", quando: "notificação de celular" },
  { funcao: null, nome: "Extras", quando: "o editor usa quando combina, pela descrição" },
];
export const NOMES_RESERVADOS = FUNCOES_SOM.map((f) => f.funcao).filter(Boolean) as string[];
export const VOLUMES_SOM = [
  { valor: 0.6, nome: "baixo" },
  { valor: 1, nome: "normal" },
  { valor: 1.5, nome: "alto" },
];
