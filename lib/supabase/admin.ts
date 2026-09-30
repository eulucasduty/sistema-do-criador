import { createClient } from "@supabase/supabase-js";

// Cliente com a chave SECRETA: passa por cima da RLS. Só pra processos do servidor
// que não têm usuário logado (webhooks, agente, disparo, rotinas). Nunca importar
// em Client Component — a chave não tem NEXT_PUBLIC_ e nunca pode ir pro navegador.
export function createAdminClient() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("SUPABASE_SECRET_KEY ausente");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    db: { schema: "criador" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** O cliente do schema criador (é o tipo que os helpers do servidor recebem). */
export type Db = ReturnType<typeof createAdminClient>;
