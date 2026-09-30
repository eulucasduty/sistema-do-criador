import { createHmac, timingSafeEqual } from "node:crypto";
import { receberInstagram } from "@/lib/instagram/receber";
import { segredosDoApp, tokenDoWebhook } from "@/lib/segredos";

// Webhook do seu app Meta (Instagram API com login do Instagram).
//   GET  → handshake da Meta (hub.verify_token = o token que o Início mostra no passo 4)
//   POST → comentários, DMs, cliques de botão. Assinado em X-Hub-Signature-256 com a
//          chave secreta do app (colada no painel, ou META_APP_SECRET / IG_APP_SECRET).
// Responde 200 rápido: a Meta desativa webhook lento. O processamento é leve (banco).

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const u = new URL(req.url);
  const esperado = tokenDoWebhook();
  if (esperado && u.searchParams.get("hub.mode") === "subscribe" && u.searchParams.get("hub.verify_token") === esperado) {
    return new Response(u.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("token de verificação não confere", { status: 403 });
}

async function assinaturaConfere(corpo: string, cabecalho: string | null): Promise<boolean | null> {
  const segredos = await segredosDoApp();
  if (!segredos.length) return null; // ainda sem a chave secreta do app
  if (!cabecalho?.startsWith("sha256=")) return false;
  const recebida = Buffer.from(cabecalho.slice(7), "hex");
  return segredos.some((s) => {
    const esperada = createHmac("sha256", s).update(corpo, "utf8").digest();
    return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
  });
}

export async function POST(req: Request) {
  const bruto = await req.text();
  const ok = await assinaturaConfere(bruto, req.headers.get("x-hub-signature-256"));
  // Sem a chave secreta do app não dá pra saber se veio da Meta: nem guarda
  if (ok === null) return new Response("falta a chave secreta do app (Início → passo 4)", { status: 401 });
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
