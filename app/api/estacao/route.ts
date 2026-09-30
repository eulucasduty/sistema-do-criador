// A estação de edição (no PC do criador) pergunta aqui como falar com o banco na primeira vez.
// Pública de propósito: devolve só os 2 valores PÚBLICOS do Supabase (os mesmos que já vão pro
// navegador em qualquer página). O acesso de verdade vem depois, com o e-mail e a senha do dono,
// e tudo passa pela RLS (editor/estacao/sessao.mjs).

export const dynamic = "force-dynamic";

export function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !publishableKey) return Response.json({ erro: "o sistema ainda não tem as variáveis do Supabase" }, { status: 503 });
  return Response.json({ sistema: "sistema-do-criador", supabaseUrl, publishableKey }, { headers: { "cache-control": "no-store" } });
}
