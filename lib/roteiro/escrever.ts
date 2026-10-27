import "server-only";
import { lerPerfil, lerConfig, type Persona } from "@/lib/config";
import { completar, extrairJSON, MODELO_PADRAO, type Mensagem } from "@/lib/ia/openrouter";
import { MODELO_CRIACAO } from "@/lib/esteira/modelos";
import { checarRoteiro, limparLinha, PALAVRAS_POR_SEGUNDO, problemasEmTexto, regrasEmTexto, type Checagem } from "./anti-ia";
import { lerPadrao, padraoEmTexto, type PadraoViral } from "./padrao-viral";
import type { AnaliseReferencia } from "./referencia";

// O escritor de roteiros pra teleprompter. O Claude escreve; a checagem anti-IA (determinística,
// lib/roteiro/anti-ia.ts) e um leitor (procura frase que soa escrita por IA quando lida em voz alta)
// avaliam; o que reprovar volta pro Claude reescrever em cima da versão anterior, até 2 vezes. Fica a
// melhor das versões. Quem roda o Claude é o Motor: a estação no PC do criador (plano, padrão desde
// 06/10) ou a API do OpenRouter (só pelo botão manual).
// Vídeo de referência: o escritor recebe só a análise ABSTRATA (assunto, ângulo, estrutura, fatos),
// nunca a fala do outro criador; a checagem ainda confere se escapou trecho igual.

export type Leitura = { linha: string; por_que: string; sugestao?: string | null };

export type VersaoRoteiro = {
  titulo: string;
  palavra_cta: string;
  gancho: string[];
  corpo: string[];
  cta: string[];
  /** pra gravar (o que mostrar na tela): fora do texto lido */
  dicas: string[];
  legenda: string;
  de_onde_veio: string | null;
  checagem: Checagem;
  /** o que o leitor ainda achou com cara de IA na versão final */
  leitor: Leitura[];
  /** o que foi barrado em cada rodada de reescrita */
  reescritas: Array<{ motivos: string[] }>;
  duracao_alvo: number;
  direcao: string | null;
  gerado_em: string;
  /** o motor: "anthropic/claude-sonnet-5" (API) ou "claude-code · opus (plano, estação …)" */
  modelo: string;
  /** o que foi cobrado (na estação, 0: roda no plano do Claude) */
  custo_usd: number;
  /** na estação: quanto seria na API (referência, não é cobrado) */
  equivalente_api_usd?: number;
};

export type Entrada = {
  tema?: string | null;
  direcao?: string | null;
  palavraCta?: string | null;
  duracaoAlvo: number;
  analise?: AnaliseReferencia | null;
  /** a fala da referência: só pra conferir cópia, NUNCA vai pro prompt */
  falaReferencia?: string | null;
  aoReescrever?: (rodada: number) => unknown;
};

const MAX_REESCRITAS = 2;

type Bruto = { titulo?: string; palavra_cta?: string; gancho?: unknown; corpo?: unknown; cta?: unknown; dicas?: unknown; legenda?: string; de_onde_veio?: string };

export const palavraLimpa = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toUpperCase()
    .slice(0, 24);

async function sistema(p: PadraoViral): Promise<string> {
  const perfil = await lerPerfil();
  const persona = await lerConfig<Persona>("persona", {});
  return `Você escreve roteiros de reel pro criador (seu perfil) gravar lendo no TELEPROMPTER.

Perfil do criador (não presuma profissão nem negócio): ${JSON.stringify(perfil)}
Guia da voz: ${persona.guia || perfil.tom || "fala simples e natural"}

O PROBLEMA Nº 1: o texto não pode ter cara de IA. O criador nunca usou roteiro de IA por causa disso. O roteiro não precisa ser a voz exata dele, mas tem que soar como gente falando, igual às transcrições de exemplo (fala real, transcrita). Escreva como quem transcreve alguém empolgado mostrando uma coisa pra um amigo, não como redator.

Como soar como gente:
- Frase falada e simples, em ordem direta, com conector de fala ("aí", "e aí", "só que", "então", "cara", "olha"). Pode começar com "e" ou "mas".
- Específico: o nome da ferramenta, o clique, o número, o que aparece. Nada genérico ("diversas ferramentas", "resultados incríveis").
- Uma opinião dele em algum ponto ("é o que eu mais uso", "pra mim é o melhor de longe").
- Ritmo irregular: linha curta, linha média, nada certinho. Nenhuma frase de efeito fechando bloco, nenhum slogan, nenhuma conclusão bonita.

PROIBIDO (uma checagem automática reprova e você reescreve):
${regrasEmTexto(p.proibidas)}

O PADRÃO VIRAL (siga):
${padraoEmTexto(p).regras}

Conteúdo:
- Não invente número, resultado, cliente ou história do criador: onde precisar de um dado dele, deixe [entre colchetes] curto pra ele preencher (ex.: [quanto tempo levou]). No máximo 3 colchetes.
- Ferramenta, site ou repositório só pelo nome real e se você tem certeza de que existe; senão, [nome da ferramenta].
- Não invente preços nem ofertas. Use apenas o que estiver no perfil ou no pedido.
- Vídeo de referência: use só o assunto, os fatos e a estrutura. Nunca frase de outro criador, e nunca o resultado pessoal dele (seguidores, faturamento, clientes) como se fosse do criador: isso vira [colchete].

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

function analiseEmTexto(a: AnaliseReferencia): string {
  return [
    `Assunto: ${a.assunto}`,
    `Ângulo: ${a.angulo}`,
    a.publico ? `Pra quem: ${a.publico}` : null,
    a.gancho ? `Gancho (tipo ${a.gancho.tipo}): ${a.gancho.mecanismo}` : null,
    a.estrutura?.length ? `Estrutura:\n${a.estrutura.map((e) => `- ${e.parte}: ${e.funcao}`).join("\n")}` : null,
    a.pontos?.length ? `Fatos e passos do assunto (pode usar, com frase sua):\n${a.pontos.map((p) => `- ${p}`).join("\n")}` : null,
    a.prova_do_criador
      ? `Prova que o criador da referência usa: ${a.prova_do_criador}. É resultado DELE: no roteiro do criador, a prova equivalente vai com o dado do criador em [colchetes] (ex.: [quantos seguidores você ganhou]).`
      : null,
    a.ritmo ? `Ritmo: ${a.ritmo}` : null,
    a.cta ? `CTA da referência (tipo): ${a.cta}` : null,
    a.por_que_funcionou?.length ? `Por que funcionou: ${a.por_que_funcionou.join(" · ")}` : null,
    a.duracao_seg ? `Duração da referência: ${a.duracao_seg} s` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function pedido(e: Entrada, p: PadraoViral): string {
  const palavras = Math.round(e.duracaoAlvo * PALAVRAS_POR_SEGUNDO);
  const faixa =
    e.duracaoAlvo <= 45
      ? `30 a 45 s (${Math.round(30 * PALAVRAS_POR_SEGUNDO)} a ${palavras} palavras, falando a ${String(PALAVRAS_POR_SEGUNDO).replace(".", ",")} palavras por segundo)`
      : `~${e.duracaoAlvo} s (por volta de ${palavras} palavras)`;
  const exemplos = padraoEmTexto(p).exemplos;
  return [
    exemplos ? `# Fala real de reels que performaram (é ASSIM que tem que soar; copie o jeito, nunca as frases)\n${exemplos}` : null,
    `# O roteiro de agora`,
    e.tema?.trim() ? `Tema${e.analise ? " / foco do criador" : ""}: ${e.tema.trim()}` : null,
    e.analise ? `Vídeo de referência que performou, analisado (só assunto e estrutura; você NÃO tem as falas, e é pra ser assim):\n${analiseEmTexto(e.analise)}` : null,
    `Duração: ${faixa} no total (gancho + corpo + cta).`,
    `Palavra do CTA: ${e.palavraCta ? palavraLimpa(e.palavraCta) : "escolha uma palavra curta, em maiúscula, ligada ao que a pessoa vai receber"}`,
    e.direcao?.trim() ? `# Direção do criador pra este roteiro (vale mais que tudo)\n${e.direcao.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const linhasDe = (v: unknown): string[] =>
  (Array.isArray(v) ? v : typeof v === "string" ? [v] : [])
    .flatMap((x) => String(x ?? "").split("\n"))
    .map((s) => s.trim())
    .filter(Boolean);

type Candidato = { bruto: Bruto; partes: { gancho: string[]; corpo: string[]; cta: string[]; palavra_cta: string }; checagem: Checagem; leitor: Leitura[] };

const LEITOR = `Você é um editor brasileiro que caça texto com cara de IA em roteiro de reel. O roteiro vai ser lido em voz alta, num teleprompter, por um criador de conteúdo de tecnologia de 20 e poucos anos. Leia como se estivesse ouvindo.

Aponte SÓ as linhas que um brasileiro reconheceria como escritas por IA ou por redator publicitário: frase de efeito, slogan, construção de texto escrito, contraste montado, tríade forçada, ritmo certinho demais, pergunta retórica, conclusão genérica, palavra que ninguém fala em vídeo.
Não aponte o que é fala normal de criador: enumeração falada ("primeiro", "por segundo", "e por terceiro", "aí", "depois"), "comenta X aqui nos comentários que eu te mando no direct", gíria, frase simples, repetição natural, nome de ferramenta, [colchetes] pra preencher. A fala real abaixo é a régua: o que soa como ela passa.
No máximo 4 linhas. Se está natural, lista vazia.

Responda APENAS um JSON: {"linhas": [{"linha": "a linha exata", "por_que": "curto", "sugestao": "como alguém falaria isso"}]}`;

/**
 * Quem escreve e quem faz a segunda leitura. Desde 06/10 o padrão é a estação no PC do criador
 * (lib/roteiro/motor-local.ts: Claude Code no plano dele, sem custo de API); a API do OpenRouter
 * (MOTOR_API) só roda pelo botão "gerar agora pela API".
 */
export type Motor = {
  /** o que fica gravado na versão (modelo e por onde rodou) */
  nome: string;
  /** a conversa com o escritor: system + pedido + (versão anterior + o que reprovou)… */
  escrever(mensagens: Mensagem[]): Promise<{ texto: string; custo: number; fim?: string | null }>;
  /** a segunda leitura: system + roteiro → JSON */
  ler(sistema: string, usuario: string): Promise<{ texto: string; custo: number }>;
  /** pra mostrar quanto custaria na API, quando o motor não cobra (plano do Claude) */
  equivalenteApi?: () => number;
};

export const MOTOR_API: Motor = {
  nome: MODELO_CRIACAO,
  async escrever(mensagens) {
    const r = await completar({ modelo: MODELO_CRIACAO, mensagens, maxTokens: 16000, temperatura: 0.9, json: true, timeoutMs: 180_000 });
    return { texto: r.texto, custo: r.uso.custoUsd, fim: r.fim };
  },
  async ler(sistema, usuario) {
    const r = await completar({
      modelo: MODELO_PADRAO,
      mensagens: [
        { role: "system", content: sistema },
        { role: "user", content: usuario },
      ],
      maxTokens: 3000,
      json: true,
      timeoutMs: 60_000,
    });
    return { texto: r.texto, custo: r.uso.custoUsd };
  },
};

async function ler(motor: Motor, partes: Candidato["partes"], regua: string): Promise<{ leitor: Leitura[]; custo: number }> {
  try {
    const texto = [...partes.gancho, ...partes.corpo, ...partes.cta].join("\n");
    const { texto: saida, custo } = await motor.ler(LEITOR, `${regua ? `A régua (fala real de um reel que performou):\n${regua}\n\n` : ""}O roteiro pra avaliar:\n${texto}`);
    const j = extrairJSON<{ linhas?: Leitura[] }>(saida);
    const leitor = (j?.linhas ?? [])
      .filter((l) => l?.linha?.trim())
      .slice(0, 4)
      .map((l) => ({ linha: String(l.linha).slice(0, 200), por_que: String(l.por_que ?? "").slice(0, 200), sugestao: l.sugestao ? String(l.sugestao).slice(0, 200) : null }));
    return { leitor, custo };
  } catch (e) {
    // o plano do Claude no limite tem que subir (a estação devolve pra fila); o resto é reforço:
    // se a segunda leitura cair, vale a checagem determinística
    if ((e as { limite?: boolean }).limite) throw e;
    return { leitor: [], custo: 0 };
  }
}

/** Maiúscula na 1ª linha da parte e em toda linha que começa frase nova. */
function maiusculas(linhas: string[]): string[] {
  return linhas.map((l, i) => (i === 0 || /[.!?…]["']?$/.test(linhas[i - 1]) ? l.replace(/^(["']?)(\p{Ll})/u, (_, a: string, b: string) => a + b.toUpperCase()) : l));
}

const nota = (c: Candidato) => c.checagem.graves.length * 10 + c.leitor.length * 3 + c.checagem.leves.length;
const passou = (c: Candidato) => c.checagem.aprovado && c.leitor.length === 0;

/** Escreve um roteiro novo: gera, confere, reescreve o que reprovar, devolve a melhor versão. */
export async function escreverRoteiro(e: Entrada, motor: Motor = MOTOR_API): Promise<VersaoRoteiro> {
  const padrao = await lerPadrao();
  const palavraFixa = e.palavraCta ? palavraLimpa(e.palavraCta) : null;
  // A cópia é conferida contra a referência E contra os exemplos do guia (fala real de outros criadores)
  const naoCopiar = [e.falaReferencia ?? "", ...padrao.exemplos.map((x) => x.transcricao)].join("\n");
  const mensagens: Mensagem[] = [
    { role: "system", content: await sistema(padrao) },
    { role: "user", content: pedido(e, padrao) },
  ];
  let custo = 0;
  const reescritas: Array<{ motivos: string[] }> = [];

  async function gerar(): Promise<{ cand: Candidato; saida: string }> {
    let texto = "";
    let fim: string | null | undefined = null;
    let bruto: Bruto | null = null;
    // Às vezes volta vazio (instabilidade do provedor): tenta mais uma vez antes de desistir
    for (let tentativa = 1; tentativa <= 2 && !bruto; tentativa++) {
      const r = await motor.escrever(mensagens);
      custo += r.custo;
      texto = r.texto;
      fim = r.fim;
      bruto = extrairJSON<Bruto>(texto);
    }
    if (!bruto) {
      if (process.env.ROTEIRO_DEPURAR) console.error(`[roteiro] fim: ${fim}\n${texto}`);
      throw new Error(`o modelo não devolveu um roteiro válido (${texto ? `fim: ${fim ?? "?"}; ${texto.slice(0, 120)}…${texto.slice(-80)}` : `resposta vazia, fim: ${fim ?? "?"}`})`);
    }
    const partes = {
      gancho: linhasDe(bruto.gancho),
      corpo: linhasDe(bruto.corpo),
      cta: linhasDe(bruto.cta),
      palavra_cta: palavraFixa ?? palavraLimpa(bruto.palavra_cta),
    };
    const checagem = checarRoteiro(partes, { proibidas: padrao.proibidas, referencia: naoCopiar, duracaoAlvo: e.duracaoAlvo });
    const l = await ler(motor, partes, padrao.exemplos[0]?.transcricao ?? "");
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
    await e.aoReescrever?.(rodada);
    mensagens.push(
      { role: "assistant", content: saida },
      {
        role: "user",
        content:
          `A checagem reprovou estes pontos:\n${problemasEmTexto(atual.checagem)}` +
          (atual.leitor.length
            ? `\n${atual.leitor.map((l) => `- [leitor] soa como IA: "${l.linha}" (${l.por_que})${l.sugestao ? `; algo como: ${l.sugestao}` : ""}`).join("\n")}`
            : "") +
          `\n\nReescreva o roteiro corrigindo TODOS esses pontos sem criar problema novo. Mantenha o que está bom. Devolva o JSON completo, no mesmo formato.`,
      },
    );
    ({ cand: atual, saida } = await gerar());
    if (nota(atual) < nota(melhor)) melhor = atual;
  }

  // Rede de segurança: o que escapou (travessão, aspa curva, emoji) não chega no teleprompter, e
  // começo de frase sai com maiúscula (o modelo às vezes escreve tudo minúsculo)
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
    legenda: String(melhor.bruto.legenda ?? "").replace(/\s*[—–]\s*/g, ", ").trim(),
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

/** O texto que vai pro teleprompter: só a fala, uma ideia por linha, partes separadas por linha em branco. */
export function textoTeleprompter(v: Pick<VersaoRoteiro, "gancho" | "corpo" | "cta">, marcado = false): string {
  const parte = (nome: string, linhas: string[]) => (marcado ? [`[${nome}]`, ...linhas] : linhas).join("\n");
  return [parte("GANCHO", v.gancho), parte("CORPO", v.corpo), parte("CTA", v.cta)].join("\n\n");
}
