// O escritor de roteiros pra teleprompter. A IA escreve; a checagem anti-IA (determinística,
// lib/roteiro/anti-ia.mjs) e um leitor (procura frase que soa escrita por IA quando lida em voz
// alta) avaliam; o que reprovar volta pra IA reescrever em cima da versão anterior, até 2 vezes.
// Fica a melhor das versões.
//
// Quem roda a IA é o "motor" (a estação no PC do criador: Claude, ChatGPT/Codex ou OpenRouter,
// editor/estacao/roteiros.mjs). A voz vem do perfil e da persona do criador (o guia tirado dos
// reels dele) + transcrições dos reels dele como exemplo de fala real.
// Vídeo de referência: o escritor recebe só a análise ABSTRATA (assunto, ângulo, estrutura, fatos),
// nunca a fala do outro criador; a checagem ainda confere se escapou trecho igual.
//
// JavaScript puro, sem dependência: a estação (Node, sem build) e o painel usam o mesmo arquivo.

import { checarRoteiro, limparLinha, PALAVRAS_POR_SEGUNDO, problemasEmTexto, regrasEmTexto } from "./anti-ia.mjs";
import { padraoEmTexto } from "./padrao-inicial.mjs";

/** @typedef {import("./anti-ia.mjs").Checagem} Checagem */
/** @typedef {import("./padrao-inicial.mjs").PadraoViral} PadraoViral */
/** @typedef {{ linha: string, por_que: string, sugestao?: string | null }} Leitura */
/** @typedef {{ role: "system" | "user" | "assistant", content: string }} Mensagem */
/**
 * @typedef {{
 *   nome: string,
 *   escrever: (mensagens: Mensagem[]) => Promise<{ texto: string, custo: number }>,
 *   ler: (sistema: string, usuario: string) => Promise<{ texto: string, custo: number }>,
 *   equivalenteApi?: () => number,
 * }} Motor
 * `nome`: o que fica gravado na versão (quem escreveu e por onde). `escrever`: a conversa com o
 * escritor (system + pedido + versão anterior + o que reprovou…). `ler`: a segunda leitura (JSON).
 * `equivalenteApi`: no plano (Claude ou ChatGPT) não é cobrado; é só a referência de quanto seria.
 */
/**
 * @typedef {{
 *   nome: string,
 *   quem: string,
 *   tom: string | null,
 *   regras: string | null,
 *   guia: string | null,
 *   exemplos: string[],
 * }} Voz
 * A voz do criador: `quem` (nome, @, nicho, público), o `tom` que ele descreveu no perfil, as
 * `regras` do que nunca pode aparecer, o `guia` da persona e trechos literais dos reels dele.
 */
/**
 * @typedef {{
 *   assunto: string,
 *   angulo: string,
 *   publico?: string | null,
 *   gancho?: { tipo: string, mecanismo: string } | null,
 *   estrutura: Array<{ parte: string, funcao: string }>,
 *   pontos: string[],
 *   prova_do_criador?: string | null,
 *   ritmo?: string | null,
 *   cta?: string | null,
 *   por_que_funcionou?: string[],
 *   duracao_seg: number | null,
 *   palavras_por_segundo: number | null,
 * }} AnaliseReferencia
 */
/**
 * @typedef {{
 *   tema?: string | null,
 *   direcao?: string | null,
 *   palavraCta?: string | null,
 *   duracaoAlvo: number,
 *   analise?: AnaliseReferencia | null,
 *   falaReferencia?: string | null,
 * }} Entrada
 * `falaReferencia`: a fala da referência, só pra conferir cópia. NUNCA vai pro prompt.
 */

export const MAX_REESCRITAS = 2;
export const MAX_VERSOES = 5;

/** @param {string | null | undefined} s */
export const palavraLimpa = (s) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toUpperCase()
    .slice(0, 24);

/**
 * JSON do modelo, tolerante a cerca de código e texto em volta.
 * @param {string} texto
 * @returns {any}
 */
export function extrairJSON(texto) {
  const limpo = String(texto ?? "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const i = limpo.indexOf("{");
    const f = limpo.lastIndexOf("}");
    if (i >= 0 && f > i) {
      try {
        return JSON.parse(limpo.slice(i, f + 1));
      } catch {}
    }
    return null;
  }
}

/** @param {{ fala?: Array<{ texto: string }> } | null | undefined} a */
export const falaCorrida = (a) => (a?.fala ?? []).map((f) => String(f.texto ?? "").trim()).join(" ");

/**
 * A voz do criador, a partir do perfil, da persona e das transcrições dos reels dele.
 * @param {{ perfil?: any, persona?: any, exemplos?: string[] }} d
 * @returns {Voz}
 */
export function vozDoCriador({ perfil = {}, persona = {}, exemplos = [] }) {
  const p = perfil && typeof perfil === "object" ? perfil : {};
  const txt = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const nome = txt(p.nome) ?? "o criador";
  const quem = [`${txt(p.nome) ?? "um criador de conteúdo"}${txt(p.usuario) ? ` (@${txt(p.usuario)})` : ""}`, txt(p.nicho) ? `nicho: ${txt(p.nicho)}` : null, txt(p.publico) ? `público: ${txt(p.publico)}` : null]
    .filter(Boolean)
    .join(" · ");
  return {
    nome,
    quem,
    tom: txt(p.tom),
    regras: txt(p.regras),
    guia: txt(persona?.guia),
    exemplos: exemplos.map((e) => String(e ?? "").trim()).filter((e) => e.split(/\s+/).length > 40).slice(0, 2),
  };
}

/** @param {PadraoViral} p @param {Voz} v */
function sistema(p, v) {
  return `Você escreve roteiros de reel pra ${v.nome} gravar lendo no TELEPROMPTER.

Quem fala: ${v.quem}, em primeira pessoa.${v.tom ? `\nJeito de falar, descrito pelo próprio criador: ${v.tom}` : ""}

O PROBLEMA Nº 1: o texto não pode ter cara de IA. Roteiro de IA costuma ficar na cara, e é por isso que muito criador não usa. O roteiro tem que soar como ${v.nome} falando, igual às transcrições de exemplo (fala real, transcrita). Escreva como quem transcreve alguém empolgado mostrando uma coisa pra um amigo, não como redator.

${
  v.guia
    ? `A VOZ DO CRIADOR (guia tirado dos reels mais recentes dele). Siga o jeito de abrir, o ritmo, o vocabulário e os bordões com naturalidade, sem forçar todos. A voz é o JEITO de falar: não recicle frases, piadas ou histórias específicas de outros reels.\n${v.guia}`
    : "Ainda não tem o guia da voz do criador (Esteira → Minha persona): siga o jeito de falar descrito acima e as transcrições de exemplo."
}

Como soar como gente:
- Frase falada e simples, em ordem direta, com conector de fala ("aí", "e aí", "só que", "então", "cara", "olha"). Pode começar com "e" ou "mas".
- Específico: o nome da coisa, o passo, o número, o que aparece. Nada genérico ("diversas opções", "resultados incríveis").
- Uma opinião do criador em algum ponto ("é o que eu mais uso", "pra mim é o melhor de longe").
- Ritmo irregular: linha curta, linha média, nada certinho. Nenhuma frase de efeito fechando bloco, nenhum slogan, nenhuma conclusão bonita.

PROIBIDO (uma checagem automática reprova e você reescreve):
${regrasEmTexto(p.proibidas)}

O PADRÃO VIRAL (siga):
${padraoEmTexto(p).regras}

Conteúdo:
- Não invente número, resultado, cliente ou história de ${v.nome}: onde precisar de um dado dele, deixe [entre colchetes] curto pra ele preencher (ex.: [quanto tempo levou]). No máximo 3 colchetes.
- Marca, app, ferramenta, produto ou site só pelo nome real e se você tem certeza de que existe; senão, [nome].
- Preço de produto, curso ou mentoria: nunca.${v.regras ? `\n- O que nunca pode aparecer (regra do criador): ${v.regras}` : ""}
- Vídeo de referência: use só o assunto, os fatos e a estrutura. Nunca frase de outro criador, e nunca o resultado pessoal dele (seguidores, faturamento, clientes) como se fosse de ${v.nome}: isso vira [colchete].

Formato TELEPROMPTER:
- Uma ideia por linha, de 3 a 14 palavras (no máximo 16). Quebre onde a pessoa respira.
- O texto lido é só fala: nada de rubrica, parênteses, indicação de cena, emoji, hashtag, asterisco ou marcação.
- "gancho": 1 a 3 linhas, os primeiros 3 segundos. A 1ª linha tem até 10 palavras e já é o choque ou a promessa.
- "corpo": a promessa, o desenvolvimento (passo a passo, lista ou história) e a prova.
- "cta": 1 a 3 linhas, pedindo pra comentar a palavra (em MAIÚSCULA) e dizendo o que a pessoa recebe no direct.
- "dicas": até 5 dicas curtas de gravação (o que mostrar na tela, print, gravação de tela), fora do texto lido.

Responda APENAS um JSON:
{"titulo": "nome curto pro criador achar depois", "palavra_cta": "PALAVRA", "gancho": ["linha"], "corpo": ["linha"], "cta": ["linha"], "dicas": ["dica"], "legenda": "a legenda do post: 1ª linha forte + comenta PALAVRA + 3 a 5 hashtags", "de_onde_veio": "em 1 frase: o que foi usado do tema ou da referência"}`;
}

/** @param {AnaliseReferencia} a */
function analiseEmTexto(a) {
  return [
    `Assunto: ${a.assunto}`,
    `Ângulo: ${a.angulo}`,
    a.publico ? `Pra quem: ${a.publico}` : null,
    a.gancho ? `Gancho (tipo ${a.gancho.tipo}): ${a.gancho.mecanismo}` : null,
    a.estrutura?.length ? `Estrutura:\n${a.estrutura.map((e) => `- ${e.parte}: ${e.funcao}`).join("\n")}` : null,
    a.pontos?.length ? `Fatos e passos do assunto (pode usar, com frase sua):\n${a.pontos.map((p) => `- ${p}`).join("\n")}` : null,
    a.prova_do_criador
      ? `Prova que o criador da referência usa: ${a.prova_do_criador}. É resultado DELE: no roteiro, a prova equivalente vai com o dado do criador em [colchetes] (ex.: [quantos seguidores você ganhou]).`
      : null,
    a.ritmo ? `Ritmo: ${a.ritmo}` : null,
    a.cta ? `CTA da referência (tipo): ${a.cta}` : null,
    a.por_que_funcionou?.length ? `Por que funcionou: ${a.por_que_funcionou.join(" · ")}` : null,
    a.duracao_seg ? `Duração da referência: ${a.duracao_seg} s` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/** @param {Entrada} e @param {PadraoViral} p @param {Voz} v */
function pedido(e, p, v) {
  const palavras = Math.round(e.duracaoAlvo * PALAVRAS_POR_SEGUNDO);
  const ritmo = String(PALAVRAS_POR_SEGUNDO).replace(".", ",");
  const faixa =
    e.duracaoAlvo <= 45
      ? `30 a 45 s (${Math.round(30 * PALAVRAS_POR_SEGUNDO)} a ${palavras} palavras, falando a ${ritmo} palavras por segundo)`
      : `~${e.duracaoAlvo} s (por volta de ${palavras} palavras)`;
  const exemplos = padraoEmTexto(p).exemplos;
  return [
    v.exemplos.length
      ? `# Como ${v.nome} fala de verdade (transcrição literal de reels dele: copie o jeito, nunca as frases)\n${v.exemplos.map((t, i) => `### Reel ${i + 1}\n${t.slice(0, 3000)}`).join("\n\n")}`
      : null,
    exemplos ? `# Fala real de reels que performaram (é ASSIM que tem que soar; copie o jeito, nunca as frases)\n${exemplos}` : null,
    "# O roteiro de agora",
    e.tema?.trim() ? `Tema${e.analise ? " / foco do criador" : ""}: ${e.tema.trim()}` : null,
    e.analise ? `Vídeo de referência que performou, analisado (só assunto e estrutura; você NÃO tem as falas, e é pra ser assim):\n${analiseEmTexto(e.analise)}` : null,
    `Duração: ${faixa} no total (gancho + corpo + cta).`,
    `Palavra do CTA: ${e.palavraCta ? palavraLimpa(e.palavraCta) : "escolha uma palavra curta, em maiúscula, ligada ao que a pessoa vai receber"}`,
    e.direcao?.trim() ? `# Direção do criador pra este roteiro (vale mais que tudo)\n${e.direcao.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** @param {Voz} v */
const leitor = (v) => `Você é um editor brasileiro que caça texto com cara de IA em roteiro de reel. O roteiro vai ser lido em voz alta, num teleprompter, por ${v.quem}. Leia como se estivesse ouvindo.

Aponte SÓ as linhas que um brasileiro reconheceria como escritas por IA ou por redator publicitário: frase de efeito, slogan, construção de texto escrito, contraste montado, tríade forçada, ritmo certinho demais, pergunta retórica, conclusão genérica, palavra que ninguém fala em vídeo.
Não aponte o que é fala normal de criador: enumeração falada ("primeiro", "por segundo", "e por terceiro", "aí", "depois"), "comenta X aqui nos comentários que eu te mando no direct", gíria, frase simples, repetição natural, nome de marca ou ferramenta, [colchetes] pra preencher. A fala real abaixo é a régua: o que soa como ela passa.
No máximo 4 linhas. Se está natural, lista vazia.

Responda APENAS um JSON: {"linhas": [{"linha": "a linha exata", "por_que": "curto", "sugestao": "como alguém falaria isso"}]}`;

/** @param {unknown} v @returns {string[]} */
const linhasDe = (v) =>
  (Array.isArray(v) ? v : typeof v === "string" ? [v] : [])
    .flatMap((x) => String(x ?? "").split("\n"))
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * A conversa (system + pedido + versão anterior + o que reprovou) num pedido só, do jeito que uma
 * CLI sem janela recebe (claude -p, codex exec).
 * @param {Mensagem[]} mensagens
 */
export function achatar(mensagens) {
  const sistemaJunto = mensagens
    .filter((m) => m.role === "system")
    .map((m) => String(m.content))
    .join("\n\n");
  const resto = mensagens.filter((m) => m.role !== "system");
  if (resto.length === 1) return { sistema: sistemaJunto, prompt: String(resto[0].content) };
  const partes = resto.map((m, i) =>
    m.role === "assistant" ? `## A sua versão anterior\n${m.content}` : i === 0 ? `## O pedido\n${m.content}` : `## O que a checagem reprovou nela\n${m.content}`,
  );
  return { sistema: sistemaJunto, prompt: `${partes.join("\n\n")}\n\nResponda APENAS o JSON da versão nova, completo.` };
}

/** @param {Motor} motor @param {{ gancho: string[], corpo: string[], cta: string[] }} partes @param {string} regua @param {Voz} v */
async function ler(motor, partes, regua, v) {
  try {
    const texto = [...partes.gancho, ...partes.corpo, ...partes.cta].join("\n");
    const { texto: saida, custo } = await motor.ler(leitor(v), `${regua ? `A régua (fala real):\n${regua}\n\n` : ""}O roteiro pra avaliar:\n${texto}`);
    const j = extrairJSON(saida);
    /** @type {Leitura[]} */
    const lidas = (Array.isArray(j?.linhas) ? j.linhas : [])
      .filter((l) => String(l?.linha ?? "").trim())
      .slice(0, 4)
      .map((l) => ({ linha: String(l.linha).slice(0, 200), por_que: String(l.por_que ?? "").slice(0, 200), sugestao: l.sugestao ? String(l.sugestao).slice(0, 200) : null }));
    return { leitor: lidas, custo };
  } catch (e) {
    // O plano no limite tem que subir (a estação devolve pra fila); o resto é reforço: se a
    // segunda leitura cair, vale a checagem determinística
    if (/** @type {any} */ (e)?.limite) throw e;
    return { leitor: [], custo: 0 };
  }
}

/** Maiúscula na 1ª linha da parte e em toda linha que começa frase nova. @param {string[]} linhas */
function maiusculas(linhas) {
  return linhas.map((l, i) => (i === 0 || /[.!?…]["']?$/.test(linhas[i - 1]) ? l.replace(/^(["']?)(\p{Ll})/u, (_, a, b) => a + b.toUpperCase()) : l));
}

/** @typedef {{ bruto: any, partes: { gancho: string[], corpo: string[], cta: string[], palavra_cta: string }, checagem: Checagem, leitor: Leitura[] }} Candidato */
/** @param {Candidato} c */
const nota = (c) => c.checagem.graves.length * 10 + c.leitor.length * 3 + c.checagem.leves.length;
/** @param {Candidato} c */
const passou = (c) => c.checagem.aprovado && c.leitor.length === 0;

/**
 * As mensagens da 1ª rodada (system + pedido). Separado pra dar pra conferir sem IA.
 * @param {Entrada} entrada @param {PadraoViral} padrao @param {Voz} voz
 * @returns {Mensagem[]}
 */
export function mensagensIniciais(entrada, padrao, voz) {
  return [
    { role: "system", content: sistema(padrao, voz) },
    { role: "user", content: pedido(entrada, padrao, voz) },
  ];
}

/**
 * Escreve um roteiro novo: gera, confere, reescreve o que reprovar, devolve a melhor versão.
 * @param {{ entrada: Entrada, padrao: PadraoViral, voz: Voz, motor: Motor, aoReescrever?: (rodada: number) => unknown }} o
 */
export async function escreverRoteiro({ entrada: e, padrao, voz, motor, aoReescrever }) {
  const palavraFixa = e.palavraCta ? palavraLimpa(e.palavraCta) : null;
  // A cópia é conferida contra a referência E contra os exemplos do guia (fala de outros criadores)
  const naoCopiar = [e.falaReferencia ?? "", ...padrao.exemplos.map((x) => x.transcricao)].join("\n");
  const regua = voz.exemplos[0] ?? padrao.exemplos[0]?.transcricao ?? "";
  const mensagens = mensagensIniciais(e, padrao, voz);
  let custo = 0;
  /** @type {Array<{ motivos: string[] }>} */
  const reescritas = [];

  /** @returns {Promise<{ cand: Candidato, saida: string }>} */
  async function gerar() {
    let texto = "";
    let bruto = null;
    // Às vezes volta vazio ou cortado: tenta mais uma vez antes de desistir
    for (let tentativa = 1; tentativa <= 2 && !bruto; tentativa++) {
      const r = await motor.escrever(mensagens);
      custo += r.custo;
      texto = r.texto;
      bruto = extrairJSON(texto);
    }
    if (!bruto) throw new Error(`a IA não devolveu um roteiro válido (${texto ? `${texto.slice(0, 120)}…${texto.slice(-80)}` : "resposta vazia"})`);
    const partes = {
      gancho: linhasDe(bruto.gancho),
      corpo: linhasDe(bruto.corpo),
      cta: linhasDe(bruto.cta),
      palavra_cta: palavraFixa ?? palavraLimpa(bruto.palavra_cta),
    };
    const checagem = checarRoteiro(partes, { proibidas: padrao.proibidas, referencia: naoCopiar, duracaoAlvo: e.duracaoAlvo });
    const l = await ler(motor, partes, regua, voz);
    custo += l.custo;
    return { cand: { bruto, partes, checagem, leitor: l.leitor }, saida: texto };
  }

  let { cand: atual, saida } = await gerar();
  let melhor = atual;
  for (let rodada = 1; rodada <= MAX_REESCRITAS && !passou(atual); rodada++) {
    const motivos = [
      ...[...atual.checagem.graves, ...atual.checagem.leves].map((p) => `${p.regra}${p.trecho ? `: ${p.trecho}` : ""}`),
      ...atual.leitor.map((l) => `soa como IA (leitor): "${l.linha}" (${l.por_que})`),
    ];
    reescritas.push({ motivos: motivos.slice(0, 20) });
    await aoReescrever?.(rodada);
    mensagens.push(
      { role: "assistant", content: saida },
      {
        role: "user",
        content:
          `A checagem reprovou estes pontos:\n${problemasEmTexto(atual.checagem)}` +
          (atual.leitor.length ? `\n${atual.leitor.map((l) => `- [leitor] soa como IA: "${l.linha}" (${l.por_que})${l.sugestao ? `; algo como: ${l.sugestao}` : ""}`).join("\n")}` : "") +
          "\n\nReescreva o roteiro corrigindo TODOS esses pontos sem criar problema novo. Mantenha o que está bom. Devolva o JSON completo, no mesmo formato.",
      },
    );
    ({ cand: atual, saida } = await gerar());
    if (nota(atual) < nota(melhor)) melhor = atual;
  }
  return montarVersao({ melhor, entrada: e, padrao, naoCopiar, reescritas, motor, custo });
}

/**
 * A versão final: limpa (o que escapou não chega no teleprompter), com maiúscula no começo de frase
 * (a IA às vezes escreve tudo minúsculo) e conferida de novo.
 * @param {{ melhor: Candidato, entrada: Entrada, padrao: PadraoViral, naoCopiar: string, reescritas: Array<{ motivos: string[] }>, motor: Motor, custo: number }} d
 */
function montarVersao({ melhor, entrada: e, padrao, naoCopiar, reescritas, motor, custo }) {
  const limpas = {
    gancho: maiusculas(melhor.partes.gancho.map(limparLinha).filter(Boolean)),
    corpo: maiusculas(melhor.partes.corpo.map(limparLinha).filter(Boolean)),
    cta: maiusculas(melhor.partes.cta.map(limparLinha).filter(Boolean)),
    palavra_cta: melhor.partes.palavra_cta,
  };
  const checagem = checarRoteiro(limpas, { proibidas: padrao.proibidas, referencia: naoCopiar, duracaoAlvo: e.duracaoAlvo });
  return {
    titulo: limparLinha(melhor.bruto.titulo ?? "") || limpas.gancho[0] || "roteiro",
    ...limpas,
    dicas: linhasDe(melhor.bruto.dicas).map(limparLinha).filter(Boolean).slice(0, 6),
    legenda: String(melhor.bruto.legenda ?? "")
      .replace(/\s*[—–]\s*/g, ", ")
      .trim(),
    de_onde_veio: melhor.bruto.de_onde_veio ? limparLinha(melhor.bruto.de_onde_veio) : null,
    checagem,
    leitor: melhor.leitor,
    reescritas,
    duracao_alvo: e.duracaoAlvo,
    direcao: e.direcao?.trim() || null,
    gerado_em: new Date().toISOString(),
    modelo: motor.nome,
    custo_usd: Number(custo.toFixed(4)),
    ...(motor.equivalenteApi ? { equivalente_api_usd: Number(motor.equivalenteApi().toFixed(4)) } : {}),
  };
}

/**
 * O que o escritor recebe, a partir da linha do roteiro no banco.
 * @param {{ tema?: string | null, direcao?: string | null, palavra_cta?: string | null, duracao_alvo: number, analise?: any, transcricao?: any }} r
 * @returns {Entrada}
 */
export function entradaDoRoteiro(r) {
  return {
    tema: r.tema ?? null,
    direcao: r.direcao ?? null,
    palavraCta: r.palavra_cta ?? null,
    duracaoAlvo: Number(r.duracao_alvo) || 45,
    analise: r.analise ?? null,
    falaReferencia: r.transcricao ? falaCorrida(r.transcricao) : null,
  };
}

/**
 * O texto que vai pro teleprompter: só a fala, uma ideia por linha, partes separadas por linha em branco.
 * @param {{ gancho: string[], corpo: string[], cta: string[] }} v
 */
export function textoTeleprompter(v, marcado = false) {
  /** @param {string} nome @param {string[]} linhas */
  const parte = (nome, linhas) => (marcado ? [`[${nome}]`, ...linhas] : linhas).join("\n");
  return [parte("GANCHO", v.gancho), parte("CORPO", v.corpo), parte("CTA", v.cta)].join("\n\n");
}
