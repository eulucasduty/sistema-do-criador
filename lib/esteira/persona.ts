import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerConfig, lerPerfil, salvarConfig, type Persona } from "@/lib/config";
import { completarJSON } from "@/lib/ia/openrouter";
import { meusReels } from "@/lib/instagram/api";
import { assistirVideo, falaCorrida, quemEhOCriador, type Assistido } from "./referencia";
import { MODELO_CRIACAO } from "./modelos";

// A sua persona, tirada dos seus reels: o roteirista escreve a partir disso, não de um "tom"
// inventado. Os últimos N reels vêm pela API do Instagram (o vídeo da própria conta a API
// entrega), o Gemini assiste e transcreve cada um (nada roda na sua máquina), e um modelo
// de texto escreve o guia: como você abre, bordões, ritmo, vocabulário, estrutura, CTA, com
// trechos literais. Reel já transcrito não é refeito. Dá pra editar o guia à mão no painel.

export const lerPersona = () => lerConfig<Persona>("persona", {});

/** Transcrições dos seus reels pra usar de exemplo (os mais falados primeiro). */
export async function exemplosDaPersona(quantos = 2): Promise<string[]> {
  const db = createAdminClient();
  const { data } = await db.from("meu_reel").select("assistido, publicado_em").not("assistido", "is", null).order("publicado_em", { ascending: false }).limit(15);
  return (data ?? [])
    .map((r) => falaCorrida(r.assistido as Assistido))
    .filter((t) => t.split(" ").length > 40)
    .sort((a, b) => b.length - a.length)
    .slice(0, quantos);
}

const guia = (quem: string) => `Você é um analista de estilo de criadores de conteúdo. A partir das transcrições LITERAIS dos últimos reels de ${quem}, escreva o GUIA DA VOZ dele(a), pra um roteirista imitar com fidelidade.

Regras: nada de elogio nem generalidade ("comunicativo", "autêntico"). Seja específico e prove com trechos literais entre aspas. Escreva em português, em texto corrido com tópicos curtos, no máximo ~700 palavras.

Responda APENAS um JSON: {"guia": "o guia inteiro, com estas seções: 1. Como abre (os tipos de gancho, com 4-6 exemplos literais) · 2. Bordões e muletas (as expressões que repete, literais, e com que frequência) · 3. Ritmo (tamanho das frases, velocidade, pausas, como emenda as ideias) · 4. Vocabulário (gírias, termos técnicos e como explica eles; e o que NÃO fala) · 5. Estrutura típica de um reel, passo a passo · 6. Como fecha e pede ação (CTA literal) · 7. Temas e posição (o que defende, o que critica) · 8. Palavras que a transcrição pode ter errado (nomes de marcas e ferramentas)"}`;

/**
 * Atualiza a persona: pega os últimos `quantidade` reels, transcreve os que faltam e reescreve
 * o guia. Demora (uns 20 s por reel novo): chamar em segundo plano.
 */
export async function atualizarPersona(opcoes: { quantidade?: number; log?: (s: string) => void } = {}): Promise<Persona> {
  const quantidade = opcoes.quantidade ?? 15;
  const log = opcoes.log ?? (() => {});
  const db = createAdminClient();
  const antes = await lerPersona();
  await salvarConfig("persona", { ...antes, status: "atualizando", erro: undefined });
  let custo = 0;
  try {
    const reels = await meusReels(quantidade);
    if (!reels.length) throw new Error("não achei reels na conta (o Instagram está conectado?)");
    const { data: feitos } = await db.from("meu_reel").select("midia_id").in("midia_id", reels.map((r) => r.id)).not("assistido", "is", null);
    const jaTem = new Set((feitos ?? []).map((f) => f.midia_id));

    // 3 por vez: cada um é download + Gemini (o servidor só repassa o arquivo)
    const fila = reels.filter((r) => !jaTem.has(r.id));
    log(`${reels.length} reels · ${fila.length} pra transcrever`);
    for (let i = 0; i < fila.length; i += 3) {
      await Promise.all(
        fila.slice(i, i + 3).map(async (r) => {
          try {
            const res = await fetch(r.media_url!, { signal: AbortSignal.timeout(120_000) });
            if (!res.ok) throw new Error(`download ${res.status}`);
            const buf = Buffer.from(await res.arrayBuffer());
            const { assistido, custoUsd } = await assistirVideo(buf, (res.headers.get("content-type") ?? "video/mp4").split(";")[0]);
            custo += custoUsd;
            await db.from("meu_reel").upsert(
              { midia_id: r.id, permalink: r.permalink ?? null, legenda: r.caption ?? null, publicado_em: r.timestamp, duracao_seg: assistido.duracao_seg, assistido, erro: null },
              { onConflict: "midia_id" },
            );
            log(`✓ ${r.timestamp.slice(0, 10)} · ${assistido.duracao_seg ?? "?"}s · ${assistido.fala.length} trechos`);
          } catch (e) {
            await db.from("meu_reel").upsert(
              { midia_id: r.id, permalink: r.permalink ?? null, legenda: r.caption ?? null, publicado_em: r.timestamp, erro: (e as Error).message.slice(0, 300) },
              { onConflict: "midia_id" },
            );
            log(`✗ ${r.timestamp.slice(0, 10)} · ${(e as Error).message.slice(0, 120)}`);
          }
        }),
      );
    }

    const { data: prontos } = await db
      .from("meu_reel")
      .select("legenda, publicado_em, assistido")
      .in("midia_id", reels.map((r) => r.id))
      .not("assistido", "is", null)
      .order("publicado_em", { ascending: false });
    if (!prontos?.length) throw new Error("nenhum reel foi transcrito");
    const corpus = prontos
      .map((r, i) => `### Reel ${i + 1} · ${String(r.publicado_em).slice(0, 10)}\nLegenda: ${(r.legenda ?? "").slice(0, 300)}\nFala: ${falaCorrida(r.assistido as Assistido)}`)
      .join("\n\n");
    const quem = quemEhOCriador(await lerPerfil());
    const { dados, uso } = await completarJSON<{ guia: string }>({
      modelo: MODELO_CRIACAO,
      sistema: guia(quem),
      usuario: `Transcrições dos ${prontos.length} reels mais recentes de ${quem}:\n\n${corpus}`,
      maxTokens: 4000,
      temperatura: 0.3,
      timeoutMs: 180_000,
    });
    custo += uso.custoUsd;
    if (!dados?.guia?.trim()) throw new Error("o modelo não devolveu o guia");
    const datas = prontos.map((r) => String(r.publicado_em)).sort();
    const persona: Persona = {
      guia: dados.guia.trim(),
      reels: prontos.length,
      de: datas[0],
      ate: datas[datas.length - 1],
      atualizado_em: new Date().toISOString(),
      status: "ok",
      custo_usd: Number(custo.toFixed(4)),
    };
    await salvarConfig("persona", persona);
    return persona;
  } catch (e) {
    const persona: Persona = { ...antes, status: "erro", erro: (e as Error).message.slice(0, 300) };
    await salvarConfig("persona", persona);
    return persona;
  }
}
