// Endereço público do sistema (links rastreados das automações, webhook, relógio).
// Na Vercel vem sozinho (VERCEL_PROJECT_PRODUCTION_URL); em outro lugar, APP_URL no .env.
export function urlDoApp(): string {
  const env = process.env.APP_URL?.replace(/\/$/, "");
  if (env) return env;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** O repositório do sistema (o passo a passo aponta pra lá). */
export const REPO_URL = "https://github.com/eulucasduty/sistema-do-criador";
