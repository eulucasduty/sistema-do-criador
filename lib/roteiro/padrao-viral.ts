import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { esquecerConfig, lerConfig, salvarConfig } from "@/lib/config";
import { PADRAO_INICIAL, padraoEmTexto, padraoValido, type ExemploViral, type PadraoViral } from "./padrao-inicial.mjs";

// O guia do padrão viral no banco (configuracao "padrao_viral"), editável em Roteiros → Padrão
// viral. A estação lê o mesmo registro na hora de escrever (lib/roteiro/padrao-inicial.mjs).

export { PADRAO_INICIAL, padraoEmTexto };
export type { ExemploViral, PadraoViral };

export async function lerPadrao(): Promise<PadraoViral> {
  return padraoValido(await lerConfig<unknown>("padrao_viral", null));
}

export async function salvarPadrao(p: PadraoViral): Promise<void> {
  await salvarConfig("padrao_viral", { ...p, atualizado_em: new Date().toISOString() });
}

/** Volta pro padrão do sistema (apaga o que foi salvo). */
export async function restaurarPadrao(): Promise<void> {
  await createAdminClient().from("configuracao").delete().eq("chave", "padrao_viral");
  esquecerConfig("padrao_viral");
}
