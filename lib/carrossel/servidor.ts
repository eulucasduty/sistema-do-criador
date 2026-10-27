import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { conferirReferencias, referenciasDoCarrossel, type AgenteCarrossel, type TextoCarrossel, type VisualCarrossel } from "./comum";

/** O painel só enfileira. O CLI vê os arquivos originais, sem depender da análise resumida. */
export async function enfileirarCarrossel(id: string, opcoes: { agente: AgenteCarrossel; headline?: string; modoTexto: TextoCarrossel; modoVisual?: VisualCarrossel; pedido?: string; totalEsperado?: number }) {
  const db = createAdminClient();
  const { data: ref, error } = await db.from("referencia").select("id, tipo, arquivo, slides, numero").eq("id", id).single();
  if (error || !ref) throw new Error("Referência não encontrada.");
  if (ref.tipo === "reel") throw new Error("Essa referência é um vídeo.");
  const referencias = referenciasDoCarrossel(ref);
  conferirReferencias(referencias, opcoes.totalEsperado);
  const { data, error: filaErro } = await db.from("carrossel_trabalho").insert({
    referencia_id: id,
    agente: opcoes.agente,
    headline: opcoes.headline?.trim().slice(0, 500) || null,
    modo_texto: opcoes.modoTexto,
    // Sem escolha explícita vale o padrão do banco ("recriar").
    ...(opcoes.modoVisual ? { modo_visual: opcoes.modoVisual } : {}),
    pedido: opcoes.pedido?.trim().slice(0, 5000) || null,
    referencias,
  }).select("id").single();
  if (filaErro?.code === "23505") throw new Error("Este carrossel já está na fila ou sendo produzido.");
  if (filaErro || !data) throw new Error(filaErro?.message ?? "Não consegui colocar na fila.");
  if (ref.numero == null) await numerarCarrossel(id);
  return data.id as string;
}

/** Número fixo do carrossel (#01, #02…), dado na 1ª vez que ele entra na produção. */
async function numerarCarrossel(id: string) {
  const db = createAdminClient();
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data: ultimo } = await db.from("referencia").select("numero").not("numero", "is", null).order("numero", { ascending: false }).limit(1).maybeSingle();
    const { error } = await db.from("referencia").update({ numero: (ultimo?.numero ?? 0) + 1 }).eq("id", id).is("numero", null);
    if (!error) return;
    if (error.code !== "23505") throw new Error(error.message); // número pego ao mesmo tempo: tenta o próximo
  }
}
