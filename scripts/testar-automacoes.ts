import assert from "node:assert/strict";
import type { Db } from "@/lib/supabase/admin";

async function principal() {
process.env.IG_SIMULADO = "1";
const { enviarRegistrado } = await import("@/lib/instagram/enviar");
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async () => { throw new Error("O teste não pode acessar a rede."); };

function banco(contato: { nao_contatar: boolean } | null, falha = false) {
  const gravadas: Record<string, unknown>[] = [];
  const db = {
    from(tabela: string) {
      if (tabela === "contato") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: contato, error: falha ? { message: "indisponível" } : null }) }) }) };
      assert.equal(tabela, "mensagem");
      return {
        insert(linha: Record<string, unknown>) { gravadas.push(linha); return { select: () => ({ single: async () => ({ data: { id: "mensagem-teste" } }) }) }; },
        update: () => ({ eq: async () => ({ error: null }) }),
      };
    },
  } as unknown as Db;
  return { db, gravadas };
}

const pedido = { conversaId: "conversa-teste", contatoId: "contato-teste", igsid: "e2e_teste", texto: "Seu material está aqui." };
try {
  for (const contato of [null, { nao_contatar: true }]) {
    const { db, gravadas } = banco(contato);
    assert.equal(await enviarRegistrado(db, pedido), null);
    assert.equal(gravadas.length, 0, "não registrar nem enviar para contato ausente ou bloqueado");
  }
  const falho = banco({ nao_contatar: false }, true);
  await assert.rejects(() => enviarRegistrado(falho.db, pedido), /preferência de contato/);
  assert.equal(falho.gravadas.length, 0);
  const permitido = banco({ nao_contatar: false });
  await enviarRegistrado(permitido.db, pedido);
  assert.equal(permitido.gravadas.length, 1);
  assert.equal(permitido.gravadas[0].autor, "sistema", "automação registrada como sistema, sem agente");
  console.log("4 cenários de envio conferidos, sem rede: bloqueio, contato ausente, falha no banco e envio simulado.");
} finally { globalThis.fetch = fetchOriginal; }
}

principal().catch(erro => { console.error(erro); process.exitCode = 1; });
