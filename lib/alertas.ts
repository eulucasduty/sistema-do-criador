import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Alertas: o que precisa de você aparece no painel (Início e Leads).
// Ex.: o agente passou a conversa pra você, alguém quer comprar, o token do Instagram caiu.

export type TipoAlerta = "precisa_de_voce" | "quer_comprar" | "perguntou_se_e_ia" | "nao_contatar" | "erro";

export const ROTULO_ALERTA: Record<TipoAlerta, string> = {
  precisa_de_voce: "Precisa de você",
  quer_comprar: "Quer comprar",
  perguntou_se_e_ia: "Perguntou se é IA",
  nao_contatar: "Pediu pra sair",
  erro: "Atenção no sistema",
};

export async function criarAlerta(opcoes: { contatoId: string | null; tipo: TipoAlerta; motivo: string }): Promise<void> {
  const db = createAdminClient();
  const { contatoId, tipo, motivo } = opcoes;
  // Um alerta aberto por tipo e contato: o segundo só atualiza o motivo
  let existente = db.from("alerta").select("id").eq("tipo", tipo).eq("resolvido", false);
  existente = contatoId ? existente.eq("contato_id", contatoId) : existente.is("contato_id", null).eq("motivo", motivo);
  const { data: aberto } = await existente.limit(1).maybeSingle();
  if (aberto) {
    await db.from("alerta").update({ motivo }).eq("id", aberto.id);
    return;
  }
  await db.from("alerta").insert({ contato_id: contatoId, tipo, motivo });
}
