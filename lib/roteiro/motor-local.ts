import "server-only";
import os from "node:os";
import { rodarCodexTexto } from "@/editor/estacao/codex.mjs";
import { lerConfigMotor } from "@/editor/estacao/motor.mjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { rodarClaudeTexto } from "@/editor/estacao/claude.mjs";
import type { Mensagem } from "@/lib/ia/openrouter";
import type { Motor } from "./escrever";

// O motor da estação (06/10, decisão do criador: "joga o agente de roteiro igual o editor de vídeo"):
// o Claude Code no PC dele, no plano dele, sem chave de API. Escreve e reescreve no Opus (o melhor em
// português falado) e faz a segunda leitura no Sonnet, com esforço baixo. Trocável pelas envs
// ROTEIRO_MODELO, ROTEIRO_ESFORCO e ROTEIRO_MODELO_LEITOR. Só roda na estação
// (scripts/estacao-roteiros.ts); o servidor nunca usa.

const MODELO = process.env.ROTEIRO_MODELO || "opus";
const ESFORCO = process.env.ROTEIRO_ESFORCO || "medium";
const MODELO_LEITOR = process.env.ROTEIRO_MODELO_LEITOR || "sonnet";

/** A conversa (system + pedido + versão anterior + o que reprovou) num pedido só, como o `claude -p` recebe. */
function achatar(mensagens: Mensagem[]): { sistema: string; prompt: string } {
  const sistema = mensagens
    .filter((m) => m.role === "system")
    .map((m) => String(m.content))
    .join("\n\n");
  const resto = mensagens.filter((m) => m.role !== "system");
  if (resto.length === 1) return { sistema, prompt: String(resto[0].content) };
  const partes = resto.map((m, i) =>
    m.role === "assistant" ? `## A tua versão anterior\n${m.content}` : i === 0 ? `## O pedido\n${m.content}` : `## O que a checagem reprovou nela\n${m.content}`,
  );
  return { sistema, prompt: `${partes.join("\n\n")}\n\nResponda APENAS o JSON da versão nova, completo.` };
}

export function motorLocal(): Motor {
  let nome = "estação local";
  const rodarTexto = async (p: {sistema:string; prompt:string; modelo?:string; esforco?:string; minutos?:number}) => {
    const config = await lerConfigMotor(createAdminClient());
    nome = `${config.motor === "codex" ? "Codex" : "Claude Code"} · estação ${os.hostname()}`;
    if (config.motor === "codex") return rodarCodexTexto(p);
    return rodarClaudeTexto(p);
  };
  let equivalente = 0;
  return {
    get nome() { return nome; },
    async escrever(mensagens) {
      const { sistema, prompt } = achatar(mensagens);
      const r = await rodarTexto({ sistema, prompt, modelo: MODELO, esforco: ESFORCO, minutos: 10 });
      equivalente += r.uso.equivalente_api_usd ?? 0;
      return { texto: r.texto, custo: 0, fim: null };
    },
    async ler(sistema, usuario) {
      const r = await rodarTexto({ sistema, prompt: usuario, modelo: MODELO_LEITOR, esforco: "low", minutos: 5 });
      equivalente += r.uso.equivalente_api_usd ?? 0;
      return { texto: r.texto, custo: 0 };
    },
    equivalenteApi: () => equivalente,
  };
}
