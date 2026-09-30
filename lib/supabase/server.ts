import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Cliente do Supabase pra Server Components, Server Actions e Route Handlers.
// Usa a sessão do usuário logado: a RLS vale. Criar um por requisição.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: "criador" },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Component não escreve cookie: quem renova a sessão é o proxy.ts.
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    },
  );
}

// Quem está logado, verificado (getClaims confere a assinatura do token).
// Nunca usar getSession() no servidor: ele só lê o cookie, que dá pra forjar.
export async function usuarioLogado() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ?? null;
}

/**
 * Guarda das Server Actions que usam a chave secreta ou gastam dinheiro (simulador,
 * disparo, envio): Server Action é endpoint público, então confere login E equipe.
 * As que só usam o cliente da sessão já são protegidas pela RLS.
 */
export async function exigirEquipe(): Promise<{ usuarioId: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) throw new Error("não logado");
  const { data: membro } = await supabase.from("equipe").select("usuario_id").eq("usuario_id", sub).maybeSingle();
  if (!membro) throw new Error("sem acesso");
  return { usuarioId: sub };
}
