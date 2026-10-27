"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import sharp from "sharp";
import { referenciasDoCarrossel, ehVideo, type ResultadoCarrossel } from "@/lib/carrossel/comum";
import { legendaDoCarrossel } from "@/lib/postagem/legenda-carrossel";

export async function agendarCarrossel(form: FormData) {
  await exigirEquipe();
  const db = createAdminClient();
  const id = String(form.get("referencia_id") ?? "");
  let erro: string | null = null;
  try {
    const quando = String(form.get("publicar_em") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(quando)) throw new Error("Escolha o dia e o horário de Brasília.");
    const data = new Date(`${quando}:00-03:00`);
    if (!Number.isFinite(data.getTime()) || data.getTime() < Date.now()) throw new Error("Escolha um horário futuro.");
    const { data: ref, error } = await db.from("referencia").select("id, palavra_cta, copia_cli, arquivo, slides").eq("id", id).maybeSingle();
    if (error || !ref) throw new Error("Carrossel não encontrado.");
    const copia = ref.copia_cli as ResultadoCarrossel | null;
    if (!copia?.arquivos?.length) throw new Error("Produza e revise o carrossel antes de agendar.");
    if (copia.arquivos.length !== referenciasDoCarrossel(ref).length) throw new Error("A cópia ainda não contém todos os slides.");
    const imagens: string[] = [];
    for (const [i, arquivo] of copia.arquivos.entries()) {
      if (ehVideo(arquivo)) { imagens.push(arquivo); continue; }
      const { data: original, error: download } = await db.storage.from("esteira").download(arquivo);
      if (download || !original) throw new Error(`Não consegui preparar o slide ${i + 1}.`);
      const jpg = await sharp(Buffer.from(await original.arrayBuffer())).flatten({ background: "#ffffff" }).jpeg({ quality: 95 }).toBuffer();
      const caminho = `postagens/${id}/${i + 1}.jpg`;
      const { error: envio } = await db.storage.from("esteira").upload(caminho, jpg, { contentType: "image/jpeg", upsert: true });
      if (envio) throw new Error(envio.message);
      imagens.push(caminho);
    }
    const legenda = String(form.get("legenda") ?? "").trim().slice(0, 2200) || legendaDoCarrossel(ref.palavra_cta || "", copia.titulo, copia.legenda);
    const { error: agendamento } = await db.from("carrossel_post").insert({ referencia_id: id, trabalho_id: copia.pedido_id, palavra: ref.palavra_cta, legenda, imagens, publicar_em: data.toISOString(), status: "agendado" });
    if (agendamento) throw new Error(agendamento.code === "23505" ? "Esse carrossel já está na agenda. Confira a publicação existente." : agendamento.message);
  } catch(e) { erro = (e as Error).message; }
  revalidatePath("/agenda");
  revalidatePath(`/esteira/${id}`);
  redirect(erro ? `/esteira/${id}?erro=${encodeURIComponent(erro)}` : "/agenda");
}

// Agenda dos carrosséis: pausar um post (sai da fila sem perder o horário) e voltar pra agenda.
// Um post com erro volta pra agenda na próxima passada do relógio (confira no Instagram antes).

export async function pausarPost(form: FormData) {
  await exigirEquipe();
  await createAdminClient().from("carrossel_post").update({ status: "pausado", etapa: null }).eq("id", String(form.get("id"))).eq("status", "agendado");
  revalidatePath("/agenda");
}

export async function retomarPost(form: FormData) {
  await exigirEquipe();
  const db = createAdminClient();
  const id = String(form.get("id"));
  const { data: p } = await db.from("carrossel_post").select("publicar_em").eq("id", id).single();
  // Horário que já passou: sai na próxima passada do relógio
  const quando = p && Date.parse(p.publicar_em) > Date.now() ? p.publicar_em : new Date().toISOString();
  await db.from("carrossel_post").update({ status: "agendado", publicar_em: quando, erro: null, etapa: null, container_id: null }).eq("id", id).in("status", ["pausado", "erro"]);
  revalidatePath("/agenda");
}
