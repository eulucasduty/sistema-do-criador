"use server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cria a conta do dono no primeiro acesso (só enquanto não há ninguém na equipe). A conta nasce
 * confirmada: sem depender de e-mail de confirmação. O gatilho do banco põe ela na equipe.
 */
export async function criarConta(dados: { email: string; senha: string; nome: string }): Promise<{ erro?: string }> {
  try {
    const db = createAdminClient();
    const { count } = await db.from("equipe").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { erro: "o sistema já tem dono: entre com o seu e-mail e senha" };
    const email = dados.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return { erro: "e-mail inválido" };
    if (dados.senha.length < 8) return { erro: "a senha precisa de pelo menos 8 caracteres" };
    const { error } = await db.auth.admin.createUser({
      email,
      password: dados.senha,
      email_confirm: true,
      user_metadata: { nome: dados.nome.trim().slice(0, 60) },
    });
    if (error) return { erro: error.message };
    const { count: depois } = await db.from("equipe").select("id", { count: "exact", head: true });
    if (!depois) return { erro: "a conta foi criada, mas não entrou na equipe: rode de novo o SQL da instalação" };
    return {};
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
