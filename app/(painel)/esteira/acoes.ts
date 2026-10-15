"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient, exigirEquipe } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { esquecerConfig, salvarConfig } from "@/lib/config";
import type { EnvioParte } from "@/lib/editor";
import { BUCKET, MAX_BYTES, MAX_SLIDES, analisarComTrava, buscarDeNovo, caminhoNovo, referenciaPorLink } from "@/lib/esteira/referencia";
import { gerarRoteiro } from "@/lib/esteira/criacao";
import { conferirReferencias, ehVideo as ehVideoSlide, referenciasDoCarrossel, tipoDoArquivo } from "@/lib/esteira/carrossel";
import { atualizarPersona, lerPersona } from "@/lib/esteira/persona";
import { ETAPAS, TRAVOU_MS, ehTipoDeSlide } from "./regras";

// Ações da Esteira. Arquivo (vídeo ou prints) nunca passa por aqui: o navegador sobe direto
// pro bucket com o link assinado que `linksDeEnvio` cria, e depois avisa quais caminhos subiu.
// A análise (1 a 3 min) roda depois da resposta, com after(); a página se atualiza sozinha.

const LINK_POST = /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+/i;
const CAMINHO = /^\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(mp4|png|jpg|webp)$/;
const IMAGEM = /^image\/(png|jpeg|webp)$/;

const volta = (id: string, erro?: string) => (erro ? `/esteira/${id}?erro=${encodeURIComponent(erro.slice(0, 200))}` : `/esteira/${id}`);
const analisarDepois = (id: string) => after(() => analisarComTrava(id).catch((e) => console.error("[esteira]", (e as Error).message)));

export async function moverReferencia(formData: FormData) {
  const etapa = String(formData.get("etapa"));
  if (!ETAPAS.some((e) => e.etapa === etapa)) return;
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
    })
    .eq("id", String(formData.get("id")));
  revalidatePath("/esteira", "layout");
}

/** Roda a análise de novo (ex.: depois de um erro, ou com prints novos). */
export async function reanalisar(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  await createAdminClient().from("referencia").update({ tentativas: 0, erro: null, analise: null, assistido: null }).eq("id", id);
  analisarDepois(id);
  revalidatePath("/esteira", "layout");
  redirect(volta(id));
}

export async function apagarReferencia(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: r } = await db.from("referencia").select("arquivo, slides").eq("id", id).single();
  const arquivos = [r?.arquivo, ...(r?.slides ?? [])].filter((c): c is string => Boolean(c));
  // A cópia do carrossel (PNG e MP4, com as capas dos vídeos) vai junto
  const { data: c } = await db.from("referencia").select("copia_cli").eq("id", id).maybeSingle();
  const copia = ((c?.copia_cli as { arquivos?: string[] } | null)?.arquivos ?? []).filter((a) => a.startsWith("carrosseis/"));
  arquivos.push(...copia, ...copia.filter(ehVideoSlide).map((a) => a.replace(/\.[^.]+$/, ".png")));
  if (arquivos.length) await db.storage.from(BUCKET).remove(arquivos);
  await db.from("referencia").delete().eq("id", id);
  revalidatePath("/esteira", "layout");
  redirect("/esteira");
}

// ── referência nova ─────────────────────────────────────────────────

/** Pelo link do post: busca pela API da Meta (se der) e já manda analisar. */
export async function adicionarPorLink(formData: FormData) {
  await exigirEquipe();
  const url = String(formData.get("url") ?? "").trim();
  if (!LINK_POST.test(url)) redirect(`/esteira?erro=${encodeURIComponent("cole o link de um reel ou post do Instagram (instagram.com/reel/… ou /p/…)")}`);
  let id: string;
  try {
    id = await referenciaPorLink({ url, notas: String(formData.get("notas") ?? "") });
  } catch (e) {
    redirect(`/esteira?erro=${encodeURIComponent((e as Error).message.slice(0, 200))}`);
  }
  const { data: ref } = await createAdminClient().from("referencia").select("arquivo, aguardando_video").eq("id", id).single();
  if (ref?.arquivo && !ref.aguardando_video) analisarDepois(id);
  revalidatePath("/esteira", "layout");
  redirect(volta(id));
}

export type ArquivoEnvio = { tipo: string; tamanho: number };

/**
 * Confere o lote e cria um link de envio por arquivo: 1 vídeo (reel) ou, com `carrossel`, até 20
 * slides (fotos PNG/JPG/WEBP e vídeos misturados, na ordem).
 */
export async function linksDeEnvio(arquivos: ArquivoEnvio[], carrossel = false): Promise<{ envios: EnvioParte[] } | { erro: string }> {
  try {
    await exigirEquipe();
    if (!Array.isArray(arquivos) || !arquivos.length) return { erro: carrossel ? "escolha as fotos e os vídeos dos slides" : "escolha o vídeo ou os prints" };
    const videos = arquivos.filter((a) => String(a.tipo).startsWith("video/"));
    if (carrossel) {
      if (arquivos.some((a) => !ehTipoDeSlide(String(a.tipo)))) return { erro: "os slides têm que ser foto (PNG, JPG ou WEBP) ou vídeo" };
    } else {
      if (videos.length && arquivos.length > 1) return { erro: "é um vídeo só (reel) ou só prints (carrossel), não os dois juntos" };
      if (!videos.length && arquivos.some((a) => !IMAGEM.test(String(a.tipo)))) return { erro: "os prints têm que ser PNG, JPG ou WEBP" };
    }
    if (arquivos.length > MAX_SLIDES) return { erro: `no máximo ${MAX_SLIDES} slides, contando a capa` };
    for (const a of arquivos) {
      if (!(a.tamanho > 0)) return { erro: "tem arquivo vazio" };
      if (a.tamanho > MAX_BYTES) return { erro: `arquivo maior que ${Math.round(MAX_BYTES / 1048576)} MB${videos.length ? ": exporte o vídeo em 1080p" : ""}` };
    }
    const storage = createAdminClient().storage.from(BUCKET);
    const envios: EnvioParte[] = [];
    for (const a of arquivos) {
      const caminho = caminhoNovo(a.tipo);
      const { data, error } = await storage.createSignedUploadUrl(caminho, { upsert: true });
      if (error || !data) return { erro: `link de envio: ${error?.message}` };
      envios.push({ caminho, url: data.signedUrl });
    }
    return { envios };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** `carrossel`: os arquivos são slides (fotos e vídeos misturados), não o vídeo de um reel. */
type Subidos = { caminhos: string[]; tipos: string[]; carrossel?: boolean };

function conferirSubidos(s: Subidos): string | null {
  if (!Array.isArray(s.caminhos) || !s.caminhos.length || s.caminhos.length > MAX_SLIDES) return "nenhum arquivo subiu";
  if (s.caminhos.some((c) => !CAMINHO.test(String(c)))) return "caminho de arquivo inválido";
  if (!Array.isArray(s.tipos) || s.tipos.length !== s.caminhos.length) return "tipos não batem com os arquivos";
  return null;
}

/** Os arquivos subiram: cria a referência (reel ou carrossel) e manda analisar. */
export async function novaReferenciaPorArquivo(d: Subidos & { notas?: string; autor?: string; url?: string }): Promise<{ id: string } | { erro: string }> {
  try {
    await exigirEquipe();
    const problema = conferirSubidos(d);
    if (problema) return { erro: problema };
    const video = !d.carrossel && d.tipos[0].startsWith("video/");
    const url = String(d.url ?? "").trim().split("?")[0];
    const { data, error } = await createAdminClient()
      .from("referencia")
      .insert({
        origem: "upload",
        tipo: video ? "reel" : "carrossel",
        url: LINK_POST.test(url) ? url : null,
        autor: String(d.autor ?? "").trim().replace(/^@/, "") || null,
        notas: String(d.notas ?? "").trim().slice(0, 2000) || null,
        arquivo: d.caminhos[0],
        arquivo_tipo: d.tipos[0],
        slides: video ? [] : d.caminhos.slice(1),
      })
      .select("id")
      .single();
    if (error || !data) return { erro: `não consegui guardar: ${error?.message}` };
    analisarDepois(data.id);
    revalidatePath("/esteira", "layout");
    return { id: data.id };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/**
 * O arquivo que faltava numa referência: o vídeo do reel, ou os slides do carrossel (fotos e
 * vídeos; somam aos que já estão, ou substituem todos). A análise recomeça com tudo.
 */
export async function completarReferencia(d: Subidos & { id: string; substituir?: boolean }): Promise<{ ok: true } | { erro: string }> {
  try {
    await exigirEquipe();
    const problema = conferirSubidos(d);
    if (problema) return { erro: problema };
    const db = createAdminClient();
    const { data: ref } = await db.from("referencia").select("id, tipo, arquivo, arquivo_tipo, slides").eq("id", d.id).single();
    if (!ref) return { erro: "referência não encontrada" };
    const video = !d.carrossel && d.tipos[0].startsWith("video/");
    const recomecar = { aguardando_video: false, sem_video_motivo: null, tentativas: 0, erro: null, analise: null, assistido: null };
    const antigos = [ref.arquivo, ...(ref.slides ?? [])].filter((c): c is string => Boolean(c));

    if (video) {
      await db.from("referencia").update({ ...recomecar, tipo: "reel", arquivo: d.caminhos[0], arquivo_tipo: d.tipos[0], slides: [] }).eq("id", d.id);
      if (antigos.length) await db.storage.from(BUCKET).remove(antigos);
    } else {
      // Sem arquivo, com o vídeo de um reel no lugar, ou pedindo pra substituir: o 1º slide vira
      // a capa. Senão, entram depois dos que já estão (atômico: dois envios juntos não se perdem).
      const eraReel = ref.tipo === "reel" || (!d.carrossel && Boolean(ref.arquivo_tipo?.includes("video") || ref.arquivo?.endsWith(".mp4")));
      const trocar = d.substituir || !ref.arquivo || eraReel;
      if (trocar) {
        const todos = d.caminhos.slice(0, MAX_SLIDES);
        await db
          .from("referencia")
          .update({ ...recomecar, tipo: ref.tipo === "reel" ? "carrossel" : ref.tipo === "post" && todos.length > 1 ? "carrossel" : ref.tipo, arquivo: todos[0], arquivo_tipo: d.tipos[0], slides: todos.slice(1) })
          .eq("id", d.id);
        const sobra = antigos.filter((c) => !todos.includes(c));
        if (sobra.length) await db.storage.from(BUCKET).remove(sobra);
      } else {
        const { error } = await db.rpc("anexar_slides_carrossel", { p_referencia: d.id, p_caminhos: d.caminhos, p_tipo_capa: d.tipos[0] });
        if (error) {
          await db.storage.from(BUCKET).remove(d.caminhos);
          return { erro: error.message };
        }
      }
    }
    analisarDepois(d.id);
    revalidatePath("/esteira", "layout");
    return { ok: true };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** "Buscar de novo": pela API da Meta (ex.: depois de conectar o Facebook). */
export async function buscarDeNovoAcao(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const achou = await buscarDeNovo(id).catch(() => false);
  if (achou) analisarDepois(id);
  revalidatePath("/esteira", "layout");
  redirect(achou ? volta(id) : volta(id, "ainda não veio: veja o motivo e suba o arquivo"));
}

// ── criação ─────────────────────────────────────────────────────────

/** "Criar roteiro" de um reel: a sua versão do formato, na sua voz. */
export async function criarRoteiro(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  let erro: string | undefined;
  try {
    await gerarRoteiro(id, String(formData.get("pedido") ?? ""));
  } catch (e) {
    erro = `roteiro: ${(e as Error).message}`;
  }
  revalidatePath(`/esteira/${id}`);
  redirect(erro ? volta(id, erro) : `${volta(id)}#roteiro`);
}

/**
 * "Copiar carrossel": só põe o pedido na fila da estação (o seu PC), com a lista dos slides
 * congelada na ordem de agora. A IA de "Quem edita" faz a arte lá; a página acompanha sozinha.
 */
export async function copiarCarrosselAcao(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  let erro: string | undefined;
  try {
    const db = createAdminClient();
    const { data: ref } = await db.from("referencia").select("id, tipo, arquivo, slides").eq("id", id).single();
    if (!ref) throw new Error("referência não encontrada");
    if (ref.tipo === "reel") throw new Error("essa referência é um reel");
    const referencias = referenciasDoCarrossel(ref);
    conferirReferencias(referencias, Number(formData.get("total_esperado")));
    const { error } = await db.from("carrossel_trabalho").insert({
      referencia_id: id,
      headline: String(formData.get("headline") ?? "").trim().slice(0, 500) || null,
      modo_texto: formData.get("modo_texto") === "reformular" ? "reformular" : "traduzir",
      pedido: String(formData.get("pedido") ?? "").trim().slice(0, 5000) || null,
      referencias,
    });
    if (error?.code === "23505") throw new Error("esse carrossel já está na fila ou sendo feito");
    if (error) throw new Error(/carrossel_trabalho|schema cache/i.test(error.message) ? "falta rodar a migration 004 (carrosséis) no banco" : error.message);
  } catch (e) {
    erro = `cópia: ${(e as Error).message}`;
  }
  revalidatePath(`/esteira/${id}`);
  redirect(erro ? volta(id, erro) : `${volta(id)}#copia`);
}

/** A ordem dos slides (e os que saem): só com arquivos que já são desta referência. */
export async function ordenarSlides(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: ref } = await db.from("referencia").select("arquivo, slides").eq("id", id).single();
  if (!ref) redirect(volta(id, "referência não encontrada"));
  const atuais = referenciasDoCarrossel(ref);
  let caminhos: unknown = [];
  try {
    caminhos = JSON.parse(String(formData.get("ordem")));
  } catch {}
  if (!Array.isArray(caminhos) || !caminhos.length || new Set(caminhos).size !== caminhos.length || caminhos.some((c) => !atuais.includes(c)))
    redirect(volta(id, "ordem inválida"));
  const lista = caminhos as string[];
  const { error } = await db
    .from("referencia")
    .update({ arquivo: lista[0], arquivo_tipo: tipoDoArquivo(lista[0]), slides: lista.slice(1), analise: null, assistido: null, tentativas: 0, erro: null })
    .eq("id", id);
  if (error) redirect(volta(id, error.message));
  // Os que saíram da seleção ficam no storage: um pedido de cópia já na fila pode usar
  analisarDepois(id);
  revalidatePath("/esteira", "layout");
  redirect(volta(id));
}

// ── persona ─────────────────────────────────────────────────────────

/** Refaz o guia da sua voz a partir dos seus últimos reels (em segundo plano: uns minutos). */
export async function atualizarPersonaAcao() {
  await exigirEquipe();
  // Já está rodando (e começou há pouco): não dispara outra
  const { data: cfg } = await createAdminClient().from("configuracao").select("valor, atualizado_em").eq("chave", "persona").maybeSingle();
  if ((cfg?.valor as { status?: string } | null)?.status === "atualizando" && Date.now() - new Date(cfg!.atualizado_em).getTime() < TRAVOU_MS) redirect("/esteira#persona");
  esquecerConfig("persona"); // lê do banco, não do cache de 30 s
  const persona = await lerPersona();
  await salvarConfig("persona", { ...persona, status: "atualizando", erro: undefined });
  after(() => atualizarPersona().catch((e) => console.error("[persona]", (e as Error).message)));
  revalidatePath("/esteira");
  redirect("/esteira#persona");
}

/** O guia editado à mão. */
export async function salvarGuia(formData: FormData) {
  await exigirEquipe();
  const guia = String(formData.get("guia") ?? "").trim().slice(0, 20000);
  esquecerConfig("persona");
  const persona = await lerPersona();
  await salvarConfig("persona", {
    ...persona,
    guia: guia || undefined,
    ...(persona.status === "atualizando" ? {} : { status: guia ? "ok" : undefined, erro: undefined }),
  });
  revalidatePath("/esteira");
  redirect("/esteira#persona");
}
