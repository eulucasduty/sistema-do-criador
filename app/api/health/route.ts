// Healthcheck (Docker e monitores): responde se o servidor está de pé.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, at: new Date().toISOString() });
}
