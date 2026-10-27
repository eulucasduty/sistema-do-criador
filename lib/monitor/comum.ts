// Monitor de criadores: o que a tela e o relógio compartilham.

/**
 * configuracao.monitor. Desligado, o relógio não confere ninguém (os roteiros que já estão na fila
 * seguem). `limite_dia` é o teto de roteiros automáticos por dia, somando todos os criadores; a
 * estação leva ~1 min por roteiro, então 150 por dia são umas 2,5 h de plano do Claude.
 * `hora` (pedido do Duty, 19/10: "puxados todo dia às 9"): com ela, cada criador é conferido uma vez
 * por dia a partir dessa hora (Brasília); vazia, vale o `intervalo_min`.
 * `carrosseis`: o carrossel novo do criador vai pra Esteira → Carrosséis (até `limite_carrosseis_dia`).
 * `atraso_dias` (pedido do Duty, 20/10: "os mais virais de 2 dias antes ao invés de 1 dia só, pq não dá
 * tempo de performar"): só entra post com pelo menos N dias, e os de um dia (de N+1 a N dias atrás)
 * entram do mais viral pro menos, até as vagas. 0 = o comportamento antigo (o mais novo primeiro).
 * `roteiro` (pedido do Duty, 20/10): `transcricao` = o roteiro é a fala do criador, como ele falou
 * (sem a análise e sem a estação, mais barato); `escrever` = a estação escreve um roteiro novo.
 */
export type ConfigMonitor = {
  ligado: boolean;
  intervalo_min: number;
  limite_dia: number;
  hora: number | null;
  carrosseis: boolean;
  limite_carrosseis_dia: number;
  atraso_dias: number;
  roteiro: "transcricao" | "escrever";
};
export const MONITOR_PADRAO: ConfigMonitor = {
  ligado: false,
  intervalo_min: 60,
  limite_dia: 150,
  hora: 9,
  carrosseis: true,
  limite_carrosseis_dia: 10,
  atraso_dias: 2,
  roteiro: "escrever",
};

/** O tamanho do "viral": views quando a rede dá (YouTube), senão curtidas + comentários (pesam 3x). */
export function viralidade(d: { views?: number | null; curtidas?: number | null; comentarios?: number | null }): number {
  if (d.views != null) return d.views;
  return (d.curtidas ?? 0) + 3 * (d.comentarios ?? 0);
}

/**
 * A janela de posts de uma conferência: até `ate` (agora menos o atraso) e desde o que já foi visto,
 * nunca mais que 3 dias antes do fim (o criador que ficou dias sem conferir não puxa o histórico) e,
 * na primeira vez, um dia.
 */
export function janelaDosPosts(vistoAte: string | null, atrasoDias: number, agora = new Date()): { desde: Date; ate: Date } {
  const ate = new Date(agora.getTime() - Math.max(0, atrasoDias) * 86_400_000);
  const umDia = new Date(ate.getTime() - (atrasoDias > 0 ? 86_400_000 : 2 * 86_400_000));
  const teto = new Date(ate.getTime() - 3 * 86_400_000);
  const visto = vistoAte ? new Date(vistoAte) : null;
  const desde = !visto || visto >= ate ? umDia : visto < teto ? teto : visto;
  return { desde, ate };
}

export const REDES: Record<string, string> = { instagram: "Instagram", youtube: "YouTube" };

/** Link do perfil do criador na rede. */
export function linkDoCriador(c: { rede: string; usuario: string; canal_id?: string | null }): string {
  if (c.rede === "youtube") return c.canal_id ? `https://www.youtube.com/channel/${c.canal_id}` : `https://www.youtube.com/@${c.usuario}`;
  return `https://www.instagram.com/${c.usuario}/`;
}

/** Meia-noite de hoje no horário de Brasília (o "por dia" conta daí). */
export function inicioDoDia(agora = new Date()): Date {
  const dia = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return new Date(`${dia}T00:00:00-03:00`);
}

/** Hoje, na hora `hora` de Brasília (a busca diária dos criadores começa aí). */
export function horaDeHoje(hora: number, agora = new Date()): Date {
  return new Date(inicioDoDia(agora).getTime() + hora * 3600_000);
}
