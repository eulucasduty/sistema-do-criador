"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { salvarConfig } from "@/lib/config";
import { DURACAO_PADRAO, DURACOES } from "@/lib/roteiro/comum";
import { MONITOR_PADRAO } from "@/lib/monitor/comum";
import { conferirCriador, lerMonitor, vagasDeCarrossel, validarCriador, type Criador } from "@/lib/monitor/monitor";

// Criadores monitorados (call de 18/10): o Duty cola a lista de referências e cada post novo em
// vídeo vira roteiro sozinho (lib/monitor/monitor.ts, pelo relógio).

const PAGINA = "/roteiros/criadores";
const limpo = (s: unknown, max = 2000) => String(s ?? "").trim().slice(0, max);
const inteiro = (v: unknown, min: number, max: number, padrao: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : padrao;
};
const duracaoValida = (d: unknown) => (DURACOES.some((x) => x.valor === Number(d)) ? Number(d) : DURACAO_PADRAO);
const voltar = (q: Record<string, string>): never => redirect(`${PAGINA}?${new URLSearchParams(q)}`);

/** A rede de uma linha da lista: link do YouTube ou "yt:" é YouTube; o resto, a rede escolhida. */
function redeDaLinha(linha: string, padrao: string): { rede: string; entrada: string } {
  if (/youtube\.com|youtu\.be/i.test(linha)) return { rede: "youtube", entrada: linha };
  if (/instagram\.com/i.test(linha)) return { rede: "instagram", entrada: linha };
  const m = linha.match(/^(yt|youtube|ig|instagram)\s*[:\s]\s*(.+)$/i);
  if (m) return { rede: /^y/i.test(m[1]) ? "youtube" : "instagram", entrada: m[2] };
  return { rede: padrao, entrada: linha };
}

/**
 * Cadastra um ou vários (uma linha por criador: @, link do perfil ou do canal). Cada um é conferido na
 * API antes de entrar; o que não passar volta na mensagem com o motivo.
 */
export async function adicionarCriadores(formData: FormData) {
  const { usuarioId } = await exigirEquipe();
  const padrao = formData.get("rede") === "youtube" ? "youtube" : "instagram";
  const linhas = limpo(formData.get("lista"), 20000)
    .split(/\n|,|;/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 100);
  if (!linhas.length) voltar({ erro: "Cola pelo menos um @ ou link." });
  const base = {
    por_dia: inteiro(formData.get("por_dia"), 1, 20, 3),
    duracao_alvo: duracaoValida(formData.get("duracao")),
    direcao: limpo(formData.get("direcao"), 1000) || null,
    criado_por: usuarioId,
  };
  const db = createAdminClient();
  const falhas: string[] = [];
  let ok = 0;
  // 4 de cada vez: a lista inteira (~50) passa em menos de um minuto sem estourar o limite da Meta
  for (let i = 0; i < linhas.length; i += 4) {
    await Promise.all(
      linhas.slice(i, i + 4).map(async (linha) => {
        const { rede, entrada } = redeDaLinha(linha, padrao);
        try {
          const v = await validarCriador(rede, entrada);
          const { error } = await db.from("criador").insert({ ...base, rede, ...v });
          if (error) throw new Error(error.code === "23505" ? "já está na lista" : error.message);
          ok++;
        } catch (e) {
          falhas.push(`${linha}: ${(e as Error).message}`);
        }
      }),
    );
  }
  revalidatePath(PAGINA);
  voltar({ ...(ok ? { salvo: `${ok} criador(es) na lista` } : {}), ...(falhas.length ? { erro: falhas.join("\n").slice(0, 1500) } : {}) });
}

export async function editarCriador(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  await createAdminClient()
    .from("criador")
    .update({
      por_dia: inteiro(formData.get("por_dia"), 1, 20, 3),
      duracao_alvo: duracaoValida(formData.get("duracao")),
      direcao: limpo(formData.get("direcao"), 1000) || null,
      notas: limpo(formData.get("notas"), 1000) || null,
      so_shorts: formData.get("so_shorts") === "on",
    })
    .eq("id", id);
  revalidatePath(PAGINA);
  voltar({ salvo: "Salvo." });
}

export async function alternarCriador(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  await createAdminClient()
    .from("criador")
    .update({ ativo: formData.get("ativo") === "1", erro: null })
    .eq("id", id);
  revalidatePath(PAGINA);
  voltar({});
}

/** Apaga o criador. Os roteiros que já saíram dele ficam (sem o vínculo). */
export async function apagarCriador(formData: FormData) {
  await exigirEquipe();
  await createAdminClient().from("criador").delete().eq("id", limpo(formData.get("id"), 60));
  revalidatePath(PAGINA);
  voltar({ salvo: "Criador apagado." });
}

/** "Conferir agora": não espera o relógio (respeita o limite do dia dele e o total). */
export async function conferirAgora(formData: FormData) {
  await exigirEquipe();
  const db = createAdminClient();
  const { data: c } = await db.from("criador").select("*").eq("id", limpo(formData.get("id"), 60)).maybeSingle();
  if (!c) voltar({ erro: "Esse criador não existe mais." });
  const r = await conferirCriador(c as Criador, Infinity, await vagasDeCarrossel(await lerMonitor()));
  revalidatePath(PAGINA);
  revalidatePath("/roteiros");
  revalidatePath("/esteira");
  const achou = [r.novos ? `${r.novos} roteiro(s) na fila` : "", r.carrosseis ? `${r.carrosseis} carrossel(éis) na esteira` : ""].filter(Boolean).join(" e ");
  voltar(r.erro ? { erro: `@${c!.usuario}: ${r.erro}` } : { salvo: `@${c!.usuario}: ${achou || "nada novo"}` });
}

export async function salvarMonitor(formData: FormData) {
  await exigirEquipe();
  const atual = await lerMonitor();
  // o formulário das opções manda "opcoes" (checkbox desmarcado não vem no form)
  const opcoes = formData.has("opcoes");
  const hora = String(formData.get("hora") ?? "").trim();
  await salvarConfig("monitor", {
    ligado: formData.has("ligado") ? formData.get("ligado") === "1" : atual.ligado,
    intervalo_min: inteiro(formData.get("intervalo_min") ?? atual.intervalo_min, 10, 1440, MONITOR_PADRAO.intervalo_min),
    limite_dia: inteiro(formData.get("limite_dia") ?? atual.limite_dia, 1, 500, MONITOR_PADRAO.limite_dia),
    hora: opcoes ? (hora ? inteiro(hora, 0, 23, 9) : null) : atual.hora,
    carrosseis: opcoes ? formData.get("carrosseis") === "on" : atual.carrosseis,
    limite_carrosseis_dia: inteiro(formData.get("limite_carrosseis_dia") ?? atual.limite_carrosseis_dia, 1, 100, MONITOR_PADRAO.limite_carrosseis_dia),
    atraso_dias: inteiro(formData.get("atraso_dias") ?? atual.atraso_dias, 0, 7, MONITOR_PADRAO.atraso_dias),
    roteiro: opcoes ? (formData.get("roteiro") === "escrever" ? "escrever" : "transcricao") : atual.roteiro,
  });
  revalidatePath(PAGINA);
  voltar({ salvo: "Salvo." });
}
