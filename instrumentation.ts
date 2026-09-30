// Roda uma vez quando o servidor sobe. No modo servidor (Docker/VPS, RELOGIO=ligado) liga o
// relógio interno; na Vercel quem bate o relógio é o Supabase, em /api/relogio. Ver lib/relogio.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.RELOGIO === "ligado") {
    const { iniciarRelogio } = await import("./lib/relogio");
    iniciarRelogio();
  }
}
