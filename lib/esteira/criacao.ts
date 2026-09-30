import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { lerPerfil, type Perfil } from "@/lib/config";
import { completarJSON } from "@/lib/ia/openrouter";
import { quemEhOCriador, type Analise, type Assistido, type Estilo } from "./referencia";
import { MODELO_CRIACAO } from "./modelos";
import { exemplosDaPersona, lerPersona } from "./persona";

// Os botões da Esteira:
//   · reel → "Criar roteiro": a SUA versão do formato da referência, na sua voz
//   · carrossel → "Copiar": a sua versão do carrossel (slides + legenda), renderizada em PNG
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

export type Slide = {
  tipo: "capa" | "texto" | "lista" | "cta";
  kicker?: string | null;
  titulo: string;
  subtitulo?: string | null;
  texto?: string | null;
  itens?: string[] | null;
  palavra?: string | null;
};

export type CopiaCarrossel = {
  titulo: string;
  palavra_cta: string;
  slides: Slide[];
  legenda: string;
  de_onde_veio: string;
  estilo: Estilo;
  visual: "referencia" | "marca";
  pedido: string | null;
  gerado_em: string;
  modelo: string;
  custo_usd: number;
};

/** O visual "minha marca": as cores do seu perfil, título em fonte grossa. */
export function estiloDaMarca(p: Perfil): Estilo {
  return { ...p.cores, fonte_titulo: "display", caixa_alta: true, descricao: "a sua marca" };
}

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

const SISTEMA_CARROSSEL = `Você cria carrosséis pro criador descrito abaixo, copiando o FORMATO de um carrossel de referência que performou. Voz dele: veja o guia.

O trabalho: a versão do criador, com o MESMO formato (mesma lógica de capa, mesma progressão, mesmo tipo de slide, quantidade parecida), com o conteúdo e a experiência dele (o nicho dele). Copie a estrutura; NUNCA as frases da referência.

Regras de carrossel:
- Capa: promessa ou curiosidade forte, título de até 8 palavras + subtítulo curto.
- Promessa cumprida: se a capa promete N itens, os N aparecem (um por slide ou numa lista). A quantidade de slides se ajusta a isso.
- Uma ideia por slide. Título de até 6 palavras. Texto de até ~220 caracteres. Lista com até 5 itens curtos.
- Penúltimo slide pode ser um resumo ("printa esse slide").
- Último slide (cta): o título é um fechamento forte que NÃO repete "comenta" (a caixa do CTA já diz "comenta PALAVRA que eu te mando no direct"); texto curto ou nenhum.
- A palavra do CTA é nova, ligada ao tema: não use a da referência.
- Português falado, direto, na voz dele. A voz é o JEITO de falar: não recicle frases, piadas ou histórias de outros reels dele. Sem emoji e sem hashtag nos slides.
- Não invente número, resultado ou cliente: onde precisar, use [colchetes] pra ele preencher. Item que exige nome real (marca, ferramenta, site) e você não tem certeza de que existe: [nome]. Nunca invente nome.

Tipos de slide:
- {"tipo": "capa", "kicker": "texto pequeno acima (opcional)", "titulo": "...", "subtitulo": "..."}
- {"tipo": "texto", "kicker": "...", "titulo": "...", "texto": "..."}
- {"tipo": "lista", "kicker": "...", "titulo": "...", "itens": ["...", "..."]}
- {"tipo": "cta", "titulo": "...", "texto": "...", "palavra": "PALAVRA"}

Responda APENAS um JSON:
{"titulo": "nome curto do carrossel", "palavra_cta": "PALAVRA", "slides": [...], "legenda": "a legenda do post: 1ª linha forte + CTA comenta PALAVRA + 3 a 5 hashtags", "de_onde_veio": "em 1 frase: o que foi tirado da referência"}`;

const semEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s{2,}/g, " ").trim();

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

const HEX = /^#[0-9a-f]{6}$/i;

/** Estilo da referência com rede de segurança: cor inválida ou sem contraste vira a da sua marca. */
function estiloSeguro(e: Estilo | undefined | null, marca: Estilo): Estilo {
  if (!e || !HEX.test(e.fundo ?? "") || !HEX.test(e.texto ?? "")) return marca;
  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(e.fundo), lum(e.texto)].sort((x, y) => y - x);
  const texto = (a + 0.05) / (b + 0.05) >= 3 ? e.texto : lum(e.fundo) > 0.4 ? "#111111" : "#f5f4f0";
  return {
    fundo: e.fundo,
    texto,
    destaque: HEX.test(e.destaque ?? "") ? e.destaque : marca.destaque,
    fonte_titulo: ["display", "sans", "serif"].includes(e.fonte_titulo) ? e.fonte_titulo : "sans",
    caixa_alta: Boolean(e.caixa_alta),
    descricao: e.descricao ?? "",
  };
}

/** A sua versão de um carrossel da Esteira: slides (renderizados na rota de slide) + legenda. */
export async function copiarCarrossel(id: string, opcoes: { pedido?: string | null; visual?: "referencia" | "marca" } = {}): Promise<CopiaCarrossel> {
  const { db, ref, a } = await carregar(id);
  const perfil = await lerPerfil();
  const marca = estiloDaMarca(perfil);
  const visual = opcoes.visual ?? "referencia";
  const alvo = Math.min(10, Math.max(4, Number(a.quantidade_slides) || 7));
  const referencia = [
    `Resumo: ${a.resumo}`,
    `Formato: ${a.formato} · Tema: ${a.tema} · Slides: ${a.quantidade_slides ?? "?"}`,
    `Capa (${a.gancho?.tipo}): ${a.gancho?.texto_ou_fala} — ${a.gancho?.o_que_acontece}. Por que faz arrastar: ${a.gancho?.por_que_prende}`,
    `Esqueleto do formato: ${a.esqueleto_do_formato}`,
    `Slides que a IA leu:\n${(a.slides_ref ?? []).map((s) => `- slide ${s.n}: ${s.texto} (${s.visual})`).join("\n") || "(só a capa)"}`,
    `Estrutura:\n${(a.estrutura ?? []).map((e) => `- ${e.trecho}: ${e.o_que_acontece}`).join("\n")}`,
    `Por que engajou: ${(a.por_que_engajou ?? []).join(" · ")}`,
    `CTA da referência: ${a.cta ?? "nenhum"}`,
    ref.legenda ? `Legenda original: ${ref.legenda}` : null,
    ref.notas ? `Nota do criador sobre esta referência: ${ref.notas}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
  const { dados, uso, bruto } = await completarJSON<Pick<CopiaCarrossel, "titulo" | "palavra_cta" | "slides" | "legenda" | "de_onde_veio">>({
    modelo: MODELO_CRIACAO,
    sistema: SISTEMA_CARROSSEL,
    usuario:
      `${await blocoDaVoz(perfil)}\n\n# A referência\n${referencia}\n\n# Tamanho\nPor volta de ${alvo} slides (capa e CTA inclusos); se a promessa da capa pedir mais, até 12.` +
      (opcoes.pedido?.trim() ? `\n\n# Direção do criador pra este carrossel (vale mais que tudo)\n${opcoes.pedido.trim()}` : ""),
    maxTokens: 8000,
    temperatura: 0.8,
    timeoutMs: 180_000,
  });
  if (!dados || !Array.isArray(dados.slides) || !dados.slides.length) throw new Error(`o modelo não devolveu os slides (${bruto.slice(0, 160)}…)`);
  const palavra = String(dados.palavra_cta ?? "").toUpperCase();
  const slides: Slide[] = dados.slides.slice(0, 12).map((s) => ({
    tipo: ["capa", "texto", "lista", "cta"].includes(s.tipo) ? s.tipo : "texto",
    kicker: s.kicker ? semEmoji(s.kicker) : null,
    titulo: semEmoji(String(s.titulo ?? "")),
    subtitulo: s.subtitulo ? semEmoji(s.subtitulo) : null,
    texto: s.texto ? semEmoji(s.texto) : null,
    itens: Array.isArray(s.itens) ? s.itens.map((i) => semEmoji(String(i))).filter(Boolean).slice(0, 8) : null,
    palavra: s.tipo === "cta" ? String(s.palavra || palavra).toUpperCase() : null,
  }));
  const copia: CopiaCarrossel = {
    titulo: dados.titulo,
    palavra_cta: palavra,
    slides,
    legenda: dados.legenda,
    de_onde_veio: dados.de_onde_veio,
    estilo: visual === "marca" ? marca : estiloSeguro(a.estilo, marca),
    visual,
    pedido: opcoes.pedido?.trim() || null,
    gerado_em: new Date().toISOString(),
    modelo: MODELO_CRIACAO,
    custo_usd: Number(uso.custoUsd.toFixed(4)),
  };
  await db.from("referencia").update({ copia }).eq("id", id);
  return copia;
}
