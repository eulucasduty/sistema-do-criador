import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

// Slides em vídeo: o original fica em referencias/NN.mp4 e a entrega sai em saida/NN.mp4.
// O ffmpeg é o mesmo do editor (winget Gyan.FFmpeg); FFMPEG/FFPROBE apontam outro caminho.
export const FFMPEG = process.env.FFMPEG || "ffmpeg";
export const FFPROBE = process.env.FFPROBE || (process.env.FFMPEG ? path.join(path.dirname(process.env.FFMPEG), `ffprobe${path.extname(process.env.FFMPEG)}`) : "ffprobe");
/** O Instagram aceita até 60 s por vídeo de carrossel. */
export const MAX_SEGUNDOS = 60;
export const ehVideo = c => /\.(mp4|mov|webm|m4v)$/i.test(c);

function rodar(bin, args, minutos = 10) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let saida = "", erro = "";
    p.stdout.on("data", d => { saida += d; });
    p.stderr.on("data", d => { erro = (erro + d).slice(-3000); });
    const t = setTimeout(() => p.kill(), minutos * 60_000);
    p.on("error", e => { clearTimeout(t); reject(new Error(`${path.basename(bin)} não abriu (${e.message}). Instale o ffmpeg: winget install Gyan.FFmpeg`)); });
    p.on("close", codigo => {
      clearTimeout(t);
      if (codigo === 0) resolve(saida);
      else reject(new Error(`${path.basename(bin)} falhou: ${erro.trim().slice(-800)}`));
    });
  });
}

/** Duração, tamanho já girado (vídeo de celular vem com rotação) e se tem áudio. */
export async function sondar(arquivo) {
  const j = JSON.parse(await rodar(FFPROBE, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", arquivo]));
  const v = j.streams?.find(s => s.codec_type === "video");
  if (!v) throw new Error(`${path.basename(arquivo)} não tem vídeo.`);
  const giro = Math.abs(Number(v.side_data_list?.find(s => s.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0)) % 180;
  const duracao = Number(j.format?.duration ?? v.duration ?? 0);
  return {
    duracao_s: Math.round(duracao * 100) / 100,
    largura: giro === 90 ? v.height : v.width,
    altura: giro === 90 ? v.width : v.height,
    audio: Boolean(j.streams?.some(s => s.codec_type === "audio")),
  };
}

/** Um quadro em tamanho real (as coordenadas dos recortes saem dele) e uma folha com 6 momentos. */
export async function quadros(video, quadroPng, folhaJpg, duracao) {
  const t = Math.min(1, duracao * 0.3).toFixed(2);
  await rodar(FFMPEG, ["-y", "-v", "error", "-ss", t, "-i", video, "-frames:v", "1", quadroPng]);
  const fps = (6 / Math.max(duracao, 0.5)).toFixed(4);
  await rodar(FFMPEG, ["-y", "-v", "error", "-i", video, "-vf", `fps=${fps},scale=360:-2,tile=3x2:padding=6:color=white`, "-frames:v", "1", "-q:v", "3", folhaJpg]);
}

const par = n => Math.max(2, Math.round(n / 2) * 2);

/** Recorta a área do motion (pixels do quadro original) e opcionalmente o trecho; grava também a capa PNG. */
export async function recortarVideo(entrada, saida, { x, y, largura, altura, inicio, fim } = {}) {
  const info = await sondar(entrada);
  const filtros = [];
  if (largura && altura) {
    if (x < 0 || y < 0 || x + largura > info.largura + 1 || y + altura > info.altura + 1) throw new Error(`Recorte fora do vídeo (${info.largura}x${info.altura}).`);
    filtros.push(`crop=${par(largura)}:${par(altura)}:${Math.round(x)}:${Math.round(y)}`);
  }
  filtros.push("scale=trunc(iw/2)*2:trunc(ih/2)*2", "setsar=1");
  const trecho = [];
  if (inicio) trecho.push("-ss", String(inicio));
  if (fim) trecho.push("-to", String(fim));
  await fs.mkdir(path.dirname(saida), { recursive: true });
  await rodar(FFMPEG, ["-y", "-v", "error", ...trecho, "-i", entrada, "-t", String(MAX_SEGUNDOS), "-vf", filtros.join(","), "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", saida]);
  const capa = saida.replace(/\.[^.]+$/, "-capa.png");
  await rodar(FFMPEG, ["-y", "-v", "error", "-ss", "0.2", "-i", saida, "-frames:v", "1", capa]);
  return { saida, capa, ...(await sondar(saida)) };
}

/**
 * Slide final em vídeo, 1080x1350: a arte inteira (base), o motion na área marcada e, por cima,
 * o que o HTML pediu sobre o vídeo + a marca (topo, PNG transparente).
 */
export async function comporSlide({ base, topo, video, area, saida }) {
  const info = await sondar(video);
  const w = par(area.largura), h = par(area.altura);
  const segundos = Math.min(MAX_SEGUNDOS, info.duracao_s || MAX_SEGUNDOS);
  const filtro = `[1:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30[v];[0:v][v]overlay=${Math.round(area.x)}:${Math.round(area.y)}:eof_action=pass[b];[b][2:v]overlay=0:0,format=yuv420p[o]`;
  await rodar(FFMPEG, [
    "-y", "-v", "error", "-loop", "1", "-framerate", "30", "-i", base, "-i", video, "-loop", "1", "-framerate", "30", "-i", topo,
    "-filter_complex", filtro, "-map", "[o]", ...(info.audio ? ["-map", "1:a"] : []), "-t", String(segundos),
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-maxrate", "5M", "-bufsize", "10M", "-r", "30",
    ...(info.audio ? ["-c:a", "aac", "-b:a", "128k"] : []), "-movflags", "+faststart", saida,
  ], 20);
  return { segundos, audio: info.audio };
}
