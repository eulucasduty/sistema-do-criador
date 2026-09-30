import { createHmac, timingSafeEqual } from "node:crypto";
import { receberInstagram } from "@/lib/instagram/receber";

// Webhook do seu app Meta (Instagram API com login do Instagram).
//   GET  → handshake da Meta (hub.verify_token = IG_WEBHOOK_VERIFY_TOKEN)
//   POST → comentários, DMs, cliques de botão. Assinado em X-Hub-Signature-256 com o
//          segredo do app (META_APP_SECRET ou IG_APP_SECRET — o painel do Instagram
//          mostra um segredo próprio; vale qualquer um dos dois configurados).
// Responde 200 rápido: a Meta desativa webhook lento. O processamento é leve (banco).

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const esperado = process.env.IG_WEBHOOK_VERIFY_TOKEN;
  if (esperado && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === esperado) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("token de verificação não confere", { status: 403 });
}

function assinaturaConfere(corpo: string, cabecalho: string | null): boolean | null {
  const segredos = [process.env.META_APP_SECRET, process.env.IG_APP_SECRET].filter(Boolean) as string[];
  if (!segredos.length) return null; // ainda sem segredo: guarda, mas não processa
  if (!cabecalho?.startsWith("sha256=")) return false;
  const recebida = Buffer.from(cabecalho.slice(7), "hex");
  return segredos.some((s) => {
    const esperada = createHmac("sha256", s).update(corpo, "utf8").digest();
    return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
  });
}

export async function POST(req: Request) {
  const bruto = await req.text();
  const ok = assinaturaConfere(bruto, req.headers.get("x-hub-signature-256"));
  if (ok === false) return new Response("assinatura inválida", { status: 401 });
  let corpo: unknown;
  try {
    corpo = JSON.parse(bruto);
  } catch {
    return new Response("json inválido", { status: 400 });
  }
  try {
    await receberInstagram(corpo, { verificado: ok === true });
  } catch (e) {
    // Nunca devolve erro pra Meta por falha nossa: ela reenvia e depois desativa o webhook.
    console.error("[webhook instagram]", (e as Error).message);
  }
  return new Response("ok", { status: 200 });
}
