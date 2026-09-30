"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { FUNCOES_SOM, NOMES_RESERVADOS, VOLUMES_SOM } from "@/lib/editor";

// "Meus sons": a biblioteca de efeitos do editor (criador.edicao_som + bucket "edicao"/sons).
// A estação baixa os ativos a cada edição e nivela o volume; o principal de cada função entra sozinho.
// O arquivo vai do navegador direto pro storage (link assinado): aqui só valida e registra.

const BUCKET = "edicao";
const MAX_BYTES = 20 * 1024 * 1024;
const funcaoValida = (f: unknown) => (FUNCOES_SOM.some((x) => x.funcao && x.funcao === f) ? String(f) : null);
const slug = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{2,4}$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

export type PedidoSom = {
  nome: string; // o que a pessoa digitou (vazio = nome do arquivo)
  arquivo: string; // nome do arquivo no PC
  tipo: string;
  tamanho: number;
  funcao: string;
  descricao: string;
  volume: string;
  principal: boolean;
};
type Conferido = { nome: string; caminho: string; funcao: string | null; descricao: string; volume: number };

async function conferir(p: PedidoSom): Promise<Conferido | { erro: string }> {
  if (!(p.tamanho > 0)) return { erro: "escolha o arquivo do som" };
  if (p.tamanho > MAX_BYTES) return { erro: "som maior que 20 MB" };
  const ext = (String(p.arquivo).match(/\.(mp3|wav|m4a|aac|ogg|flac|mp4|mov)$/i)?.[1] ?? "").toLowerCase();
  if (!ext && !String(p.tipo).startsWith("audio")) return { erro: "mande um arquivo de áudio (mp3, wav, m4a…)" };
  const nome = slug(String(p.nome ?? "").trim() || String(p.arquivo));
  if (nome.length < 2) return { erro: "dê um nome pro som" };
  if (NOMES_RESERVADOS.includes(nome)) return { erro: `"${nome}" é nome de função; use algo como "${nome}-meu"` };
  const descricao = String(p.descricao ?? "").trim().slice(0, 300);
  if (!descricao) return { erro: "escreva quando usar esse som" };
  const volume = VOLUMES_SOM.find((v) => String(v.valor) === String(p.volume))?.valor ?? 1;
  const { data: existe } = await createAdminClient().from("edicao_som").select("id").eq("nome", nome).maybeSingle();
  if (existe) return { erro: `já tem um som chamado "${nome}"` };
  return { nome, caminho: `sons/${nome}.${ext || "mp3"}`, funcao: funcaoValida(p.funcao), descricao, volume };
}

/** 1º passo: confere e devolve o link pra subir o arquivo direto pro storage. */
export async function prepararSom(p: PedidoSom): Promise<{ url: string; nome: string } | { erro: string }> {
  try {
    await exigirEquipe();
    const c = await conferir(p);
    if ("erro" in c) return c;
    const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(c.caminho, { upsert: true });
    if (error || !data) return { erro: `link de envio: ${error?.message}` };
    return { url: data.signedUrl, nome: c.nome };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** 2º passo: o arquivo subiu, entra na biblioteca. */
export async function registrarSom(p: PedidoSom): Promise<{ ok: string } | { erro: string }> {
  try {
    await exigirEquipe();
    const c = await conferir(p);
    if ("erro" in c) return c;
    const db = createAdminClient();
    const { data: som, error } = await db
      .from("edicao_som")
      .insert({ nome: c.nome, funcao: c.funcao, principal: false, descricao: c.descricao, origem: "criador", arquivo: c.caminho, tipo: p.tipo || null, tamanho: p.tamanho, volume: c.volume })
      .select("id")
      .single();
    if (error || !som) {
      await db.storage.from(BUCKET).remove([c.caminho]);
      return { erro: error?.message ?? "erro ao salvar" };
    }
    if (c.funcao && p.principal) await soEstePrincipal(som.id, c.funcao);
    revalidatePath("/editor/sons");
    return { ok: `"${c.nome}" entrou na biblioteca` };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Deixa só um principal por função. */
async function soEstePrincipal(id: string, funcao: string) {
  const db = createAdminClient();
  await db.from("edicao_som").update({ principal: false }).eq("funcao", funcao).neq("id", id);
  await db.from("edicao_som").update({ principal: true, ativo: true }).eq("id", id);
}

export async function tornarPrincipal(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const { data: som } = await createAdminClient().from("edicao_som").select("funcao").eq("id", id).single();
  if (som?.funcao) await soEstePrincipal(id, som.funcao);
  revalidatePath("/editor/sons");
}

export async function mudarVolume(formData: FormData) {
  await exigirEquipe();
  const volume = VOLUMES_SOM.find((v) => String(v.valor) === String(formData.get("volume")))?.valor;
  if (volume) await createAdminClient().from("edicao_som").update({ volume }).eq("id", String(formData.get("id")));
  revalidatePath("/editor/sons");
}

export async function alternarSom(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: som } = await db.from("edicao_som").select("ativo").eq("id", id).single();
  if (som) await db.from("edicao_som").update({ ativo: !som.ativo, ...(som.ativo ? { principal: false } : {}) }).eq("id", id);
  revalidatePath("/editor/sons");
}

export async function apagarSom(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: som } = await db.from("edicao_som").select("arquivo").eq("id", id).single();
  if (som?.arquivo) await db.storage.from(BUCKET).remove([som.arquivo]);
  await db.from("edicao_som").delete().eq("id", id);
  revalidatePath("/editor/sons");
}
