// Editor de vídeo: tipos e constantes que o painel e as ações do servidor compartilham.
// A edição em si roda na estação, no PC do criador (scripts/estacao-edicao.mjs).

import catalogo from "./editor-estilos.json";

/** Partes de 45 MB: o storage aceita até 50 MB por arquivo. */
export const PARTE_BYTES = 45 * 1024 * 1024;
export const partesDe = (tamanho: number) => Math.max(1, Math.ceil(tamanho / PARTE_BYTES));

/**
 * Estilos de edição: os cards que o criador escolhe ao subir o vídeo. Vêm do kit do editor
 * (editor/kit/estilos/<id>: o manual que a IA segue, as cores e as regras de cada um). A lista é
 * gerada por `npm run editor:catalogo` em lib/editor-estilos.json.
 */
export type EstiloEdicao = {
  id: string;
  nome: string;
  grupo: string;
  ordem: number;
  descricao: string;
  /** recorta a pessoa do fundo em alguns trechos (o render demora mais) */
  recorte: boolean;
  padrao: boolean;
  /** o tipo de legenda padrão do estilo (o primeiro de `legendas`) */
  legenda: string;
  legendas: Array<{ id: string; nome: string }>;
  /** fundo, destaque e segunda cor do tema (a amostra do card) */
  cores: string[];
};
export const ESTILOS_EDICAO = catalogo as EstiloEdicao[];
/** Os grupos, na ordem em que aparecem no formulário. */
export const GRUPOS_ESTILO: Array<{ id: string; nome: string; resumo: string }> = [
  { id: "base", nome: "Para começar", resumo: "Os três do dia a dia: o clássico, o vlog e o profissional." },
  { id: "roxo-3d", nome: "Roxo e 3D", resumo: "Motion em violeta: janelas, camadas de vidro, recorte de fundo e tipografia." },
  { id: "virais", nome: "Virais", resumo: "Os formatos que dominam o feed: legenda grande, corte rápido, manchete." },
  { id: "cinema", nome: "Cinema e minimal", resumo: "Contidos: pouca coisa na tela, muito acabamento." },
  { id: "documentario", nome: "Documentário", resumo: "Papel, prova, marca-texto, lugar e data." },
  { id: "tech", nome: "Tech e jornal", resumo: "Código, review e plantão de TV." },
];
export const ESTILO_PADRAO = (ESTILOS_EDICAO.find((e) => e.padrao) ?? ESTILOS_EDICAO[0]).id;
/** O estilo pedido, se existir; senão, o padrão. */
export const estiloDe = (v: unknown): EstiloEdicao => ESTILOS_EDICAO.find((e) => e.id === v) ?? ESTILOS_EDICAO.find((e) => e.id === ESTILO_PADRAO)!;
export const estiloValido = (v: unknown) => estiloDe(v).id;
export const nomeDoEstilo = (v: unknown) => estiloDe(v).nome;
// nomes de legenda de antes dos estilos (pedidos e perfis antigos)
const LEGENDA_ANTIGA: Record<string, string> = { labs: "limpa" };
/** A legenda pedida, se o estilo tiver esse tipo; senão, a padrão dele. */
export function legendaValida(estilo: unknown, v: unknown) {
  const e = estiloDe(estilo);
  const pedida = LEGENDA_ANTIGA[String(v)] ?? String(v ?? "");
  return e.legendas.some((l) => l.id === pedida) ? pedida : e.legenda;
}
export const nomeDaLegenda = (estilo: unknown, v: unknown) => estiloDe(estilo).legendas.find((l) => l.id === legendaValida(estilo, v))?.nome ?? "";

export type ArquivoPedido = { nome: string; tamanho: number; tipo: string; partes: number };
export type PedidoEdicao = {
  titulo: string;
  roteiro?: string;
  estilo: string; // o estilo de edição (editor/kit/estilos/<id>)
  legenda: string; // um dos tipos de legenda do estilo
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
