import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Trava entre chamadas (tabela trava): só uma pega, até `ms` depois. */
export async function pegarTrava(nome: string, ms: number): Promise<boolean> {
  const db = createAdminClient();
  const agora = new Date().toISOString();
  await db.from("trava").upsert({ nome, ate: "1970-01-01T00:00:00Z" }, { onConflict: "nome", ignoreDuplicates: true });
  const { data } = await db
    .from("trava")
    .update({ ate: new Date(Date.now() + ms).toISOString() })
    .eq("nome", nome)
    .lt("ate", agora)
    .select("nome");
  return Boolean(data?.length);
}

export async function soltarTrava(nome: string): Promise<void> {
  await createAdminClient().from("trava").update({ ate: new Date().toISOString() }).eq("nome", nome);
}
