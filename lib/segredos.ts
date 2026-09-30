import "server-only";
import { createHmac } from "node:crypto";
import { lerConfig } from "@/lib/config";
import { DEMO } from "@/lib/demo";

// As chaves do sistema, num lugar só. Pra instalar ser fácil, a Vercel só precisa das 3
// variáveis do Supabase: o resto você cola no painel (fica na tabela configuracao, que só
// o dono lê) ou é derivado da chave secreta do Supabase. Variável de ambiente, se existir,
// continua valendo por cima (quem prefere assim).

export type ConfigIA = { openrouter_key?: string | null };

/** Deriva um segredo estável da chave secreta do Supabase (não precisa guardar nem colar). */
function derivado(rotulo: string): string | null {
  if (DEMO) return `demo-${rotulo}`;
  const base = process.env.SUPABASE_SECRET_KEY;
  if (!base) return null;
  return createHmac("sha256", base).update(`sistema-do-criador:${rotulo}`).digest("hex").slice(0, 40);
}

/** A chave da OpenRouter (Início → passo 2, ou a variável OPENROUTER_API_KEY). */
export async function chaveOpenRouter(): Promise<string | null> {
  if (process.env.OPENROUTER_API_KEY) return process.env.OPENROUTER_API_KEY;
  const ia = await lerConfig<ConfigIA>("ia", {});
  return ia.openrouter_key?.trim() || null;
}

/** A "chave secreta do app" da Meta: valida a assinatura dos webhooks. */
export async function segredosDoApp(): Promise<string[]> {
  const doEnv = [process.env.META_APP_SECRET, process.env.IG_APP_SECRET].filter((s): s is string => Boolean(s));
  if (doEnv.length) return doEnv;
  const app = await lerConfig<{ app_secret?: string | null }>("meta_app", {});
  return app.app_secret?.trim() ? [app.app_secret.trim()] : [];
}

/** O token de verificação do webhook (você cola esse mesmo valor no app da Meta). */
export function tokenDoWebhook(): string | null {
  return process.env.IG_WEBHOOK_VERIFY_TOKEN || derivado("webhook-instagram");
}

/** O segredo que protege /api/relogio (o Supabase manda ele a cada batida). */
export function segredoDoRelogio(): string | null {
  return process.env.CRON_SECRET || derivado("relogio");
}
