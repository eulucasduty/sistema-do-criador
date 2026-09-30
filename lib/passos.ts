import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { PERFIL_PADRAO, type Perfil, type Persona } from "@/lib/config";
import { estacaoLigada, type BatidaEstacao } from "@/lib/editor";
import type { ContaInstagram } from "@/lib/instagram/api";
import type { ContaFacebook } from "@/lib/instagram/descoberta";
import type { BatidaRelogio } from "@/lib/relogio";
import { urlDoApp } from "@/lib/app";

// O que já está ligado e o que falta: o passo a passo do Início e a tela de Conexões leem daqui.

export type Situacao = {
  url: string;
  vercel: boolean;
  env: { openrouter: boolean; cron: boolean; verifyToken: boolean; appSecret: boolean; appUrl: boolean };
  perfil: Perfil;
  persona: Persona;
  instagram: ContaInstagram;
  facebook: ContaFacebook;
  ultimoEventoIg: { recebido_em: string; tipo: string } | null;
  relogio: BatidaRelogio;
  relogioBatendo: boolean;
  relogioAgendado: boolean | null;
  estacao: BatidaEstacao;
  estacaoLigada: boolean;
  automacoes: number;
  automacoesAtivas: number;
  agenteAtivo: boolean;
  ofertas: number;
  referencias: number;
  edicoes: number;
  alertasAbertos: number;
};

export async function lerSituacao(): Promise<Situacao> {
  const db = createAdminClient();
  const [{ data: configs }, { data: ultimo }, auto, autoAtivas, { data: agente }, refs, eds, alertas, agendado] = await Promise.all([
    db.from("configuracao").select("chave, valor"),
    db.from("evento_recebido").select("recebido_em, tipo").order("recebido_em", { ascending: false }).limit(1).maybeSingle(),
    db.from("ig_automacao").select("id", { count: "exact", head: true }),
    db.from("ig_automacao").select("id", { count: "exact", head: true }).eq("ativa", true),
    db.from("agente").select("ativo").order("criado_em").limit(1).maybeSingle(),
    db.from("referencia").select("id", { count: "exact", head: true }),
    db.from("edicao").select("id", { count: "exact", head: true }),
    db.from("alerta").select("id", { count: "exact", head: true }).eq("resolvido", false),
    db.rpc("relogio_agendado"),
  ]);
  const cfg = Object.fromEntries((configs ?? []).map((c) => [c.chave, c.valor])) as Record<string, unknown>;
  const perfilSalvo = (cfg.perfil ?? {}) as Partial<Perfil>;
  const relogio = (cfg.relogio ?? {}) as BatidaRelogio;
  const estacao = (cfg.estacao_edicao ?? { visto_em: null, maquina: null }) as BatidaEstacao;
  return {
    url: urlDoApp(),
    vercel: Boolean(process.env.VERCEL),
    env: {
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      cron: Boolean(process.env.CRON_SECRET),
      verifyToken: Boolean(process.env.IG_WEBHOOK_VERIFY_TOKEN),
      appSecret: Boolean(process.env.META_APP_SECRET || process.env.IG_APP_SECRET),
      appUrl: Boolean(process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL),
    },
    perfil: { ...PERFIL_PADRAO, ...perfilSalvo, cores: { ...PERFIL_PADRAO.cores, ...(perfilSalvo.cores ?? {}) } },
    persona: (cfg.persona ?? {}) as Persona,
    instagram: (cfg.instagram ?? {}) as ContaInstagram,
    facebook: (cfg.facebook ?? {}) as ContaFacebook,
    ultimoEventoIg: ultimo ?? null,
    relogio,
    relogioBatendo: Boolean(relogio.visto_em && Date.now() - Date.parse(relogio.visto_em) < 3 * 60_000),
    relogioAgendado: agendado.error ? null : Boolean(agendado.data),
    estacao,
    estacaoLigada: estacaoLigada(estacao),
    automacoes: auto.count ?? 0,
    automacoesAtivas: autoAtivas.count ?? 0,
    agenteAtivo: Boolean(agente?.ativo),
    ofertas: Array.isArray(cfg.ofertas) ? cfg.ofertas.length : 0,
    referencias: refs.count ?? 0,
    edicoes: eds.count ?? 0,
    alertasAbertos: alertas.count ?? 0,
  };
}

/** O banco responde? (schema criado e exposto na Data API). Devolve o problema em português. */
export async function conferirBanco(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return "faltam as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
  }
  if (!process.env.SUPABASE_SECRET_KEY) return "falta a variável SUPABASE_SECRET_KEY";
  try {
    const { error } = await createAdminClient().from("configuracao").select("chave").limit(1);
    if (!error) return null;
    if (error.code === "PGRST106" || /schema must be one of|Invalid schema/i.test(error.message)) {
      return "o schema \"criador\" não está exposto: no Supabase, Project Settings → Data API → Exposed schemas, adicione criador e salve";
    }
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|Could not find the table/i.test(error.message)) {
      return "as tabelas ainda não existem: rode o arquivo supabase/migrations/001_sistema.sql no SQL Editor do Supabase";
    }
    if (/Invalid API key|JWT|apikey/i.test(error.message)) return "a SUPABASE_SECRET_KEY não confere com o projeto";
    return `o banco respondeu com erro: ${error.message}`;
  } catch (e) {
    return `não consegui falar com o Supabase: ${(e as Error).message}`;
  }
}
