import "server-only";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { urlDoApp } from "@/lib/app";
import { chaveOpenRouter } from "@/lib/segredos";
import { MODELO_PADRAO, OPENROUTER_URL } from "@/lib/ia/openrouter";

// O motor do agente: dois nós — `agente` (o modelo com as
// ferramentas) e `ferramentas` (ToolNode) — em loop até o modelo parar de chamar
// ferramenta. Modelo via OpenRouter com o cliente ChatOpenAI.

export async function criarModelo(opcoes: { modelo?: string; temperatura?: number; maxTokens?: number }) {
  const apiKey = await chaveOpenRouter();
  if (!apiKey) throw new Error("falta a chave da OpenRouter (Início → passo 2)");
  return new ChatOpenAI({
    model: opcoes.modelo || MODELO_PADRAO,
    temperature: opcoes.temperatura ?? 0.7,
    // Folga: modelo que raciocina gasta token pensando antes de escrever (com teto
    // baixo a resposta sai cortada). Só paga o que usar.
    maxTokens: opcoes.maxTokens ?? 1500,
    apiKey,
    timeout: 60_000,
    maxRetries: 2,
    configuration: {
      baseURL: OPENROUTER_URL,
      defaultHeaders: {
        "HTTP-Referer": urlDoApp(),
        "X-Title": "Creator System",
      },
    },
  });
}

export function criarGrafo(modelo: ChatOpenAI, ferramentas: StructuredToolInterface[]) {
  const comFerramentas = modelo.bindTools(ferramentas);

  const agente = async (estado: typeof MessagesAnnotation.State) => ({
    messages: [await comFerramentas.invoke(estado.messages)],
  });

  const continuar = (estado: typeof MessagesAnnotation.State) => {
    const ultima = estado.messages[estado.messages.length - 1] as AIMessage;
    return ultima.tool_calls?.length ? "ferramentas" : END;
  };

  return new StateGraph(MessagesAnnotation)
    .addNode("agente", agente)
    .addNode("ferramentas", new ToolNode(ferramentas))
    .addEdge(START, "agente")
    .addConditionalEdges("agente", continuar, ["ferramentas", END])
    .addEdge("ferramentas", "agente")
    .compile();
}

export type SaidaDoGrafo = {
  texto: string;
  ferramentas: Array<{ nome: string; args: unknown }>;
  tokensEntrada: number;
  tokensSaida: number;
};

function textoDe(m: BaseMessage): string {
  const c = m.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((p) => (typeof p === "string" ? p : p && typeof p === "object" && "text" in p ? String(p.text ?? "") : ""))
      .join("");
  }
  return "";
}

/** Roda o grafo e junta o que interessa: o texto final, as ferramentas chamadas e os tokens. */
export async function rodarGrafo(
  grafo: ReturnType<typeof criarGrafo>,
  mensagens: BaseMessage[],
): Promise<SaidaDoGrafo> {
  const resultado = await grafo.invoke({ messages: mensagens }, { recursionLimit: 8 });
  const novas = resultado.messages.slice(mensagens.length);
  const ais = novas.filter((m): m is AIMessage => m instanceof AIMessage || m.getType() === "ai") as AIMessage[];

  let tokensEntrada = 0;
  let tokensSaida = 0;
  const ferramentas: SaidaDoGrafo["ferramentas"] = [];
  for (const m of ais) {
    tokensEntrada += m.usage_metadata?.input_tokens ?? 0;
    tokensSaida += m.usage_metadata?.output_tokens ?? 0;
    for (const t of m.tool_calls ?? []) ferramentas.push({ nome: t.name, args: t.args });
  }

  // A resposta é o texto da última mensagem do modelo. Gemini às vezes escreve junto com
  // a chamada de ferramenta e depois devolve vazio: aí vale o texto que veio com a chamada.
  const final = ais.length ? textoDe(ais[ais.length - 1]).trim() : "";
  const comFerramenta = ais.map(textoDe).filter((t) => t.trim()).pop() ?? "";
  return { texto: final || comFerramenta, ferramentas, tokensEntrada, tokensSaida };
}
