import "server-only";
import type { Db } from "@/lib/supabase/admin";
import { palavraNormal } from "./blocos";

export type EntregaDaDm = { id: string; slug: string; palavra: string; titulo: string; subtitulo: string | null };

/**
 * O material publicado (com "mandar na DM") da palavra que a pessoa comentou. Prefere a palavra
 * que casou com a automação; senão qualquer palavra do comentário que tenha material. Erro no
 * banco (ou a migration 003 ainda não rodou) = sem material: a automação segue do jeito de sempre.
 */
export async function entregaDoComentario(db: Db, comentario: string | null | undefined, palavrasDaAutomacao: string[] = []): Promise<EntregaDaDm | null> {
  const tokens = String(comentario ?? "")
    .split(/[^\p{L}\p{N}]+/u)
    .map(palavraNormal)
    .filter(Boolean);
  if (!tokens.length) return null;
  try {
    const { data, error } = await db.from("entrega").select("id, slug, palavra, titulo, subtitulo").eq("publicada", true).eq("na_dm", true).not("palavra", "is", null).limit(200);
    if (error) return null;
    const porPalavra = new Map((data ?? []).map((e) => [palavraNormal(e.palavra), e as EntregaDaDm]));
    const daAutomacao = new Set(palavrasDaAutomacao.map(palavraNormal));
    const casou = tokens.find((t) => daAutomacao.has(t) && porPalavra.has(t)) ?? tokens.find((t) => porPalavra.has(t));
    return casou ? (porPalavra.get(casou) ?? null) : null;
  } catch {
    return null;
  }
}

/** A tabela ainda não existe: falta rodar supabase/migrations/003_postagem_materiais.sql. */
export const faltaMigracao = (e: { code?: string; message?: string } | null | undefined): boolean =>
  Boolean(e && (e.code === "42P01" || e.code === "42703" || e.code === "PGRST205" || e.code === "PGRST204" || /does not exist|Could not find the (table|column)/i.test(e.message ?? "")));

export const AVISO_MIGRACAO = "Falta atualizar o banco: no Supabase, abra o SQL Editor, cole o arquivo supabase/migrations/003_postagem_materiais.sql e clique em Run.";
