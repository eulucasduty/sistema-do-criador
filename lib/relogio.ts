import "server-only";
import { passoDosCriadores, passoDaFilaDoMonitor } from "@/lib/monitor/monitor";
import { passoDasPostagens } from "@/lib/postagem/publicar";
import { passoDosCarrosseis } from "@/lib/postagem/carrossel";
import { rodarRotinas } from "@/lib/rotinas";
import { passoDaEsteira } from "@/lib/esteira/referencia";
import { passoDoFollowup } from "@/lib/instagram/followup";
import { passoDasPostagens } from "@/lib/postagem/publicar";
import { salvarConfig } from "@/lib/config";
import { pegarTrava, soltarTrava } from "@/lib/trava";
export type BatidaRelogio = { visto_em?: string; modo?: "cron" | "servidor" };
async function executar(modo: "cron" | "servidor") {
  await salvarConfig("relogio", { visto_em: new Date().toISOString(), modo });
  if (!(await pegarTrava("minuto", 15 * 60_000))) return;
  try {
    for (const [nome, fn] of [["postagens", passoDasPostagens], ["carrosseis", passoDosCarrosseis], ["followup", passoDoFollowup], ["esteira", passoDaEsteira], ["criadores", passoDosCriadores], ["roteiros", passoDaFilaDoMonitor]] as const) {
      try { await fn(); } catch(e) { console.error(`[relogio:${nome}]`, (e as Error).message); }
    }
    if (await pegarTrava("rotinas", 5 * 60_000)) await rodarRotinas();
  } finally { await soltarTrava("minuto"); }
}
export async function batida() { await executar("cron"); return { conversas: 0 }; }
let ligado = false;
export function iniciarRelogio() {
  if (ligado) return; ligado = true;
  const timer = setInterval(() => void executar("servidor").catch(e=>console.error("[relogio]", e)), 60_000);
  timer.unref();
  void executar("servidor").catch(e=>console.error("[relogio]", e));
}
