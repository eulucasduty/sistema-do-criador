import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Next 16: o antigo middleware agora se chama proxy.
// Aqui só renova a sessão do Supabase e manda quem não está logado pro /login.
// A checagem de verdade acontece de novo em cada página (getClaims no servidor).
export async function proxy(request: NextRequest) {
  let resposta = NextResponse.next({ request });

  // Instalação pela metade (sem as variáveis do Supabase): a tela de login explica o que falta
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    if (request.nextUrl.pathname.startsWith("/login")) return resposta;
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          resposta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
          // Cache-Control/Expires/Pragma: impedem CDN de guardar a sessão de alguém
          Object.entries(headers ?? {}).forEach(([chave, valor]) => resposta.headers.set(chave, valor));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const logado = Boolean(data?.claims);
  const naLogin = request.nextUrl.pathname.startsWith("/login");

  if (!logado && !naLogin) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/login";
    const redirecionamento = NextResponse.redirect(destino);
    resposta.cookies.getAll().forEach((c) => redirecionamento.cookies.set(c));
    return redirecionamento;
  }

  if (logado && naLogin) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/";
    return NextResponse.redirect(destino);
  }

  return resposta;
}

export const config = {
  // Fica de fora: arquivos estáticos, healthcheck, webhooks e rotinas (não têm usuário logado)
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health|api/webhooks|api/relogio|robots.txt|privacidade|r/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
