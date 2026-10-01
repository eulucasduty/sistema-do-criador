// Recorte da pessoa (sem o fundo) nos trechos que o plano pede: texto atrás dela, troca de cenário,
// profundidade, "sair" da moldura. O montador lista os trechos em dados/recortes.json; aqui cada um
// vira um .webm com transparência (hyperframes remove-background: um modelo que roda no próprio PC,
// uns 15 s de processamento por segundo de vídeo; na primeira vez ele baixa o modelo). Depois o
// montador roda de novo e encaixa.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { comandoHyperframes } from "./ferramentas.mjs";
import { FERRAMENTAS, rodar } from "./preparar.mjs";

function rodarShell(comando, { cwd, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const p = spawn(comando, { cwd, shell: true, windowsHide: true });
    let log = "";
    const ler = (d) => {
      log += d;
      if (log.length > 60_000) log = log.slice(-30_000);
    };
    p.stdout.on("data", ler);
    p.stderr.on("data", ler);
    const relogio = setTimeout(() => {
      p.kill();
      reject(new Error(`o recorte passou de ${Math.round(timeoutMs / 60_000)} min`));
    }, timeoutMs);
    p.on("error", (e) => {
      clearTimeout(relogio);
      reject(e);
    });
    p.on("close", (codigo) => {
      clearTimeout(relogio);
      if (codigo === 0) resolve(log);
      else reject(new Error(`o recorte falhou (código ${codigo}): ${log.slice(-800)}`));
    });
  });
}

/** Os trechos de dados/recortes.json que ainda não têm arquivo. */
export function recortesPendentes(pasta) {
  try {
    return JSON.parse(fs.readFileSync(path.join(pasta, "dados", "recortes.json"), "utf8")).filter((p) => p?.arquivo && /^recortes\/r-\d+-\d+\.webm$/.test(p.arquivo) && !fs.existsSync(path.join(pasta, p.arquivo)));
  } catch {
    return [];
  }
}

/** Gera os recortes pendentes. Devolve quantos fez. */
export async function gerarRecortes(pasta, { aviso = () => {} } = {}) {
  const pendentes = recortesPendentes(pasta);
  if (!pendentes.length) return 0;
  const total = pendentes.reduce((s, p) => s + (p.ate - p.de), 0);
  aviso(`recortando você do fundo: ${pendentes.length} trecho(s), ${Math.round(total)} s de vídeo (leva uns ${Math.max(1, Math.ceil((total * 15) / 60))} min)`);
  fs.mkdirSync(path.join(pasta, "recortes"), { recursive: true });
  for (const [k, p] of pendentes.entries()) {
    const dur = Math.round((p.ate - p.de) * 1000) / 1000;
    const trecho = `recortes/_trecho-${k}.mp4`;
    // o trecho exato do vídeo já tratado (mesma cor e mesmo quadro do render), sem áudio
    await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-ss", String(p.de), "-t", String(dur), "-i", "assets/video.mp4", "-an", "-r", "30", "-c:v", "libx264", "-preset", "fast", "-crf", "14", "-pix_fmt", "yuv420p", trecho], { cwd: pasta, timeoutMs: 10 * 60_000 });
    await rodarShell(`${comandoHyperframes()} remove-background ${trecho} -o ${p.arquivo} --quality balanced`, { cwd: pasta, timeoutMs: Math.max(10, Math.ceil(dur)) * 60_000 });
    fs.rmSync(path.join(pasta, trecho), { force: true });
    if (!fs.existsSync(path.join(pasta, p.arquivo))) throw new Error(`o recorte ${p.arquivo} não saiu`);
    aviso(`recorte ${k + 1} de ${pendentes.length} pronto`);
  }
  return pendentes.length;
}
