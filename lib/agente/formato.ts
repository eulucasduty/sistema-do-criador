// Resposta do modelo → balões de direct, do jeito que gente manda.
//
// Rede determinística: o modelo às vezes narra a ferramenta ("[chama
// passar_pro_criador]"), cola rótulo ("Resposta:"), usa markdown ou lista. Nada disso
// pode chegar na pessoa, então raspamos aqui, independente do que o prompt diz.

const FERRAMENTAS = /\b(passar_pro_criador|encerrar_conversa|pediu_pra_sair|consultar_se_segue|enviar_oferta)\b/gi;

export function limparResposta(texto: string): string {
  return (
    texto
      // bloco narrado de ferramenta/ação: "[chama passar_pro_criador com tipo x]", "(ferramenta: …)"
      .replace(/[[(][^\])]*\b(chama|chamar|ferramenta|tool|a[çc][aã]o|escalar|encerrar|sistema)\b[^\])]*[\])]/gi, "")
      .replace(FERRAMENTAS, "")
      // rótulo de quem fala
      .replace(/^\s*(criador|voc[eê]|resposta|agente)\s*:\s*/gim, "")
      // markdown
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      .replace(/^#{1,6}\s*/gm, "")
      .replace(/^\s*[-•*]\s+/gm, "")
      .replace(/^\s*\d{1,2}[.)]\s+/gm, "")
      // id interno que vazou
      .replace(/\s*\(?\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b\)?/gi, "")
      // aspas em volta do balão inteiro
      .replace(/^\s*["“”](.*)["“”]\s*$/gm, "$1")
      // travessão é assinatura de texto de IA: vira vírgula
      // (só espaço e tab: a linha em branco entre balões não pode sumir; "3–4" fica)
      .replace(/[ \t]*—[ \t]*/g, ", ")
      .replace(/[ \t]+–[ \t]+/g, ", ")
      .replace(/^,[ \t]*/gm, "")
      .replace(/,[ \t]*([?!.…]|$)/gm, "$1")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** "Opa" → "opa". Sigla (IA, MCP) e começo com número ficam como estão. */
function minusculaNoComeco(s: string): string {
  return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Ponto final em frase curta é cara de texto formal. Reticências, ? e ! ficam. */
function semPontoFinal(s: string): string {
  return /[^.]\.$/.test(s) ? s.slice(0, -1) : s;
}

/**
 * Mensagem picotada, como gente manda: um bloco só, longo e com várias frases, vira
 * 2-3 balões nas frases. Link nunca é cortado (a quebra é só depois de . ! ? …).
 */
function picotar(bloco: string, max: number): string[] {
  if (bloco.length < 90 || bloco.includes("\n")) return [bloco];
  const frases = bloco
    .split(/(?<=[.!?…])\s+(?=\S)/)
    .map((f) => f.trim())
    .filter(Boolean);
  if (frases.length < 2) return [bloco];
  const alvo = Math.min(max, frases.length);
  const tamanho = Math.ceil(frases.length / alvo);
  const saida: string[] = [];
  for (let i = 0; i < frases.length; i += tamanho) saida.push(frases.slice(i, i + tamanho).join(" "));
  return saida;
}

const LINHA_DE_LINK = /^\s*(?:https?:\/\/|www\.)\S+\s*$/i;

/** Quebra em balões (linha em branco separa), no máximo `max` — o excedente vai junto do último. */
export function emBaloes(texto: string, max = 3): string[] {
  let partes = limparResposta(texto)
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean).join("\n"))
    .filter(Boolean);
  if (partes.length === 1) partes = picotar(partes[0], max);
  // Ainda cabe balão: primeiro, linha colada vira balão próprio (menos a do link, que
  // fica junto de quem apresenta: "tá aqui 👇\nhttps://…"); depois, o mais longo com
  // duas frases vira dois
  while (partes.length < max) {
    const i = partes.findIndex((p) => p.split("\n").slice(1).some((l) => !LINHA_DE_LINK.test(l)));
    if (i >= 0) {
      const linhas = partes[i].split("\n");
      const corte = linhas.findIndex((l, k) => k > 0 && !LINHA_DE_LINK.test(l));
      partes.splice(i, 1, linhas.slice(0, corte).join("\n"), linhas.slice(corte).join("\n"));
      continue;
    }
    const longos = partes.map((p, k) => [p.length, k] as const).filter(([n]) => n >= 90).sort((a, b) => b[0] - a[0]);
    const alvo = longos.find(([, k]) => picotar(partes[k], 2).length === 2);
    if (!alvo) break;
    partes.splice(alvo[1], 1, ...picotar(partes[alvo[1]], 2));
  }
  partes = partes.map((p) => semPontoFinal(minusculaNoComeco(p)));
  if (partes.length <= max) return partes;
  return [...partes.slice(0, max - 1), partes.slice(max - 1).join("\n")];
}

/** Tempo de "digitando…" antes de cada balão: parece gente sem enrolar. Varia ±25%: ritmo fixo é assinatura de robô. */
export function tempoDigitando(balao: string): number {
  return Math.round(Math.min(1500 + balao.length * 45, 9000) * (0.75 + Math.random() * 0.5));
}
