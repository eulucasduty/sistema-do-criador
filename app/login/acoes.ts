"use server";

import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const igual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Cria a conta do dono no primeiro acesso (só enquanto não há ninguém na equipe). Pra provar
 * que o sistema é seu, pede a Secret key do Supabase (a mesma que está na hospedagem): quem
 * só achou o endereço não consegue virar dono. A conta nasce confirmada, sem e-mail.
 */
export async function criarConta(dados: { email: string; senha: string; nome: string; chave: string }): Promise<{ erro?: string }> {
  try {
    const segredo = process.env.SUPABASE_SECRET_KEY ?? "";
    if (!segredo || !igual(dados.chave.trim(), segredo)) {
      return { erro: "essa não é a Secret key do seu Supabase (Project Settings → API Keys → Secret key)" };
    }
    const db = createAdminClient();
    const { count } = await db.from("equipe").select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { erro: "o sistema já tem dono: entre com o seu e-mail e senha" };
    const email = dados.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return { erro: "e-mail inválido" };
    if (dados.senha.length < 8) return { erro: "a senha precisa de pelo menos 8 caracteres" };
    const nome = dados.nome.trim().slice(0, 60) || email.split("@")[0];
    const { data, error } = await db.auth.admin.createUser({ email, password: dados.senha, email_confirm: true, user_metadata: { nome } });
    if (error || !data.user) return { erro: error?.message ?? "não consegui criar a conta" };
    const { error: erroEquipe } = await db.from("equipe").insert({ usuario_id: data.user.id, nome, papel: "dono" });
    if (erroEquipe) {
      await db.auth.admin.deleteUser(data.user.id);
      return { erro: `não consegui te pôr como dono: ${erroEquipe.message}` };
    }
    return {};
  } catch (e) {
    return { erro: (e as Error).message };
  }
}
