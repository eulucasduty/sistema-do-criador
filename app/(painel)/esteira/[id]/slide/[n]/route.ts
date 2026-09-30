import { createClient } from "@/lib/supabase/server";
import type { CopiaCarrossel } from "@/lib/esteira/criacao";
import { renderizarSlide } from "@/lib/esteira/slide";

// PNG de um slide da cópia de carrossel (1080x1350). /esteira/<id>/slide/<n>?v=<gerado_em>
// Só quem está logado (o proxy barra o resto; a RLS também).
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.from("referencia").select("copia").eq("id", id).maybeSingle();
  const copia = data?.copia as CopiaCarrossel | null;
  if (!copia?.slides?.length) return new Response("sem cópia desse carrossel", { status: 404 });
  const i = Math.max(0, Math.min(copia.slides.length - 1, (Number(n) || 1) - 1));
  return renderizarSlide(copia, i);
}
