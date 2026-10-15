"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { enviarPostagem, passoDaPostagem } from "@/lib/postagem/publicar";
import { palavraNormal, slugDe } from "@/lib/entregas/blocos";

// O post do vídeo editado (cartão "Postar no Instagram" da página da edição). A legenda é escrita
// pela estação no seu PC (editor/estacao/escrita.mjs); o envio e a publicação, pelo servidor.

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
  const fila = { status: "aguardando_estacao", etapa: "na fila da estação: a IA escreve a legenda", erro: null };
  const { error } = p ? await db.from("postagem").update(fila).eq("id", p.id) : await db.from("postagem").insert({ edicao_id: edicaoId, palavra: ed?.cta_palavra ?? null, ...fila });
  voltar(edicaoId, error ? `não deu pra pedir a legenda: ${error.message}` : undefined);
}

function camposDoForm(form: FormData) {
  const bruto = String(form.get("capa_s") ?? "").trim().replace(",", ".");
  const capa = Number(bruto);
  return {
    legenda: limpo(form.get("legenda"), 2200),
    palavra: limpo(form.get("palavra"), 40) || null,
    compartilhar_feed: form.get("feed") === "on",
    capa_s: bruto && Number.isFinite(capa) && capa >= 0 ? Math.round(capa * 10) / 10 : null,
  };
}

/** Guarda a legenda que você mexeu (sem postar). */
export async function salvarPostagem(form: FormData) {
  await exigirEquipe();
  const id = limpo(form.get("id"), 60);
  const edicaoId = limpo(form.get("edicao_id"), 60);
  const { error } = await createAdminClient().from("postagem").update(camposDoForm(form)).eq("id", id).in("status", ["pronta", "erro"]);
  voltar(edicaoId, error ? `não salvou: ${error.message}` : undefined);
}

/** O botão: salva o que está na tela e cria o post no Instagram. O resto a página e o relógio acompanham. */
export async function postarAgora(form: FormData) {
  await exigirEquipe();
  const id = limpo(form.get("id"), 60);
  const edicaoId = limpo(form.get("edicao_id"), 60);
  const campos = camposDoForm(form);
  if (!campos.legenda) voltar(edicaoId, "a legenda está vazia");
  await createAdminClient().from("postagem").update(campos).eq("id", id).in("status", ["pronta", "erro"]);
  let erro: string | undefined;
  try {
    await enviarPostagem(id);
  } catch (e) {
    erro = (e as Error).message;
  }
  voltar(edicaoId, erro);
}

/** Um passo do processamento (a página chama enquanto o Instagram processa o vídeo). */
export async function conferirPostagem(id: string): Promise<string | null> {
  await exigirEquipe();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return passoDaPostagem(id);
}

/** Põe a palavra do CTA numa automação (quem comentar recebe a DM). */
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

/** Põe o post publicado numa automação que vale só pra posts escolhidos. */
export async function postNaAutomacao(form: FormData) {
  await exigirEquipe();
  const edicaoId = limpo(form.get("edicao_id"), 60);
  const automacaoId = limpo(form.get("automacao_id"), 60);
  const midia = limpo(form.get("midia_id"), 60);
  if (!midia) voltar(edicaoId, "o post ainda não tem id");
  const db = createAdminClient();
  const { data: a } = await db.from("ig_automacao").select("id, midias").eq("id", automacaoId).maybeSingle();
  if (!a) voltar(edicaoId, "automação não encontrada");
  const midias: string[] = a?.midias ?? [];
  if (!midias.includes(midia)) {
    const { error } = await db.from("ig_automacao").update({ midias: [...midias, midia] }).eq("id", automacaoId);
    if (error) voltar(edicaoId, `não deu pra pôr o post: ${error.message}`);
  }
  revalidatePath("/instagram");
  voltar(edicaoId);
}

/** Cria o material deste vídeo (a estação escreve o rascunho) e abre ele. */
export async function materialDoVideo(form: FormData) {
  await exigirEquipe();
  const edicaoId = limpo(form.get("edicao_id"), 60);
  const palavra = limpo(form.get("palavra"), 40);
  const pedido = limpo(form.get("pedido"), 12000);
  const db = createAdminClient();
  const { data: ed } = await db.from("edicao").select("id, titulo").eq("id", edicaoId).maybeSingle();
  if (!ed) voltar(edicaoId, "edição não encontrada");
  const base = slugDe(palavra || ed!.titulo) || "material";
  let slug = base.length >= 2 ? base : `${base}-material`;
  for (let k = 2; k < 50; k++) {
    const { data: tem } = await db.from("entrega").select("id").eq("slug", slug).maybeSingle();
    if (!tem) break;
    slug = `${base.slice(0, 36)}-${k}`;
  }
  const { data: nova, error } = await db
    .from("entrega")
    .insert({ slug, palavra: palavra || null, titulo: "", pedido: pedido || null, edicao_id: edicaoId, status: "aguardando_estacao", etapa: "na fila da estação: a IA monta o material" })
    .select("id")
    .single();
  if (error || !nova) voltar(edicaoId, `não criou o material: ${error?.message}`);
  revalidatePath("/materiais");
  redirect(`/materiais/${nova!.id}`);
}
