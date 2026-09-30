import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { processarConversa } from "@/lib/agente/turno";
import { rodarRotinas } from "@/lib/rotinas";
import { passoDaEsteira } from "@/lib/esteira/referencia";
import { passoDoFollowup } from "@/lib/instagram/followup";
import { salvarConfig } from "@/lib/config";
import { pegarTrava, soltarTrava } from "@/lib/trava";

// O relógio: o que o sistema faz sozinho, sem ninguém clicar.
//
//   conversas · a cada 5 s — pega até 3 conversas com a espera vencida e o agente responde
//   followup  · a cada 1 min — os toques de quem parou de responder
//   esteira   · a cada 1 min — analisa referência que ficou sem análise
//   rotinas   · a cada 5 min — reabrir conversas, limpeza, token e foto do Instagram
//
// Dois jeitos de rodar (o Início mostra qual está batendo):
//   · cron (Vercel, padrão): o Supabase chama /api/relogio a cada minuto (pg_cron); cada
//     chamada fica ~50 s atendendo as conversas e roda os outros passos uma vez.
//   · servidor (Docker/VPS, RELOGIO=ligado): laços dentro do próprio servidor (1 réplica).

// Teste local (IG_SIMULADO=1): só contatos de teste "e2e_…"; a produção ignora esses.
const SIMULADO = process.env.IG_SIMULADO === "1";
const contatoDeTeste = (c: { instagram_id?: string | null } | null | undefined) => /^e2e_/.test(c?.instagram_id ?? "");
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type BatidaRelogio = { visto_em?: string; modo?: "cron" | "servidor" };

/** Pega até 3 conversas com a espera vencida e roda o turno do agente em cada uma. */
async function conversasVencidas(): Promise<number> {
  const db = createAdminClient();
  const agora = new Date().toISOString();
  const trava = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data } = await db
    .from("conversa")
    .select("id, contato:contato_id (instagram_id)")
    .lte("responder_apos", agora)
    .order("responder_apos", { ascending: true })
    .limit(10);
  const daVez = (data ?? [])
    .filter((c) => SIMULADO === contatoDeTeste(Array.isArray(c.contato) ? c.contato[0] : c.contato))
    .slice(0, 3);
  let feitas = 0;
  for (const c of daVez) {
    // Pega a trava: só uma volta do relógio processa a conversa
    const { data: pega } = await db
      .from("conversa")
      .update({ processando_desde: agora })
      .eq("id", c.id)
      .lte("responder_apos", agora)
      .or(`processando_desde.is.null,processando_desde.lt.${trava}`)
      .select("id");
    if (!pega?.length) continue;
    try {
      await processarConversa(c.id, agora);
      feitas++;
    } catch (e) {
      console.error("[relogio:conversa]", c.id, (e as Error).message);
    } finally {
      // Solta a trava; a espera só é zerada se não chegou mensagem nova durante o turno
      await db.from("conversa").update({ processando_desde: null }).eq("id", c.id);
      await db.from("conversa").update({ responder_apos: null }).eq("id", c.id).lte("responder_apos", agora);
    }
  }
  return feitas;
}

async function tentar(nome: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    console.error(`[relogio:${nome}]`, (e as Error).message);
  }
}

/** Os passos de 1 minuto (followup e esteira) e, a cada 5 min, as rotinas. */
async function passosDoMinuto(): Promise<void> {
  if (!(await pegarTrava("minuto", 4 * 60_000))) return; // a volta anterior ainda está rodando
  try {
    await tentar("followup", passoDoFollowup);
    if (SIMULADO) return;
    await tentar("esteira", passoDaEsteira);
    if (await pegarTrava("rotinas", 5 * 60_000 - 10_000)) await tentar("rotinas", rodarRotinas);
  } finally {
    await soltarTrava("minuto");
  }
}

/**
 * Uma batida do modo cron: registra que o relógio está vivo, roda os passos do minuto e
 * fica `duracaoMs` atendendo conversas a cada 5 s.
 */
export async function batida(duracaoMs = 50_000): Promise<{ conversas: number }> {
  const fim = Date.now() + duracaoMs;
  await salvarConfig("relogio", { visto_em: new Date().toISOString(), modo: "cron" } satisfies BatidaRelogio);
  const passos = passosDoMinuto();
  let conversas = 0;
  while (Date.now() < fim) {
    const volta = Date.now();
    try {
      conversas += await conversasVencidas();
    } catch (e) {
      console.error("[relogio:conversas]", (e as Error).message);
    }
    const resta = fim - Date.now();
    if (resta <= 0) break;
    await dormir(Math.min(resta, Math.max(0, 5_000 - (Date.now() - volta))));
  }
  await passos;
  return { conversas };
}

// ── modo servidor (Docker/VPS) ───────────────────────────────────────

let ligado = false;

function laco(nome: string, intervaloMs: number, fn: () => Promise<unknown>) {
  let rodando = false;
  const t = setInterval(async () => {
    if (rodando) return;
    rodando = true;
    await tentar(nome, fn);
    rodando = false;
  }, intervaloMs);
  t.unref?.();
}

export function iniciarRelogio() {
  if (ligado) return;
  ligado = true;
  console.log("[relogio] ligado no modo servidor: conversas a cada 5 s, o resto a cada 1 min");
  laco("conversas", 5_000, conversasVencidas);
  laco("minuto", 60_000, async () => {
    await salvarConfig("relogio", { visto_em: new Date().toISOString(), modo: "servidor" } satisfies BatidaRelogio);
    await passosDoMinuto();
  });
}
