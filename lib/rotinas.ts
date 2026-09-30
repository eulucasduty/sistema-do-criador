import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { renovarToken, sincronizarPerfil } from "@/lib/instagram/api";
import { pegarTrava } from "@/lib/trava";

// Rotinas de manutenção (o relógio roda a cada 5 min).

/** A pausa do contato venceu (ex.: 48 h depois de você responder pelo app) → a conversa volta pro agente. */
async function reabrirConversas() {
  const db = createAdminClient();
  const agora = new Date().toISOString();
  const { data } = await db.from("conversa").select("id, contato:contato_id (id, agente_pausado_ate)").eq("status", "com_voce").limit(200);
  for (const c of data ?? []) {
    const contato = Array.isArray(c.contato) ? c.contato[0] : c.contato;
    const ate = contato?.agente_pausado_ate as string | null | undefined;
    if (!ate || ate === "infinity" || ate > agora) continue;
    await db.from("contato").update({ agente_pausado_ate: null, agente_pausa_motivo: null }).eq("id", contato.id);
    await db.from("conversa").update({ status: "aberta", status_motivo: null, status_em: agora }).eq("id", c.id);
  }
}

/** Eventos do webhook ficam 30 dias (dá pra investigar), depois somem. */
async function limparEventos() {
  const db = createAdminClient();
  const limite = new Date(Date.now() - 30 * 86400e3).toISOString();
  await db.from("evento_recebido").delete().lt("recebido_em", limite).not("processado_em", "is", null);
}

/** Uma vez por dia: o seu @, nome e foto (a foto do Instagram muda e o link expira). */
async function perfilDoDia() {
  if (await pegarTrava("perfil", 24 * 3600e3)) await sincronizarPerfil();
}

export async function rodarRotinas() {
  for (const [nome, fn] of [
    ["reabrir conversas", reabrirConversas],
    ["limpar eventos", limparEventos],
    ["token do instagram", async () => void (await renovarToken())],
    ["perfil do instagram", perfilDoDia],
  ] as const) {
    try {
      await fn();
    } catch (e) {
      console.error(`[rotina:${nome}]`, (e as Error).message);
    }
  }
}
