"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, exigirEquipe } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { salvarConfig } from "@/lib/config";
import { analisarReferencia, guardarArquivo } from "@/lib/instagram/esteira";
import { enfileirarCarrossel } from "@/lib/carrossel/servidor";
import { MAX_SLIDES_CARROSSEL, referenciasDoCarrossel, tipoDoArquivo } from "@/lib/carrossel/comum";
import { obterCarrosselPorLink } from "@/lib/carrossel/importar";
import { atualizarMinhaVoz, lerVoz } from "@/lib/esteira/voz";

const ETAPAS = ["nova", "analisada", "vou_gravar", "gravado", "postado", "descartada"];

export async function moverReferencia(formData: FormData) {
  const etapa = String(formData.get("etapa"));
  if (!ETAPAS.includes(etapa)) return;
  const supabase = await createClient();
  await supabase.from("referencia").update({ etapa }).eq("id", String(formData.get("id")));
  revalidatePath("/esteira", "layout");
}

export async function salvarReferencia(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("referencia")
    .update({
      notas: String(formData.get("notas") ?? "").trim() || null,
      autor: String(formData.get("autor") ?? "").trim().replace(/^@/, "") || null,
      url: String(formData.get("url") ?? "").trim() || null,
      // Só o formulário do carrossel manda a palavra do CTA
      ...(formData.has("palavra_cta") ? { palavra_cta: String(formData.get("palavra_cta")).trim().replace(/["“”]/g, "").toUpperCase() || null } : {}),
    })
    .eq("id", String(formData.get("id")));
  revalidatePath("/esteira", "layout");
}

/** Roda a análise de novo agora (ex.: depois de um erro). */
export async function reanalisar(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  await db.from("referencia").update({ tentativas: 0, erro: null }).eq("id", id);
  try {
    await analisarReferencia(id);
  } catch (e) {
    await db.from("referencia").update({ erro: `análise: ${(e as Error).message}`.slice(0, 500) }).eq("id", id);
  }
  revalidatePath("/esteira", "layout");
}

export async function apagarReferencia(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: r } = await db.from("referencia").select("arquivo").eq("id", id).single();
  if (r?.arquivo) await db.storage.from("esteira").remove([r.arquivo]);
  await db.from("referencia").delete().eq("id", id);
  redirect("/esteira");
}

/** Sobe um vídeo/print do computador (quando não veio pela DM). A IA analisa em seguida. */
export async function subirReferencia(formData: FormData) {
  await exigirEquipe();
  const entradas = formData.getAll("arquivo").filter((f): f is File => f instanceof File && f.size > 0);
  const arquivo = entradas[0];
  if (!(arquivo instanceof File) || !arquivo.size) redirect("/esteira?erro=escolha+um+arquivo");
  if (arquivo.size > 45 * 1024 * 1024) redirect("/esteira?erro=arquivo+maior+que+45+MB");
  if (entradas.length > MAX_SLIDES_CARROSSEL) redirect("/esteira?erro=envie+até+20+slides");
  if (entradas.length > 1 && entradas.some(f => !f.type.startsWith("image/"))) redirect("/esteira?erro=selecione+um+vídeo+ou+as+imagens+do+carrossel");
  if (entradas.reduce((n, f) => n + f.size, 0) > 45 * 1024 * 1024) redirect("/esteira?erro=conjunto+maior+que+45+MB");
  const db = createAdminClient();
  const tipoMime = arquivo.type || "application/octet-stream";
  const ext = tipoMime.includes("video") ? "mp4" : tipoMime.includes("png") ? "png" : "jpg";
  const caminho = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
  const up = await db.storage.from("esteira").upload(caminho, Buffer.from(await arquivo.arrayBuffer()), { contentType: tipoMime });
  if (up.error) redirect(`/esteira?erro=${encodeURIComponent(up.error.message)}`);
  const slides: string[] = [];
  try {
    for (const f of entradas.slice(1)) slides.push(await guardarArquivo(db, Buffer.from(await f.arrayBuffer()), f.type));
  } catch (e) { redirect(`/esteira?erro=${encodeURIComponent((e as Error).message)}`); }
  const { data } = await db
    .from("referencia")
    .insert({
      origem: "manual",
      tipo: tipoMime.includes("video") ? "reel" : "carrossel",
      arquivo: caminho,
      arquivo_tipo: tipoMime,
      slides,
      url: String(formData.get("url") ?? "").trim() || null,
      autor: String(formData.get("autor") ?? "").trim().replace(/^@/, "") || null,
      notas: String(formData.get("notas") ?? "").trim() || null,
      enviado_por: "painel",
    })
    .select("id")
    .single();
  redirect(`/esteira/${data!.id}`);
}

const volta = (id: string, erro?: string) => (erro ? `/esteira/${id}?erro=${encodeURIComponent(erro.slice(0, 200))}` : `/esteira/${id}`);

// O "Criar roteiro" do reel virou roteiro pra teleprompter (06/10): roteiroDaEsteira, em
// app/(painel)/roteiros/acoes.ts, com o padrão viral e a checagem anti-IA.

/** O botão entrega o trabalho ao CLI no PC; a requisição termina sem esperar a criação. */
export async function copiarCarrosselAcao(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  let erro: string | undefined;
  try {
    await enfileirarCarrossel(id, {
      agente: formData.get("agente") === "claude" ? "claude" : "codex",
      headline: String(formData.get("headline") ?? ""),
      modoTexto: formData.get("modo_texto") === "traduzir" ? "traduzir" : "reformular",
      pedido: String(formData.get("pedido") ?? ""),
      totalEsperado: Number(formData.get("total_esperado")),
    });
  } catch (e) {
    erro = `cópia: ${(e as Error).message}`;
  }
  revalidatePath(`/esteira/${id}`);
  redirect(erro ? volta(id, erro) : `${volta(id)}#copia`);
}

/** Refaz o guia da voz a partir dos últimos reels (em segundo plano: uns minutos). */
export async function atualizarVoz() {
  await exigirEquipe();
  const voz = await lerVoz();
  if (voz.status === "atualizando") return;
  await salvarConfig("persona", { ...voz, status: "atualizando", erro: undefined });
  after(() => atualizarMinhaVoz().catch((e) => console.error("[voz]", (e as Error).message)));
  revalidatePath("/esteira");
}

/** O vídeo de um reel que chegou só como link (a Meta não entrega vídeo de outra conta). */
export async function subirVideoDaReferencia(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.size) redirect(volta(id, "escolha o vídeo"));
  if (!arquivo.type.startsWith("video/")) redirect(volta(id, "esse arquivo não é vídeo"));
  if (arquivo.size > 45 * 1024 * 1024) redirect(volta(id, "vídeo maior que 45 MB"));
  const db = createAdminClient();
  let caminho: string;
  try {
    caminho = await guardarArquivo(db, Buffer.from(await arquivo.arrayBuffer()), arquivo.type);
  } catch (e) {
    redirect(volta(id, (e as Error).message));
  }
  await db
    .from("referencia")
    .update({ arquivo: caminho, arquivo_tipo: arquivo.type, aguardando_video: false, tentativas: 0, erro: null, analise: null, assistido: null })
    .eq("id", id);
  revalidatePath("/esteira", "layout");
  redirect(volta(id));
}

const MAX_SLIDE_BYTES = 45 * 1024 * 1024;
const CAMINHO_SUBIDO = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(png|jpg|webp|mp4)$/;

/**
 * Slides do carrossel (fotos e vídeos) direto do navegador pro storage, sem passar pelo teto de
 * 50 MB do servidor: aqui só saem os links de envio. Com `id`, os arquivos completam um carrossel.
 */
export async function linksDosSlides(arquivos: Array<{ tipo: string; tamanho: number }>, id?: string): Promise<{ erro?: string; envios?: Array<{ caminho: string; url: string }> }> {
  await exigirEquipe();
  if (!arquivos.length) return { erro: "Escolha as fotos e os vídeos do carrossel." };
  const db = createAdminClient();
  let ja = 0;
  if (id) {
    const { data: ref } = await db.from("referencia").select("arquivo, slides").eq("id", id).single();
    if (!ref) return { erro: "Referência não encontrada." };
    ja = referenciasDoCarrossel(ref).length;
  }
  if (ja + arquivos.length > MAX_SLIDES_CARROSSEL) return { erro: `O carrossel tem até ${MAX_SLIDES_CARROSSEL} slides, contando a capa.` };
  const dia = new Date().toISOString().slice(0, 10);
  const envios = [];
  for (const [i, a] of arquivos.entries()) {
    if (!/^(image\/(png|jpeg|webp)|video\/)/.test(a.tipo)) return { erro: `Arquivo ${i + 1}: use foto (PNG, JPG, WEBP) ou vídeo.` };
    if (!(a.tamanho > 0) || a.tamanho > MAX_SLIDE_BYTES) return { erro: `Arquivo ${i + 1}: até 45 MB por arquivo.` };
    const ext = a.tipo.startsWith("video/") ? "mp4" : a.tipo === "image/png" ? "png" : a.tipo === "image/webp" ? "webp" : "jpg";
    const caminho = `${dia}/${randomUUID()}.${ext}`;
    const { data, error } = await db.storage.from("esteira").createSignedUploadUrl(caminho, { upsert: true });
    if (error || !data) return { erro: `link de envio: ${error?.message}` };
    envios.push({ caminho, url: data.signedUrl });
  }
  return { envios };
}

/** Os arquivos subiram: vira um carrossel novo (na ordem) ou completa o carrossel `id`. */
export async function salvarSlidesSubidos(p: { id?: string; caminhos: string[]; autor?: string; url?: string; notas?: string }): Promise<{ erro?: string; id?: string }> {
  await exigirEquipe();
  const caminhos = p.caminhos ?? [];
  if (!caminhos.length || caminhos.length > MAX_SLIDES_CARROSSEL || caminhos.some((c) => !CAMINHO_SUBIDO.test(c))) return { erro: "Envio inválido." };
  const db = createAdminClient();
  const { data: conferidos } = await db.storage.from("esteira").createSignedUrls(caminhos, 60);
  if (!conferidos || conferidos.some((c) => c.error || !c.signedUrl)) return { erro: "Algum arquivo não terminou de subir. Envie de novo." };
  let id = p.id;
  if (id) {
    const { error } = await db.rpc("anexar_slides_carrossel", { ref_id: id, caminhos });
    if (error) return { erro: error.message };
  } else {
    const { data, error } = await db
      .from("referencia")
      .insert({
        origem: "manual",
        tipo: "carrossel",
        arquivo: caminhos[0],
        arquivo_tipo: tipoDoArquivo(caminhos[0]),
        slides: caminhos.slice(1),
        url: p.url?.trim() || null,
        autor: p.autor?.trim().replace(/^@/, "") || null,
        notas: p.notas?.trim() || null,
        enviado_por: "painel",
      })
      .select("id")
      .single();
    if (error || !data) return { erro: error?.message ?? "Não consegui salvar o carrossel." };
    id = data.id as string;
  }
  revalidatePath("/esteira", "layout");
  return { id };
}

/** Ordem dos prints: usa somente arquivos já pertencentes a esta referência. */
export async function ordenarSlides(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: ref } = await db.from("referencia").select("arquivo, slides").eq("id", id).single();
  if (!ref) redirect(volta(id, "Referência não encontrada."));
  const atuais = referenciasDoCarrossel(ref);
  let caminhos: string[] = [];
  try { caminhos = JSON.parse(String(formData.get("ordem"))); } catch {}
  if (!Array.isArray(caminhos) || !caminhos.length || new Set(caminhos).size !== caminhos.length || caminhos.some(c => !atuais.includes(c))) redirect(volta(id, "Ordem inválida."));
  const { error } = await db.from("referencia").update({ arquivo: caminhos[0], arquivo_tipo: tipoDoArquivo(caminhos[0]), slides: caminhos.slice(1), analise: null, tentativas: 0, erro: null }).eq("id", id);
  if (error) redirect(volta(id, error.message));
  revalidatePath("/esteira", "layout");
  redirect(volta(id));
}

/** Busca cada filho do carrossel: a capa sozinha nunca é considerada importação completa. */
export async function importarCarrosselLink(formData: FormData) {
  await exigirEquipe();
  const db = createAdminClient();
  let id = "";
  let erro: string | undefined;
  const caminhos: string[] = [];
  try {
    const post = await obterCarrosselPorLink(String(formData.get("url") ?? ""));
    for (const m of post.midias) {
      const r = await fetch(m.url, { signal: AbortSignal.timeout(m.video ? 90_000 : 25_000) });
      if (!r.ok) throw new Error("Não consegui baixar todos os slides. Tente de novo ou suba os arquivos.");
      caminhos.push(await guardarArquivo(db, Buffer.from(await r.arrayBuffer()), m.video ? "video/mp4" : r.headers.get("content-type")));
    }
    const { data, error } = await db.from("referencia").insert({ origem: "manual", tipo: "carrossel", arquivo: caminhos[0], arquivo_tipo: tipoDoArquivo(caminhos[0]), slides: caminhos.slice(1), url: post.url, autor: post.autor, legenda: post.legenda, enviado_por: "painel" }).select("id").single();
    if (error || !data) throw new Error(error?.message ?? "Não consegui salvar a referência.");
    id = data.id;
  } catch (e) {
    erro = (e as Error).message;
    if (caminhos.length) await db.storage.from("esteira").remove(caminhos);
  }
  revalidatePath("/esteira", "layout");
  redirect(id ? `/esteira/${id}` : `/esteira?aba=carrosseis&erro=${encodeURIComponent(erro ?? "Não consegui importar.")}`);
}

/** "Buscar o vídeo de novo": pela API oficial (precisa do Facebook conectado). */
export async function buscarVideoAcao(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const { buscarVideoDeNovo } = await import("@/lib/instagram/esteira");
  await buscarVideoDeNovo(id).catch(() => false);
  revalidatePath("/esteira", "layout");
  redirect(volta(id));
}
