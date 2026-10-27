// Roteiro sem IA escrevendo (pedido do Duty, 20/10: "se colocarmos só a transcrição dos vídeos
// puxados vai ser melhor e mais barato"). Dois caminhos dão no mesmo formato do teleprompter:
//   · a fala do vídeo do criador monitorado, como ele falou (a transcrição do Gemini);
//   · o roteiro que o Duty cola na esteira ("colocar um roteiro na esteira").
// O texto é picotado em GANCHO / CORPO / CTA, uma ideia por linha. Puro: sem banco e sem IA.

import { medir } from "./anti-ia";
import type { VersaoRoteiro } from "./escrever";

const MAX_PALAVRAS_LINHA = 12;
/** o fim que pede ação: comentar, seguir, salvar, link */
const EH_CTA = /\b(comment|follow|comenta|comente|comentar|digita|digite|segue|siga|seguir|salva|salve|link na bio|me chama|manda)\b/i;

/** Frases do texto corrido (ponto, interrogação, exclamação ou quebra de linha). */
export function frases(texto: string): string[] {
  return texto
    .replace(/\r\n/g, "\n")
    .split(/\n+|(?<=[.!?…])\s+/)
    .map((f) => f.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * Frase de até 12 palavras fica inteira; a longa vira linhas de até 12, juntando os pedaços entre
 * vírgulas enquanto cabem (e cortando no meio só o pedaço que sozinho passa de 12).
 */
export function linhasDe(frase: string): string[] {
  const contar = (t: string) => t.split(/\s+/).filter(Boolean).length;
  if (contar(frase) <= MAX_PALAVRAS_LINHA) return [frase.trim()];
  const out: string[] = [];
  let atual = "";
  for (const pedaco of frase.split(/(?<=,)\s+/)) {
    if (atual && contar(atual) + contar(pedaco) <= MAX_PALAVRAS_LINHA) {
      atual = `${atual} ${pedaco}`;
      continue;
    }
    if (atual) out.push(atual);
    atual = "";
    const palavras = pedaco.split(/\s+/).filter(Boolean);
    for (let k = 0; k < palavras.length; ) {
      const resto = palavras.length - k;
      // não deixa uma ou duas palavras sozinhas na última linha
      const passo = resto > MAX_PALAVRAS_LINHA && resto < MAX_PALAVRAS_LINHA + 3 ? Math.ceil(resto / 2) : MAX_PALAVRAS_LINHA;
      const linha = palavras.slice(k, k + passo).join(" ");
      k += passo;
      if (k >= palavras.length) atual = linha;
      else out.push(linha);
    }
  }
  if (atual) out.push(atual);
  return out;
}

/** A palavra do "comenta X" (sem aspas e em maiúscula), se o texto pedir. */
export function palavraDoComenta(texto: string): string | null {
  const m = texto.match(/\b(?:comenta|comente|comentar|digita|digite|escreve|escreva|comment|type)\s+(?:a\s+palavra\s+|aqui\s+|o\s+|a\s+)?["“'«]?([\p{L}\p{N}]{2,20})["”'»]?/iu);
  if (!m) return null;
  const p = m[1];
  if (/^(aqui|ai|aí|embaixo|ali|que|isso|eu|pra|para|o|a|um|uma|nos|no|na|below|the|and)$/i.test(p)) return null;
  return p.toUpperCase();
}

/**
 * Divide o texto em gancho, corpo e CTA. Com os títulos GANCHO / CORPO / CTA (como sai do sistema),
 * vale o que está embaixo de cada um; sem eles, o gancho é a 1ª frase (até 2 linhas) e o CTA são as
 * frases do fim que pedem ação (ou a última).
 */
export function partesDoTexto(texto: string): { gancho: string[]; corpo: string[]; cta: string[] } {
  const limpo = texto.replace(/\r\n/g, "\n").trim();
  const titulos = [...limpo.matchAll(/^\s*(GANCHO|CORPO|CTA)\s*:?\s*$/gim)];
  if (titulos.some((t) => t[1].toUpperCase() === "GANCHO")) {
    const partes = { gancho: [] as string[], corpo: [] as string[], cta: [] as string[] };
    titulos.forEach((t, i) => {
      const fim = titulos[i + 1]?.index ?? limpo.length;
      const trecho = limpo.slice(t.index! + t[0].length, fim);
      const chave = t[1].toLowerCase() as keyof typeof partes;
      partes[chave].push(
        ...trecho
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .flatMap(linhasDe),
      );
    });
    return partes;
  }
  const lista = frases(limpo);
  if (!lista.length) return { gancho: [], corpo: [], cta: [] };
  let iniCta = lista.length;
  while (iniCta > 1 && EH_CTA.test(lista[iniCta - 1])) iniCta--;
  if (iniCta === lista.length && lista.length > 2) iniCta = lista.length - 1;
  const gancho = linhasDe(lista[0]).slice(0, 2);
  const restoGancho = linhasDe(lista[0]).slice(2);
  return {
    gancho,
    corpo: [...restoGancho, ...lista.slice(1, Math.max(1, iniCta)).flatMap(linhasDe)],
    cta: lista.slice(Math.max(1, iniCta)).flatMap(linhasDe),
  };
}

/** Monta a versão do roteiro (o mesmo formato que a estação escreve) a partir de texto pronto. */
export function versaoDoTexto(
  texto: string,
  o: { titulo?: string | null; palavra?: string | null; duracaoAlvo: number; deOndeVeio: string | null; modelo: string; legenda?: string | null },
): VersaoRoteiro {
  const p = partesDoTexto(texto);
  const linhas = [...p.gancho, ...p.corpo, ...p.cta];
  const medida = medir(linhas);
  const palavra = (o.palavra?.trim() || palavraDoComenta(p.cta.join(" ")) || palavraDoComenta(texto) || "").toUpperCase();
  const titulo = (o.titulo?.trim() || p.gancho.join(" ")).replace(/\s+/g, " ").slice(0, 90) || "roteiro";
  return {
    titulo,
    palavra_cta: palavra,
    gancho: p.gancho,
    corpo: p.corpo,
    cta: p.cta,
    dicas: [],
    legenda: o.legenda?.trim() ?? "",
    de_onde_veio: o.deOndeVeio,
    checagem: { aprovado: true, graves: [], leves: [], preencher: [], palavras: medida.palavras, segundos: medida.segundos },
    leitor: [],
    reescritas: [],
    duracao_alvo: o.duracaoAlvo,
    direcao: null,
    gerado_em: new Date().toISOString(),
    modelo: o.modelo,
    custo_usd: 0,
  };
}

const PT = /^(que|não|nao|você|voce|pra|para|com|uma|isso|esse|essa|mas|tá|ta|é|do|da|dos|das|no|na|em|eu|ele|mais|muito|como|aqui|vai|tem|quando|porque|seu|sua)$/i;
const EN = /^(the|and|you|your|this|that|with|for|is|are|to|of|it|in|on|my|we|just|what|how|can|will|get|all|now|if|so|be|have)$/i;

/** A fala está em português? (contagem de palavras comuns; texto curto demais conta como português) */
export function ehPortugues(texto: string): boolean {
  const palavras = texto.toLowerCase().match(/[\p{L}]+/gu) ?? [];
  let pt = 0;
  let en = 0;
  for (const p of palavras) {
    if (PT.test(p)) pt++;
    else if (EN.test(p)) en++;
  }
  return pt + en < 3 || pt >= en;
}
