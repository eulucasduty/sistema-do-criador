import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient, type Db } from "@/lib/supabase/admin";
import { lerPerfil, type Perfil } from "@/lib/config";
import { analisarMidiaJSON } from "@/lib/ia/openrouter";
import { acharPostPublico } from "@/lib/instagram/descoberta";

// A Esteira: referências (reels e carrosséis de outros perfis que performaram).
//
// Como chega (pelo painel):
//   · LINK do post → com o Facebook conectado, a Esteira busca o vídeo (ou as imagens do
//     carrossel) pela API oficial da Meta (Business Discovery, lib/instagram/descoberta.ts).
//     Não deu (conta pessoal, música licenciada, Facebook não conectado): fica "aguardando o
//     arquivo" com o motivo, e você sobe o vídeo ou os prints.
//   · ARQUIVO (vídeo do reel ou prints do carrossel) → vai direto do navegador pro bucket
//     privado "esteira" (link assinado), sem passar pelo servidor.
//
// Análise, toda no Gemini (ele vê E ouve o vídeo, sem ffmpeg):
//   · reel: 1ª passada ASSISTE (fala palavra por palavra com tempo + cenas + texto na tela);
//     2ª passada DESMONTA (gancho, estrutura, por que engajou) em cima da transcrição.
//   · carrossel: lê todos os slides, a estrutura e o estilo visual (pra copiar).
// Roteiro e cópia de carrossel ficam em lib/esteira/criacao.ts (botões no painel).

export const BUCKET = "esteira";
export const MAX_BYTES = 45 * 1024 * 1024; // o storage grátis aceita até 50 MB por arquivo
export const MAX_SLIDES = 12;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** O link não é um arquivo (é a página pública do post): não adianta tentar de novo. */
class NaoEhArquivo extends Error {}

export const caminhoNovo = (tipo: string | null) => {
  const ext = tipo?.includes("video") ? "mp4" : tipo?.includes("png") ? "png" : tipo?.includes("webp") ? "webp" : tipo?.includes("image") ? "jpg" : "bin";
  return `${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
};

/** Guarda um arquivo no bucket. O Storage às vezes dá timeout: tenta 3 vezes. */
export async function guardarArquivo(db: Db, buf: Buffer, tipo: string | null): Promise<string> {
  if (buf.length > MAX_BYTES) throw new Error(`arquivo grande demais (${Math.round(buf.length / 1e6)} MB)`);
  const caminho = caminhoNovo(tipo);
  let ultimo = "";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const up = await db.storage.from(BUCKET).upload(caminho, buf, { contentType: tipo ?? "application/octet-stream", upsert: true });
    if (!up.error) return caminho;
    ultimo = up.error.message;
    if (tentativa < 3) await dormir(tentativa * 2000);
  }
  throw new Error(`storage: ${ultimo}`);
}

/** Baixa do CDN da Meta e guarda. Página HTML (link público) não é arquivo: NaoEhArquivo. */
async function baixarEGuardar(db: Db, url: string): Promise<{ arquivo: string; arquivoTipo: string | null }> {
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`download ${r.status}`);
  const arquivoTipo = (r.headers.get("content-type") ?? "").split(";")[0].trim() || null;
  if (!arquivoTipo || !/^(video|image)\//.test(arquivoTipo)) {
    throw new NaoEhArquivo(`o link é a página do post (${arquivoTipo ?? "sem tipo"}), não o arquivo`);
  }
  const buf = Buffer.from(await r.arrayBuffer());
  return { arquivo: await guardarArquivo(db, buf, arquivoTipo), arquivoTipo };
}

type Buscado = {
  tipo: "reel" | "carrossel" | "post";
  arquivo: string | null;
  arquivoTipo: string | null;
  slides: string[];
  autor: string | null;
  legenda: string | null;
  metricas: Record<string, unknown> | null;
  motivo: string | null;
};

/** Procura o post público pelo link e guarda o que a Meta liberar (vídeo, ou as imagens do carrossel). */
async function buscarNoPublico(db: Db, url: string): Promise<Buscado> {
  const tipoDoLink = /\/(reel|reels)\//.test(url) ? "reel" : "post";
  const { post, motivo } = await acharPostPublico(url).catch((e) => ({ post: null, motivo: (e as Error).message }));
  const vazio: Buscado = { tipo: tipoDoLink === "reel" ? "reel" : "post", arquivo: null, arquivoTipo: null, slides: [], autor: null, legenda: null, metricas: null, motivo };
  if (!post) return vazio;
  const base: Buscado = {
    ...vazio,
    tipo: post.tipo === "VIDEO" ? "reel" : post.tipo === "CAROUSEL_ALBUM" ? "carrossel" : "post",
    autor: post.autor,
    legenda: post.legenda,
    metricas: { curtidas: post.curtidas, comentarios: post.comentarios, publicado_em: post.publicado_em, fonte: "meta" },
  };
  try {
    if (post.tipo === "CAROUSEL_ALBUM") {
      // As imagens na ordem; vídeo dentro do carrossel entra pela capa dele
      const urls = (post.filhos.length ? post.filhos.map((f) => (f.tipo === "IMAGE" ? f.media_url : null)) : [post.media_url]).filter((u): u is string => Boolean(u));
      if (!urls.length) return { ...base, motivo: "a Meta não liberou as imagens desse carrossel: suba os prints" };
      const guardados: Array<{ arquivo: string; arquivoTipo: string | null }> = [];
      for (const u of urls.slice(0, MAX_SLIDES)) guardados.push(await baixarEGuardar(db, u));
      return {
        ...base,
        arquivo: guardados[0].arquivo,
        arquivoTipo: guardados[0].arquivoTipo,
        slides: guardados.slice(1).map((g) => g.arquivo),
        motivo: post.filhos.length ? null : "a Meta mandou só a capa: suba os prints dos outros slides",
      };
    }
    if (!post.media_url) return { ...base, motivo };
    const g = await baixarEGuardar(db, post.media_url);
    return { ...base, arquivo: g.arquivo, arquivoTipo: g.arquivoTipo, motivo: null };
  } catch (e) {
    return { ...base, motivo: `achei o post, mas não deu pra baixar: ${(e as Error).message}` };
  }
}

/** Referência nova a partir do link do post. Devolve o id (a análise roda em seguida). */
export async function referenciaPorLink(opcoes: { url: string; notas?: string | null }): Promise<string> {
  const db = createAdminClient();
  const url = opcoes.url.trim().split("?")[0];
  const b = await buscarNoPublico(db, url);
  const { data, error } = await db
    .from("referencia")
    .insert({
      origem: "link",
      tipo: b.tipo,
      url,
      autor: b.autor,
      legenda: b.legenda,
      notas: opcoes.notas?.trim() || null,
      arquivo: b.arquivo,
      arquivo_tipo: b.arquivoTipo,
      slides: b.slides,
      metricas: b.metricas,
      aguardando_video: !b.arquivo,
      sem_video_motivo: b.motivo,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`não consegui guardar: ${error?.message}`);
  return data.id;
}

/** Tenta de novo buscar pelo link (ex.: depois de conectar o Facebook). true = achou e guardou. */
export async function buscarDeNovo(id: string): Promise<boolean> {
  const db = createAdminClient();
  const { data: ref } = await db.from("referencia").select("id, url, aguardando_video").eq("id", id).single();
  if (!ref?.aguardando_video || !ref.url) return false;
  const b = await buscarNoPublico(db, ref.url);
  await db
    .from("referencia")
    .update({
      ...(b.arquivo
        ? { tipo: b.tipo, arquivo: b.arquivo, arquivo_tipo: b.arquivoTipo, slides: b.slides, aguardando_video: false, tentativas: 0, analise: null, assistido: null, erro: null }
        : {}),
      autor: b.autor ?? undefined,
      legenda: b.legenda ?? undefined,
      metricas: b.metricas ?? undefined,
      sem_video_motivo: b.arquivo ? b.motivo : b.motivo,
    })
    .eq("id", id);
  return Boolean(b.arquivo);
}

// ── o que a IA devolve ─────────────────────────────────────────────

/** A IA assistindo um vídeo inteiro: a fala palavra por palavra e o que aparece, com tempo. */
export type Assistido = {
  duracao_seg: number | null;
  fala: Array<{ t: string; texto: string }>;
  cenas: Array<{ t: string; o_que_aparece: string; texto_na_tela?: string | null }>;
  audio: string | null;
};

/** O visual de um carrossel, pra copiar: cores em hex e o tipo de letra do título. */
export type Estilo = {
  fundo: string;
  texto: string;
  destaque: string;
  fonte_titulo: "display" | "sans" | "serif";
  caixa_alta: boolean;
  descricao: string;
};

export type Analise = {
  resumo: string;
  duracao_seg: number | null;
  gancho: { o_que_acontece: string; texto_ou_fala: string; tipo: string; por_que_prende: string };
  formato: string;
  estrutura: Array<{ trecho: string; o_que_acontece: string }>;
  texto_na_tela: string | null;
  audio: string;
  cta: string | null;
  tema: string;
  por_que_engajou: string[];
  gatilhos: string[];
  esqueleto_do_formato: string;
  transcricao: string | null;
  // carrossel
  quantidade_slides?: number | null;
  slides_ref?: Array<{ n: number; texto: string; visual: string }>;
  estilo?: Estilo;
};

const ASSISTIR = `Você assiste e ouve vídeos curtos (reels) do começo ao fim e anota tudo com precisão, em português do Brasil.

Responda APENAS um JSON:
{
  "duracao_seg": número,
  "fala": [{"t": "mm:ss", "texto": "o que foi falado, LITERAL, palavra por palavra"}],
  "cenas": [{"t": "mm:ss", "o_que_aparece": "o que se vê: enquadramento, pessoa falando, tela gravada, corte, b-roll, zoom, print", "texto_na_tela": "o texto literal que aparece, ou null"}],
  "audio": "voz, música ou trend de áudio, efeitos"
}

Regras:
- Transcreva TODA a fala, do primeiro ao último segundo, sem resumir e sem pular nada. Um trecho por frase ou mudança de assunto.
- Uma cena a cada corte ou mudança visual que importa. Texto na tela sempre literal.
- Nome de marca, produto ou ferramenta como é.
- Sem fala: "fala": [].`;

/** Quem é o criador, pro contexto dos prompts. */
export function quemEhOCriador(p: Perfil): string {
  const partes = [
    `${p.nome ?? "um criador de conteúdo"}${p.usuario ? ` (@${p.usuario})` : ""}`,
    p.nicho ? `nicho: ${p.nicho}` : null,
    p.publico ? `público: ${p.publico}` : null,
  ].filter(Boolean);
  return partes.join(" · ");
}

const desmontarReel = (p: Perfil) => `Você desmonta reels de referência pro criador ${quemEhOCriador(p)}. Ele minera FORMATOS que performam em outros perfis pra fazer a versão dele.

Sua tarefa: explicar COMO a peça funciona e POR QUE engajou, com base no vídeo e na transcrição com tempos (já tirada, abaixo). Seja concreto (o que aparece, em que segundo, com que texto), sem elogio vazio. Não escreva roteiro aqui: isso é outro botão.

Responda APENAS um JSON:
{
  "resumo": "o que é a peça, em 1 frase",
  "gancho": {
    "o_que_acontece": "o que se vê e ouve nos primeiros 1-3 segundos",
    "texto_ou_fala": "o texto na tela e/ou a fala do gancho, literal",
    "tipo": "promessa | curiosidade | choque | pergunta | contraste | humor | prova | lista | outro",
    "por_que_prende": "o mecanismo que segura o dedo"
  },
  "formato": "o formato em poucas palavras (ex.: tela gravada + narração, talking head, meme com áudio em alta)",
  "estrutura": [{"trecho": "0-3s", "o_que_acontece": "..."}],
  "texto_na_tela": "o texto que aparece, resumido" ou null,
  "audio": "fala, trend de áudio, música…",
  "cta": "a chamada pra ação, literal" ou null,
  "tema": "o assunto",
  "por_que_engajou": ["motivo concreto 1", "motivo concreto 2", "motivo concreto 3"],
  "gatilhos": ["FOMO", "hack", "curiosidade", "novidade", "prova social", "…"],
  "esqueleto_do_formato": "a estrutura abstrata que dá pra reaproveitar em outro assunto, SEM o conteúdo (ex.: 'problema na tela 2s → solução aparecendo → resultado lado a lado → CTA de comentário')"
}`;

const desmontarCarrossel = (p: Perfil) => `Você desmonta carrosséis de referência pro criador ${quemEhOCriador(p)}. Ele minera FORMATOS que performam pra fazer a versão dele.

As imagens vêm na ordem: a 1ª é a capa. Se vier só a capa, deduza o resto pela legenda (e diga isso). Seja concreto e literal nos textos.

Responda APENAS um JSON:
{
  "resumo": "o que é o carrossel, em 1 frase",
  "gancho": {
    "o_que_acontece": "como a capa é montada",
    "texto_ou_fala": "o texto da capa, literal",
    "tipo": "promessa | curiosidade | choque | pergunta | contraste | humor | prova | lista | outro",
    "por_que_prende": "por que a capa faz arrastar"
  },
  "formato": "o formato em poucas palavras (ex.: lista numerada, passo a passo com prints, antes e depois)",
  "quantidade_slides": número (conte; ou deduza de '1/9' na capa ou da lista da legenda) ou null,
  "slides_ref": [{"n": 1, "texto": "o texto do slide, literal", "visual": "como o slide é montado"}],
  "estrutura": [{"trecho": "slide 1", "o_que_acontece": "..."}],
  "texto_na_tela": "os textos dos slides, resumidos" ou null,
  "audio": "carrossel",
  "cta": "a chamada pra ação, literal" ou null,
  "tema": "o assunto",
  "por_que_engajou": ["motivo concreto 1", "motivo concreto 2", "motivo concreto 3"],
  "gatilhos": ["…"],
  "esqueleto_do_formato": "a estrutura abstrata, SEM o conteúdo (ex.: 'capa com promessa numérica → 1 item por slide com print → slide resumo → CTA')",
  "estilo": {
    "fundo": "#hex da cor de fundo predominante",
    "texto": "#hex da cor do texto principal",
    "destaque": "#hex da cor de destaque",
    "fonte_titulo": "display (grossa/arredondada) | sans (sem serifa) | serif (com serifa)",
    "caixa_alta": true ou false,
    "descricao": "o visual em 1 frase (ex.: fundo preto, título branco gigante, destaque amarelo, print no meio)"
  }
}
"slides_ref" só com os slides que você VIU (a capa conta).`;

// ── a análise ──────────────────────────────────────────────────────

async function baixarDoBucket(db: Db, caminho: string): Promise<Buffer> {
  const baixado = await db.storage.from(BUCKET).download(caminho);
  if (baixado.error || !baixado.data) throw new Error(`storage: ${baixado.error?.message ?? "vazio"}`);
  return Buffer.from(await baixado.data.arrayBuffer());
}

/** A 1ª passada: o Gemini assiste e ouve o vídeo inteiro (também usada nos seus reels, pra persona). */
export async function assistirVideo(buf: Buffer, mime = "video/mp4"): Promise<{ assistido: Assistido; custoUsd: number }> {
  const { dados, uso } = await analisarMidiaJSON<Assistido>({
    sistema: ASSISTIR,
    instrucao: "Assista e ouça este reel inteiro e anote.",
    midia: { tipo: "video", url: `data:${mime};base64,${buf.toString("base64")}` },
    maxTokens: 12000,
  });
  if (!dados || !Array.isArray(dados.fala)) throw new Error("a IA não devolveu a transcrição");
  return {
    assistido: {
      duracao_seg: Number(dados.duracao_seg) || null,
      fala: dados.fala.filter((f) => f?.texto?.trim()),
      cenas: Array.isArray(dados.cenas) ? dados.cenas : [],
      audio: dados.audio ?? null,
    },
    custoUsd: uso.custoUsd,
  };
}

export const falaCorrida = (a: Assistido | null | undefined) => (a?.fala ?? []).map((f) => f.texto.trim()).join(" ");

/** Um passo do relógio: analisa a próxima referência que ficou sem análise (rede de segurança). */
export async function passoDaEsteira(): Promise<void> {
  const db = createAdminClient();
  const { data: ref } = await db
    .from("referencia")
    .select("id, tentativas")
    .is("analise", null)
    .not("arquivo", "is", null)
    .eq("aguardando_video", false)
    .lt("tentativas", 3)
    .lt("atualizado_em", new Date(Date.now() - 5 * 60_000).toISOString()) // a análise do botão já teve a chance dela
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ref) await analisarComTrava(ref.id, ref.tentativas);
}

/** Conta a tentativa e analisa; o erro fica na referência (aparece no painel). */
export async function analisarComTrava(id: string, tentativas = 0): Promise<void> {
  const db = createAdminClient();
  await db.from("referencia").update({ tentativas: tentativas + 1 }).eq("id", id);
  try {
    await analisarReferencia(id);
  } catch (e) {
    await db.from("referencia").update({ erro: `análise: ${(e as Error).message}`.slice(0, 500) }).eq("id", id);
  }
}

export async function analisarReferencia(id: string): Promise<void> {
  const db = createAdminClient();
  const { data: ref } = await db.from("referencia").select("id, tipo, arquivo, arquivo_tipo, legenda, notas, etapa, slides").eq("id", id).single();
  if (!ref?.arquivo) throw new Error("referência sem arquivo");
  const perfil = await lerPerfil();
  const video = ref.arquivo_tipo?.includes("video") || ref.arquivo.endsWith(".mp4");
  const contexto = [ref.legenda ? `Legenda que veio junto: ${ref.legenda}` : null, ref.notas ? `Nota do criador: ${ref.notas}` : null].filter(Boolean).join("\n");
  const agora = new Date().toISOString();
  const etapa = ref.etapa === "nova" ? "analisada" : ref.etapa;

  if (video) {
    const buf = await baixarDoBucket(db, ref.arquivo);
    const mime = ref.arquivo_tipo || "video/mp4";
    const { assistido } = await assistirVideo(buf, mime);
    const tempos = assistido.fala.map((f) => `[${f.t}] ${f.texto}`).join("\n");
    const cenas = assistido.cenas.map((c) => `[${c.t}] ${c.o_que_aparece}${c.texto_na_tela ? ` | na tela: ${c.texto_na_tela}` : ""}`).join("\n");
    const { dados } = await analisarMidiaJSON<Analise>({
      sistema: desmontarReel(perfil),
      instrucao:
        `Desmonte este reel.${contexto ? `\n${contexto}` : ""}\n\n` +
        `Duração: ${assistido.duracao_seg ?? "?"} s\nFala com tempo:\n${tempos || "(sem fala)"}\n\nCenas:\n${cenas || "(sem cenas anotadas)"}\n\nÁudio: ${assistido.audio ?? "?"}`,
      midia: { tipo: "video", url: `data:${mime};base64,${buf.toString("base64")}` },
    });
    if (!dados) throw new Error("a IA não devolveu uma análise válida");
    const analise: Analise = { ...dados, duracao_seg: assistido.duracao_seg, transcricao: falaCorrida(assistido) || null };
    await db.from("referencia").update({ tipo: "reel", assistido, analise, analisado_em: agora, erro: null, etapa }).eq("id", id);
    return;
  }

  // Carrossel / post: a capa + os prints dos slides, na ordem
  const caminhos = [ref.arquivo, ...(ref.slides ?? [])].slice(0, MAX_SLIDES);
  const imagens = await Promise.all(
    caminhos.map(async (c) => ({
      tipo: "imagem" as const,
      url: `data:${c.endsWith(".png") ? "image/png" : c.endsWith(".webp") ? "image/webp" : "image/jpeg"};base64,${(await baixarDoBucket(db, c)).toString("base64")}`,
    })),
  );
  const { dados } = await analisarMidiaJSON<Analise>({
    sistema: desmontarCarrossel(perfil),
    instrucao: `Desmonte este carrossel (${imagens.length === 1 ? "só veio a capa" : `${imagens.length} imagens, na ordem`}).${contexto ? `\n${contexto}` : ""}`,
    midias: imagens,
  });
  if (!dados) throw new Error("a IA não devolveu uma análise válida");
  await db
    .from("referencia")
    .update({ tipo: ref.tipo === "reel" ? "carrossel" : ref.tipo, analise: { ...dados, duracao_seg: null, transcricao: null }, analisado_em: agora, erro: null, etapa })
    .eq("id", id);
}
