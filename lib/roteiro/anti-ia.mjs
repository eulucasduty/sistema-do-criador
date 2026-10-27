// A camada anti-IA dos roteiros: roteiro de IA costuma ficar na cara, e é isso que trava muito
// criador de usar. Determinística: roda em cada roteiro gerado, sem custo, e o que reprovar volta
// pro escritor reescrever (lib/roteiro/escritor.mjs). Base: os sinais de texto de IA (o guia
// "humanizer", trazido pro português falado) + regras de copy pra vídeo:
//   · proibido "não é X, é Y" e toda contradição de IA
//   · sem travessão
//   · direto, falado, frase curta: teleprompter lê uma ideia por linha, sem rubrica no texto lido
// Grave reprova sozinho. Leve só reprova junto (3 ou mais). O roteiro final também passa por
// limparLinha (rede de segurança: travessão vira vírgula, aspa curva vira reta, emoji sai).
//
// JavaScript puro de propósito: o painel (TypeScript) e a estação no PC do criador (Node, sem
// build) usam o mesmo arquivo.

/** @typedef {{ regra: string, trecho: string, grave: boolean, dica: string }} Problema */
/**
 * @typedef {{
 *   aprovado: boolean,
 *   graves: Problema[],
 *   leves: Problema[],
 *   preencher: string[],
 *   palavras: number,
 *   segundos: number,
 * }} Checagem
 * `preencher`: os [colchetes] que o criador preenche antes de gravar (número, nome, resultado dele).
 */
/** @typedef {{ gancho: string[], corpo: string[], cta: string[], palavra_cta?: string | null }} Partes */

const INI = String.raw`(?<![\p{L}\p{N}])`;
const FIM = String.raw`(?![\p{L}\p{N}])`;
const re = (s, flags = "giu") => new RegExp(s, flags);

/**
 * Ritmo da fala lendo no teleprompter, com folga. Reels que viralizam costumam ir de 3,8 a 4,4
 * palavras por segundo; quem lê fica perto de 3,2 a 3,9.
 */
export const PALAVRAS_POR_SEGUNDO = 3.3;
export const LINHA_LONGA = 16;
export const LINHA_GRANDE_DEMAIS = 22;

const CONTRADICAO = "contradição de IA (não é X, é Y)";
const DICA_CONTRADICAO = 'diga do jeito positivo, direto: em vez de "não é sorte, é método", "o que funciona é método"';

/**
 * As regras de texto. A ordem é a do relatório.
 * @type {Array<{ regra: string, re: RegExp, grave: boolean, dica: string, soNoGancho?: boolean }>}
 */
export const REGRAS = [
  // ── copy pra vídeo ──
  { regra: "travessão", re: /[—–]|\s-\s/gu, grave: true, dica: "sem travessão: vira vírgula, ponto ou frase nova" },
  {
    regra: CONTRADICAO,
    re: re(String.raw`${INI}n[aã]o (?:[eé]|s[aã]o|foi|era|t[aá]|est[aá]|vai ser)${FIM}[^.!?\n]{1,60}?[,.:;]\s*(?:é|são|foi|era|mas sim|mas é|mas são|e sim)${FIM}`),
    grave: true,
    dica: DICA_CONTRADICAO,
  },
  { regra: CONTRADICAO, re: re(String.raw`${INI}n[aã]o (?:[eé]|s[aã]o) (?:s[oó]|apenas|somente)${FIM}`), grave: true, dica: DICA_CONTRADICAO },
  { regra: CONTRADICAO, re: re(String.raw`${INI}n[aã]o se trata de${FIM}|${INI}n[aã]o (?:[eé]|tem a ver) (?:sobre|com)${FIM}`), grave: true, dica: DICA_CONTRADICAO },
  { regra: CONTRADICAO, re: re(String.raw`${INI}mais (?:do )?que (?:um |uma |s[oó] |apenas )[^,.!?\n]{1,40}[,.]\s*(?:[eé]|um|uma)${FIM}`), grave: true, dica: DICA_CONTRADICAO },
  { regra: CONTRADICAO, re: re(String.raw`${INI}n[aã]o porque${FIM}[^.!?\n]{1,60}mas porque${FIM}`), grave: true, dica: DICA_CONTRADICAO },
  { regra: CONTRADICAO, re: re(String.raw`${INI}deixa(?:r|m)? de ser${FIM}[^.!?\n]{1,40}(?:e |pra |para )(?:passa|vira|virar|ser)${FIM}`), grave: true, dica: DICA_CONTRADICAO },
  {
    regra: CONTRADICAO,
    re: re(String.raw`${INI}(?:o problema|a quest[aã]o|o segredo|o ponto|a diferen[cç]a|o erro) n[aã]o (?:[eé]|est[aá]|t[aá])${FIM}`),
    grave: true,
    dica: DICA_CONTRADICAO,
  },
  {
    regra: "você está perdendo",
    re: re(String.raw`${INI}(?:voc[eê]|vc|c[eê]|tu)\s+(?:est[aá]|t[aá]|ta|vai (?:ficar|estar)|fica)\s+perdendo${FIM}`),
    grave: true,
    dica: "sem culpar quem assiste: mostre o ganho",
  },

  // ── pergunta retórica respondida na sequência ("E o melhor? …") ──
  {
    regra: "pergunta retórica de IA",
    re: re(
      String.raw`(?:^|[\n.!?]\s*)(?:e\s+)?(?:o|a)\s+(?:melhor|pior|resultado|segredo|detalhe|problema|pegadinha|diferen[cç]a|verdade|truque|parte boa)(?:\s+de tudo|\s+disso)?\s*\?|${INI}(?:sabe|quer saber) (?:o que|qual) (?:[eé] )?(?:o|a) (?:melhor|pior|segredo|resultado)${FIM}|${INI}por qu[eê]\s*\?\s*porque${FIM}`,
    ),
    grave: true,
    dica: 'conta direto, sem o "E o melhor? …"',
  },

  // ── abertura que perde os 3 primeiros segundos ──
  {
    regra: "cumprimento no gancho",
    re: re(String.raw`^\s*(?:ol[aá]|oi|e a[ií]|fala),? (?:gente|galera|pessoal|turma|meu povo|time)${FIM}`, "iu"),
    grave: true,
    dica: "o gancho bate na 1ª frase: corta o cumprimento",
    soNoGancho: true,
  },
  {
    regra: "anúncio no gancho",
    re: re(String.raw`^\s*(?:(?:nesse|neste|no) v[ií]deo|hoje (?:eu vou|a gente vai|vamos)|vou (?:te )?(?:mostrar|ensinar|explicar) (?:nesse|neste) v[ií]deo)${FIM}`, "iu"),
    grave: false,
    dica: "o gancho entrega o choque ou a promessa, não anuncia o vídeo",
    soNoGancho: true,
  },

  // ── vocabulário de IA (humanizer, em português) ──
  .../** @type {Array<[string, boolean]>} */ ([
    [String.raw`crucia(?:l|is)`, true],
    [String.raw`no cen[aá]rio (?:atual|de hoje|digital)|nesse cen[aá]rio|neste cen[aá]rio`, true],
    [String.raw`panorama`, true],
    [String.raw`jornada`, true],
    [String.raw`mergulh(?:ar|e|amos|ando)(?: fundo)?`, true],
    [String.raw`desvend(?:ar|e|a|amos)`, true],
    [String.raw`desbloque(?:ar|ie|ia|ando)`, true],
    [String.raw`(?:destrav|desbloque)\p{L}* (?:o |seu |teu |todo o |todo seu )?potencial`, true],
    [String.raw`potencializ\p{L}*`, true],
    [String.raw`alavanc\p{L}*`, true],
    [String.raw`revolucion\p{L}*`, true],
    [String.raw`transformador\p{L}*|transform(?:ar|e) (?:a |sua |tua )vida`, true],
    [String.raw`divisor de [aá]guas|game ?changer`, true],
    [String.raw`virada de chave`, false],
    [String.raw`no mundo (?:de hoje|atual|digital|moderno)|nos dias (?:de hoje|atuais)|n?um mundo (?:onde|em que)|era digital`, true],
    [String.raw`nesse sentido|neste sentido|al[eé]m disso|ademais|outrossim`, true],
    [String.raw`vale (?:ressaltar|destacar|lembrar|mencionar)|[eé] important[ei] (?:notar|ressaltar|lembrar|destacar|mencionar|entender|saber)`, true],
    [String.raw`em suma|em resumo|resumindo|moral da hist[oó]ria`, true],
    [String.raw`robust[oa]s?|abrangente|hol[ií]stic\p{L}*|sinergia|paradigma|tape[cç]aria|ecossistema`, true],
    [String.raw`pilar(?:es)?`, true],
    [String.raw`elev(?:e|ar|a) (?:o |seu |teu |a |sua |tua )?(?:neg[oó]cio|n[ií]vel|jogo|marca|resultado)`, true],
    [String.raw`impulsion\p{L}*|maximiz\p{L}*|aprimor\p{L}*|foment\p{L}*|catalis\p{L}*`, true],
    [String.raw`a verdade [eé] que|no final do dia`, true],
    [String.raw`simples assim|spoiler|sem mais delongas`, true],
    [String.raw`prepare-se|imagine (?:s[oó]|um mundo|só)|descubra|confira`, true],
    [String.raw`vamos (?:mergulhar|explorar|desvendar|entender juntos|juntos)`, true],
    [String.raw`essencia(?:l|is)|fundamenta(?:l|is)`, false],
    [String.raw`inovador\p{L}*|de ponta|imperd[ií]ve(?:l|is)|poderos[oa]s?`, false],
    [String.raw`incr[ií]ve(?:l|is)|fant[aá]stic\p{L}*|extraordin[aá]ri\p{L}*|surpreendente|impressionante|sensaciona(?:l|is)`, false],
    [String.raw`no fim das contas|sem d[uú]vida(?:s)?|definitivamente`, false],
    [String.raw`otimiz\p{L}*|eficien\p{L}*|estrat[eé]gic\p{L}*`, false],
  ]).map(([padrao, grave]) => ({
    regra: "vocabulário de IA",
    re: re(String.raw`${INI}(?:${padrao})${FIM}`),
    grave,
    dica: "troca pela palavra que alguém usaria falando com um amigo",
  })),

  // ── papo de chatbot ──
  {
    regra: "papo de chatbot",
    re: re(String.raw`espero que (?:isso |esse v[ií]deo |esse conte[uú]do )?(?:te |lhe )?ajude|${INI}[oó]tima pergunta|fico (?:muito )?feliz|se quiser,? (?:eu )?posso|aqui est[aá] (?:o|a|seu|teu|sua|tua)${FIM}|^\s*(?:claro|com certeza|certamente)\s*!`),
    grave: true,
    dica: "isso é fala de assistente, não de gente",
  },

  // ── português escrito, que ninguém fala em reel ──
  {
    regra: "português de texto escrito",
    re: re(String.raw`${INI}(?:entretanto|todavia|contudo|cujo|cuja|cujos|cujas|lhe|lhes|o qual|a qual|os quais|as quais|mediante|acerca de|por conseguinte|destarte)${FIM}|${INI}\p{L}+-(?:lhe|lhes|lo|la|los|las|me|nos)${FIM}`),
    grave: true,
    dica: 'fala do jeito que se fala: "mas", "que", "pra ele"',
  },
  { regra: "português de texto escrito", re: re(String.raw`${INI}(?:portanto|dessa forma|desta forma|assim sendo)${FIM}|${INI}\p{L}+-se${FIM}`), grave: false, dica: "fala do jeito que se fala" },

  // ── "sem X, sem Y" (negação em lista, assinatura de copy de IA) ──
  { regra: "negação em lista", re: re(String.raw`${INI}sem [^,.!?\n]{1,25}, sem${FIM}`), grave: false, dica: "fala o que tem, não a lista do que não tem" },

  // ── o que não pode estar no texto LIDO ──
  { regra: "rubrica no texto lido", re: /\([^)]*\)/gu, grave: true, dica: "indicação de cena vai em dicas de gravação, fora do texto lido" },
  {
    regra: "rubrica no texto lido",
    re: re(String.raw`\[[^\]]*(?:cena|corte|corta|tela|mostr|apont|pausa|zoom|b-?roll|close|c[aâ]mera|print|olha pra|sorri|risada|m[uú]sica|efeito|transi[cç]|texto|v[ií]deo|gesto|enquadr)[^\]]*\]`),
    grave: true,
    dica: "indicação de cena vai em dicas de gravação, fora do texto lido",
  },
  {
    regra: "rubrica no texto lido",
    re: re(String.raw`^\s*(?:cena|hook|gancho|corpo|cta|na tela|visual|texto na tela|legenda|prova|fala)\s*\d*\s*[:—-]`, "gimu"),
    grave: true,
    dica: "a marcação de parte fica fora da linha",
  },
  { regra: "formatação no texto lido", re: /\*|#\p{L}|^\s*[-•]\s/gmu, grave: true, dica: "sem markdown, hashtag ou lista no que é lido" },
  { regra: "emoji no texto lido", re: /\p{Extended_Pictographic}/gu, grave: true, dica: "teleprompter não lê emoji" },
];

/** @param {string} s */
const semAcento = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** @param {string} s */
const palavrasDe = (s) => s.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));

/**
 * Quantas palavras e quantos segundos de fala.
 * @param {string[]} linhas
 * @returns {{ palavras: number, segundos: number }}
 */
export function medir(linhas) {
  const palavras = palavrasDe(linhas.join(" ").replace(/\[[^\]]*\]/g, "xx")).length;
  return { palavras, segundos: Math.round(palavras / PALAVRAS_POR_SEGUNDO) };
}

/** @param {string} texto @param {number} indice @param {number} tamanho */
function trechoEmVolta(texto, indice, tamanho) {
  const ini = Math.max(0, texto.lastIndexOf("\n", indice) + 1);
  const fimLinha = texto.indexOf("\n", indice + tamanho);
  return texto.slice(ini, fimLinha < 0 ? undefined : fimLinha).trim().slice(0, 160);
}

/**
 * Trechos de 8+ palavras seguidas que aparecem iguais na fala da referência (o roteiro tem que ser
 * NOVO). Menos que isso pega fato do assunto ("conecta a planilha com o banco"), que pode.
 * O "comenta X que eu te mando" é genérico e fica de fora.
 * @param {string} texto
 * @param {string} referencia
 * @returns {string[]}
 */
export function trechosCopiados(texto, referencia, n = 8) {
  /** @param {string} s */
  const tok = (s) => semAcento(s).replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const ref = tok(referencia);
  if (ref.length < n) return [];
  const grams = new Set();
  for (let i = 0; i + n <= ref.length; i++) grams.add(ref.slice(i, i + n).join(" "));
  const nosso = tok(texto);
  const achados = [];
  let i = 0;
  while (i + n <= nosso.length) {
    if (grams.has(nosso.slice(i, i + n).join(" "))) {
      let f = i + n;
      while (f < nosso.length && grams.has(nosso.slice(f - n + 1, f + 1).join(" "))) f++;
      const trecho = nosso.slice(i, f).join(" ");
      if (!/\b(?:comenta|comente|direct|comentarios)\b/.test(trecho)) achados.push(trecho);
      i = f;
    } else i++;
  }
  return achados;
}

/**
 * CTA do padrão: pedir pra comentar a palavra (a automação do Instagram responde no direct).
 * @param {string[]} cta
 * @param {string | null | undefined} palavra
 */
export function ctaPedeComentario(cta, palavra) {
  if (!palavra?.trim()) return false;
  const t = semAcento(cta.join(" "));
  return /\b(?:comenta|comente|comentar|digita|digite|escreve|escreva|manda)\b/.test(t) && t.includes(semAcento(palavra.trim()));
}

/**
 * Confere um roteiro. `proibidas` são as expressões extras do guia; `referencia`, a fala do outro
 * criador (e dos exemplos do guia), pra conferir cópia.
 * @param {Partes} r
 * @param {{ proibidas?: string[], referencia?: string | null, duracaoAlvo?: number | null }} [opcoes]
 * @returns {Checagem}
 */
export function checarRoteiro(r, opcoes = {}) {
  const linhas = [...r.gancho, ...r.corpo, ...r.cta].map((l) => String(l ?? ""));
  const texto = linhas.join("\n");
  /** @type {Problema[]} */
  const graves = [];
  /** @type {Problema[]} */
  const leves = [];
  /** @param {Problema} p */
  const add = (p) => {
    const lista = p.grave ? graves : leves;
    if (!lista.some((x) => x.regra === p.regra && x.trecho === p.trecho)) lista.push(p);
  };

  for (const regra of REGRAS) {
    const alvo = regra.soNoGancho ? (r.gancho[0] ?? "") : texto;
    const flags = regra.re.flags.includes("g") ? regra.re.flags : regra.re.flags + "g";
    for (const m of alvo.matchAll(new RegExp(regra.re.source, flags))) {
      add({ regra: regra.regra, trecho: `${trechoEmVolta(alvo, m.index ?? 0, m[0].length)} → "${m[0].trim()}"`, grave: regra.grave, dica: regra.dica });
    }
  }

  for (const p of opcoes.proibidas ?? []) {
    const termo = String(p).trim();
    if (termo.length < 2) continue;
    const i = semAcento(texto).indexOf(semAcento(termo));
    if (i >= 0) add({ regra: "expressão proibida no guia", trecho: `${trechoEmVolta(texto, i, termo.length)} → "${termo}"`, grave: true, dica: "o guia do padrão viral proíbe essa expressão" });
  }

  for (const l of linhas) {
    const n = palavrasDe(l).length;
    if (n > LINHA_GRANDE_DEMAIS) add({ regra: "linha grande demais pro teleprompter", trecho: l.slice(0, 160), grave: true, dica: `quebra em 2 ou 3 linhas (tem ${n} palavras; até ${LINHA_LONGA})` });
    else if (n > LINHA_LONGA) add({ regra: "linha longa", trecho: l.slice(0, 160), grave: false, dica: `uma ideia por linha (tem ${n} palavras)` });
  }
  const primeira = palavrasDe(r.gancho[0] ?? "").length;
  if (!r.gancho.length || !primeira) add({ regra: "sem gancho", trecho: "", grave: true, dica: "a 1ª linha é o gancho" });
  else if (primeira > 14) add({ regra: "gancho lento", trecho: r.gancho[0], grave: true, dica: `a 1ª linha tem que caber em 3 segundos (tem ${primeira} palavras; até 12)` });
  if (!r.corpo.length) add({ regra: "sem corpo", trecho: "", grave: true, dica: "falta o corpo" });
  if (!ctaPedeComentario(r.cta, r.palavra_cta)) {
    add({ regra: "CTA sem o comenta PALAVRA", trecho: r.cta.join(" / ").slice(0, 160), grave: true, dica: `o fim pede pra comentar a palavra ${r.palavra_cta || "(escolha uma)"} e diz o que a pessoa recebe no direct` });
  }

  if (opcoes.referencia) {
    for (const t of trechosCopiados(texto, opcoes.referencia)) {
      add({ regra: "copiou fala da referência ou de um exemplo do guia", trecho: t, grave: true, dica: "use só o assunto e o formato, com frase sua" });
    }
  }

  const { palavras, segundos } = medir(linhas);
  if (opcoes.duracaoAlvo) {
    const alvo = `o alvo é ~${opcoes.duracaoAlvo} s (${Math.round(opcoes.duracaoAlvo * PALAVRAS_POR_SEGUNDO)} palavras)`;
    if (segundos > opcoes.duracaoAlvo * 1.35) add({ regra: "longo demais", trecho: `~${segundos} s`, grave: false, dica: alvo });
    if (segundos < opcoes.duracaoAlvo * 0.6) add({ regra: "curto demais", trecho: `~${segundos} s`, grave: false, dica: alvo });
  }

  const preencher = [...new Set(texto.match(/\[[^\]]{1,80}\]/g) ?? [])];
  return { aprovado: graves.length === 0 && leves.length < 3, graves, leves, preencher, palavras, segundos };
}

/**
 * Rede de segurança na linha final: o que escapou da reescrita não chega no teleprompter.
 * @param {string} s
 */
export function limparLinha(s) {
  return String(s ?? "")
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+-\s+/g, ", ")
    .replace(/\*+/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/^\s*[-•]\s+/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])(?=\s|$)/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/^,\s*/, "")
    .trim();
}

/**
 * As regras em texto, pro prompt do escritor e pra tela (a mesma lista que a checagem usa).
 * @param {string[]} [proibidas]
 */
export function regrasEmTexto(proibidas = []) {
  return [
    "- Travessão (— ou –) e hífen solto entre palavras: proibido. Use vírgula, ponto ou frase nova.",
    '- Contradição de IA, proibida em qualquer forma: "não é X, é Y", "não é X. É Y", "não é só X", "não é sobre X", "não se trata de", "mais que um X, é um Y", "não porque X, mas porque Y", "deixa de ser X e passa a ser Y", "o problema não é X", "você está perdendo". Diga do jeito positivo e direto.',
    '- Pergunta retórica respondida na sequência: "E o melhor? …", "O resultado? …", "Sabe qual é o segredo? …", "Por quê? Porque …".',
    "- Vocabulário de IA: crucial, cenário atual, panorama, jornada, mergulhar, desvendar, desbloquear/destravar potencial, potencializar, alavancar, revolucionar, transformador, divisor de águas, virada de chave, no mundo de hoje, nos dias de hoje, além disso, nesse sentido, vale ressaltar, é importante lembrar, em suma, resumindo, robusto, abrangente, sinergia, ecossistema, pilar, elevar o nível, impulsionar, maximizar, aprimorar, a verdade é que, no final do dia, simples assim, spoiler, prepare-se, imagine só, descubra, confira, vamos mergulhar. Evite também: essencial, fundamental, inovador, poderoso, incrível, fantástico, impressionante, sem dúvida, definitivamente, otimizar, estratégico.",
    '- Português de texto escrito: entretanto, todavia, contudo, cujo, lhe, o qual, mediante, acerca de, portanto, mesóclise e ênclise ("diga-me", "faça-o", "prepare-se").',
    '- "sem X, sem Y" (lista do que não tem), tríade forçada ("rápido, simples e barato"), frase de efeito fechando cada bloco, conclusão genérica positiva.',
    '- Papo de assistente: "espero que ajude", "ótima pergunta", "claro!", "aqui está".',
    '- Cumprimento no gancho ("oi gente", "fala galera"): o gancho bate na 1ª frase.',
    "- No texto lido: nada de rubrica, parênteses, indicação de cena, emoji, hashtag, asterisco ou marcação de parte.",
    ...(proibidas.length ? [`- Expressões que o criador proibiu: ${proibidas.map((p) => `"${p}"`).join(", ")}.`] : []),
  ].join("\n");
}

/**
 * O relatório da checagem, em texto, pra reescrita.
 * @param {{ graves: Problema[], leves: Problema[] }} c
 */
export function problemasEmTexto(c) {
  return [...c.graves, ...c.leves].map((p) => `- [${p.grave ? "grave" : "leve"}] ${p.regra}${p.trecho ? `: ${p.trecho}` : ""} (${p.dica})`).join("\n");
}
