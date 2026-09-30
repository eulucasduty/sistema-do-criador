// Regras de tela da Esteira, usadas pela lista, pela referência e pelas ações.

export const ETAPAS = [
  { etapa: "nova", nome: "Nova" },
  { etapa: "analisada", nome: "Analisada" },
  { etapa: "vou_gravar", nome: "Vou gravar" },
  { etapa: "gravado", nome: "Gravado" },
  { etapa: "postado", nome: "Postado" },
  { etapa: "descartada", nome: "Descartada" },
] as const;

/** A função da Vercel morre em 5 min: "analisando" ou "atualizando" há mais que isso travou. */
export const TRAVOU_MS = 7 * 60_000;

type Ref = {
  analise: unknown;
  arquivo: string | null;
  aguardando_video: boolean;
  erro: string | null;
  atualizado_em: string;
};

export type EstadoAnalise = "aguardando" | "pronta" | "erro" | "travada" | "analisando";

export function estadoDaAnalise(r: Ref, agora = Date.now()): EstadoAnalise {
  if (r.analise) return "pronta";
  if (r.aguardando_video || !r.arquivo) return "aguardando";
  if (r.erro) return "erro";
  if (agora - new Date(r.atualizado_em).getTime() > TRAVOU_MS) return "travada";
  return "analisando";
}

/** A persona está sendo atualizada agora (e não travou)? */
export const personaRodando = (status: string | undefined, desde: string | null | undefined, agora = Date.now()) =>
  status === "atualizando" && agora - new Date(desde ?? 0).getTime() < TRAVOU_MS;

export const ehVideo = (r: { arquivo: string | null; arquivo_tipo: string | null }) => Boolean(r.arquivo_tipo?.includes("video") || r.arquivo?.endsWith(".mp4"));

// Os limites do envio (os mesmos de lib/esteira/referencia.ts, que só roda no servidor)
export const MAX_MB = 45; // o storage grátis aceita até 50 MB por arquivo
export const MAX_PRINTS = 12;
export const TIPOS_PRINT = "image/png,image/jpeg,image/webp";
