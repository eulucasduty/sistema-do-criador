import { createBrowserClient } from "@supabase/ssr";

// Cliente do Supabase pro navegador (Client Components). Só a chave publishable.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { db: { schema: "criador" } },
  );
}
