import { INI, FIM } from "./gatilhos";

// Auditor determinístico da resposta, antes de enviar.
//
// Crítico (reprova e o agente refaz; se reprovar de novo, não envia e passa pra você):
//   · urgência ou escassez inventada ("últimas vagas", "só hoje")
//   · se apresentar como IA sem ninguém perguntar; NEGAR ser IA ou dizer que é humano, nunca
//   · "vou passar pra ele" sem a ferramenta ter sido chamada
//   · link que não está na lista de permitidos (o seu perfil, o material, as ofertas)
//   · mais balões que o limite
// Leve (só registra, pra você ajustar o prompt): frase de robô, pergunta dupla, balão longo.

export type Auditoria = { ok: boolean; motivos: string[]; avisos: string[] };

const re = (s: string) => new RegExp(s, "iu");

const ESCASSEZ: [RegExp, string] = [
  re(
    String.raw`${INI}(?:[uú]ltimas? vagas?|vagas? limitadas?|poucas vagas|restam \d+ vagas|s[oó] (?:at[eé] )?hoje|acaba hoje|[uú]ltima chance|antes que acabe|corre (?:que|l[aá]))${FIM}`,
  ),
  "inventou urgência",
];

const SE_APRESENTOU_COMO_IA: Array<[RegExp, string]> = [
  [
    re(String.raw`${INI}(?:sou|eu sou|aqui é)\s+(?:uma?\s+)?(?:ia|intelig[eê]ncia artificial|assistente(?: virtual)?|bot|chatbot|rob[oô]|modelo de linguagem|agente de ia)${FIM}`),
    "se apresentou como IA sem ninguém perguntar",
  ],
  [re(String.raw`${INI}modelo de linguagem${FIM}|${INI}como (?:uma )?ia${FIM}`), "falou como IA"],
];

const NUNCA: Array<[RegExp, string]> = [
  [re(String.raw`${INI}n[aã]o\s+sou\s+(?:uma?\s+)?(?:ia|bot|rob[oô]|m[aá]quina|intelig[eê]ncia artificial|chatbot)${FIM}`), "negou ser IA"],
  [re(String.raw`${INI}(?:sou|eu sou)\s+(?:humano|gente de verdade|uma pessoa de verdade|de carne e osso)${FIM}`), "afirmou ser humano"],
];

/** "vou passar pra ele", "ele vai te responder", "já avisei ele". */
const PASSAGEM = re(
  String.raw`${INI}(?:vou (?:passar|chamar|avisar)|j[aá] (?:passei|avisei|chamei)|ele (?:vai|j[aá]) (?:te )?(?:responder|chamar|falar)|ela (?:vai|j[aá]) (?:te )?(?:responder|chamar|falar))${FIM}`,
);

const ROBO: Array<[RegExp, string]> = [
  [re(String.raw`como posso (?:te |lhe )?ajud`), "frase de atendimento"],
  [re(String.raw`${INI}ol[aá]\s*!|${INI}prezad[oa]${FIM}|fico (?:muito )?feliz em`), "frase formal"],
  // Repetir o que a pessoa disse é a assinatura mais clara de IA
  [re(String.raw`(?:^|\n)\s*(?:entendi|saquei|ah+,? saquei|ah+,? entendi)[,.!]?\s+(?:ent[aã]o\s+)?(?:vc|voc[eê]|c[eê])${FIM}`), "repetiu o que a pessoa disse"],
  [re(String.raw`abrir (?:muitas |umas )?portas|${INI}[eé] o futuro${FIM}`), "frase de palestra"],
];

const URL = /\b(?:https?:\/\/|www\.)[^\s]+|\b[\w-]+\.(?:com|com\.br|net|io|me|tech|app|link|ly|gg)(?:\/[^\s]*)?/gi;

export function auditar(
  baloes: string[],
  opcoes: {
    linksPermitidos: string[];
    maxBaloes?: number;
    /** Pergunta sincera "é IA?": pode contar a verdade. */
    permitirRevelarIA?: boolean;
    /** Chamou passar_pro_criador: pode anunciar a passagem. */
    passou?: boolean;
  },
): Auditoria {
  const texto = baloes.join("\n");
  const motivos: string[] = [];
  const avisos: string[] = [];

  if (ESCASSEZ[0].test(texto)) motivos.push(ESCASSEZ[1]);
  if (!opcoes.permitirRevelarIA) for (const [r, m] of SE_APRESENTOU_COMO_IA) if (r.test(texto)) motivos.push(m);
  if (PASSAGEM.test(texto) && !opcoes.passou) motivos.push("anunciou que vai passar pro criador sem chamar a ferramenta");
  for (const [r, m] of NUNCA) if (r.test(texto)) motivos.push(m);

  const permitidos = opcoes.linksPermitidos.map((l) => l.replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase());
  for (const achado of texto.match(URL) ?? []) {
    const limpo = achado.replace(/^https?:\/\//, "").replace(/[.,!?)]+$/, "").replace(/\/$/, "").toLowerCase();
    if (!permitidos.some((p) => limpo.startsWith(p))) motivos.push(`link não permitido: ${achado.slice(0, 60)}`);
  }

  if (baloes.length > (opcoes.maxBaloes ?? 3)) motivos.push(`mandou ${baloes.length} balões`);

  for (const [r, m] of ROBO) if (r.test(texto)) avisos.push(m);
  if ((texto.match(/\?/g) ?? []).length > 1) avisos.push("mais de uma pergunta");
  if (baloes.some((b) => b.length > 320)) avisos.push("balão longo");

  return { ok: motivos.length === 0, motivos: [...new Set(motivos)], avisos };
}
