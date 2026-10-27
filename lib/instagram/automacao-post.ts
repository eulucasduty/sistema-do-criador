import { urlDoApp } from "@/lib/app";
import "server-only";
import type { Db } from "@/lib/supabase/admin";

// Uma automação por post (pedido do Lucas, 19/10, no modelo do Rafa Grandi e dos grandes criadores):
// quando um post sai pela agenda, nasce a automação só daquela mídia, só da palavra dela, com o
// texto falando do assunto do post. Cada passo é UMA mensagem com UM botão (como o ManyChat):
//   1ª DM   "Vi que você comentou no post sobre <tema>…"            [Pode mandar!]
//   portão  "Ih, tu ainda não me segue…"                              [Seguindo! ✅]
//   entrega "Pronto! Aqui embaixo tem o link…"                        [Acessar o material] → /m/<palavra>
// A geral (todas as publicações) continua valendo pros posts antigos; a do post ganha dela.

export const TEXTOS_AUTOMACAO = {
  abertura: (tema: string) => `Vi que você comentou no post sobre ${tema}! Vou te mandar por aqui pra ficar mais fácil, ok?`,
  botaoAbertura: "Pode mandar!",
  portao: "Ih, tu ainda não me segue 😅\n\nMe segue lá que eu te mando na hora!\n\nAssim que seguir, volta aqui e toca no botão abaixo 👇",
  botaoPortao: "Seguindo! ✅",
  entrega: "Pronto! Aqui embaixo tem o link com o material completo e o passo a passo de como usar.\n\nClica aqui embaixo pra acessar 👇",
  botaoEntrega: "Acessar o material",
  // Variar a resposta pública: o mesmo texto em todo comentário tem cara de robô
  respostasPublicas: ["Te mandei no direct 📩", "Olha teu direct 👀", "Mandei lá na DM! Confere se tá me seguindo 😉"],
};

/** "O prompt de renda passiva" → "o prompt de renda passiva" (o tema entra no meio da frase). */
function temaDe(titulo: string | null | undefined, palavra: string): string {
  const t = String(titulo ?? "").trim().replace(/[.!?:]+$/, "");
  if (!t) return palavra.toLowerCase();
  return /^[A-ZÀ-Ý][a-zà-ÿ]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
}

/** Cria (ou deixa como está) a automação do post publicado. Erro não derruba a publicação. */
export async function criarAutomacaoDoPost(
  db: Db,
  p: { postId?: string | null; mediaId: string; palavra: string; numero?: number | null; tipo?: "Post" | "Reel" },
): Promise<void> {
  const { data: ja } = await db.from("ig_automacao").select("id").eq("todas_as_midias", false).contains("midias", [p.mediaId]).limit(1);
  if (ja?.length) return;
  const { data: entrega } = await db.from("entrega").select("slug, titulo, subtitulo").ilike("palavra", p.palavra).eq("status", "pronta").limit(1).maybeSingle();
  const palavra = p.palavra.toUpperCase();
  const { error } = await db.from("ig_automacao").insert({
    nome: `${p.tipo ?? "Post"}${p.numero ? ` #${String(p.numero).padStart(2, "0")}` : ""} · ${palavra}`,
    ativa: true,
    modo: "botao",
    todas_as_midias: false,
    midias: [p.mediaId],
    palavras: [palavra.toLowerCase()],
    respostas_publicas: TEXTOS_AUTOMACAO.respostasPublicas,
    dm_abertura: TEXTOS_AUTOMACAO.abertura(temaDe(entrega?.titulo, palavra)),
    botao_abertura: TEXTOS_AUTOMACAO.botaoAbertura,
    exigir_seguir: true,
    dm_nao_segue: TEXTOS_AUTOMACAO.portao,
    botao_seguir: TEXTOS_AUTOMACAO.botaoPortao,
    dm_entrega: TEXTOS_AUTOMACAO.entrega,
    entrega_mensagens: [],
    link_entrega: entrega ? `${urlDoApp()}/m/${entrega.slug}` : null,
    tag: "material",
    contexto: entrega?.titulo ? `o material "${entrega.titulo}"${entrega.subtitulo ? ` (${entrega.subtitulo})` : ""}, na página /m/${palavra.toLowerCase()}` : null,
    carrossel_post_id: p.postId ?? null,
  });
  if (error) console.error("[automacao-post]", palavra, error.message);
}
