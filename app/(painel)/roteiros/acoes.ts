"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { duracaoValida, semTabela } from "@/lib/roteiro/comum";
import { palavraLimpa } from "@/lib/roteiro/escritor.mjs";
import { linkValido } from "@/lib/roteiro/link";
import { lerPadrao, PADRAO_INICIAL, restaurarPadrao, salvarPadrao, type ExemploViral } from "@/lib/roteiro/padrao-viral";
import { BUCKET, processarRoteiro } from "@/lib/roteiro/processar";

// Roteiros pra teleprompter. O vídeo de referência vai do navegador direto pro Storage (link
// assinado, como na Esteira); maior que 45 MB, o navegador manda só o áudio. A transcrição e a
// análise rodam depois da resposta (after) e quem escreve é a estação no PC do criador.

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
const EXTENSAO: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "audio/wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a" };
const SEM_BANCO = "o banco ainda não tem os roteiros: rode o SQL da atualização (o Início mostra)";
const processarDepois = (id: string) => after(() => processarRoteiro(id).catch((e) => console.error("[roteiro]", id, (e as Error).message)));
const erroDoBanco = (e: { code?: string; message?: string } | null) => (semTabela(e) ? SEM_BANCO : `não consegui criar: ${e?.message ?? "erro"}`);

/**
 * Cria o roteiro. Tema já vai pra estação; link entra na fila do servidor; arquivo volta com o link
 * pra subir o vídeo. Devolve {erro} em vez de lançar: em produção o Next esconde a mensagem.
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
      if (tema.length < 3) return { erro: "Escreva sobre o que é o vídeo." };
      const { data, error } = await db.from("roteiro").insert({ ...base, origem: "tema", status: "aguardando_estacao", etapa: "esperando a estação" }).select("id").single();
      if (error || !data) return { erro: erroDoBanco(error) };
      revalidatePath("/roteiros");
      return { id: data.id };
    }

    if (p.modo === "link") {
      const link = limpo(p.link, 1000).split("?")[0];
      if (!linkValido(link)) return { erro: "Cole o link de um reel do Instagram (instagram.com/reel/…). Vídeo de outro lugar: baixe e suba o arquivo." };
      const { data, error } = await db.from("roteiro").insert({ ...base, origem: "link", link, status: "na_fila", etapa: "na fila" }).select("id").single();
      if (error || !data) return { erro: erroDoBanco(error) };
      processarDepois(data.id);
      revalidatePath("/roteiros");
      return { id: data.id };
    }

    const a = p.arquivo;
    if (!a || !(a.tamanho > 0)) return { erro: "Escolha o vídeo." };
    if (a.tamanho > MAX_ARQUIVO) return { erro: "O arquivo passou de 45 MB." };
    const tipo = limpo(a.tipo, 80) || "video/mp4";
    if (!/^(video|audio)\//.test(tipo)) return { erro: "Esse arquivo não é vídeo." };
    const { data, error } = await db
      .from("roteiro")
      .insert({ ...base, origem: "arquivo", status: "subindo", etapa: "subindo o vídeo", arquivo_tipo: tipo, arquivo_nome: limpo(a.nome, 200) })
      .select("id")
      .single();
    if (error || !data) return { erro: erroDoBanco(error) };
    const caminho = `roteiro/${data.id}/referencia.${EXTENSAO[tipo] ?? (tipo.startsWith("audio") ? "wav" : "mp4")}`;
    const { data: envio, error: e } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho, { upsert: true });
    if (e || !envio) return { erro: `link de envio: ${e?.message}` };
    await db.from("roteiro").update({ arquivo: caminho }).eq("id", data.id);
    return { id: data.id, envio: envio.signedUrl };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** O vídeo subiu: entra na fila (o servidor ouve e analisa; depois a estação escreve). */
export async function confirmarEnvio(id: string): Promise<void> {
  await exigirEquipe();
  const { data } = await createAdminClient().from("roteiro").update({ status: "na_fila", etapa: "na fila" }).eq("id", limpo(id, 60)).eq("status", "subindo").select("id");
  if (data?.length) processarDepois(data[0].id);
  revalidatePath("/roteiros");
}

/** Outra versão do mesmo roteiro (aproveita a transcrição e a análise da referência). */
export async function novaVersao(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const { data } = await createAdminClient()
    .from("roteiro")
    .update({
      status: "na_fila",
      etapa: "na fila",
      erro: null,
      direcao: limpo(formData.get("direcao"), 2000) || null,
      palavra_cta: palavraLimpa(String(formData.get("palavra") ?? "")) || null,
      duracao_alvo: duracaoValida(formData.get("duracao")),
    })
    .eq("id", id)
    .in("status", ["pronto", "erro"])
    .select("id");
  if (data?.length) processarDepois(id);
  revalidatePath(`/roteiros/${id}`);
  redirect(`/roteiros/${id}`);
}

/** Erro ou travado: tenta de novo de onde parou. */
export async function tentarDeNovo(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const { data } = await createAdminClient()
    .from("roteiro")
    .update({ status: "na_fila", etapa: "na fila", erro: null, processando_desde: null })
    .eq("id", id)
    .in("status", ["erro", "na_fila", "transcrevendo", "escrevendo"])
    .select("id");
  if (data?.length) processarDepois(id);
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

/** Botão "Criar roteiro" de um reel da Esteira: roteiro pra teleprompter a partir dele. */
export async function roteiroDaEsteira(formData: FormData) {
  const { usuarioId } = await exigirEquipe();
  const referencia = limpo(formData.get("id"), 60);
  const { data, error } = await createAdminClient()
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
  if (error || !data) redirect(`/esteira/${referencia}?erro=${encodeURIComponent(`roteiro: ${erroDoBanco(error)}`.slice(0, 200))}`);
  processarDepois(data.id);
  revalidatePath("/roteiros");
  revalidatePath(`/esteira/${referencia}`);
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
    fonte: atual.fonte === PADRAO_INICIAL.fonte ? "o seu padrão (editado no painel)" : atual.fonte,
  });
  revalidatePath("/roteiros/padrao");
  redirect("/roteiros/padrao?salvo=1");
}

/** Volta o guia pro padrão do sistema. */
export async function restaurarPadraoViral() {
  await exigirEquipe();
  await restaurarPadrao();
  revalidatePath("/roteiros/padrao");
  redirect("/roteiros/padrao?salvo=1");
}
