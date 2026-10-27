import os from "node:os";
const NUCLEOS = Math.max(1, Math.min(8, os.cpus().length - 2));
// Esteira de reels (pedido do Duty, 19/10): o vídeo gravado no gravador do painel chega em TAKES.
// Aqui a estação junta os takes num vídeo só, antes da edição de sempre, e põe a música no fim.
//
//   juntarTakes   cada take: corta o começo e o fim (o que ele marcou no celular), muda a velocidade,
//                 aplica os ajustes de imagem (brilho, iluminação, nitidez) e padroniza (1080×1920,
//                 30 fps, áudio 48 kHz); depois emenda na ordem. As emendas viram as "tomadas" que o
//                 editor já sabe tratar (onda de calor + clique).
//   misturarMusica a música dele por baixo da voz no vídeo pronto: abaixa sozinha quando ele fala
//                 (sidechain), some no fim e o volume final fica em -14 LUFS.
// O ajuste de imagem só existe quando ele mexeu no gravador: a estação continua sem filtro por conta
// própria (pedido do Lucas em 01/10).

import fs from "node:fs";
import path from "node:path";
import { FERRAMENTAS, rodar, sondar } from "./preparar.mjs";

const entre = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));

/** O filtro do ffmpeg pros ajustes do gravador (null = sem ajuste). Perto da prévia do navegador. */
export function filtroAjustes(a) {
  if (!a) return null;
  const brilho = entre(a.brilho, -1, 1);
  const iluminacao = entre(a.iluminacao, -1, 1);
  const nitidez = entre(a.nitidez, 0, 1);
  const f = [];
  // brilho soma luz em tudo; iluminação mexe nos tons médios (o rosto) sem estourar o branco
  if (brilho || iluminacao) f.push(`eq=brightness=${(brilho * 0.12).toFixed(3)}:gamma=${(1 + iluminacao * 0.35).toFixed(3)}`);
  if (nitidez) f.push(`unsharp=5:5:${(nitidez * 1.2).toFixed(2)}:5:5:0`);
  return f.length ? f.join(",") : null;
}

/**
 * takes: [{ arquivo, inicio, fim, velocidade }] na ordem do vídeo. Escreve `saida` (mp4) e devolve
 * a duração total.
 */
export async function juntarTakes(takes, saida, { ajustes = null, aviso = () => {} } = {}) {
  if (!takes.length) throw new Error("o pedido não tem takes");
  const pasta = path.join(path.dirname(saida), "_takes");
  fs.mkdirSync(pasta, { recursive: true });
  const ajuste = filtroAjustes(ajustes);
  const partes = [];
  for (const [k, t] of takes.entries()) {
    aviso(`juntando os takes: ${k + 1} de ${takes.length}`);
    const info = await sondar(t.arquivo);
    if (!info.largura) throw new Error(`o take ${k + 1} não tem imagem`);
    const fim = Number(t.fim) > 0 ? Number(t.fim) : info.duracao;
    const inicio = entre(t.inicio, 0, Math.max(0, fim - 0.2));
    const vel = entre(t.velocidade || 1, 0.5, 2);
    const v = [
      `[0:v]trim=start=${inicio.toFixed(3)}:end=${fim.toFixed(3)},setpts=PTS-STARTPTS`,
      vel !== 1 ? `setpts=PTS/${vel}` : null,
      "fps=30",
      "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos",
      "crop=1080:1920",
      "setsar=1",
      ajuste,
      "format=yuv420p[v]",
    ]
      .filter(Boolean)
      .join(",");
    // take sem áudio (raro): silêncio do mesmo tamanho, pra emenda não desalinhar
    const a = info.temAudio
      ? `[0:a]atrim=start=${inicio.toFixed(3)}:end=${fim.toFixed(3)},asetpts=PTS-STARTPTS${vel !== 1 ? `,atempo=${vel}` : ""},aresample=48000,aformat=channel_layouts=stereo[a]`
      : `anullsrc=r=48000:cl=stereo,atrim=duration=${((fim - inicio) / vel).toFixed(3)}[a]`;
    const destino = path.join(pasta, `take-${String(k + 1).padStart(2, "0")}.mp4`);
    await rodar(
      FERRAMENTAS.ffmpeg,
      ["-y", "-v", "error", "-filter_threads", String(NUCLEOS), "-i", t.arquivo, "-filter_complex", `${v};${a}`, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-threads", String(NUCLEOS), "-r", "30", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", destino],
      { timeoutMs: 30 * 60_000 },
    );
    partes.push(destino);
  }
  const lista = path.join(pasta, "lista.txt");
  fs.writeFileSync(lista, partes.map((p) => `file '${p.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`).join("\n"));
  await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lista, "-c", "copy", "-movflags", "+faststart", saida], { timeoutMs: 20 * 60_000 });
  fs.rmSync(pasta, { recursive: true, force: true });
  return (await sondar(saida)).duracao;
}

/** A música por baixo da voz no vídeo pronto. volume: 0 a 1 (o do gravador; ~0,15 é fundo). */
export async function misturarMusica(video, musica, volume, saida) {
  const info = await sondar(video);
  const dur = Math.max(1, info.duracao);
  const vol = entre(volume || 0.15, 0.01, 1);
  const filtro = info.temAudio
    ? [
        `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${vol.toFixed(3)},atrim=duration=${dur.toFixed(3)},afade=t=out:st=${Math.max(0, dur - 1.5).toFixed(3)}:d=1.5[m]`,
        "[0:a]aresample=48000,aformat=channel_layouts=stereo,asplit=2[voz][chave]",
        "[m][chave]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[baixa]",
        "[voz][baixa]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]",
      ].join(";")
    : `[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${vol.toFixed(3)},atrim=duration=${dur.toFixed(3)},afade=t=out:st=${Math.max(0, dur - 1.5).toFixed(3)}:d=1.5,loudnorm=I=-14:TP=-1.5:LRA=11[a]`;
  await rodar(
    FERRAMENTAS.ffmpeg,
    ["-y", "-v", "error", "-i", video, "-stream_loop", "-1", "-i", musica, "-filter_complex", filtro, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-t", dur.toFixed(3), "-movflags", "+faststart", saida],
    { timeoutMs: 10 * 60_000 },
  );
  return saida;
}
