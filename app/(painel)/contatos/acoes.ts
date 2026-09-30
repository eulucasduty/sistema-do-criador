"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Etiquetas do lead: separadas por vírgula, minúsculas, espaço vira "_".
export async function salvarTags(formData: FormData) {
  const contatoId = String(formData.get("contato_id"));
  const tags = String(formData.get("tags") ?? "")
    .split(/[,\n]/)
    .map((t) => t.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "_").slice(0, 40))
    .filter(Boolean);
  const supabase = await createClient();
  await supabase.from("contato").update({ tags: [...new Set(tags)].slice(0, 30) }).eq("id", contatoId);
  revalidatePath(`/contatos/${contatoId}`);
}
