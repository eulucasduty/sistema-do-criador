import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Configuração do sistema (tabela criador.configuracao), lida pelos processos do
// servidor. Cache curto: o relógio lê toda volta e você muda pelo painel.

type Chave =
  | "perfil"
  | "persona"
  | "ofertas"
  | "perfis_teste"
  | "instagram"
  | "facebook"
  | "pausa_por_eco_horas"
  | "followup_agente"
  | "lembrete_comentario"
  | "estacao_edicao"
  | "relogio";

/** Quem é o criador: vai pro editor (CTA, legenda), pro roteirista e pro agente. */
export type Perfil = {
  nome: string | null; // como você assina ("Ana")
  usuario: string | null; // @ do Instagram (vem da conexão; dá pra trocar)
  nicho: string | null; // "finanças pra jovens", "treino em casa"…
  publico: string | null; // pra quem você fala
  tom: string | null; // como você fala (gírias, bordões, jeito)
  foto_url: string | null; // foto de perfil (vem do Instagram)
  cor: "natural" | "quente" | "duty"; // look do vídeo no editor
  legenda: "bangers" | "labs"; // estilo de legenda padrão
  cores: { fundo: string; texto: string; destaque: string }; // sua marca (carrossel no visual "minha marca")
};
export const PERFIL_PADRAO: Perfil = {
  nome: null,
  usuario: null,
  nicho: null,
  publico: null,
  tom: null,
  foto_url: null,
  cor: "natural",
  legenda: "bangers",
  cores: { fundo: "#0b0b0c", texto: "#f5f4f0", destaque: "#ffc93c" },
};

/** O guia da sua voz, tirado dos seus reels (Esteira → Minha persona). */
export type Persona = {
  guia?: string;
  reels?: number;
  de?: string;
  ate?: string;
  atualizado_em?: string;
  status?: "atualizando" | "ok" | "erro";
  erro?: string;
  custo_usd?: number;
};

/** O link que o agente oferece no fim da conversa (produto, grupo, mentoria, agenda…). */
export type Oferta = { nome: string; link: string; para_quem: string };

/** O toque de quem some no meio da conversa com o agente. */
export type FollowupAgente = { horas: number; antes_da_oferta: string; depois_da_oferta: string };
/** Quem não respondeu a 1ª DM: resposta pública de novo no comentário ({arroba} = @ da pessoa). */
export type LembreteComentario = { ativo: boolean; horas: number; por_minuto: number; textos: string[] };

const cache = new Map<Chave, { valor: unknown; ate: number }>();
const TTL_MS = 30_000;

export async function lerConfig<T>(chave: Chave, padrao: T): Promise<T> {
  const c = cache.get(chave);
  if (c && c.ate > Date.now()) return (c.valor ?? padrao) as T;
  const { data } = await createAdminClient().from("configuracao").select("valor").eq("chave", chave).maybeSingle();
  const valor = data?.valor ?? null;
  cache.set(chave, { valor, ate: Date.now() + TTL_MS });
  return (valor ?? padrao) as T;
}

export async function salvarConfig(chave: Chave, valor: unknown): Promise<void> {
  await createAdminClient().from("configuracao").upsert({ chave, valor }, { onConflict: "chave" });
  cache.delete(chave);
}

export function esquecerConfig(chave?: Chave) {
  if (chave) cache.delete(chave);
  else cache.clear();
}

export async function lerPerfil(): Promise<Perfil> {
  const salvo = await lerConfig<Partial<Perfil>>("perfil", {});
  return { ...PERFIL_PADRAO, ...salvo, cores: { ...PERFIL_PADRAO.cores, ...(salvo.cores ?? {}) } };
}
