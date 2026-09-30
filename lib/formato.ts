// Formatação de datas e nomes — tudo no fuso de São Paulo.

const FUSO = "America/Sao_Paulo";

export function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: FUSO, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

export function haQuanto(iso: string | null | undefined): string {
  if (!iso) return "—";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

// Data "de hoje" em São Paulo, como YYYY-MM-DD
export function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: FUSO });
}

export function horaSP(): { h: number; m: number } {
  const [h, m] = new Date()
    .toLocaleTimeString("en-GB", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false })
    .split(":")
    .map(Number);
  return { h, m };
}

export function nomeDoContato(c: { nome: string | null; instagram_usuario?: string | null }): string {
  return c.nome || (c.instagram_usuario ? `@${c.instagram_usuario}` : "sem nome");
}

/** Instante de N horas atrás, em ISO (pra filtro "últimas 24 h"). */
export function horasAtras(horas: number): string {
  return new Date(Date.now() - horas * 3600e3).toISOString();
}
