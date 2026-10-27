import "server-only";
import { completarJSON, MODELO_PADRAO } from "@/lib/ia/openrouter";
import { medir } from "./anti-ia";
import { ehPortugues } from "./da-texto";
import type { VersaoRoteiro } from "./escrever";

// A fala do criador gringo vira português (pedido do Duty, 20/10: "faz a tradução do gringo pro
// português no gemini"). Só a tradução, no Gemini (centavos): o roteiro continua sendo a fala dele,
// linha por linha, pra ler no teleprompter.

const TRADUZIR = `Você traduz o roteiro de um vídeo curto (Reels/Shorts) pro português do Brasil FALADO: direto, informal, frases curtas ("você", "pra", "tá"). Preserve o nicho, o conteúdo e a intenção da referência.

Regras:
- Traduza linha por linha: mesma quantidade de linhas em cada parte, na mesma ordem, cada linha uma ideia.
- Mesmo conteúdo e mesmos fatos: não acrescente, não resuma, não corte.
- Nome de ferramenta, site, produto e empresa fica como é (Claude, ChatGPT, Cursor, n8n, Notion…). Número e moeda ficam como estão.
- Sem travessão.
- "palavra_cta": a palavra que a pessoa comenta, em português e em maiúscula, uma palavra só (ex.: AGENT → AGENTE, GUIDE → GUIA); se a palavra for nome de ferramenta, mantenha. Sem pedido de comentário: "".
- "titulo": um título curto em português pro roteiro.

Responda APENAS um JSON: {"titulo": "...", "palavra_cta": "...", "gancho": ["..."], "corpo": ["..."], "cta": ["..."]}`;

type Traduzido = { titulo?: string; palavra_cta?: string; gancho?: unknown; corpo?: unknown; cta?: unknown };
const lista = (x: unknown) => (Array.isArray(x) ? x.map((l) => String(l).replace(/\s*[—–]\s*/g, ", ").trim()).filter(Boolean) : []);

/** Já em português: devolve a mesma versão. Em outra língua: a tradução (o custo vai na versão). */
export async function emPortugues(v: VersaoRoteiro): Promise<VersaoRoteiro> {
  const texto = [...v.gancho, ...v.corpo, ...v.cta].join(" ");
  if (ehPortugues(texto)) return v;
  const { dados, uso } = await completarJSON<Traduzido>({
    modelo: MODELO_PADRAO,
    sistema: TRADUZIR,
    usuario: JSON.stringify({ titulo: v.titulo, palavra_cta: v.palavra_cta, gancho: v.gancho, corpo: v.corpo, cta: v.cta }),
    maxTokens: 6000,
    temperatura: 0.2,
    timeoutMs: 120_000,
  });
  const gancho = lista(dados?.gancho);
  const corpo = lista(dados?.corpo);
  const cta = lista(dados?.cta);
  if (!gancho.length || (v.cta.length && !cta.length)) throw new Error("a IA não devolveu a tradução do roteiro");
  const medida = medir([...gancho, ...corpo, ...cta]);
  return {
    ...v,
    titulo: String(dados?.titulo ?? "").trim().slice(0, 90) || v.titulo,
    palavra_cta: String(dados?.palavra_cta ?? "").replace(/[^\p{L}\p{N}]/gu, "").toUpperCase() || v.palavra_cta,
    gancho,
    corpo,
    cta,
    checagem: { ...v.checagem, palavras: medida.palavras, segundos: medida.segundos },
    de_onde_veio: `${v.de_onde_veio ?? "transcrição"}, traduzida pro português`,
    modelo: "transcrição traduzida",
    custo_usd: Number((v.custo_usd + uso.custoUsd).toFixed(4)),
  };
}
