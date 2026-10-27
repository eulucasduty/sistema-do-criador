import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { falaCorrida, type Analise, type Assistido } from "@/lib/esteira/referencia";
import { escreverRoteiro, MOTOR_API, type Entrada, type VersaoRoteiro } from "./escrever";
import { perfilPublico } from "@/lib/instagram/descoberta";
import { baixarDoLink, baixarUrl } from "./link";
import { analisarReferencia, transcreverArquivo, type AnaliseReferencia, type Transcricao } from "./referencia";
import { versaoDoTexto } from "./da-texto";
import { emPortugues } from "./traduzir";
import { lerConfig } from "@/lib/config";
import { MONITOR_PADRAO, type ConfigMonitor } from "@/lib/monitor/comum";

// O caminho de um roteiro (lucasduty.roteiro), em segundo plano (after() da Server Action):
//   referência (arquivo, link ou reel da esteira) → transcrição → análise abstrata (Gemini, centavos)
//   → "aguardando a estação" → a estação no PC do criador escreve no Claude Code do plano dele
//   (scripts/estacao-roteiros.ts) → pronto.
// Desde 06/10 a escrita não roda mais aqui: só pelo botão manual "gerar agora pela API" (via = 'api').
// Desde 20/10 (pedido do Duty), o post do criador monitorado vira roteiro com a própria fala dele,
// sem análise e sem estação (configuracao.monitor.roteiro = "transcricao", o padrão).
// Cada etapa grava no banco: se cair no meio, "Tentar de novo" continua de onde parou. O arquivo da
// referência sai do storage assim que vira transcrição. Um por vez (o container tem 512 MB e o
// vídeo vai em base64 pro Gemini).

export const BUCKET = "esteira";
export const MAX_VERSOES = 5;

type Linha = {
  id: string;
  tema: string | null;
  direcao: string | null;
  palavra_cta: string | null;
  duracao_alvo: number;
  transcricao: unknown;
  analise: unknown;
};

/** O que o escritor recebe, a partir da linha do roteiro (servidor e estação usam o mesmo). */
export function entradaDoRoteiro(r: Linha, aoReescrever?: Entrada["aoReescrever"]): Entrada {
  const transcricao = r.transcricao as Transcricao | null;
  return {
    tema: r.tema,
    direcao: r.direcao,
    palavraCta: r.palavra_cta,
    duracaoAlvo: r.duracao_alvo,
    analise: r.analise as AnaliseReferencia | null,
    falaReferencia: transcricao ? falaCorrida(transcricao) : null,
    aoReescrever,
  };
}

/** Grava a versão nova (a mais nova primeiro, até 5) e o roteiro fica pronto. */
export async function gravarVersao(id: string, versao: VersaoRoteiro): Promise<void> {
  const db = createAdminClient();
  const { data: atual } = await db.from("roteiro").select("versoes, titulo, custo_usd").eq("id", id).single();
  const versoes = [versao, ...((atual?.versoes as VersaoRoteiro[]) ?? [])].slice(0, MAX_VERSOES);
  await db
    .from("roteiro")
    .update({
      status: "pronto",
      etapa: null,
      versoes,
      titulo: atual?.titulo || versao.titulo,
      custo_usd: Number((Number(atual?.custo_usd || 0) + versao.custo_usd).toFixed(4)),
      erro: null,
    })
    .eq("id", id);
}

/**
 * O vídeo de um post do monitor de criadores. Instagram: o link do vídeo sai de novo da Business
 * Discovery (o da hora em que o post entrou na fila já pode ter vencido); não deu, o caminho do link.
 */
async function baixarDoMonitor(r: { criador_id: string | null; post_id: string | null; link: string | null }): Promise<{ buf: Buffer; mime: string; fonte: string }> {
  const db = createAdminClient();
  const { data: c } = r.criador_id ? await db.from("criador").select("rede, usuario").eq("id", r.criador_id).maybeSingle() : { data: null };
  if (c?.rede === "instagram" && r.post_id) {
    const post = await perfilPublico(c.usuario, 50)
      .then((p) => p.posts.find((m) => m.id === r.post_id))
      .catch(() => null);
    if (post?.media_url) {
      const { buf, mime } = await baixarUrl(post.media_url);
      return { buf, mime, fonte: `monitor (@${c.usuario}, API da Meta)` };
    }
  }
  if (!r.link) throw new Error("o post ficou sem link");
  const baixado = await baixarDoLink(r.link);
  return { ...baixado, fonte: `monitor${c ? ` (@${c.usuario})` : ""}: ${baixado.fonte}` };
}

/**
 * O roteiro de um post do monitor: a fala do criador, picotada em gancho, corpo e CTA. Criador gringo:
 * a fala é traduzida pro português no Gemini (lib/roteiro/traduzir.ts).
 */
export async function roteiroDaFala(
  r: { duracao_alvo: number; post_dados: unknown; link?: string | null },
  transcricao: Transcricao,
): Promise<VersaoRoteiro> {
  // o título do YouTube; no Instagram a 1ª linha da legenda costuma ser o "comenta X", então vale o gancho
  const dados = (r.post_dados ?? {}) as { titulo?: string | null };
  return emPortugues(
    versaoDoTexto(falaCorrida(transcricao), {
      titulo: dados.titulo || null,
      duracaoAlvo: r.duracao_alvo,
      deOndeVeio: `transcrição de ${transcricao.fonte}`,
      modelo: "transcrição da referência",
    }),
  );
}

let fila: Promise<unknown> = Promise.resolve();

/** Põe o roteiro na fila do processo (um por vez). */
export function agendarRoteiro(id: string): Promise<void> {
  const vez = fila.then(() => processarRoteiro(id)).catch((e) => console.error("[roteiro]", id, (e as Error).message));
  fila = vez;
  return vez;
}

export async function processarRoteiro(id: string): Promise<void> {
  const db = createAdminClient();
  const agora = new Date().toISOString();
  const trava = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: pegos } = await db
    .from("roteiro")
    .update({ processando_desde: agora, erro: null })
    .eq("id", id)
    .in("status", ["na_fila", "transcrevendo"])
    .or(`processando_desde.is.null,processando_desde.lt.${trava}`)
    .select("*");
  const r = pegos?.[0];
  if (!r) return;
  let custo = Number(r.custo_usd) || 0;
  const marcar = (status: string, etapa: string) => db.from("roteiro").update({ status, etapa }).eq("id", id);

  try {
    let transcricao = r.transcricao as Transcricao | null;
    let analise = r.analise as AnaliseReferencia | null;
    let extra: { legenda?: string | null; notas?: string | null } = {};

    if (r.origem === "esteira" && r.referencia_id) {
      const { data: ref } = await db.from("referencia").select("assistido, analise, legenda, notas, autor").eq("id", r.referencia_id).maybeSingle();
      if (!ref) throw new Error("a referência da esteira foi apagada");
      extra = { legenda: ref.legenda, notas: ref.notas };
      if (!transcricao) {
        const assistido = ref.assistido as Assistido | null;
        const texto = (ref.analise as Analise | null)?.transcricao;
        if (!assistido?.fala?.length && !texto) throw new Error("a esteira ainda não transcreveu esse reel");
        transcricao = {
          ...(assistido ?? { duracao_seg: (ref.analise as Analise | null)?.duracao_seg ?? null, fala: [{ t: "00:00", texto: texto! }], cenas: [], audio: null }),
          fonte: `esteira${ref.autor ? ` (@${ref.autor})` : ""}`,
        };
        await db.from("roteiro").update({ transcricao }).eq("id", id);
      }
    }

    if (r.origem === "monitor") extra = { legenda: (r.post_dados as { legenda?: string | null } | null)?.legenda ?? null };

    if ((r.origem === "arquivo" || r.origem === "link" || r.origem === "monitor") && !transcricao) {
      let buf: Buffer;
      let mime: string;
      let fonte: string;
      if (r.origem === "monitor") {
        await marcar("transcrevendo", "baixando o vídeo do post");
        ({ buf, mime, fonte } = await baixarDoMonitor(r));
      } else if (r.origem === "link") {
        await marcar("transcrevendo", "baixando o vídeo do link");
        ({ buf, mime, fonte } = await baixarDoLink(r.link));
      } else {
        if (!r.arquivo) throw new Error("o vídeo não chegou: sobe de novo");
        await marcar("transcrevendo", "pegando o vídeo");
        const baixado = await db.storage.from(BUCKET).download(r.arquivo);
        if (baixado.error || !baixado.data) throw new Error(`storage: ${baixado.error?.message ?? "vazio"}`);
        buf = Buffer.from(await baixado.data.arrayBuffer());
        mime = r.arquivo_tipo || "video/mp4";
        fonte = `arquivo${r.arquivo_nome ? ` (${r.arquivo_nome})` : ""}`;
      }
      await marcar("transcrevendo", mime.startsWith("audio/") ? "ouvindo o áudio" : "assistindo e ouvindo o vídeo");
      const t = await transcreverArquivo(buf, mime, fonte);
      custo += t.custoUsd;
      transcricao = t.transcricao;
      if (!transcricao.fala.length) throw new Error("não achei fala nesse vídeo: o roteiro sai da fala (vídeo só com música não serve)");
      // Virou transcrição: o vídeo de terceiro sai do storage
      if (r.arquivo) await db.storage.from(BUCKET).remove([r.arquivo]);
      await db.from("roteiro").update({ transcricao, arquivo: null, custo_usd: custo }).eq("id", id);
    }

    // O roteiro do monitor é a fala do criador, como ele falou (o "Tentar de novo"/"outra versão" pela
    // estação continua escrevendo um novo, porque aí já tem versão)
    if (r.origem === "monitor" && r.via !== "api" && transcricao && !(r.versoes as unknown[] | null)?.length) {
      const cfg = { ...MONITOR_PADRAO, ...(await lerConfig<Partial<ConfigMonitor>>("monitor", {})) };
      if (cfg.roteiro === "transcricao") {
        await db.from("roteiro").update({ custo_usd: Number(custo.toFixed(4)) }).eq("id", id);
        await marcar("transcrevendo", "montando o roteiro com a fala");
        await gravarVersao(id, await roteiroDaFala(r, transcricao));
        return;
      }
    }

    if (transcricao && !analise) {
      await marcar("transcrevendo", "tirando o assunto e a estrutura");
      const a = await analisarReferencia(transcricao, extra);
      custo += a.custoUsd;
      analise = a.analise;
      await db.from("roteiro").update({ analise, custo_usd: custo }).eq("id", id);
    }

    // A escrita é da estação no PC do criador; aqui só pelo botão manual (via = 'api')
    if (r.via !== "api") {
      await db.from("roteiro").update({ status: "aguardando_estacao", etapa: "aguardando a estação", custo_usd: Number(custo.toFixed(4)) }).eq("id", id);
      return;
    }
    await marcar("escrevendo", "escrevendo pela API (botão manual)");
    const versao = await escreverRoteiro(
      entradaDoRoteiro({ ...r, transcricao, analise }, (n) => marcar("escrevendo", `reescrevendo pela API o que a checagem anti-IA barrou (rodada ${n})`)),
      MOTOR_API,
    );
    await db.from("roteiro").update({ custo_usd: Number(custo.toFixed(4)) }).eq("id", id);
    await gravarVersao(id, versao);
  } catch (e) {
    await db
      .from("roteiro")
      .update({ status: "erro", etapa: null, erro: (e as Error).message.slice(0, 500), custo_usd: Number(custo.toFixed(4)) })
      .eq("id", id);
  } finally {
    await db.from("roteiro").update({ processando_desde: null }).eq("id", id);
  }
}
