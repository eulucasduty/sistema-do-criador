// Esteira de reels (pedido do Duty, 19/10): o que o gravador, a esteira e o servidor compartilham.
//
//   Roteiros → Pra editar → Editando → Review → Postagem → Postados
//
// O gravador (/gravar/<roteiro>) grava no celular, take por take, com o teleprompter na tela. Nada
// sobe até ele mandar: aí os takes vão pro bucket "edicao" (em partes, como no editor) com o corte
// do começo e do fim, a velocidade, os ajustes de imagem e a música. A estação no PC do criador junta
// os takes (editor/estacao/takes.mjs), edita e põe a música por baixo da voz no fim.

import type { ArquivoPedido } from "./editor";

/** Um take gravado: o arquivo e o que fazer com ele na junção. */
export type TakePedido = ArquivoPedido & {
  /** segundos cortados do começo e onde ele acaba (o resto sai) */
  inicio: number;
  fim: number;
  /** 0,5 a 2 (1 = normal) */
  velocidade: number;
};

/** Ajustes de imagem do gravador, aplicados na junção dos takes (0 = como gravou). */
export type AjustesVideo = {
  /** -1 a 1 */
  brilho: number;
  /** -1 a 1: clareia ou escurece os tons médios (o rosto) sem estourar o branco */
  iluminacao: number;
  /** 0 a 1 */
  nitidez: number;
};
export const AJUSTES_NEUTROS: AjustesVideo = { brilho: 0, iluminacao: 0, nitidez: 0 };

export type MusicaPedido = { id: string; nome: string; arquivo: string; volume: number };

/** O que o gravador manda (o servidor cria a edição e devolve os links de envio). */
export type PedidoGravacao = {
  roteiroId: string;
  /** a versão do roteiro que ele leu (0 = a mais nova) */
  versao: number;
  titulo: string;
  takes: TakePedido[];
  ajustes: AjustesVideo;
  musica: { id: string; volume: number } | null;
};

export const VELOCIDADES = [0.8, 0.9, 1, 1.1, 1.2, 1.25, 1.3, 1.5];
export const MAX_TAKES = 30;

const entre = (n: unknown, min: number, max: number, padrao: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao;
};
export function ajustesValidos(a: Partial<AjustesVideo> | null | undefined): AjustesVideo {
  return { brilho: entre(a?.brilho, -1, 1, 0), iluminacao: entre(a?.iluminacao, -1, 1, 0), nitidez: entre(a?.nitidez, 0, 1, 0) };
}
export const velocidadeValida = (v: unknown) => entre(v, 0.5, 2, 1);
export const volumeValido = (v: unknown) => entre(v, 0, 1, 0.15);

/**
 * Prévia no navegador (CSS) dos ajustes, perto do que o ffmpeg faz na estação. A nitidez não tem
 * prévia fiel em CSS: um pouco de contraste dá a ideia.
 */
export function filtroCss(a: AjustesVideo): string {
  const brilho = 1 + a.brilho * 0.35 + a.iluminacao * 0.15;
  const contraste = 1 - a.iluminacao * 0.08 + a.nitidez * 0.08;
  return `brightness(${brilho.toFixed(3)}) contrast(${contraste.toFixed(3)})`;
}

// ── a agenda dos reels ────────────────────────────────────────────
/** configuracao.agenda_reels: os horários do dia (Brasília) em que sai um reel aprovado. */
export type AgendaReels = { horarios: string[] };
/** Fora dos horários dos carrosséis (6h a 16h, de 2 em 2 h). */
export const AGENDA_REELS_PADRAO: AgendaReels = { horarios: ["11:00", "19:00"] };
export const horarioValido = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

/** O próximo horário livre da agenda a partir de `depois` (os ocupados ficam de fora). */
export function proximoHorario(horarios: string[], ocupados: string[], depois = new Date(Date.now() + 10 * 60_000)): Date {
  const lista = (horarios.filter(horarioValido).length ? horarios.filter(horarioValido) : AGENDA_REELS_PADRAO.horarios).slice().sort();
  const usados = new Set(ocupados.map((o) => new Date(o).getTime()));
  for (let d = 0; d < 120; d++) {
    const dia = new Date(depois.getTime() + d * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    for (const h of lista) {
      const quando = new Date(`${dia}T${h}:00-03:00`);
      if (quando > depois && !usados.has(quando.getTime())) return quando;
    }
  }
  return new Date(depois.getTime() + 86_400_000);
}

// ── as etapas da esteira ───────────────────────────────────────────
export const ETAPAS_REELS = [
  { id: "roteiros", nome: "Roteiros", dica: "pra gravar" },
  { id: "pra_editar", nome: "Pra editar", dica: "escolha a edição" },
  { id: "editando", nome: "Editando", dica: "na estação" },
  { id: "review", nome: "Review", dica: "confere e aprova" },
  { id: "postagem", nome: "Postagem", dica: "agendados" },
  { id: "postados", nome: "Postados", dica: "com automação e material" },
] as const;
export type EtapaReel = (typeof ETAPAS_REELS)[number]["id"];

/** Em qual etapa está a edição mais nova de um roteiro gravado. */
export function etapaDaEdicao(e: { status: string; aprovada_em: string | null }, postagem: { status: string } | null): EtapaReel {
  if (postagem?.status === "publicada") return "postados";
  if (e.status === "subindo" || e.status === "gravado") return "pra_editar";
  if (e.status === "pronto") return e.aprovada_em ? "postagem" : "review";
  return "editando";
}
