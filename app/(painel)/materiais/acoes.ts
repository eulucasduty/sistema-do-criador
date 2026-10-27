"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { salvarConfig } from "@/lib/config";
import { normalizarBlocos, slugDe, urlSegura } from "@/lib/entregas/blocos";

// As entregas dos CTAs (Materiais): o rascunho é escrito pela estação (fila em
// scripts/estacao-roteiros.ts), o criador revisa aqui e publica em /m/<slug>.

const limpo = (s: unknown, max: number) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const voltar = (caminho: string, erro?: string): never => {
  revalidatePath("/materiais");
  revalidatePath(caminho);
  redirect(`${caminho}${erro ? `?erro=${encodeURIComponent(erro)}` : ""}`);
};

async function slugLivre(db: ReturnType<typeof createAdminClient>, base: string, menosId?: string): Promise<string> {
  const raiz = slugDe(base) || "material";
  let slug = raiz.length >= 2 ? raiz : `${raiz}-material`;
  for (let k = 2; k < 60; k++) {
    const { data } = await db.from("entrega").select("id").eq("slug", slug).maybeSingle();
    if (!data || data.id === menosId) return slug;
    slug = `${raiz}-${k}`.slice(0, 40);
  }
  return `${raiz}-${Date.now().toString(36)}`.slice(0, 40);
}

/** Nova entrega: vai pra fila da estação, que monta o rascunho. */
export async function criarEntrega(form: FormData) {
  await exigirEquipe();
  const palavra = limpo(form.get("palavra"), 40);
  const titulo = limpo(form.get("titulo"), 120);
  const pedido = limpo(form.get("pedido"), 12000);
  const edicaoId = limpo(form.get("edicao_id"), 60) || null;
  if (!palavra && !titulo) voltar("/materiais", "dê a palavra do comentário ou um título");
  if (!pedido && !edicaoId) voltar("/materiais", "escreva o que entregar ou escolha o vídeo de onde tirar");
  const db = createAdminClient();
  const slug = await slugLivre(db, palavra || titulo);
  const { data, error } = await db
    .from("entrega")
    .insert({ slug, palavra: palavra || null, titulo, pedido: pedido || null, edicao_id: edicaoId, status: "aguardando_estacao", etapa: "na fila da estação: o Claude monta o material" })
    .select("id")
    .single();
  if (error || !data) voltar("/materiais", `não criou: ${error?.message}`);
  voltar(`/materiais/${data!.id}`);
}

/** Guarda o que ele mexeu (título, palavra, endereço, blocos). */
export async function salvarEntrega(form: FormData) {
  await exigirEquipe();
  const id = limpo(form.get("id"), 60);
  const db = createAdminClient();
  const caminho = `/materiais/${id}`;
  let blocos: ReturnType<typeof normalizarBlocos> = [];
  try {
    blocos = normalizarBlocos(JSON.parse(String(form.get("blocos") ?? "[]")));
  } catch {
    voltar(caminho, "os blocos vieram quebrados: recarregue a página");
  }
  const slugPedido = limpo(form.get("slug"), 40);
  const slug = await slugLivre(db, slugPedido || limpo(form.get("palavra"), 40) || limpo(form.get("titulo"), 120), id);
  const { error } = await db
    .from("entrega")
    .update({
      titulo: limpo(form.get("titulo"), 120),
      subtitulo: limpo(form.get("subtitulo"), 240) || null,
      palavra: limpo(form.get("palavra"), 40) || null,
      slug,
      na_dm: form.get("na_dm") === "on",
      blocos,
      ...(String(form.get("publicar") ?? "") === "1" ? { publicada: true, publicada_em: new Date().toISOString() } : {}),
      ...(String(form.get("publicar") ?? "") === "0" ? { publicada: false } : {}),
    })
    .eq("id", id)
    .in("status", ["pronta", "rascunho", "erro"]);
  voltar(caminho, error ? `não salvou: ${error.message}` : undefined);
}

/** Pede pra IA mudar o material (ou montar de novo, sem ajuste). */
export async function ajustarEntrega(form: FormData) {
  await exigirEquipe();
  const id = limpo(form.get("id"), 60);
  const ajuste = limpo(form.get("ajuste"), 4000);
  const pedido = form.has("pedido") ? limpo(form.get("pedido"), 12000) : undefined;
  const db = createAdminClient();
  const { error } = await db
    .from("entrega")
    .update({
      status: "aguardando_estacao",
      ajuste: ajuste || null,
      ...(pedido !== undefined ? { pedido: pedido || null } : {}),
      etapa: ajuste ? "na fila da estação: o Claude ajusta o material" : "na fila da estação: o Claude monta o material de novo",
      erro: null,
    })
    .eq("id", id)
    .in("status", ["pronta", "rascunho", "erro"]);
  voltar(`/materiais/${id}`, error ? error.message : undefined);
}

export async function apagarEntrega(form: FormData) {
  await exigirEquipe();
  const id = limpo(form.get("id"), 60);
  await createAdminClient().from("entrega").delete().eq("id", id);
  voltar("/materiais");
}

/** O convite da comunidade: vai na DM depois do link do material e no fim da página. */
export async function salvarConvite(form: FormData) {
  await exigirEquipe();
  const link = urlSegura(form.get("convite_link"));
  if (String(form.get("convite_link") ?? "").trim() && !link) voltar("/materiais", "o link do convite precisa começar com https://");
  await salvarConfig("entregas", {
    convite_texto: limpo(form.get("convite_texto"), 600),
    convite_botao: limpo(form.get("convite_botao"), 40) || "entrar na comunidade",
    convite_link: link,
  });
  voltar("/materiais");
}
