import "server-only";
import { urlDoApp } from "@/lib/app";
import { chaveOpenRouter } from "@/lib/segredos";

// Chamadas diretas à OpenRouter pro que não é o agente em si: transcrever áudio,
// descrever imagem, a Esteira (carrossel, roteiro, persona). O agente conversa pelo
// LangGraph (lib/agente/grafo.ts).

export const OPENROUTER_URL = "https://openrouter.ai/api/v1";
export const MODELO_PADRAO = process.env.AI_MODEL || "google/gemini-3.8-flash";

/** Tem chave da OpenRouter (colada no painel ou na variável de ambiente)? */
export async function iaConfigurada(): Promise<boolean> {
  return Boolean(await chaveOpenRouter());
}

type Uso = { tokensEntrada: number; tokensSaida: number; custoUsd: number };

type Parte =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "input_audio"; input_audio: { data: string; format: string } };

type Mensagem = { role: "system" | "user" | "assistant"; content: string | Parte[] };

async function completar(opcoes: {
  modelo?: string;
  mensagens: Mensagem[];
  maxTokens?: number;
  temperatura?: number;
  json?: boolean;
  timeoutMs?: number;
}): Promise<{ texto: string; uso: Uso }> {
  const chave = await chaveOpenRouter();
  if (!chave) throw new Error("falta a chave da OpenRouter (Início → passo 2)");
  const r = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
      "HTTP-Referer": urlDoApp(),
      "X-Title": "Sistema do Criador",
    },
    body: JSON.stringify({
      model: opcoes.modelo || MODELO_PADRAO,
      messages: opcoes.mensagens,
      max_tokens: opcoes.maxTokens ?? 800,
      temperature: opcoes.temperatura ?? 0,
      ...(opcoes.json ? { response_format: { type: "json_object" } } : {}),
      usage: { include: true },
    }),
    signal: AbortSignal.timeout(opcoes.timeoutMs ?? 90_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  const texto = String(j.choices?.[0]?.message?.content ?? "").trim();
  return {
    texto,
    uso: {
      tokensEntrada: j.usage?.prompt_tokens ?? 0,
      tokensSaida: j.usage?.completion_tokens ?? 0,
      custoUsd: Number(j.usage?.cost ?? 0),
    },
  };
}

/** JSON do modelo, tolerante a cerca de código e texto em volta. */
export async function completarJSON<T>(opcoes: {
  modelo?: string;
  sistema: string;
  usuario: string;
  maxTokens?: number;
  temperatura?: number;
  timeoutMs?: number;
}): Promise<{ dados: T | null; uso: Uso; bruto: string }> {
  const { texto, uso } = await completar({
    modelo: opcoes.modelo,
    mensagens: [
      { role: "system", content: opcoes.sistema },
      { role: "user", content: opcoes.usuario },
    ],
    maxTokens: opcoes.maxTokens ?? 900,
    temperatura: opcoes.temperatura,
    timeoutMs: opcoes.timeoutMs,
    json: true,
  });
  return { dados: extrairJSON<T>(texto), uso, bruto: texto };
}

export function extrairJSON<T>(texto: string): T | null {
  const limpo = texto.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(limpo) as T;
  } catch {
    const i = limpo.indexOf("{");
    const f = limpo.lastIndexOf("}");
    if (i >= 0 && f > i) {
      try {
        return JSON.parse(limpo.slice(i, f + 1)) as T;
      } catch {}
    }
    return null;
  }
}

const FORMATO_AUDIO: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "audio/wav": "wav",
  "audio/webm": "webm",
};

/** Áudio (do direct, ogg/mp4) → texto, em português. */
export async function transcreverAudio(base64: string, mime = "audio/ogg"): Promise<{ texto: string; uso: Uso }> {
  const formato = FORMATO_AUDIO[mime.split(";")[0].trim().toLowerCase()] ?? "ogg";
  return completar({
    mensagens: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Transcreva este áudio exatamente como foi falado, em português do Brasil. " +
              "Responda só com a transcrição, sem comentário, sem aspas. Se não houver fala, responda [sem fala].",
          },
          { type: "input_audio", input_audio: { data: base64, format: formato } },
        ],
      },
    ],
    maxTokens: 1500,
  });
}

/** Imagem recebida → descrição curta (o agente "vê" pelo texto). */
export async function descreverImagem(url: string, legenda?: string | null): Promise<{ texto: string; uso: Uso }> {
  return completar({
    mensagens: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "Descreva esta imagem que alguém mandou no direct, em 1 a 3 frases, em português. " +
              "Se tiver texto na imagem (print de tela, post), transcreva o essencial. Nunca use aspas." +
              (legenda ? ` A legenda que veio junto foi: ${legenda}` : ""),
          },
          { type: "image_url", image_url: { url } },
        ],
      },
    ],
    maxTokens: 400,
  });
}

// ── Preço por token (pra custo do turno do agente, que vem pelo LangChain) ─────

let precos: { mapa: Map<string, { entrada: number; saida: number }>; ate: number } | null = null;

export async function precoDoModelo(modelo: string): Promise<{ entrada: number; saida: number } | null> {
  if (!precos || precos.ate < Date.now()) {
    try {
      const r = await fetch(`${OPENROUTER_URL}/models`, { signal: AbortSignal.timeout(15_000) });
      const j = await r.json();
      const mapa = new Map<string, { entrada: number; saida: number }>();
      for (const m of j.data ?? []) {
        mapa.set(m.id, { entrada: Number(m.pricing?.prompt ?? 0), saida: Number(m.pricing?.completion ?? 0) });
      }
      precos = { mapa, ate: Date.now() + 12 * 3600_000 };
    } catch {
      return null;
    }
  }
  return precos.mapa.get(modelo) ?? null;
}

type Midia = { tipo: "video" | "imagem"; url: string };

/**
 * JSON a partir de mídia (um vídeo, ou várias imagens na ordem) + instrução. Cada `url` é
 * https ou data URI. O Gemini ouve o áudio do vídeo junto com a imagem — sem ffmpeg.
 */
export async function analisarMidiaJSON<T>(opcoes: {
  modelo?: string;
  sistema: string;
  instrucao: string;
  midia?: Midia;
  midias?: Midia[];
  maxTokens?: number;
}): Promise<{ dados: T | null; uso: Uso; bruto: string }> {
  const lista = opcoes.midias ?? (opcoes.midia ? [opcoes.midia] : []);
  const partes: Parte[] = lista.map((m) =>
    m.tipo === "video"
      ? ({ type: "video_url", video_url: { url: m.url } } as unknown as Parte)
      : { type: "image_url", image_url: { url: m.url } },
  );
  const { texto, uso } = await completar({
    modelo: opcoes.modelo,
    mensagens: [
      { role: "system", content: opcoes.sistema },
      { role: "user", content: [{ type: "text", text: opcoes.instrucao }, ...partes] },
    ],
    // Folga: o Gemini raciocina antes de escrever, e transcrição inteira é texto longo
    maxTokens: opcoes.maxTokens ?? 8000,
    json: true,
    timeoutMs: 300_000,
  });
  return { dados: extrairJSON<T>(texto), uso, bruto: texto };
}
