import "server-only";
import { createAdminClient, type Db } from "@/lib/supabase/admin";
import { lerConfig, type FollowupAgente, type LembreteComentario } from "@/lib/config";
import { digitandoIG, perfilDe, responderComentario } from "./api";
import { enviarRegistrado } from "./enviar";

// Os toques de quem parou de responder no Instagram.
//
// 1. Entrega: recebeu o material e não respondeu mais → os toques da automação
//    (ig_automacao.followups: [{horas, texto}], padrão "{nome}?" em 12 h e "?" em 23 h),
//    contados da ÚLTIMA mensagem da pessoa: é dela que conta a janela de 24 h da Meta.
// 2. Primeira DM sem resposta (muita gente comenta e deixa pra ver depois): a Meta NÃO
//    deixa mandar outra DM antes de a pessoa responder a resposta privada (erro 10,
//    "fora do período permitido"). Então vai um lembrete em PÚBLICO,
//    respondendo o comentário de novo 12 h depois ("@fulano chegou lá? te mandei na dm");
//    a pessoa recebe a notificação. Uma vez por comentário (configuracao.lembrete_comentario).
// 3. Conversa com o agente: a pessoa sumiu no meio e não clicou no link da oferta →
//    um toque 23 h depois da última mensagem dela (configuracao.followup_agente). Depois
//    da oferta, o toque pergunta se ela conseguiu abrir o link.
// Respondeu? Os toques param e o agente assume pela rota normal.
// {nome} (ou {{nome}}) vira o primeiro nome do perfil; sem nome, o @.

type Toque = { horas: number; texto: string };
type Linha = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const SIMULADO = process.env.IG_SIMULADO === "1";
const deTeste = (igsid: string | null | undefined) => /^e2e_/.test(igsid ?? "");
const MARGEM_MS = 10 * 60_000; // não manda nos últimos 10 min da janela
const JANELA_MS = 24 * 3600e3;
const MAX_POR_VOLTA = 10; // no máximo 10 por volta do relógio, com respiro entre eles
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const um = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

const FOLLOWUP_AGENTE_PADRAO: FollowupAgente = {
  horas: 23,
  antes_da_oferta: "{nome}?",
  depois_da_oferta: "conseguiu abrir o link?",
};

/** "Maria Clara Souza" → "Maria". Nome que não parece nome (emoji, número, marca) fica vazio. */
function primeiroNome(nome: string | null | undefined): string {
  const p = String(nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^\p{L}[\p{L}'-]{1,19}$/u.test(p)) return "";
  return p[0].toUpperCase() + p.slice(1).toLowerCase();
}

export async function passoDoFollowup(): Promise<void> {
  const db = createAdminClient();
  let enviados = await followupDaEntrega(db, 0);
  enviados = await lembreteNoComentario(db, enviados);
  await followupDoAgente(db, enviados);
}

/** Ninguém de fora no teste, ninguém de verdade no modo simulado. */
function podeMandar(contato: Linha | null): contato is Linha {
  return Boolean(contato?.instagram_id) && SIMULADO === deTeste(contato!.instagram_id);
}

async function nomeDe(contato: Linha): Promise<string> {
  return contato.primeiro_nome || primeiroNome((await perfilDe(contato.instagram_id).catch(() => null))?.name) || contato.instagram_usuario || "";
}

const preencher = (texto: string, nome: string) => texto.replace(/\{\{?\s*nome\s*\}?\}/gi, nome).replace(/^\s*\?/, "?").trim();

async function mandar(db: Db, conversaId: string, contato: Linha, texto: string, metadados: Record<string, unknown>): Promise<void> {
  await digitandoIG(contato.instagram_id).catch(() => {});
  await dormir(1500);
  await enviarRegistrado(db, { conversaId, contatoId: contato.id, igsid: contato.instagram_id, texto, metadados });
  await dormir(2000 + Math.random() * 2000);
}

// ── 1. quem recebeu o material e não respondeu ─────────────────────

async function followupDaEntrega(db: Db, jaEnviados: number): Promise<number> {
  const agora = Date.now();
  let enviados = jaEnviados;
  const { data: fluxos } = await db
    .from("ig_fluxo")
    .select(
      "id, entregue_em, followups_enviados, contato:contato_id (id, instagram_id, instagram_usuario, primeiro_nome, nao_contatar, agente_pausado_ate), automacao:automacao_id (followups, ativa)",
    )
    .eq("etapa", "entregue")
    .gte("entregue_em", new Date(agora - 26 * 3600e3).toISOString())
    .order("entregue_em", { ascending: true })
    .limit(100);

  for (const f of fluxos ?? []) {
    if (enviados >= MAX_POR_VOLTA) break;
    const contato = um(f.contato) as Linha | null;
    const automacao = um(f.automacao) as { followups?: Toque[]; ativa?: boolean } | null;
    if (!podeMandar(contato)) continue;
    const toques = (automacao?.followups ?? []).filter((t) => t?.texto?.trim() && Number(t.horas) > 0);
    const k = Number(f.followups_enviados ?? 0);
    if (!automacao?.ativa || k >= toques.length) continue;
    const parar = () => db.from("ig_fluxo").update({ followups_enviados: toques.length }).eq("id", f.id);
    if (contato.nao_contatar || contato.agente_pausado_ate) {
      await parar();
      continue;
    }

    const { data: conversa } = await db
      .from("conversa")
      .select("id, status, janela_ate")
      .eq("contato_id", contato.id)
      .maybeSingle();
    if (!conversa?.janela_ate || conversa.status === "com_voce") continue;

    // Respondeu depois da entrega (no modo "só automação" o fluxo não muda de etapa)
    const { count: respondeu } = await db
      .from("mensagem")
      .select("id", { count: "exact", head: true })
      .eq("conversa_id", conversa.id)
      .eq("direcao", "entrada")
      .gt("enviada_em", f.entregue_em);
    if (respondeu) {
      await parar();
      continue;
    }

    const fim = Date.parse(conversa.janela_ate);
    const inicio = fim - JANELA_MS; // a última mensagem dela
    if (agora < inicio + toques[k].horas * 3600e3) continue; // ainda não é a hora
    if (agora > fim - MARGEM_MS) {
      await parar(); // a janela fechou: a Meta não entrega mais
      continue;
    }

    // Trava: só uma volta do relógio manda este toque
    const { data: pega } = await db
      .from("ig_fluxo")
      .update({ followups_enviados: k + 1, ultimo_followup_em: new Date().toISOString() })
      .eq("id", f.id)
      .eq("followups_enviados", k)
      .select("id");
    if (!pega?.length) continue;

    try {
      await mandar(db, conversa.id, contato, preencher(toques[k].texto, await nomeDe(contato)), { followup: k + 1 });
      enviados++;
    } catch (e) {
      console.warn("[followup]", contato.instagram_usuario, (e as Error).message);
    }
  }
  return enviados;
}

// ── 2. quem não respondeu a primeira DM: lembrete no comentário ────

const LEMBRETE_PADRAO: LembreteComentario = {
  ativo: true,
  horas: 12,
  por_minuto: 5, // resposta pública em lote chama atenção: vai devagar
  textos: ["{arroba} chegou lá? te mandei na dm 👀"],
};
const LEMBRETE_ATE_MS = 48 * 3600e3; // comentário mais velho que isso não ganha lembrete

async function lembreteNoComentario(db: Db, jaEnviados: number): Promise<number> {
  let enviados = jaEnviados;
  const cfg = { ...LEMBRETE_PADRAO, ...(await lerConfig<Partial<LembreteComentario>>("lembrete_comentario", {})) };
  const textos = (cfg.textos ?? []).filter((t) => t?.trim());
  if (!cfg.ativo || !textos.length || enviados >= MAX_POR_VOLTA) return enviados;
  const horas = Math.max(1, Number(cfg.horas) || 12);
  const porVolta = Math.min(MAX_POR_VOLTA, Math.max(1, Number(cfg.por_minuto) || 5)); // o relógio dá uma volta por minuto
  const agora = Date.now();

  // No teste, só os e2e_; em produção, nunca eles (e a fila não trava em quem não entra)
  const consulta = db
    .from("ig_fluxo")
    .select("id, criado_em, comentario_id, contato:contato_id!inner (id, instagram_id, instagram_usuario, nao_contatar, agente_pausado_ate), automacao:automacao_id (ativa)");
  const { data: fluxos } = await (SIMULADO ? consulta.like("contato.instagram_id", "e2e_%") : consulta.not("contato.instagram_id", "like", "e2e_%"))
    .eq("etapa", "abertura")
    .is("lembrete_em", null)
    .not("comentario_id", "is", null)
    .lte("criado_em", new Date(agora - horas * 3600e3).toISOString())
    .gte("criado_em", new Date(agora - LEMBRETE_ATE_MS).toISOString())
    .order("criado_em", { ascending: true })
    .limit(30);

  let nestaVolta = 0;
  for (const f of fluxos ?? []) {
    if (enviados >= MAX_POR_VOLTA || nestaVolta >= porVolta) break;
    const contato = um(f.contato) as Linha | null;
    const automacao = um(f.automacao) as { ativa?: boolean } | null;
    if (!podeMandar(contato)) continue;
    const pular = (motivo: string) => db.from("ig_fluxo").update({ lembrete_em: new Date().toISOString(), lembrete_texto: `(não mandou: ${motivo})` }).eq("id", f.id);
    if (!automacao?.ativa) {
      await pular("automação desligada");
      continue;
    }
    if (contato.nao_contatar || contato.agente_pausado_ate || !contato.instagram_usuario) {
      await pular(contato.instagram_usuario ? "contato pausado ou pediu pra sair" : "sem o @ da pessoa");
      continue;
    }

    // Respondeu por DM depois da abertura (a etapa ainda não mudou)? Não precisa lembrar
    const { data: conversa } = await db.from("conversa").select("id").eq("contato_id", contato.id).maybeSingle();
    if (conversa) {
      const { count: respondeu } = await db
        .from("mensagem")
        .select("id", { count: "exact", head: true })
        .eq("conversa_id", conversa.id)
        .eq("direcao", "entrada")
        .gt("enviada_em", f.criado_em);
      if (respondeu) {
        await pular("ela respondeu na DM");
        continue;
      }
    }

    const texto = textos[Math.floor(Math.random() * textos.length)].replace(/\{arroba\}/g, `@${contato.instagram_usuario}`).trim();
    // Trava: só uma volta do relógio responde este comentário
    const { data: pega } = await db
      .from("ig_fluxo")
      .update({ lembrete_em: new Date().toISOString(), lembrete_texto: texto })
      .eq("id", f.id)
      .is("lembrete_em", null)
      .select("id");
    if (!pega?.length) continue;

    try {
      await responderComentario(f.comentario_id, texto);
      enviados++;
      nestaVolta++;
      await dormir(4000 + Math.random() * 4000);
    } catch (e) {
      console.warn("[lembrete no comentário]", contato.instagram_usuario, (e as Error).message);
      await db.from("ig_fluxo").update({ lembrete_texto: `(falhou: ${(e as Error).message.slice(0, 200)})` }).eq("id", f.id);
    }
  }
  return enviados;
}

// ── 3. quem sumiu no meio da conversa com o agente ─────────────────

async function followupDoAgente(db: Db, jaEnviados: number): Promise<number> {
  let enviados = jaEnviados;
  if (enviados >= MAX_POR_VOLTA) return enviados;
  const cfg = { ...FOLLOWUP_AGENTE_PADRAO, ...(await lerConfig<Partial<FollowupAgente>>("followup_agente", {})) };
  const horas = Math.min(23.5, Math.max(1, Number(cfg.horas) || 23));
  const agora = Date.now();

  // Última mensagem dela há mais de `horas` e a janela ainda aberta (fecha em 24 h)
  const { data: conversas } = await db
    .from("conversa")
    .select("id, status, janela_ate, contato:contato_id (id, instagram_id, instagram_usuario, primeiro_nome, nao_contatar, agente_pausado_ate, tags)")
    .in("status", ["aberta", "encerrada"])
    .is("aguardando_desde", null)
    .gte("janela_ate", new Date(agora + MARGEM_MS).toISOString())
    .lte("janela_ate", new Date(agora + JANELA_MS - horas * 3600e3).toISOString())
    .limit(50);

  for (const c of conversas ?? []) {
    if (enviados >= MAX_POR_VOLTA) break;
    const contato = um(c.contato) as Linha | null;
    if (!podeMandar(contato) || contato.nao_contatar || contato.agente_pausado_ate) continue;

    // Quem falou por último foi o agente (não a sequência, nem um toque já mandado)
    const { data: ultima } = await db
      .from("mensagem")
      .select("direcao, metadados")
      .eq("conversa_id", c.id)
      .order("enviada_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    const meta = (ultima?.metadados ?? {}) as Record<string, unknown>;
    if (ultima?.direcao !== "saida" || !meta.turno) continue;

    // Chegou no fim do funil: recebeu a oferta e clicou no link
    const tags: string[] = contato.tags ?? [];
    const oferta = tags.includes("oferta_enviada");
    if (oferta && tags.includes("clicou_oferta")) continue;
    // Encerrada antes da oferta = ela disse que não queria conversa; depois da oferta, ainda
    // não abriu o link, então o toque vale
    if (c.status === "encerrada" && !oferta) continue;

    const texto = oferta ? cfg.depois_da_oferta : cfg.antes_da_oferta;
    if (!texto?.trim()) continue;
    try {
      await mandar(db, c.id, contato, preencher(texto, await nomeDe(contato)), { followup_agente: true, oferta });
      enviados++;
    } catch (e) {
      console.warn("[followup agente]", contato.instagram_usuario, (e as Error).message);
    }
  }
  return enviados;
}
