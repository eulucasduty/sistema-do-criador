import "server-only";
import { lerConfig, salvarConfig } from "@/lib/config";

// O guia do PADRÃO VIRAL que o escritor de roteiros segue (configuracao.padrao_viral, editável em
// /roteiros/padrao). Regras (gancho, estrutura, ritmo, vocabulário, CTA) + exemplos REAIS de
// transcrição como few-shot: é o exemplo de fala de verdade que tira a cara de texto de IA.
//
// Fase 1 (06/10): saiu dos reels do próprio criador que performaram (03_Conteudo do vault da operação).
// Fase 2 (06/10): os 4 virais que ele mandou (03_Conteudo/referencias_virais: os vídeos, as
// transcrições e a ANALISE_PADRAO_VIRAL.md com as evidências). Vídeo novo: `npm run roteiro:virais`
// transcreve só o que falta; a análise e o guia são atualizados a partir dela.
// Sem nada no banco, vale o PADRAO_INICIAL.

export type ExemploViral = {
  titulo: string;
  /** de onde veio e como performou */
  fonte: string;
  /** a fala, uma ideia por linha */
  transcricao: string;
  /** o que fez funcionar */
  por_que: string;
};

export type PadraoViral = {
  regras: string;
  exemplos: ExemploViral[];
  /** expressões extras que o criador proíbe (a checagem anti-IA barra) */
  proibidas: string[];
  atualizado_em?: string;
  fonte?: string;
};

export const PADRAO_INICIAL: PadraoViral = {
  fonte: "Modelo inicial do Creaty; personalize com os seus exemplos",
  proibidas: [], exemplos: [],
  regras: "Comece com um gancho específico e verdadeiro. Desenvolva uma ideia por vídeo, com passos concretos e frases faladas. Use exemplos do nicho do criador. Não invente resultados pessoais, promessas ou números. Termine com uma ação clara e uma entrega coerente com o assunto. Respeite a duração solicitada."
};

export async function lerPadrao(): Promise<PadraoViral> {
  const salvo = await lerConfig<PadraoViral | null>("padrao_viral", null);
  if (!salvo?.regras?.trim()) return PADRAO_INICIAL;
  return {
    regras: salvo.regras,
    exemplos: Array.isArray(salvo.exemplos) ? salvo.exemplos.filter((e) => e?.transcricao?.trim()) : [],
    proibidas: Array.isArray(salvo.proibidas) ? salvo.proibidas.map(String).filter((p) => p.trim()) : [],
    atualizado_em: salvo.atualizado_em,
    fonte: salvo.fonte,
  };
}

export async function salvarPadrao(p: PadraoViral): Promise<void> {
  await salvarConfig("padrao_viral", { ...p, atualizado_em: new Date().toISOString() });
}

/** O guia no formato do prompt: regras + exemplos de fala real. */
export function padraoEmTexto(p: PadraoViral): { regras: string; exemplos: string } {
  return {
    regras: p.regras.trim(),
    exemplos: p.exemplos
      .map((e, i) => `### Exemplo ${i + 1}: ${e.titulo}\n(${e.fonte})\n${e.transcricao.trim()}\nPor que funcionou: ${e.por_que}`)
      .join("\n\n"),
  };
}
