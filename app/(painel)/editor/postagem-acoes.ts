"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { avancarPostagem, enviarPostagem } from "@/lib/postagem/publicar";
import { palavraNormal, slugDe } from "@/lib/entregas/blocos";

// O post do vídeo editado (botão "Postar no Instagram" da página da edição). A legenda é escrita
// pela estação (fila em scripts/estacao-roteiros.ts); o envio e a publicação, pelo servidor.

const limpo = (s: unknown, max: number) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const voltar = (edicaoId: string, erro?: string): never => {
  revalidatePath(`/editor/${edicaoId}`);
  redirect(`/editor/${edicaoId}${erro ? `?erro=${encodeURIComponent(erro)}` : ""}#postar`);
};

/** Escreve (ou reescreve) a legenda: o pedido vai pra fila da estação. */
export async function pedirLegenda(form: FormData) {
  await exigirEquipe();
  const edicaoId = limpo(form.get("edicao_id"), 60);
  const db = createAdminClient();
  const { data: ed } = await db.from("edicao").select("id, status, cta_palavra").eq("id", edicaoId).maybeSingle();
  if (!ed || ed.status !== "pronto") voltar(edicaoId, "o vídeo ainda não está pronto");
  const { data: p } = await db.from("postagem").select("id, status").eq("edicao_id", edicaoId).maybeSingle();
  if (p && ["enviando", "processando", "publicando", "publicada"].includes(p.status)) voltar(edicaoId, "esse vídeo já foi pro Instagram");
  const fila = { status: "aguardando_estacao", etapa: "na fila da estação: o Claude escreve a legenda", erro: null };
  if (p) await db.from("postagem").update(fila).eq("id", p.id);
  else await db.from("postagem").insert({ edicao_id: edicaoId, palavra: ed?.cta_palavra ?? null, ...fila });
  voltar(edicaoId);
}

function camposDoForm(form: FormData) {
  const capa = Number(String(form.get("capa_s") ?? "").replace(",", "."));
  return {
    legenda: limpo(form.get("legenda"), 2200),
    palavra: limpo(form.get("palavra"), 40) || null,
    compartilhar_feed: form.get("feed") === "on",
    capa_s: String(form.get("capa_s") ?? "").trim() && Number.isFinite(capa) && capa >= 0 ? Math.round(capa * 10) / 10 : null,
  };
}

/** Guarda a legenda que ele mexeu (sem postar). */
export async function salvarPostagem(form: FormData) {
  await exigirEquipe();
  const id = limpo(form.get("id"), 60);
  const edicaoId = limpo(form.get("edicao_id"), 60);
  const db = createAdminClient();
  const { error } = await db.from("postagem").update(camposDoForm(form)).eq("id", id).in("status", ["pronta", "erro"]);
  voltar(edicaoId, error ? `não salvou: ${error.message}` : undefined);
}

/** O botão: salva o que está na tela e manda pro Instagram. O resto o servidor acompanha. */
export async function postarAgora(form: FormData) {
  await exigirEquipe();
  const id = limpo(form.get("id"), 60);
  const edicaoId = limpo(form.get("edicao_id"), 60);
  const campos = camposDoForm(form);
  if (!campos.legenda) voltar(edicaoId, "a legenda está vazia");
  const db = createAdminClient();
  await db.from("postagem").update(campos).eq("id", id).in("status", ["pronta", "erro"]);
  try {
    await enviarPostagem(id);
  } catch (e) {
    voltar(edicaoId, (e as Error).message);
  }
  // Acompanha de perto nos primeiros minutos (o relógio do servidor também confere a cada 15 s)
  after(async () => {
    for (let k = 0; k < 60; k++) {
      await new Promise((ok) => setTimeout(ok, 5000));
      const { data: p } = await createAdminClient().from("postagem").select("id, status, container_id, enviado_em").eq("id", id).maybeSingle();
      if (!p || p.status !== "processando") return;
      if ((await avancarPostagem(p)) !== "esperando") return;
    }
  });
  voltar(edicaoId);
}

/** Põe a palavra do CTA na automação de comentários (quem comentar recebe a DM). */
export async function palavraNaAutomacao(form: FormData) {
  await exigirEquipe();
  const edicaoId = limpo(form.get("edicao_id"), 60);
  const automacaoId = limpo(form.get("automacao_id"), 60);
  const palavra = limpo(form.get("palavra"), 40);
  if (!palavra) voltar(edicaoId, "sem palavra");
  const db = createAdminClient();
  const { data: a } = await db.from("ig_automacao").select("id, palavras").eq("id", automacaoId).maybeSingle();
  if (!a) voltar(edicaoId, "automação não encontrada");
  const palavras: string[] = a?.palavras ?? [];
  if (!palavras.some((p) => palavraNormal(p) === palavraNormal(palavra))) {
    const { error } = await db.from("ig_automacao").update({ palavras: [...palavras, palavra] }).eq("id", automacaoId);
    if (error) voltar(edicaoId, `não deu pra pôr a palavra: ${error.message}`);
  }
  revalidatePath("/instagram");
  voltar(edicaoId);
}

/** Cria a entrega do material deste vídeo (a estação escreve o rascunho) e abre ela. */
export async function entregaDoVideo(form: FormData) {
  await exigirEquipe();
  const edicaoId = limpo(form.get("edicao_id"), 60);
  const palavra = limpo(form.get("palavra"), 40);
  const pedido = limpo(form.get("pedido"), 12000);
  const db = createAdminClient();
  const { data: ed } = await db.from("edicao").select("id, titulo").eq("id", edicaoId).maybeSingle();
  if (!ed) voltar(edicaoId, "edição não encontrada");
  const base = slugDe(palavra || ed!.titulo) || "material";
  let slug = base;
  for (let k = 2; k < 50; k++) {
    const { data: tem } = await db.from("entrega").select("id").eq("slug", slug).maybeSingle();
    if (!tem) break;
    slug = `${base}-${k}`.slice(0, 40);
  }
  const { data: nova, error } = await db
    .from("entrega")
    .insert({ slug, palavra: palavra || null, titulo: "", pedido: pedido || null, edicao_id: edicaoId, status: "aguardando_estacao", etapa: "na fila da estação: o Claude monta o material" })
    .select("id")
    .single();
  if (error || !nova) voltar(edicaoId, `não criou a entrega: ${error?.message}`);
  revalidatePath("/materiais");
  redirect(`/materiais/${nova!.id}`);
}
