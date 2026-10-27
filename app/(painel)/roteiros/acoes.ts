"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { DURACAO_PADRAO, DURACOES } from "@/lib/roteiro/comum";
import { palavraLimpa } from "@/lib/roteiro/escrever";
import { linkValido } from "@/lib/roteiro/link";
import { lerPadrao, salvarPadrao, type ExemploViral } from "@/lib/roteiro/padrao-viral";
import { agendarRoteiro, BUCKET } from "@/lib/roteiro/processar";
import { salvarConfig } from "@/lib/config";

// Roteiros pra teleprompter. O vídeo de referência vai do navegador direto pro storage (link
// assinado, como no editor de vídeo); maior que 45 MB, o navegador manda só o áudio. O resto roda
// em segundo plano (lib/roteiro/processar.ts) e a página acompanha.

export type NovoRoteiro = {
  modo: "tema" | "arquivo" | "link";
  tema?: string;
  direcao?: string;
  palavra?: string;
  duracao?: number;
  link?: string;
  arquivo?: { nome: string; tamanho: number; tipo: string };
};

const MAX_ARQUIVO = 45 * 1024 * 1024;
const limpo = (s: unknown, max = 2000) => String(s ?? "").trim().slice(0, max);
const duracaoValida = (d: unknown) => (DURACOES.some((x) => x.valor === Number(d)) ? Number(d) : DURACAO_PADRAO);
const EXTENSAO: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "audio/wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a" };

/**
 * Cria o roteiro. Tema e link já entram na fila; arquivo volta com o link pra subir o vídeo.
 * Devolve {erro} em vez de lançar: em produção o Next esconde a mensagem de erro de Server Action.
 */
export async function criarRoteiro(p: NovoRoteiro): Promise<{ id: string; envio?: string } | { erro: string }> {
  try {
    const { usuarioId } = await exigirEquipe();
    const tema = limpo(p.tema, 2000);
    const base = {
      tema: tema || null,
      direcao: limpo(p.direcao, 2000) || null,
      palavra_cta: palavraLimpa(p.palavra) || null,
      duracao_alvo: duracaoValida(p.duracao),
      criado_por: usuarioId,
    };
    const db = createAdminClient();

    if (p.modo === "tema") {
      if (tema.length < 3) return { erro: "Escreve sobre o que é o vídeo." };
      const { data, error } = await db.from("roteiro").insert({ ...base, origem: "tema", status: "na_fila", etapa: "na fila" }).select("id").single();
      if (error || !data) return { erro: `não consegui criar: ${error?.message}` };
      after(() => agendarRoteiro(data.id));
      revalidatePath("/roteiros");
      return { id: data.id };
    }

    if (p.modo === "link") {
      const link = limpo(p.link, 1000);
      if (!linkValido(link)) return { erro: "Cola o link de um vídeo do Instagram, TikTok ou YouTube." };
      const { data, error } = await db.from("roteiro").insert({ ...base, origem: "link", link, status: "na_fila", etapa: "na fila" }).select("id").single();
      if (error || !data) return { erro: `não consegui criar: ${error?.message}` };
      after(() => agendarRoteiro(data.id));
      revalidatePath("/roteiros");
      return { id: data.id };
    }

    const a = p.arquivo;
    if (!a || !(a.tamanho > 0)) return { erro: "Escolhe o vídeo." };
    if (a.tamanho > MAX_ARQUIVO) return { erro: "O arquivo passou de 45 MB." };
    const tipo = limpo(a.tipo, 80) || "video/mp4";
    if (!/^(video|audio)\//.test(tipo)) return { erro: "Esse arquivo não é vídeo." };
    const { data, error } = await db
      .from("roteiro")
      .insert({ ...base, origem: "arquivo", status: "subindo", etapa: "subindo o vídeo", arquivo_tipo: tipo, arquivo_nome: limpo(a.nome, 200) })
      .select("id")
      .single();
    if (error || !data) return { erro: `não consegui criar: ${error?.message}` };
    const caminho = `roteiro/${data.id}/referencia.${EXTENSAO[tipo] ?? (tipo.startsWith("audio") ? "wav" : "mp4")}`;
    const { data: envio, error: e } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho, { upsert: true });
    if (e || !envio) return { erro: `link de envio: ${e?.message}` };
    await db.from("roteiro").update({ arquivo: caminho }).eq("id", data.id);
    return { id: data.id, envio: envio.signedUrl };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** O vídeo subiu: entra na fila. */
export async function confirmarEnvio(id: string): Promise<void> {
  await exigirEquipe();
  const db = createAdminClient();
  const { data } = await db.from("roteiro").update({ status: "na_fila", etapa: "na fila" }).eq("id", id).eq("status", "subindo").select("id");
  if (data?.length) after(() => agendarRoteiro(id));
  revalidatePath("/roteiros");
}

/** Outra versão do mesmo roteiro (aproveita a transcrição e a análise da referência). */
export async function novaVersao(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const db = createAdminClient();
  const { data } = await db
    .from("roteiro")
    .update({
      status: "na_fila",
      etapa: "na fila",
      via: "estacao",
      erro: null,
      direcao: limpo(formData.get("direcao"), 2000) || null,
      palavra_cta: palavraLimpa(String(formData.get("palavra") ?? "")) || null,
      duracao_alvo: duracaoValida(formData.get("duracao")),
    })
    .eq("id", id)
    .in("status", ["pronto", "erro"])
    .select("id");
  if (data?.length) after(() => agendarRoteiro(id));
  revalidatePath(`/roteiros/${id}`);
  redirect(`/roteiros/${id}`);
}

/** Erro ou travado: tenta de novo de onde parou. */
export async function tentarDeNovo(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const db = createAdminClient();
  // "Tentar de novo" volta pra estação: a API só entra pelo botão dela
  const { data } = await db
    .from("roteiro")
    .update({ status: "na_fila", etapa: "na fila", via: "estacao", erro: null, processando_desde: null })
    .eq("id", id)
    .in("status", ["erro", "na_fila", "transcrevendo", "escrevendo"])
    .select("id");
  if (data?.length) after(() => agendarRoteiro(id));
  revalidatePath(`/roteiros/${id}`);
  redirect(`/roteiros/${id}`);
}

/** Reserva manual: a estação está desligada e o criador quer o roteiro agora (escreve pela API, ~US$ 0,15). */
export async function gerarPelaApi(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const db = createAdminClient();
  const { data } = await db
    .from("roteiro")
    .update({ status: "na_fila", via: "api", etapa: "vai escrever pela API (pedido manual)" })
    .eq("id", id)
    .eq("status", "aguardando_estacao")
    .select("id");
  if (data?.length) after(() => agendarRoteiro(id));
  revalidatePath(`/roteiros/${id}`);
  redirect(`/roteiros/${id}`);
}

export async function apagarRoteiro(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const db = createAdminClient();
  const { data: arquivos } = await db.storage.from(BUCKET).list(`roteiro/${id}`, { limit: 100 });
  if (arquivos?.length) await db.storage.from(BUCKET).remove(arquivos.map((a) => `roteiro/${id}/${a.name}`));
  await db.from("roteiro").delete().eq("id", id);
  revalidatePath("/roteiros");
  redirect("/roteiros");
}

/** Botão da esteira: roteiro pra teleprompter a partir de um reel que a esteira já transcreveu. */
export async function roteiroDaEsteira(formData: FormData) {
  const { usuarioId } = await exigirEquipe();
  const referencia = limpo(formData.get("id"), 60);
  const db = createAdminClient();
  const { data, error } = await db
    .from("roteiro")
    .insert({
      origem: "esteira",
      referencia_id: referencia,
      direcao: limpo(formData.get("pedido"), 2000) || null,
      palavra_cta: palavraLimpa(String(formData.get("palavra") ?? "")) || null,
      duracao_alvo: duracaoValida(formData.get("duracao")),
      status: "na_fila",
      etapa: "na fila",
      criado_por: usuarioId,
    })
    .select("id")
    .single();
  if (error || !data) redirect(`/esteira/${referencia}?erro=${encodeURIComponent(`roteiro: ${error?.message ?? "erro"}`)}`);
  after(() => agendarRoteiro(data.id));
  revalidatePath("/roteiros");
  redirect(`/roteiros/${data.id}`);
}

/** O guia do padrão viral (regras, exemplos de fala real e expressões proibidas). */
export async function salvarPadraoViral(formData: FormData) {
  await exigirEquipe();
  const atual = await lerPadrao();
  const titulos = formData.getAll("exemplo_titulo").map(String);
  const fontes = formData.getAll("exemplo_fonte").map(String);
  const falas = formData.getAll("exemplo_transcricao").map(String);
  const porques = formData.getAll("exemplo_por_que").map(String);
  const exemplos: ExemploViral[] = falas
    .map((t, i) => ({ titulo: limpo(titulos[i], 120) || `Exemplo ${i + 1}`, fonte: limpo(fontes[i], 300), transcricao: limpo(t, 6000), por_que: limpo(porques[i], 1000) }))
    .filter((e) => e.transcricao.length > 20)
    .slice(0, 12);
  const regras = limpo(formData.get("regras"), 20000);
  if (regras.length < 50) redirect(`/roteiros/padrao?erro=${encodeURIComponent("as regras ficaram curtas demais")}`);
  await salvarPadrao({
    regras,
    exemplos,
    proibidas: String(formData.get("proibidas") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 1)
      .slice(0, 200),
    fonte: atual.fonte,
  });
  revalidatePath("/roteiros/padrao");
  redirect("/roteiros/padrao?salvo=1");
}

/** Volta o guia pro da fase 1 (o que está no código). */
export async function restaurarPadraoViral() {
  await exigirEquipe();
  await salvarConfig("padrao_viral", null);
  revalidatePath("/roteiros/padrao");
  redirect("/roteiros/padrao?salvo=1");
}
