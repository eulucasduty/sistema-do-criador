// A legenda do post de um carrossel (pedido do criador, 18/10):
//   1ª linha sempre: Comenta "PALAVRA" pra receber na sua DM!
//   logo embaixo, a legenda que a estação escreveu, sem o CTA dela (a frase do "comenta X" e o
//   "Quer receber…?" antes dela saem, mesmo no meio do parágrafo) e com no máximo 4 hashtags.
//   O título só entra quando a estação não escreveu legenda.
// Sem "server-only": o script de agendar usa a mesma regra.

const MAX_HASHTAGS = 4;
const LIMITE_IG = 2200;

const ehCta = (frase: string) => /\bcoment[ae]\b/i.test(frase);
// "Quer receber o passo a passo?", "Quer o prompt?", "Bora?" logo antes do CTA
const ehChamada = (frase: string) => /\?\s*$/.test(frase) && /\b(quer|receber|bora)\b/i.test(frase);

/** Tira o CTA da estação de um parágrafo, frase por frase. */
function semCta(paragrafo: string): string {
  const frases = paragrafo.split(/(?<=[.!?…])\s+/);
  const fica: string[] = [];
  for (const f of frases) {
    if (ehCta(f)) {
      if (fica.length && ehChamada(fica[fica.length - 1])) fica.pop();
      continue;
    }
    fica.push(f);
  }
  return fica.join(" ").trim();
}

export function legendaDoCarrossel(palavra: string, titulo: string | null | undefined, legenda: string | null | undefined): string {
  const cta = `Comenta "${palavra.toUpperCase()}" pra receber na sua DM!`;
  const tags: string[] = [];
  const base = legenda?.trim() ? legenda : titulo ?? "";
  const corpo = base
    .replace(/\r\n/g, "\n")
    .replace(/#[\p{L}\p{N}_]+/gu, (t) => {
      if (!tags.some((x) => x.toLowerCase() === t.toLowerCase())) tags.push(t);
      return "";
    })
    .split("\n")
    .map((l) => semCta(l.replace(/[ \t]+$/g, "")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  // Preserve as hashtags do criador, sem presumir um nicho.
  const fim = [...new Set(tags)].slice(0, MAX_HASHTAGS).join(" ");
  const texto = [`${cta}\n${corpo}`.trim(), fim].filter(Boolean).join("\n\n");
  return texto.length > LIMITE_IG ? texto.slice(0, LIMITE_IG) : texto;
}

/** A 1ª linha da legenda do reel (pedido do Duty, 19/10: "Comenta XXXXXX pra receber passo a passo na dm"). */
export const ctaDoReel = (palavra: string) => `Comenta "${palavra.trim().toUpperCase()}" pra receber o passo a passo na DM!`;

/**
 * A legenda do reel da esteira: a 1ª linha é sempre o CTA e, embaixo, a legenda que a estação
 * escreveu sem o "comenta X" dela. Já começa pelo CTA desta palavra: fica como está (dá pra rodar
 * de novo sem duplicar, e o que o Duty mexeu não muda).
 */
export function legendaDoReel(palavra: string | null | undefined, legenda: string | null | undefined): string {
  const base = String(legenda ?? "").replace(/\r\n/g, "\n").trim();
  if (!palavra?.trim()) return base;
  const cta = ctaDoReel(palavra);
  if (base.split("\n")[0].trim().toLowerCase() === cta.toLowerCase()) return base;
  const corpo = base
    .split("\n")
    .map((l) => semCta(l.replace(/[ \t]+$/g, "")))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const texto = `${cta}\n${corpo}`.trim();
  return texto.length > LIMITE_IG ? texto.slice(0, LIMITE_IG) : texto;
}
