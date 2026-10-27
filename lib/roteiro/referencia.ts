import "server-only";
import { completar, completarJSON, extrairJSON, MODELO_PADRAO } from "@/lib/ia/openrouter";
import { assistirVideo, falaCorrida, type Assistido } from "@/lib/esteira/referencia";

// O vídeo de referência de um roteiro: a fala (transcrição) e a análise em ABSTRATO.
//   · vídeo até 45 MB: o mesmo "assistir" da esteira (Gemini vê e ouve, fala palavra por palavra
//     com tempo + cenas), sem ffmpeg;
//   · vídeo maior: o navegador do criador tira só o áudio (WAV 16 kHz mono) e o Gemini ouve.
// A análise tira assunto, ângulo, estrutura e os fatos do assunto, com palavras próprias: é só
// isso que chega no escritor (lib/roteiro/escrever.ts). As falas do outro criador ficam aqui.

export type Transcricao = Assistido & { fonte: string };

export type AnaliseReferencia = {
  assunto: string;
  angulo: string;
  publico?: string | null;
  gancho?: { tipo: string; mecanismo: string } | null;
  estrutura: Array<{ parte: string; funcao: string }>;
  pontos: string[];
  /** a prova pessoal do outro criador (o tipo, sem número): no roteiro do criador vira [colchete] */
  prova_do_criador?: string | null;
  ritmo?: string | null;
  cta?: string | null;
  por_que_funcionou?: string[];
  duracao_seg: number | null;
  palavras_por_segundo: number | null;
};

const OUVIR = `Você ouve o áudio de um vídeo curto do começo ao fim e transcreve com precisão, em português do Brasil.

Responda APENAS um JSON:
{"duracao_seg": número, "fala": [{"t": "mm:ss", "texto": "o que foi falado, LITERAL, palavra por palavra"}], "audio": "voz, música, efeitos"}

Regras:
- Transcreva TODA a fala, sem resumir e sem pular nada. Um trecho por frase.
- Nome de ferramenta como é (Claude, ChatGPT, Cursor, GSAP, n8n…).
- Sem fala: "fala": [].`;

const FORMATO_AUDIO: Record<string, string> = { "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/aac": "aac" };

/** A fala (e as cenas, quando é vídeo) de um arquivo de referência. */
export async function transcreverArquivo(buf: Buffer, mime: string, fonte: string): Promise<{ transcricao: Transcricao; custoUsd: number }> {
  if (mime.startsWith("audio/")) {
    const { texto, uso } = await completar({
      mensagens: [
        { role: "system", content: OUVIR },
        {
          role: "user",
          content: [
            { type: "text", text: "Ouça este áudio inteiro e transcreva." },
            { type: "input_audio", input_audio: { data: buf.toString("base64"), format: FORMATO_AUDIO[mime] ?? "wav" } },
          ],
        },
      ],
      maxTokens: 12000,
      json: true,
      timeoutMs: 300_000,
    });
    const j = extrairJSON<{ duracao_seg?: number; fala?: Array<{ t: string; texto: string }>; audio?: string }>(texto);
    if (!j || !Array.isArray(j.fala)) throw new Error("a IA não devolveu a transcrição do áudio");
    return {
      transcricao: { duracao_seg: Number(j.duracao_seg) || null, fala: j.fala.filter((f) => f?.texto?.trim()), cenas: [], audio: j.audio ?? null, fonte },
      custoUsd: uso.custoUsd,
    };
  }
  const { assistido, custoUsd } = await assistirVideo(buf, mime || "video/mp4");
  return { transcricao: { ...assistido, fonte }, custoUsd };
}

const ANALISAR = `Você analisa um vídeo de referência que performou bem (transcrição com tempos e cenas abaixo) pra um OUTRO criador escrever um roteiro NOVO sobre o mesmo assunto.

Tire o assunto, o ângulo e a estrutura em ABSTRATO. Regra de ouro: não copie frase do vídeo. Escreva tudo com as suas palavras, nada entre aspas, nenhum bordão ou expressão característica do criador.
Os fatos do assunto entram, com frase sua: nome de ferramenta, site, plataforma e repositório fica EXATO como é (Airbnb, Google Flow, Claude Code, GitHub), passos concretos, números públicos (estrelas de um repositório, preço de uma ferramenta). Escreva simples e direto, sem adjetivo ("expressivamente", "contundente").
Resultado PESSOAL do criador (seguidores que ganhou, quanto faturou, os clientes dele, o tempo que levou) é dele, não do assunto: fica fora de "pontos" e vai em "prova_do_criador", só o tipo de prova, sem o número.

Responda APENAS um JSON:
{
  "assunto": "do que o vídeo fala, em 1 frase",
  "angulo": "o recorte: qual promessa, contra o quê, por que alguém para pra ver",
  "publico": "pra quem é",
  "gancho": {"tipo": "ruptura | resultado com número | reconhecimento | incômodo | espanto | pergunta | contraste | lista | história | outro", "mecanismo": "o que prende nos 3 primeiros segundos, sem citar a fala"},
  "estrutura": [{"parte": "0-3s", "funcao": "o que essa parte faz (ex.: promete X, mostra o passo 1, prova com resultado)"}],
  "pontos": ["fato ou passo concreto do assunto, com as suas palavras (até 8)"],
  "prova_do_criador": "que tipo de prova pessoal ele usa (ex.: mostra o crescimento de seguidores dele), sem o número" ou null,
  "ritmo": "como fala: tamanho das frases, velocidade, tom",
  "cta": "que tipo de chamada (ex.: comentar uma palavra pra receber o link), sem a palavra deles",
  "por_que_funcionou": ["motivo concreto", "motivo concreto"]
}`;

/** Assunto, ângulo e estrutura da referência, sem as falas. */
export async function analisarReferencia(t: Transcricao, extra: { legenda?: string | null; notas?: string | null } = {}): Promise<{ analise: AnaliseReferencia; custoUsd: number }> {
  const fala = t.fala.map((f) => `[${f.t}] ${f.texto}`).join("\n");
  const cenas = (t.cenas ?? []).map((c) => `[${c.t}] ${c.o_que_aparece}${c.texto_na_tela ? ` | na tela: ${c.texto_na_tela}` : ""}`).join("\n");
  const { dados, uso } = await completarJSON<Omit<AnaliseReferencia, "duracao_seg" | "palavras_por_segundo">>({
    modelo: MODELO_PADRAO,
    sistema: ANALISAR,
    usuario: [
      `Duração: ${t.duracao_seg ?? "?"} s`,
      `Fala com tempo:\n${fala || "(sem fala)"}`,
      cenas ? `Cenas:\n${cenas}` : null,
      extra.legenda ? `Legenda do post: ${extra.legenda}` : null,
      extra.notas ? `Nota do criador: ${extra.notas}` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    maxTokens: 6000,
    temperatura: 0.2,
    timeoutMs: 120_000,
  });
  if (!dados?.assunto) throw new Error("a IA não devolveu a análise da referência");
  const palavras = falaCorrida(t).split(/\s+/).filter(Boolean).length;
  return {
    analise: {
      assunto: String(dados.assunto),
      angulo: String(dados.angulo ?? ""),
      publico: dados.publico ?? null,
      gancho: dados.gancho ?? null,
      estrutura: Array.isArray(dados.estrutura) ? dados.estrutura.slice(0, 12) : [],
      pontos: Array.isArray(dados.pontos) ? dados.pontos.map(String).slice(0, 10) : [],
      prova_do_criador: dados.prova_do_criador ?? null,
      ritmo: dados.ritmo ?? null,
      cta: dados.cta ?? null,
      por_que_funcionou: Array.isArray(dados.por_que_funcionou) ? dados.por_que_funcionou.map(String).slice(0, 5) : [],
      duracao_seg: t.duracao_seg,
      palavras_por_segundo: t.duracao_seg ? Number((palavras / t.duracao_seg).toFixed(2)) : null,
    },
    custoUsd: uso.custoUsd,
  };
}
