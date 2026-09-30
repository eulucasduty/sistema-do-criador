"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Todas as ações rodam com a sessão do usuário: a RLS decide o que pode.

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function resolverAlerta(formData: FormData) {
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("alerta").update({ resolvido: true, resolvido_em: new Date().toISOString() }).eq("id", id);
  revalidatePath("/", "layout");
}

// Pausa personalizada do agente pra um contato
export async function pausarAgente(formData: FormData) {
  const contatoId = String(formData.get("contato_id"));
  const opcao = String(formData.get("opcao"));
  const motivo = String(formData.get("motivo") ?? "").trim() || null;
  let ate: string | null = null;
  if (opcao === "1h") ate = new Date(Date.now() + 3600e3).toISOString();
  else if (opcao === "24h") ate = new Date(Date.now() + 86400e3).toISOString();
  else if (opcao === "7d") ate = new Date(Date.now() + 7 * 86400e3).toISOString();
  else if (opcao === "sempre") ate = "infinity";
  else if (opcao === "data") {
    const data = String(formData.get("data") ?? "");
    if (data) ate = new Date(`${data}T23:59:00-03:00`).toISOString();
  }
  const supabase = await createClient();
  await supabase
    .from("contato")
    .update({ agente_pausado_ate: ate, agente_pausa_motivo: ate ? motivo : null })
    .eq("id", contatoId);
  if (!ate) {
    // Devolveu pro agente: a conversa reabre e o limite de respostas recomeça
    await supabase
      .from("conversa")
      .update({ status: "aberta", status_motivo: null, status_em: new Date().toISOString(), mensagens_do_agente: 0 })
      .eq("contato_id", contatoId);
  }
  revalidatePath(`/contatos/${contatoId}`);
}

export async function marcarNaoContatar(formData: FormData) {
  const contatoId = String(formData.get("contato_id"));
  const valor = formData.get("valor") === "sim";
  const supabase = await createClient();
  await supabase
    .from("contato")
    .update({ nao_contatar: valor, nao_contatar_em: valor ? new Date().toISOString() : null })
    .eq("id", contatoId);
  revalidatePath(`/contatos/${contatoId}`);
}

export async function salvarObservacoes(formData: FormData) {
  const contatoId = String(formData.get("contato_id"));
  const supabase = await createClient();
  await supabase
    .from("contato")
    .update({ observacoes: String(formData.get("observacoes") ?? "").trim() || null })
    .eq("id", contatoId);
  revalidatePath(`/contatos/${contatoId}`);
}
