import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerConfig, PERFIL_PADRAO, type Perfil, type Persona } from "@/lib/config";
import { estacaoLigada, type BatidaEstacao } from "@/lib/editor";
import type { ContaInstagram } from "@/lib/instagram/api";
import type { ContaFacebook } from "@/lib/instagram/descoberta";
import type { BatidaRelogio } from "@/lib/relogio";
import { urlDoApp } from "@/lib/app";
import { chaveOpenRouter, segredoDoRelogio, segredosDoApp, tokenDoWebhook } from "@/lib/segredos";

// O que já está ligado e o que falta: o passo a passo do Início e a tela de Conexões leem daqui.

export type Situacao = {
  url: string;
  vercel: boolean;
  env: { openrouter: boolean; cron: boolean; verifyToken: boolean; appSecret: boolean; appUrl: boolean };
  /** O token de verificação do webhook, pra você colar no app da Meta (só o dono vê esta tela). */
  tokenWebhook: string | null;
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
      openrouter: Boolean(await chaveOpenRouter()),
      cron: Boolean(segredoDoRelogio()),
      verifyToken: Boolean(tokenDoWebhook()),
      appSecret: (await segredosDoApp()).length > 0,
      appUrl: Boolean(process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL),
    },
    tokenWebhook: tokenDoWebhook(),
    perfil: { ...PERFIL_PADRAO, ...perfilSalvo, cores: { ...PERFIL_PADRAO.cores, ...(perfilSalvo.cores ?? {}) } },
    persona: (cfg.persona ?? {}) as Persona,
    instagram: await lerConfig<ContaInstagram>("instagram", {}),
    facebook: await lerConfig<ContaFacebook>("facebook", {}),
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

export type ProblemaBanco = { tipo: "variaveis" | "sql" | "outro"; mensagem: string };

/** O banco responde? (tabelas criadas pelo SQL da instalação). Devolve o problema em português. */
export async function conferirBanco(): Promise<ProblemaBanco | null> {
  const faltam = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"].filter((v) => !process.env[v]);
  if (faltam.length) return { tipo: "variaveis", mensagem: `faltam as variáveis ${faltam.join(", ")} na hospedagem` };
  try {
    const { error } = await createAdminClient().from("configuracao").select("chave").limit(1);
    if (!error) return null;
    if (error.code === "PGRST106" || /schema must be one of|Invalid schema/i.test(error.message)) {
      return { tipo: "outro", mensagem: "o Supabase não está expondo as tabelas: em Project Settings → Data API, deixe o schema public nos Exposed schemas" };
    }
    if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|Could not find the table/i.test(error.message)) {
      return { tipo: "sql", mensagem: "o banco ainda está vazio: falta rodar o SQL da instalação" };
    }
    if (/Invalid API key|JWT|apikey/i.test(error.message)) return { tipo: "variaveis", mensagem: "a SUPABASE_SECRET_KEY não confere com o projeto" };
    console.error("[instalação] banco:", error.code, error.message);
    return { tipo: "outro", mensagem: "o banco respondeu com erro (o detalhe está no log da hospedagem)" };
  } catch (e) {
    console.error("[instalação] supabase:", (e as Error).message);
    return { tipo: "outro", mensagem: "não consegui falar com o Supabase: confira a NEXT_PUBLIC_SUPABASE_URL" };
  }
}

/** Link direto pro SQL Editor do seu projeto (tirado do endereço do Supabase). */
export function linkDoSqlEditor(): string {
  const ref = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : "https://supabase.com/dashboard/projects";
}
