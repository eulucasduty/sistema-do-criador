import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerConfig } from "@/lib/config";
import { perfilPublico, type CarrosselPublico } from "@/lib/instagram/descoberta";
import { guardarArquivo } from "@/lib/instagram/esteira";
import { agendarRoteiro, roteiroDaFala } from "@/lib/roteiro/processar";
import type { Transcricao } from "@/lib/roteiro/referencia";
import type { VersaoRoteiro } from "@/lib/roteiro/escrever";
import { MAX_SLIDES_CARROSSEL, tipoDoArquivo } from "@/lib/carrossel/comum";
import { MONITOR_PADRAO, horaDeHoje, inicioDoDia, janelaDosPosts, viralidade, type ConfigMonitor } from "./comum";
import { resolverCanal, videosNovos } from "./youtube";

// O monitor de criadores (call de 18/10: o Duty só grava; o sistema acha a referência e escreve).
// Dois laços do relógio:
//   criadores · a cada 2 min confere até 3 criadores vencidos (cada um a cada intervalo_min); post
//               novo em vídeo vira roteiro (origem 'monitor', automatico) na fila;
//   fila      · a cada 1 min manda o roteiro automático mais antigo pra transcrição e análise
//               (Gemini, no servidor, um por vez); daí ele vai pra estação, que escreve.
// Na estação, o pedido feito à mão passa na frente dos automáticos.
// Primeira conferência de um criador: só um dia de posts (não puxa o histórico).
// Desde 19/10: com `hora` na configuração, a conferência é diária (a partir das 9h, pedido do Duty) e
// o carrossel novo do criador (Instagram) vira referência na Esteira → Carrosséis, com os slides.
// Desde 20/10 (pedido do Duty): só post com `atraso_dias` (2) de vida, o mais viral primeiro, pra dar
// tempo de performar; e o roteiro do monitor é a própria fala do criador (`roteiro: "transcricao"`).

export type Criador = {
  id: string;
  rede: "instagram" | "youtube";
  usuario: string;
  nome: string | null;
  canal_id: string | null;
  ativo: boolean;
  so_shorts: boolean;
  por_dia: number;
  duracao_alvo: number;
  direcao: string | null;
  visto_ate: string | null;
  total_roteiros: number;
  total_carrosseis?: number;
};

type Post = {
  id: string;
  link: string;
  publicado_em: string;
  dados: { legenda: string | null; curtidas?: number | null; comentarios?: number | null; views?: number | null; titulo?: string | null };
};

const POR_VOLTA = 3;

export const lerMonitor = async (): Promise<ConfigMonitor> => ({ ...MONITOR_PADRAO, ...(await lerConfig<Partial<ConfigMonitor>>("monitor", {})) });

/** Confere o perfil antes de cadastrar: o @ existe e a API enxerga (devolve o que vai pro banco). */
export async function validarCriador(rede: string, entrada: string) {
  if (rede === "youtube") {
    const c = await resolverCanal(entrada);
    return { usuario: c.handle ?? c.canal_id, canal_id: c.canal_id, nome: c.nome, foto: null, seguidores: null };
  }
  const usuario = entrada
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
  const p = await perfilPublico(usuario, 1);
  return { usuario: p.usuario.toLowerCase(), canal_id: null, nome: p.nome, foto: p.foto, seguidores: p.seguidores };
}

/** Quantos roteiros automáticos já entraram hoje (de um criador ou de todos). */
async function feitosHoje(criadorId?: string): Promise<number> {
  const db = createAdminClient();
  let q = db.from("roteiro").select("id", { count: "exact", head: true }).eq("automatico", true).gte("criado_em", inicioDoDia().toISOString());
  if (criadorId) q = q.eq("criador_id", criadorId);
  const { count } = await q;
  return count ?? 0;
}

/** Quantos carrosséis do monitor já entraram na esteira hoje (todos os criadores). */
async function carrosseisHoje(): Promise<number> {
  const { count } = await createAdminClient().from("referencia").select("id", { count: "exact", head: true }).eq("origem", "monitor").gte("criado_em", inicioDoDia().toISOString());
  return count ?? 0;
}

/** Do mais viral pro menos; no empate, o mais novo. */
const porViral = <T extends { publicado_em: string }>(lista: T[], dados: (x: T) => Parameters<typeof viralidade>[0]) =>
  lista.sort((a, b) => viralidade(dados(b)) - viralidade(dados(a)) || b.publicado_em.localeCompare(a.publicado_em));

async function postsNovos(c: Criador, desde: Date, ate: Date): Promise<{ posts: Post[]; carrosseis: CarrosselPublico[]; maisNovo: string | null; perfil: Partial<Criador> & { foto?: string | null; seguidores?: number | null } }> {
  if (c.rede === "youtube") {
    if (!c.canal_id) throw new Error("o canal ficou sem id: apaga e cadastra de novo");
    const r = await videosNovos(c.canal_id, desde, c.so_shorts, ate);
    return {
      maisNovo: r.maisNovo,
      carrosseis: [],
      perfil: r.nome ? { nome: r.nome } : {},
      posts: r.videos.map((v) => ({ id: v.id, link: v.link, publicado_em: v.publicado_em, dados: { titulo: v.titulo, legenda: v.descricao, views: v.views } })),
    };
  }
  const p = await perfilPublico(c.usuario, 25);
  const datados = p.posts.filter((m) => m.publicado_em && m.permalink);
  const carrosseis = p.carrosseis.filter((m) => m.publicado_em && m.permalink);
  const naJanela = (iso: string) => new Date(iso) > desde && new Date(iso) <= ate;
  const maisNovo = [...datados, ...carrosseis].reduce<string | null>((max, m) => (!max || m.publicado_em! > max ? m.publicado_em! : max), null);
  return {
    maisNovo: maisNovo ? new Date(maisNovo).toISOString() : null,
    carrosseis: carrosseis
      .filter((m) => naJanela(m.publicado_em!))
      .sort((a, b) => new Date(b.publicado_em!).getTime() - new Date(a.publicado_em!).getTime()),
    perfil: { nome: p.nome, foto: p.foto, seguidores: p.seguidores },
    posts: datados
      .filter((m) => naJanela(m.publicado_em!))
      .sort((a, b) => new Date(b.publicado_em!).getTime() - new Date(a.publicado_em!).getTime())
      .map((m) => ({
        id: m.id,
        link: m.permalink!,
        publicado_em: new Date(m.publicado_em!).toISOString(),
        dados: { legenda: m.legenda, curtidas: m.curtidas, comentarios: m.comentarios },
      })),
  };
}

/**
 * O carrossel do criador vira referência na Esteira → Carrosséis, com todos os slides guardados no
 * bucket (o link da Meta vence). Carrossel incompleto (a Meta não liberou algum slide) fica de fora.
 */
async function guardarCarrossel(c: Criador, m: CarrosselPublico): Promise<boolean> {
  if (m.slides.length < 2 || m.slides.length > MAX_SLIDES_CARROSSEL) return false;
  const db = createAdminClient();
  const { data: ja } = await db.from("referencia").select("id").eq("criador_id", c.id).eq("post_id", m.id).maybeSingle();
  if (ja) return false;
  const caminhos: string[] = [];
  try {
    for (const s of m.slides) {
      const r = await fetch(s.url, { signal: AbortSignal.timeout(s.video ? 90_000 : 25_000) });
      if (!r.ok) throw new Error(`slide ${caminhos.length + 1}: download ${r.status}`);
      caminhos.push(await guardarArquivo(db, Buffer.from(await r.arrayBuffer()), s.video ? "video/mp4" : r.headers.get("content-type")));
    }
    const { error } = await db.from("referencia").insert({
      origem: "monitor",
      tipo: "carrossel",
      criador_id: c.id,
      post_id: m.id,
      arquivo: caminhos[0],
      arquivo_tipo: tipoDoArquivo(caminhos[0]),
      slides: caminhos.slice(1),
      url: m.permalink,
      autor: m.autor,
      legenda: m.legenda,
      enviado_por: "monitor",
    });
    if (error) throw new Error(error.code === "23505" ? "já entrou" : error.message);
    return true;
  } catch (e) {
    if (caminhos.length) await db.storage.from("esteira").remove(caminhos);
    console.error(`[monitor] carrossel de @${c.usuario} não entrou: ${(e as Error).message}`);
    return false;
  }
}

/**
 * Confere um criador agora: o que ele postou desde a última vez vira roteiro (até as vagas do dia
 * dele e do total) e o carrossel novo vai pra esteira (até as vagas de carrossel do dia). Erro fica
 * gravado no criador (a tela mostra) e não derruba os outros.
 */
export async function conferirCriador(c: Criador, vagasTotal = Infinity, vagasCarrosseis = 0): Promise<{ novos: number; carrosseis: number; erro: string | null }> {
  const db = createAdminClient();
  const agora = new Date();
  try {
    const cfg = await lerMonitor();
    const { desde, ate } = janelaDosPosts(c.visto_ate, cfg.atraso_dias, agora);
    const r = await postsNovos(c, desde, ate);
    const { maisNovo, perfil } = r;
    // o que já entrou (de uma conferência com a janela por cima) não ocupa vaga
    const ids = [...r.posts, ...r.carrosseis].map((p) => p.id);
    const [{ data: jaRoteiros }, { data: jaCarrosseis }] = ids.length
      ? await Promise.all([
          db.from("roteiro").select("post_id").eq("criador_id", c.id).in("post_id", ids),
          db.from("referencia").select("post_id").eq("criador_id", c.id).in("post_id", ids),
        ])
      : [{ data: [] }, { data: [] }];
    const ja = new Set([...(jaRoteiros ?? []), ...(jaCarrosseis ?? [])].map((x) => x.post_id as string));
    let posts = r.posts.filter((p) => !ja.has(p.id));
    let carrosseis = r.carrosseis.filter((m) => !ja.has(m.id));
    if (cfg.atraso_dias > 0) {
      posts = porViral(posts, (p) => p.dados);
      carrosseis = porViral(carrosseis as Array<CarrosselPublico & { publicado_em: string }>, (m) => m);
    }
    const vagas = Math.max(0, Math.min(c.por_dia - (await feitosHoje(c.id)), vagasTotal));
    let novos = 0;
    for (const p of posts.slice(0, vagas)) {
      const { error } = await db.from("roteiro").insert({
        origem: "monitor",
        automatico: true,
        criador_id: c.id,
        post_id: p.id,
        post_publicado_em: p.publicado_em,
        post_dados: { ...p.dados, link: p.link },
        link: p.link,
        direcao: c.direcao,
        duracao_alvo: c.duracao_alvo,
        status: "na_fila",
        etapa: "na fila (veio do monitor)",
      });
      if (!error) novos++;
      else if (error.code !== "23505") throw new Error(`não consegui pôr na fila: ${error.message}`);
    }
    let novosCarrosseis = 0;
    for (const m of carrosseis) {
      if (novosCarrosseis >= vagasCarrosseis) break;
      if (await guardarCarrossel(c, m)) novosCarrosseis++;
    }
    // O que passou do limite do dia fica de fora: o próximo post novo é o que conta. Com o atraso, a
    // janela anda até o fim dela (o que é mais novo entra nas próximas conferências).
    const visto = cfg.atraso_dias > 0 ? ate.toISOString() : ([c.visto_ate, maisNovo].filter(Boolean).sort().pop() ?? null);
    await db
      .from("criador")
      .update({
        ...perfil,
        visto_ate: visto ?? agora.toISOString(),
        checado_em: agora.toISOString(),
        erro: null,
        total_roteiros: c.total_roteiros + novos,
        total_carrosseis: (c.total_carrosseis ?? 0) + novosCarrosseis,
      })
      .eq("id", c.id);
    return { novos, carrosseis: novosCarrosseis, erro: null };
  } catch (e) {
    const erro = (e as Error).message.slice(0, 300);
    await db.from("criador").update({ checado_em: agora.toISOString(), erro }).eq("id", c.id);
    return { novos: 0, carrosseis: 0, erro };
  }
}

/** Vagas de carrossel que ainda sobram hoje (0 com a opção desligada). */
export async function vagasDeCarrossel(cfg: ConfigMonitor): Promise<number> {
  return cfg.carrosseis ? Math.max(0, cfg.limite_carrosseis_dia - (await carrosseisHoje())) : 0;
}

/**
 * Laço "criadores" do relógio: confere os vencidos, respeitando o limite do dia. Com `hora`, vencido é
 * quem ainda não foi conferido desde a hora de hoje (uma busca por dia); antes dela, nada.
 */
export async function passoDosCriadores(): Promise<void> {
  const cfg = await lerMonitor();
  if (!cfg.ligado) return;
  let vagas = cfg.limite_dia - (await feitosHoje());
  let vagasCarrosseis = await vagasDeCarrossel(cfg);
  if (vagas <= 0 && vagasCarrosseis <= 0) return;
  const db = createAdminClient();
  let vencido: string;
  if (cfg.hora != null) {
    const inicio = horaDeHoje(cfg.hora);
    if (Date.now() < inicio.getTime()) return;
    vencido = inicio.toISOString();
  } else vencido = new Date(Date.now() - Math.max(10, cfg.intervalo_min) * 60_000).toISOString();
  const { data } = await db
    .from("criador")
    .select("*")
    .eq("ativo", true)
    .or(`checado_em.is.null,checado_em.lt.${vencido}`)
    .order("checado_em", { ascending: true, nullsFirst: true })
    .limit(POR_VOLTA);
  for (const c of (data ?? []) as Criador[]) {
    const r = await conferirCriador(c, Math.max(0, vagas), vagasCarrosseis);
    if (r.erro) console.error("[monitor]", c.rede, c.usuario, r.erro);
    else if (r.novos || r.carrosseis) console.log(`[monitor] @${c.usuario} (${c.rede}): ${r.novos} roteiro(s) na fila, ${r.carrosseis} carrossel(éis) na esteira`);
    vagas -= r.novos;
    vagasCarrosseis -= r.carrosseis;
    if (vagas <= 0 && vagasCarrosseis <= 0) break;
  }
}

/**
 * Laço "fila" do relógio: o roteiro automático mais antigo vai pra transcrição (o pedido manual já
 * foi agendado na hora, pelo after() da tela). Quem caiu no meio volta depois de 10 min (a trava do
 * processarRoteiro).
 */
export async function passoDaFilaDoMonitor(): Promise<void> {
  const db = createAdminClient();
  const trava = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data } = await db
    .from("roteiro")
    .select("id")
    .in("status", ["na_fila", "transcrevendo"])
    .or(`processando_desde.is.null,processando_desde.lt.${trava}`)
    .order("criado_em", { ascending: true })
    .limit(1);
  if (data?.[0]) await agendarRoteiro(data[0].id);
  else await fecharComAFala();
}

/**
 * Os automáticos que já estavam esperando a estação quando o modo virou "transcricao" (20/10): viram
 * roteiro com a fala do criador, sem gastar o plano do Claude. A troca de status é a trava (a estação
 * pega o mesmo status).
 */
async function fecharComAFala(): Promise<void> {
  if ((await lerMonitor()).roteiro !== "transcricao") return;
  const db = createAdminClient();
  const { data } = await db
    .from("roteiro")
    .select("id, duracao_alvo, post_dados, transcricao, versoes, titulo, custo_usd")
    .eq("automatico", true)
    .eq("status", "aguardando_estacao")
    .not("transcricao", "is", null)
    .order("criado_em", { ascending: true })
    .limit(10);
  for (const r of data ?? []) {
    if ((r.versoes as unknown[] | null)?.length) continue;
    try {
      const v = await roteiroDaFala(r, r.transcricao as Transcricao);
      await db
        .from("roteiro")
        .update({
          status: "pronto",
          etapa: null,
          erro: null,
          versoes: [v] satisfies VersaoRoteiro[],
          titulo: r.titulo || v.titulo,
          custo_usd: Number((Number(r.custo_usd || 0) + v.custo_usd).toFixed(4)),
        })
        .eq("id", r.id)
        .eq("status", "aguardando_estacao");
    } catch (e) {
      // a tradução falhou: "Tentar de novo" na página do roteiro refaz
      await db.from("roteiro").update({ status: "erro", etapa: null, erro: `tradução: ${(e as Error).message}`.slice(0, 500) }).eq("id", r.id).eq("status", "aguardando_estacao");
    }
  }
}
