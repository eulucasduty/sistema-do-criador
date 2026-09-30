import { after } from "next/server";
import { batida } from "@/lib/relogio";

// A batida do relógio no modo cron: o Supabase (pg_cron + pg_net) chama esta rota a cada
// minuto com "Authorization: Bearer <CRON_SECRET>". Responde na hora e trabalha depois
// (after), então não importa se quem chamou desiste de esperar.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(req: Request): boolean {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return false;
  const cabecalho = req.headers.get("authorization") ?? "";
  const chave = new URL(req.url).searchParams.get("chave");
  return cabecalho === `Bearer ${segredo}` || chave === segredo;
}

async function tratar(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ erro: "falta a variável CRON_SECRET" }, { status: 503 });
  if (!autorizado(req)) return Response.json({ erro: "não autorizado" }, { status: 401 });
  // No modo servidor o relógio já roda dentro do servidor: não bate duas vezes
  if (process.env.RELOGIO === "ligado") return Response.json({ ok: true, modo: "servidor" });
  after(() => batida(50_000).catch((e) => console.error("[relogio]", (e as Error).message)));
  return Response.json({ ok: true, modo: "cron" }, { status: 202 });
}

export const GET = tratar;
export const POST = tratar;
