import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ehVideo, type ResultadoCarrossel } from "@/lib/esteira/carrossel";

// Um slide da cópia de carrossel feita pela estação: /esteira/<id>/slide/<n>?v=<gerado_em>
// PNG 1080x1350; slide em vídeo redireciona pro MP4 (link assinado curto) e ?capa=1 dá o PNG dele.
// Só quem está logado (o proxy barra o resto): a leitura da referência passa pela RLS e só então
// o servidor baixa do bucket privado um caminho da versão que essa pessoa conseguiu ler.
export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await ctx.params;
  const indice = Number(n) - 1;
  if (!Number.isInteger(indice) || indice < 0) return new Response("slide inválido", { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("referencia").select("copia_cli").eq("id", id).maybeSingle();
  const copia = data?.copia_cli as ResultadoCarrossel | null | undefined;
  const caminho = copia?.arquivos?.[indice];
  if (!caminho || !caminho.startsWith("carrosseis/")) return new Response("sem esse slide", { status: 404 });
  const storage = createAdminClient().storage.from("esteira");
  if (ehVideo(caminho) && !new URL(req.url).searchParams.has("capa")) {
    // O player do navegador precisa pular pelo arquivo: vai direto pro storage
    const { data: assinado } = await storage.createSignedUrl(caminho, 3600);
    if (!assinado?.signedUrl) return new Response("não consegui carregar o vídeo", { status: 502 });
    return Response.redirect(assinado.signedUrl, 302);
  }
  const { data: png, error } = await storage.download(caminho.replace(/\.[^.]+$/, ".png"));
  if (error || !png) return new Response("não consegui carregar o slide", { status: 502 });
  return new Response(await png.arrayBuffer(), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=3600" } });
}
