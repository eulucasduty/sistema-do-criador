import "server-only";
import { lerPerfil } from "@/lib/config";
import fs from "node:fs";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { extrairJSON } from "@/lib/ia/openrouter";
import { lerVoz } from "@/lib/esteira/voz";

// A legenda do post do vídeo editado (pedido do criador, 08/10: "postagem automática apertando 1
// botão, com legenda já pronta, alterável"). Quem escreve é a estação no PC dele (Claude Code do
// plano, sem custo de API), na fila dos roteiros (scripts/estacao-roteiros.ts). Parte do que ele
// FALOU no vídeo, no jeito das legendas dele de verdade (as últimas dos reels) e do guia da voz.

export type LegendaPronta = { legenda: string; palavra: string | null };

const PERFIL = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "editor", "perfil.json"), "utf8")) as { regras?: string[] };
  } catch {
    return {};
  }
})();

const pastaDaOficina = (ed: { id: string; criado_em: string; versao: number }) => path.join(process.cwd(), "editor", "oficina", `${String(ed.criado_em).slice(0, 10)}-${String(ed.id).slice(0, 8)}-v${ed.versao}`);

/** A palavra do CTA: a que a estação guardou na edição; senão a do plano da oficina, neste PC. */
export function ctaDaEdicao(ed: { id: string; criado_em: string; versao: number; cta_palavra?: string | null }): string | null {
  if (ed.cta_palavra?.trim()) return ed.cta_palavra.trim();
  try {
    const plano = JSON.parse(fs.readFileSync(path.join(pastaDaOficina(ed), "plano.json"), "utf8")) as { cenas?: Array<{ tipo?: string; palavra?: string }> };
    const c = (plano.cenas ?? []).find((x) => x.tipo === "cta" && x.palavra);
    return c?.palavra ? String(c.palavra).trim().slice(0, 40) : null;
  } catch {
    return null;
  }
}

/** A fala do vídeo: a que a estação guardou na edição; senão a da oficina, neste PC. */
export function falaDaEdicao(ed: { id: string; criado_em: string; versao: number; transcricao?: string | null }): string {
  if (ed.transcricao?.trim()) return ed.transcricao.trim();
  const pasta = pastaDaOficina(ed);
  try {
    const palavras = JSON.parse(fs.readFileSync(path.join(pasta, "dados", "palavras.json"), "utf8")) as Array<{ text?: string; texto?: string }>;
    return palavras.map((w) => String(w.text ?? w.texto ?? "").trim()).filter(Boolean).join(" ");
  } catch {
    return "";
  }
}

const SISTEMA = `Você escreve a LEGENDA de um reel do criador (seu perfil: conteúdo no nicho do perfil configurado). A legenda vai no post do Instagram, embaixo do vídeo.

Como ela é (copie o jeito das legendas dele que vêm de exemplo, não invente um estilo):
- curta: 2 a 5 linhas. A primeira linha é um gancho que completa o vídeo (não repete a primeira frase dele).
- na voz dele: minúscula, frase curta, de igual pra igual, gíria leve ("cara", "mano", "sem sal"), nada de tom de guru, de anúncio ou de IA.
- se o vídeo tem CTA de comentário, a legenda repete o pedido com a MESMA palavra: "comenta PALAVRA que eu te mando …" (o que ele promete no vídeo). Uma vez só, perto do fim.
- 3 a 5 hashtags no fim, em minúscula, do assunto do vídeo (#ia #inteligenciaartificial e as específicas). Sem hashtag genérica de engajamento.
- emoji: no máximo 2, e só se as legendas de exemplo usam.

Nunca:
- travessão (—), "não é X, é Y", trio de adjetivos, "descubra", "revolucionário", "neste vídeo", "confira".
- prometer o que ele não falou no vídeo; número, resultado ou preço que ele não disse.
- preços, ofertas e resultados que não tenham sido informados pelo criador.

Responda SÓ um JSON: {"legenda": "...", "palavra": "PALAVRA do CTA ou null"}`;

/** Monta o pedido da legenda com o que tem: a fala, o título, o contexto, a palavra do CTA e os exemplos. */
export async function pedidoDaLegenda(ed: { id: string; titulo: string; roteiro?: string | null; criado_em: string; versao: number; transcricao?: string | null; cta_palavra?: string | null }): Promise<{ sistema: string; prompt: string }> {
  const db = createAdminClient();
  const fala = falaDaEdicao(ed);
  const cta = ctaDaEdicao(ed);
  const [{ data: reels }, voz] = await Promise.all([db.from("meu_reel").select("legenda").not("legenda", "is", null).order("publicado_em", { ascending: false }).limit(8), lerVoz()]);
  const exemplos = (reels ?? [])
    .map((r) => String(r.legenda ?? "").trim())
    .filter((l) => l.length > 20)
    .slice(0, 6);
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const partes = [
    `## O vídeo\ntítulo que ele deu: ${ed.titulo}`,
    fala ? `o que ele fala (transcrição automática, pode ter nome trocado):\n"${fala.slice(0, 6000)}"` : "(sem a transcrição: escreva a partir do título e do contexto)",
    ed.roteiro?.trim() ? `contexto que ele escreveu no pedido da edição:\n${ed.roteiro.trim().slice(0, 2000)}` : "",
    cta ? `a palavra do CTA que está no vídeo: ${cta}` : "o vídeo não tem palavra de CTA marcada: se a fala pede pra comentar alguma palavra, use ela; senão, palavra = null e sem pedido de comentário",
    exemplos.length ? `## Legendas dele de verdade (o jeito a copiar)\n${exemplos.map((l, k) => `--- exemplo ${k + 1}\n${l.slice(0, 700)}`).join("\n")}` : "",
    voz.guia ? `## Guia da voz dele (tirado dos reels)\n${voz.guia.slice(0, 3500)}` : "",
    PERFIL.regras?.length ? `## Regras do que pode aparecer (hoje é ${hoje})\n${PERFIL.regras.map((r) => `- ${r}`).join("\n")}` : "",
  ];
  return { sistema: `${SISTEMA}\nPerfil do criador: ${JSON.stringify(await lerPerfil())}`, prompt: partes.filter(Boolean).join("\n\n") };
}

/** Lê o JSON que o Claude devolveu e confere o básico (tamanho, travessão, preço). */
export function lerLegenda(texto: string, palavraPadrao: string | null): LegendaPronta {
  const j = extrairJSON<{ legenda?: string; palavra?: string | null }>(texto);
  let legenda = String(j?.legenda ?? "").trim();
  if (!legenda) throw new Error("o Claude não devolveu a legenda");
  legenda = legenda.replace(/\s+—\s+/g, ", ").replace(/—/g, ",");
  if (/R\$\s?\d/.test(legenda)) legenda = legenda.replace(/[^\n]*R\$\s?\d[^\n]*\n?/g, "").trim();
  const palavra = String(j?.palavra ?? palavraPadrao ?? "").trim().replace(/^null$/i, "") || null;
  return { legenda: legenda.slice(0, 2200), palavra: palavra ? palavra.slice(0, 40) : null };
}
