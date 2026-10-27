import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { palavraNormal } from "./blocos";

type Db = ReturnType<typeof createAdminClient>;
export type EntregaDaDm = { id: string; slug: string; palavra: string; titulo: string; subtitulo: string | null };

/**
 * A entrega publicada (com "mandar na DM") da palavra que a pessoa comentou. Prefere a palavra
 * que casou com a automação; senão qualquer palavra do comentário que tenha entrega. Erro no banco
 * = sem entrega (a automação segue do jeito de sempre).
 */
export async function entregaDoComentario(db: Db, comentario: string | null | undefined, palavrasDaAutomacao: string[] = []): Promise<EntregaDaDm | null> {
  const tokens = String(comentario ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map(palavraNormal)
    .filter(Boolean);
  if (!tokens.length) return null;
  try {
    const { data } = await db.from("entrega").select("id, slug, palavra, titulo, subtitulo").eq("publicada", true).eq("na_dm", true).not("palavra", "is", null).limit(200);
    const porPalavra = new Map((data ?? []).map((e) => [palavraNormal(e.palavra), e as EntregaDaDm]));
    const daAutomacao = new Set(palavrasDaAutomacao.map(palavraNormal));
    const casou = tokens.find((t) => daAutomacao.has(t) && porPalavra.has(t)) ?? tokens.find((t) => porPalavra.has(t));
    return casou ? (porPalavra.get(casou) ?? null) : null;
  } catch {
    return null;
  }
}
