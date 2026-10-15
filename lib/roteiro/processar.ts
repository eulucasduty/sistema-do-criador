import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Analise, Assistido } from "@/lib/esteira/referencia";
import { baixarDoLink } from "./link";
import { analisarReferencia, transcreverArquivo, type AnaliseReferencia, type Transcricao } from "./referencia";

// O caminho de um roteiro no servidor (after() da Server Action, que tem até 5 min na Vercel):
//   referência (arquivo, link do Instagram ou reel da Esteira) → transcrição → análise abstrata
//   (Gemini pela OpenRouter, centavos) → "aguardando_estacao".
// Quem escreve é a estação no PC do criador (editor/estacao/roteiros.mjs), com a IA escolhida no
// painel: nada de tarefa longa aqui. Roteiro sobre um tema já nasce "aguardando_estacao".
// Cada etapa grava no banco: se cair no meio, "Tentar de novo" continua de onde parou. O arquivo
// da referência sai do Storage assim que vira transcrição.

export const BUCKET = "esteira";

export async function processarRoteiro(id: string): Promise<void> {
  const db = createAdminClient();
  const agora = new Date().toISOString();
  const trava = new Date(Date.now() - 7 * 60_000).toISOString();
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
      if (!ref) throw new Error("a referência da Esteira foi apagada");
      extra = { legenda: ref.legenda, notas: ref.notas };
      if (!transcricao) {
        const assistido = ref.assistido as Assistido | null;
        const texto = (ref.analise as Analise | null)?.transcricao;
        if (!assistido?.fala?.length && !texto) throw new Error("a Esteira ainda não transcreveu esse reel");
        transcricao = {
          ...(assistido?.fala?.length ? assistido : { duracao_seg: (ref.analise as Analise | null)?.duracao_seg ?? null, fala: [{ t: "00:00", texto: texto! }], cenas: [], audio: null }),
          fonte: `Esteira${ref.autor ? ` (@${ref.autor})` : ""}`,
        };
        await db.from("roteiro").update({ transcricao }).eq("id", id);
      }
    }

    if ((r.origem === "arquivo" || r.origem === "link") && !transcricao) {
      let buf: Buffer;
      let mime: string;
      let fonte: string;
      if (r.origem === "link") {
        await marcar("transcrevendo", "buscando o vídeo pelo link");
        const baixado = await baixarDoLink(r.link ?? "");
        ({ buf, mime, fonte } = baixado);
        extra = { legenda: baixado.legenda };
      } else {
        if (!r.arquivo) throw new Error("o vídeo não chegou: suba de novo");
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
      // Virou transcrição: o vídeo de terceiro sai do Storage
      if (r.arquivo) await db.storage.from(BUCKET).remove([r.arquivo]);
      await db.from("roteiro").update({ transcricao, arquivo: null, custo_usd: custo }).eq("id", id);
    }

    if (transcricao && !analise) {
      await marcar("transcrevendo", "tirando o assunto e a estrutura");
      const a = await analisarReferencia(transcricao, extra);
      custo += a.custoUsd;
      analise = a.analise;
      await db.from("roteiro").update({ analise, custo_usd: custo }).eq("id", id);
    }

    await db.from("roteiro").update({ status: "aguardando_estacao", etapa: "esperando a estação", custo_usd: Number(custo.toFixed(4)) }).eq("id", id);
  } catch (e) {
    await db
      .from("roteiro")
      .update({ status: "erro", etapa: null, erro: (e as Error).message.slice(0, 500), custo_usd: Number(custo.toFixed(4)) })
      .eq("id", id);
  } finally {
    await db.from("roteiro").update({ processando_desde: null }).eq("id", id);
  }
}
