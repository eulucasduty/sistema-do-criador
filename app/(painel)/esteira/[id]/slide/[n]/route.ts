import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CopiaCarrossel } from "@/lib/esteira/criacao";
import { renderizarSlide } from "@/lib/esteira/slide";
import { ehVideo, type ResultadoCarrossel } from "@/lib/carrossel/comum";

// PNG de um slide da cópia de carrossel (1080x1350). /esteira/<id>/slide/<n>?v=<gerado_em>
// Só quem está logado (o proxy barra o resto; a RLS também).
export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await ctx.params;
  const supabase = await createClient();
  const { data } = await supabase.from("referencia").select("copia, copia_cli").eq("id", id).maybeSingle();
  const indice = Number(n) - 1;
  if (!Number.isInteger(indice) || indice < 0) return new Response("slide inválido", { status: 404 });
  const cli = data?.copia_cli as ResultadoCarrossel | null;
  if (cli) {
    const caminho = cli.arquivos[indice];
    if (!caminho) return new Response("slide inexistente", { status: 404 });
    // A leitura da referência acima é feita com a sessão e a RLS. O bucket é privado;
    // o servidor só baixa um caminho da versão que esse usuário conseguiu acessar.
    const admin = createAdminClient();
    if (ehVideo(caminho) && !new URL(req.url).searchParams.has("capa")) {
      // Slide em vídeo: link assinado curto (o player do navegador precisa pular pelo arquivo)
      const { data: assinado } = await admin.storage.from("esteira").createSignedUrl(caminho, 3600);
      if (!assinado?.signedUrl) return new Response("não consegui carregar o vídeo", { status: 502 });
      return Response.redirect(assinado.signedUrl, 302);
    }
    // ?capa=1 num slide em vídeo: o PNG do mesmo slide, enviado junto pela estação
    const { data: png, error } = await admin.storage.from("esteira").download(caminho.replace(/\.mp4$/, ".png"));
    if (error || !png) return new Response("não consegui carregar o slide", { status: 502 });
    return new Response(await png.arrayBuffer(), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  }
  const copia = data?.copia as CopiaCarrossel | null;
  if (!copia?.slides?.length) return new Response("sem cópia desse carrossel", { status: 404 });
  if (indice >= copia.slides.length) return new Response("slide inexistente", { status: 404 });
  return renderizarSlide(copia, indice);
}
