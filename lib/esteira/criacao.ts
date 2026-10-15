import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerPerfil, type Perfil } from "@/lib/config";
import { completarJSON } from "@/lib/ia/openrouter";
import { quemEhOCriador, type Analise, type Assistido } from "./referencia";
import { MODELO_CRIACAO } from "./modelos";
import { exemplosDaPersona, lerPersona } from "./persona";

// O botão da Esteira no reel: "Criar roteiro", a SUA versão do formato da referência, na sua voz.
// (A cópia de carrossel é feita pela estação no seu PC: lib/esteira/carrossel.ts.)
// Regras: copiar o FORMATO e o mecanismo, nunca as frases da referência; número ou resultado
// que não dá pra provar vira [colchete] pra você preencher. A voz vem da sua persona
// (lib/esteira/persona.ts) + trechos reais dos seus reels. Escrita no Claude (melhor em
// português); ver e ouvir mídia continua no Gemini.

export { MODELO_CRIACAO };

export type Roteiro = {
  tipo: string;
  palavra_cta: string;
  titulo: string;
  duracao_seg: number | null;
  gancho: { fala: string; na_tela: string | null; visual: string | null };
  blocos: Array<{ tempo: string; fala: string; na_tela: string | null; visual: string | null }>;
  legenda: string;
  gancho_continuidade: string | null;
  de_onde_veio: string;
  pedido: string | null;
  gerado_em: string;
  modelo: string;
  custo_usd: number;
};

// Vale quando você ainda não gerou a persona, e como reforço do que converte em vídeo curto.
const BASE_DA_VOZ = `Base (quando ainda não tem persona): fale como gente, não como professor. Gancho de ruptura ou promessa concreta nos 2 primeiros segundos; promessa com número ou resultado logo depois; passo a passo rápido e prático; prova pessoal; CTA "comenta PALAVRA que eu te mando no direct". Frases curtas, faladas, informais.`;

async function blocoDaVoz(p: Perfil): Promise<string> {
  const persona = await lerPersona();
  const exemplos = await exemplosDaPersona(2);
  return [
    `## Quem é o criador\n${quemEhOCriador(p)}${p.tom ? `\nJeito de falar (descrito por ele): ${p.tom}` : ""}`,
    persona.guia?.trim()
      ? `## Guia da voz dele (tirado dos ${persona.reels ?? "seus"} reels mais recentes)\n${persona.guia.trim()}`
      : "## Guia da voz dele\n(ainda não gerado: use a base abaixo)",
    `## ${BASE_DA_VOZ}`,
    ...exemplos.map((t, i) => `## Exemplo real ${i + 1} (transcrição literal de um reel dele)\n${t.slice(0, 3500)}`),
  ].join("\n\n");
}

const SISTEMA_ROTEIRO = `Você escreve roteiros de reel na VOZ do criador descrito abaixo: tem que soar como ele falando, não como IA.

Você recebe uma REFERÊNCIA (um reel de outro perfil que performou, desmontado: transcrição com tempos, cenas, gancho, estrutura, por que engajou) e o GUIA DA VOZ do criador, com trechos reais dele.

O trabalho: pegar o FORMATO e o mecanismo que fizeram a referência engajar e escrever a versão do criador, com o assunto e a experiência dele (o nicho dele). Copie estrutura, ritmo e tipo de gancho; NUNCA as frases da referência.

Regras:
1. Gancho nos 2 primeiros segundos, do jeito que ELE abre (veja o guia).
2. Promessa com número ou resultado concreto logo depois.
3. Educativo: passo a passo rápido e prático, verbo no comando.
4. Prova pessoal, do jeito dele.
5. CTA: "comenta PALAVRA que eu te mando no direct" (palavra curta, em maiúscula, ligada ao tema; nova, não a da referência).
6. Frases curtas, faladas. Os bordões dele com naturalidade, sem forçar todos. A voz é o JEITO de falar: não recicle frases, piadas ou histórias específicas de outros reels dele.
7. Não invente número, resultado, cliente ou história: onde precisar de um dado dele, deixe [entre colchetes] pra ele preencher. Nome de marca, ferramenta ou site só se você tem certeza de que existe; senão, [nome].
8. Duração parecida com a da referência (fala ~2,5 palavras por segundo).

Responda APENAS um JSON:
{
  "tipo": "educativo | meme | bastidor",
  "palavra_cta": "PALAVRA",
  "titulo": "nome curto do roteiro, pra achar depois",
  "duracao_seg": número estimado,
  "gancho": {"fala": "a fala do gancho", "na_tela": "o texto na tela do gancho", "visual": "o que aparece"},
  "blocos": [{"tempo": "3-8s", "fala": "o que ele fala, literal", "na_tela": "texto na tela ou null", "visual": "enquadramento / o que mostrar"}],
  "legenda": "a legenda do post: 1ª linha forte + CTA comenta PALAVRA + 3 a 5 hashtags",
  "gancho_continuidade": "como segurar pra próxima (parte 2, série) ou null",
  "de_onde_veio": "em 1 frase: o que foi tirado da referência (formato, mecanismo)"
}
"blocos" começa DEPOIS do gancho e vai até o CTA.`;

async function carregar(id: string) {
  const db = createAdminClient();
  const { data: ref } = await db.from("referencia").select("id, tipo, legenda, notas, autor, analise, assistido, roteiros").eq("id", id).single();
  if (!ref) throw new Error("referência não encontrada");
  if (!ref.analise) throw new Error("a referência ainda não foi analisada");
  return { db, ref, a: ref.analise as Analise, assistido: ref.assistido as Assistido | null };
}

/** Cria o seu roteiro a partir de um reel da Esteira. Guarda os 5 mais novos. */
export async function gerarRoteiro(id: string, pedido?: string | null): Promise<Roteiro> {
  const { db, ref, a, assistido } = await carregar(id);
  const perfil = await lerPerfil();
  const fala = (assistido?.fala ?? []).map((f) => `[${f.t}] ${f.texto}`).join("\n") || a.transcricao || "(sem fala)";
  const cenas = (assistido?.cenas ?? []).map((c) => `[${c.t}] ${c.o_que_aparece}${c.texto_na_tela ? ` | na tela: ${c.texto_na_tela}` : ""}`).join("\n");
  const referencia = [
    `Resumo: ${a.resumo}`,
    `Formato: ${a.formato} · Tema: ${a.tema} · Duração: ${a.duracao_seg ?? assistido?.duracao_seg ?? "?"} s`,
    `Gancho (${a.gancho?.tipo}): ${a.gancho?.texto_ou_fala} — ${a.gancho?.o_que_acontece}. Por que prende: ${a.gancho?.por_que_prende}`,
    `Esqueleto do formato: ${a.esqueleto_do_formato}`,
    `Estrutura:\n${(a.estrutura ?? []).map((e) => `- ${e.trecho}: ${e.o_que_acontece}`).join("\n")}`,
    `Por que engajou: ${(a.por_que_engajou ?? []).join(" · ")}`,
    `CTA da referência: ${a.cta ?? "nenhum"}`,
    `Fala com tempo:\n${fala}`,
    cenas ? `Cenas:\n${cenas}` : null,
    ref.legenda ? `Legenda original: ${ref.legenda}` : null,
    ref.notas ? `Nota do criador sobre esta referência: ${ref.notas}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  const { dados, uso, bruto } = await completarJSON<Omit<Roteiro, "pedido" | "gerado_em" | "modelo" | "custo_usd">>({
    modelo: MODELO_CRIACAO,
    sistema: SISTEMA_ROTEIRO,
    usuario:
      `${await blocoDaVoz(perfil)}\n\n# A referência\n${referencia}` +
      (pedido?.trim() ? `\n\n# Direção do criador pra este roteiro (vale mais que tudo)\n${pedido.trim()}` : ""),
    maxTokens: 8000,
    temperatura: 0.8,
    timeoutMs: 180_000,
  });
  if (!dados?.gancho || !Array.isArray(dados.blocos)) throw new Error(`o modelo não devolveu um roteiro válido (${bruto.slice(0, 160)}…)`);
  const roteiro: Roteiro = {
    ...dados,
    palavra_cta: String(dados.palavra_cta ?? "").toUpperCase(),
    pedido: pedido?.trim() || null,
    gerado_em: new Date().toISOString(),
    modelo: MODELO_CRIACAO,
    custo_usd: Number(uso.custoUsd.toFixed(4)),
  };
  const roteiros = [roteiro, ...((ref.roteiros as Roteiro[]) ?? [])].slice(0, 5);
  await db.from("referencia").update({ roteiros }).eq("id", id);
  return roteiro;
}

/** O roteiro em texto corrido, pra copiar (ou mandar pro editor de vídeo). */
export function roteiroEmTexto(r: Roteiro): string {
  const linhas = [
    `${r.titulo} · ${r.tipo} · ~${r.duracao_seg ?? "?"}s · CTA: comenta ${r.palavra_cta}`,
    "",
    `GANCHO: ${r.gancho.fala}`,
    r.gancho.na_tela ? `  na tela: ${r.gancho.na_tela}` : null,
    r.gancho.visual ? `  visual: ${r.gancho.visual}` : null,
    "",
    ...r.blocos.flatMap((b) => [`[${b.tempo}] ${b.fala}`, b.na_tela ? `  na tela: ${b.na_tela}` : null, b.visual ? `  visual: ${b.visual}` : null]),
    "",
    `LEGENDA:\n${r.legenda}`,
    r.gancho_continuidade ? `\nCONTINUIDADE: ${r.gancho_continuidade}` : null,
  ];
  return linhas.filter((l) => l !== null).join("\n");
}
