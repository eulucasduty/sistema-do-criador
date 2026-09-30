import "server-only";
import type { Db } from "@/lib/supabase/admin";
import { enviarDM, enviarDMComBotoes, respostaPrivada, type Botao, type RespostaRapida } from "./api";

// Envio pelo Instagram REGISTRADO ANTES de sair. A Meta devolve cada mensagem que a
// conta manda como "eco" no webhook — tanto as do sistema quanto as que você digita
// no app. Gravando antes, o eco do sistema é reconhecido (pelo id ou pelo texto) e só o
// que você digitou tira o agente da conversa (lib/instagram/receber.ts → tratarEco).

type Envio = {
  conversaId: string;
  contatoId: string;
  texto: string;
  metadados?: Record<string, unknown>;
  rapidas?: RespostaRapida[];
  botoes?: Botao[]; // botão de link (só em DM, não na resposta privada ao comentário)
} & ({ igsid: string } | { comentarioId: string });

export async function enviarRegistrado(db: Db, e: Envio): Promise<string | null> {
  const { data: linha } = await db
    .from("mensagem")
    .insert({
      conversa_id: e.conversaId,
      contato_id: e.contatoId,
      direcao: "saida",
      autor: "agente",
      tipo: "texto",
      conteudo: e.texto,
      status: "enviada",
      metadados: { ...(e.botoes?.length ? { botoes: e.botoes } : {}), ...(e.metadados ?? {}) },
      enviada_em: new Date().toISOString(),
    })
    .select("id")
    .single();
  try {
    const mid =
      "comentarioId" in e
        ? await respostaPrivada(e.comentarioId, e.texto, e.rapidas)
        : e.botoes?.length
          ? await enviarDMComBotoes(e.igsid, e.texto, e.botoes)
          : await enviarDM(e.igsid, e.texto, e.rapidas);
    if (mid && linha) await db.from("mensagem").update({ externo_id: mid }).eq("id", linha.id);
    return mid;
  } catch (err) {
    if (linha) await db.from("mensagem").update({ status: "falhou", erro: (err as Error).message.slice(0, 300) }).eq("id", linha.id);
    throw err;
  }
}
