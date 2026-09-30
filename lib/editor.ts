// Editor de vídeo: tipos e constantes que o painel e as ações do servidor compartilham.
// A edição em si roda na estação, no PC do criador (scripts/estacao-edicao.mjs).

/** Partes de 45 MB: o storage aceita até 50 MB por arquivo. */
export const PARTE_BYTES = 45 * 1024 * 1024;
export const partesDe = (tamanho: number) => Math.max(1, Math.ceil(tamanho / PARTE_BYTES));

export type ArquivoPedido = { nome: string; tamanho: number; tipo: string; partes: number };
export type PedidoEdicao = {
  titulo: string;
  roteiro?: string;
  legenda: "bangers" | "limpa";
  cor?: "natural" | "quente" | "contraste"; // o look do vídeo (vazio = o do perfil)
  video: ArquivoPedido;
  materiais: Array<{ tipo: "imagem" | "video" | "link"; descricao: string; url?: string; arquivo?: ArquivoPedido }>;
};
export type EnvioParte = { caminho: string; url: string };

export const STATUS_EDICAO: Record<string, { nome: string; cor: string }> = {
  subindo: { nome: "Subindo arquivos", cor: "text-suave" },
  na_fila: { nome: "Na fila", cor: "text-frio" },
  preparando: { nome: "Preparando", cor: "text-frio" },
  editando: { nome: "IA editando", cor: "text-roxo" },
  renderizando: { nome: "Renderizando", cor: "text-morno" },
  enviando: { nome: "Subindo o vídeo", cor: "text-morno" },
  pronto: { nome: "Pronto", cor: "text-ok" },
  erro: { nome: "Erro", cor: "text-quente" },
  cancelada: { nome: "Cancelada", cor: "text-apagado" },
};
export const FINAIS = ["pronto", "erro", "cancelada"];

/**
 * Quem edita os vídeos (configuracao "editor"). A estação lê a cada pedido e confere se o programa
 * está instalado e logado no PC (editor/estacao/motor.mjs).
 */
export type MotorEdicao = "claude" | "codex" | "openrouter";
export type ConfigEditor = { motor: MotorEdicao; modelo: string | null };
export const MOTOR_PADRAO: ConfigEditor = { motor: "claude", modelo: null };
/** Custo típico de uma edição pela OpenRouter (Claude Sonnet, ~1 min de vídeo), em reais. */
export const CUSTO_OPENROUTER = "uns R$ 10";
export const MOTORES: Array<{ id: MotorEdicao; nome: string; quem: string; como: string; modeloPadrao: string }> = [
  {
    id: "claude",
    nome: "Claude",
    quem: "Você tem assinatura do Claude Pro ou Max",
    como: "O Claude Code, logado na sua conta do Claude, edita no seu PC. Não cobra nada por vídeo.",
    modeloPadrao: "opus",
  },
  {
    id: "codex",
    nome: "ChatGPT",
    quem: "Você tem ChatGPT Plus ou Pro",
    como: "O Codex da OpenAI, logado na sua conta do ChatGPT, edita no seu PC. Não cobra nada por vídeo.",
    modeloPadrao: "o padrão da sua conta",
  },
  {
    id: "openrouter",
    nome: "OpenRouter",
    quem: `Não tem nenhum dos dois: paga por vídeo, ${CUSTO_OPENROUTER}`,
    como: "O Claude Code usa a sua chave da OpenRouter (a mesma do passo 2 do Início). Não precisa de assinatura.",
    modeloPadrao: "anthropic/claude-sonnet-5.5",
  },
];
export const nomeDoMotor = (m: unknown) => MOTORES.find((x) => x.id === m)?.nome ?? "Claude";
export function configEditor(v: unknown): ConfigEditor {
  const o = (v ?? {}) as Partial<ConfigEditor>;
  const motor = MOTORES.some((m) => m.id === o.motor) ? (o.motor as MotorEdicao) : "claude";
  const modelo = typeof o.modelo === "string" && /^[~\w./:[\]-]{1,100}$/.test(o.modelo.trim()) ? o.modelo.trim() : null;
  return { motor, modelo };
}
/** Os passos da IA no log do pedido começam assim ("o Claude rodou…", "o ChatGPT escreveu…"). */
export const PASSO_DA_IA = /^(o Claude|o ChatGPT) /;

export type BatidaEstacao = {
  visto_em: string | null;
  maquina: string | null;
  ocupada?: boolean;
  edicao_id?: string | null;
  /** O motor que a estação conferiu por último e se ele está pronto (instalado e logado). */
  motor?: MotorEdicao | null;
  modelo?: string | null;
  motor_ok?: boolean | null;
  motor_erro?: string | null;
  motor_aviso?: string | null;
  motor_conferido_em?: string | null;
};
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
