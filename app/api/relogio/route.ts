import { after } from "next/server";
import { batida } from "@/lib/relogio";
import { segredoDoRelogio } from "@/lib/segredos";

// A batida do relógio no modo cron: o Supabase (pg_cron + pg_net) chama esta rota a cada
// minuto com "Authorization: Bearer <segredo do relógio>" (lib/segredos.ts). Responde na hora e trabalha depois
// (after), então não importa se quem chamou desiste de esperar.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(req: Request): boolean {
  const segredo = segredoDoRelogio();
  if (!segredo) return false;
  return (req.headers.get("authorization") ?? "") === `Bearer ${segredo}`;
}

async function tratar(req: Request) {
  if (!segredoDoRelogio()) return Response.json({ erro: "falta a variável SUPABASE_SECRET_KEY" }, { status: 503 });
  if (!autorizado(req)) return Response.json({ erro: "não autorizado" }, { status: 401 });
  // No modo servidor o relógio já roda dentro do servidor: não bate duas vezes
  if (process.env.RELOGIO === "ligado") return Response.json({ ok: true, modo: "servidor" });
  after(() => batida(50_000).catch((e) => console.error("[relogio]", (e as Error).message)));
  return Response.json({ ok: true, modo: "cron" }, { status: 202 });
}

export const GET = tratar;
export const POST = tratar;
