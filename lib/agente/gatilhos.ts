// Gatilhos determinísticos, antes de chamar o modelo.
//
// Pergunta sincera se é IA/robô → o agente conta a verdade e passa a conversa pra você.
// O prompt também manda; aqui é a rede pro caso óbvio, que não
// pode depender do modelo acertar. Os padrões são estreitos de propósito: "ia" também
// é verbo ("eu ia te perguntar") e "resposta automática" é assunto de negócio ("vc faz
// resposta automática pra loja?"). O caso sutil fica com o modelo (§4 do prompt).
//
// Pedido de sair da lista → não contatar, sem resposta nenhuma do agente.
//
// Fronteira de palavra com acento: o \b do JavaScript não reconhece "é" nem "ô".

export const INI = String.raw`(?<![\p{L}\p{N}])`;
export const FIM = String.raw`(?![\p{L}\p{N}])`;
const re = (s: string) => new RegExp(s, "iu");

const EH = String.raw`(?:é|eh|vc é|vc e|vc eh|voce é|você é|voce e|tu é|tu e|isso é|isso aqui é|isso e|to falando com|tô falando com|estou falando com|falando com|seria)`;
const COISA = String.raw`(?:rob[oô]|bot|chat ?bot|chat ?gpt|intelig[eê]ncia artificial|assistente virtual|m[aá]quina|grava[cç][aã]o)`;

const PERGUNTA_IA: RegExp[] = [
  // "vc é um robô?", "to falando com um bot", "isso é inteligência artificial?"
  re(String.raw`${INI}${EH}\s+(?:um |uma |o |a )?${COISA}${FIM}`),
  // "é uma ia?", "falando com uma ia", "vc é ia" — "ia" só como pergunta ou fim de frase
  re(String.raw`${INI}${EH}\s+(?:uma |a )?i\.?a\.?\s*(?:\?|$|mesmo|msm)`),
  // "é vc mesmo?", "é tu msm?"
  re(String.raw`${INI}(?:é|eh|e) (?:vc|voce|você|tu) (?:mesmo|msm)\s*\?`),
  // "é uma pessoa de verdade?", "falando com gente de verdade"
  re(String.raw`${INI}(?:é|eh|é uma|vc é|você é|falando com)\s+(?:uma )?(?:pessoa|gente|humano) de verdade`),
  // "essa mensagem é automática?", "é automático?"
  re(String.raw`${INI}(?:é|eh|isso é|essa (?:msg|mensagem) é|essa (?:msg|mensagem) foi|foi|são)\s+(?:uma )?(?:(?:msg|mensagem|resposta) )?autom[aá]tic[oa]s?\s*\?`),
  // só "robô?", "bot?", "humano?"
  re(String.raw`^\s*(?:rob[oô]|bot|i\.?a\.?|humano)\s*\?+\s*$`),
];

export function perguntouSeEhIA(texto: string): boolean {
  return PERGUNTA_IA.some((r) => r.test(texto));
}

const SAIR = re(
  String.raw`^\s*(?:pare|para|parar|sair|stop|remover|remove|descadastrar|cancelar|n[aã]o tenho interesse|sem interesse|me (?:tira|tire|remove|remova|exclui|exclua)(?: d(?:essa|a|esta) lista| daqui)?|n[aã]o (?:quero|desejo) (?:mais )?(?:receber|mensagens?|ser (?:chamad|contatad)\p{L}*)[^?]*|n[aã]o me (?:mande|manda|chame|chama|envie|envia) mais[^?]*)\s*[.!]*\s*$`,
);

export function pediuPraSair(texto: string, botaoPayload?: string | null): boolean {
  if (botaoPayload && /^(parar|sair|stop|opt[_-]?out|nao_tenho_interesse)$/i.test(botaoPayload)) return true;
  return SAIR.test(texto.trim());
}
