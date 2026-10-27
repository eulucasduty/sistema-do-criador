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
