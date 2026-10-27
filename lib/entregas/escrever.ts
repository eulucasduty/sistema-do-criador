import "server-only";
import { lerPerfil } from "@/lib/config";
import { extrairJSON } from "@/lib/ia/openrouter";
import { normalizarBlocos, type ConteudoEntrega } from "./blocos";

// O rascunho de uma entrega (o material do CTA), escrito pela estação no PC do criador (Claude Code
// do plano, sem custo de API), na fila dos roteiros. Parte do que ele FALOU no vídeo (o que
// prometeu entregar) e do que ele escreveu no pedido (prompts e links colados, o que entregar).
// O criador revisa no painel antes de publicar.

const SISTEMA = `Você monta o MATERIAL que o criador (seu perfil, conteúdo no nicho do perfil configurado) entrega pra quem comenta a palavra do vídeo. O material vira uma página no celular: quem abre é iniciante, veio do Instagram e quer fazer o que o vídeo mostrou, agora.

O que entregar (é o que faz a página valer o comentário):
- O que o vídeo PROMETEU, completo e pronto pra usar: se ele falou de um prompt, o prompt inteiro, testável, colável (com [colchetes] onde a pessoa troca pelo dela); se falou de passo a passo, cada passo com a ação exata (onde clicar, o que colar); se falou de template, o texto do template.
- Se o pedido do criador trouxe prompts, links ou textos colados, use EXATAMENTE eles (pode organizar e explicar, não reescreva o prompt dele sem motivo).
- Comece por um texto de 1 ou 2 frases dizendo o que a pessoa vai conseguir; termine com o próximo passo concreto.

Os blocos que existem (JSON):
- {"tipo": "texto", "texto": "..."} — parágrafo curto (aceita **negrito**)
- {"tipo": "passos", "titulo": "...", "itens": [{"titulo": "...", "texto": "...", "prompt": "... (opcional)", "link": {"titulo": "...", "url": "https://... (opcional)"}}]}
- {"tipo": "prompt", "titulo": "...", "texto": "o prompt inteiro", "dica": "como usar (opcional)"}
- {"tipo": "link", "titulo": "texto do botão", "url": "https://...", "descricao": "pra que serve (opcional)"}
- {"tipo": "template", "titulo": "...", "texto": "o texto pra copiar e adaptar", "descricao": "..."}
- {"tipo": "aviso", "texto": "uma atenção ou dica importante"}

Regras:
- LINK: só os que o criador passou ou os sites oficiais que você tem certeza que existem (claude.ai, chatgpt.com, github.com/<repo que ele citou>…). NUNCA invente endereço. Precisa de um link que não tem? Bloco "link" com "url": "" e o título dizendo o que é: o criador completa no painel.
- Linguagem de igual pra igual, simples, frases curtas, minúsculas no texto corrido (como ele fala), sem termo técnico sem explicar. Prompts podem ter a formatação que precisarem.
- Nada de travessão (—), "não é X, é Y", tom de guru ou de anúncio.
- Nunca invente preço, oferta ou resultado. Nunca resultado ou número que ele não disse.
- De 4 a 12 blocos. Título da página curto (até 6 palavras), subtítulo de uma linha.

Responda SÓ um JSON: {"titulo": "...", "subtitulo": "...", "blocos": [...]}`;

export async function pedidoDaEntrega(e: {
  palavra: string | null;
  titulo: string;
  pedido: string | null;
  ajuste?: string | null;
  fala?: string;
  tituloVideo?: string | null;
  roteiro?: string | null;
  atual?: ConteudoEntrega | null;
}): Promise<{ sistema: string; prompt: string }> {
  const partes = [
    `## A entrega\npalavra do comentário: ${e.palavra ?? "(sem palavra)"}${e.titulo ? `\ntítulo que o criador deu: ${e.titulo}` : ""}`,
    e.pedido?.trim() ? `## O que o criador pediu pra entregar (use os prompts e links daqui como estão)\n${e.pedido.trim().slice(0, 12000)}` : "",
    e.tituloVideo ? `## O vídeo\ntítulo: ${e.tituloVideo}` : "",
    e.fala ? `o que ele fala no vídeo (transcrição automática, pode ter nome trocado: corrija marcas e ferramentas):\n"${e.fala.slice(0, 8000)}"` : "",
    e.roteiro?.trim() ? `contexto do pedido da edição:\n${e.roteiro.trim().slice(0, 3000)}` : "",
    e.atual && e.ajuste?.trim() ? `## A versão atual da página (JSON)\n${JSON.stringify(e.atual).slice(0, 15000)}\n\n## O ajuste que o criador pediu\n${e.ajuste.trim()}\nMude só o que ele pediu e devolva a página inteira.` : "",
  ];
  return { sistema: `${SISTEMA}\nPerfil do criador: ${JSON.stringify(await lerPerfil())}`, prompt: partes.filter(Boolean).join("\n\n") };
}

export function lerEntrega(texto: string): ConteudoEntrega {
  const j = extrairJSON<{ titulo?: string; subtitulo?: string; blocos?: unknown }>(texto);
  const blocos = normalizarBlocos(j?.blocos);
  if (!blocos.length) throw new Error("o Claude não devolveu os blocos do material");
  const limpar = (s: unknown, max: number) => String(s ?? "").replace(/\s+—\s+/g, ", ").trim().slice(0, max);
  return { titulo: limpar(j?.titulo, 120) || "Material", subtitulo: limpar(j?.subtitulo, 240) || undefined, blocos };
}
