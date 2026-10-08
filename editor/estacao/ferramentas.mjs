// Onde estão os programas que a estação usa no PC do criador (Windows ou macOS).
// Cada um pode ser apontado no .env.local; sem isso, procura nos lugares de instalação
// mais comuns e depois no PATH.
//
//   FFMPEG_BIN     ffmpeg (o ffprobe é procurado na mesma pasta; ou FFPROBE_BIN)
//   WHISPER_BIN    whisper-cli do whisper.cpp
//   WHISPER_MODEL  modelo do whisper (o esperado é o ggml-large-v3-turbo-q5_0.bin)
//   CLAUDE_BIN     Claude Code (motores "claude" e "openrouter")
//   CODEX_BIN      Codex CLI da OpenAI (motor "codex", logado no ChatGPT)
//   CHROME_BIN     Chrome/Chromium/Edge pros prints de página (kit/print.mjs)
//   EDITOR_FONTE   fonte .ttf das folhas de quadros (texto do tempo em cada quadro)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WIN = process.platform === "win32";
const MAC = process.platform === "darwin";
const CASA = os.homedir();
/** A pasta do sistema (onde está o package.json). */
export const RAIZ_SISTEMA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const env = (...nomes) => nomes.map((n) => process.env[n]).find((v) => v && v.trim())?.trim();

/** Procura um programa no PATH (no Windows, com .exe/.com). Devolve o caminho ou null. */
export function acharPrograma(nome) {
  if (!nome) return null;
  if (path.isAbsolute(nome) || nome.includes("/") || nome.includes("\\")) return fs.existsSync(nome) ? nome : null;
  const extensoes = WIN ? (path.extname(nome) ? [""] : [".exe", ".com"]) : [""];
  for (const pasta of String(process.env.PATH ?? "").split(path.delimiter).filter(Boolean))
    for (const ext of extensoes) {
      const p = path.join(pasta.replace(/^"|"$/g, ""), nome + ext);
      try {
        if (fs.statSync(p).isFile()) return p;
      } catch {}
    }
  return null;
}
const primeiro = (lista) => lista.filter(Boolean).find((p) => fs.existsSync(p)) ?? null;

// ── ffmpeg / ffprobe ───────────────────────────────────────────────
// No Mac, o "ffmpeg" do Homebrew veio enxuto (sem zscale nem drawtext): o certo é o ffmpeg-full,
// que é keg-only (fica fora do PATH), então ele vem primeiro.
const ffmpeg =
  env("FFMPEG_BIN", "FFMPEG") ||
  (MAC ? primeiro(["/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg", "/usr/local/opt/ffmpeg-full/bin/ffmpeg"]) : null) ||
  acharPrograma("ffmpeg") ||
  (WIN ? primeiro([path.join(CASA, "ffmpeg", "bin", "ffmpeg.exe")]) : null) || // o instalador põe aqui quando não tem winget
  primeiro(MAC ? ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"] : []) ||
  "ffmpeg";
const irmao = (bin, nome) => (path.isAbsolute(bin) ? path.join(path.dirname(bin), nome + (WIN ? ".exe" : "")) : null);
const ffprobe = env("FFPROBE_BIN", "FFPROBE") || primeiro([irmao(ffmpeg, "ffprobe")]) || acharPrograma("ffprobe") || "ffprobe";
// O HyperFrames (render e lint) também chama o ffmpeg pelo PATH: põe a pasta dele na frente
if (path.isAbsolute(ffmpeg) && !String(process.env.PATH ?? "").split(path.delimiter).includes(path.dirname(ffmpeg)))
  process.env.PATH = `${path.dirname(ffmpeg)}${path.delimiter}${process.env.PATH ?? ""}`;

// ── whisper.cpp ────────────────────────────────────────────────────
const whisper =
  env("WHISPER_BIN", "WHISPER_CLI") ||
  primeiro(
    WIN
      ? [path.join(CASA, "whisper-cpp", "Release", "whisper-cli.exe"), path.join(CASA, "whisper-cpp", "whisper-cli.exe"), path.join(CASA, "whisper-cpp", "build", "bin", "Release", "whisper-cli.exe")]
      : ["/opt/homebrew/bin/whisper-cli", "/usr/local/bin/whisper-cli", path.join(CASA, "whisper-cpp", "build", "bin", "whisper-cli")],
  ) ||
  acharPrograma("whisper-cli") ||
  acharPrograma("whisper-cpp") ||
  (WIN ? path.join(CASA, "whisper-cpp", "Release", "whisper-cli.exe") : "whisper-cli");
const MODELO = "ggml-large-v3-turbo-q5_0.bin";
const modelos = [env("WHISPER_MODEL", "WHISPER_MODELO"), path.join(CASA, "whisper-cpp", "models", MODELO), path.join(CASA, "whisper-cpp", MODELO), MAC ? path.join("/opt/homebrew/share/whisper-cpp", MODELO) : null, path.join(CASA, "whisper-cpp", "models", "ggml-small.bin")].filter(Boolean);

// ── Claude Code (instalador nativo: ~/.local/bin; npm global: node_modules) ──
const claude =
  env("CLAUDE_BIN") ||
  primeiro(
    WIN
      ? [path.join(CASA, ".local", "bin", "claude.exe"), process.env.APPDATA && path.join(process.env.APPDATA, "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe")]
      : [path.join(CASA, ".local", "bin", "claude"), path.join(CASA, ".claude", "local", "claude"), "/opt/homebrew/bin/claude", "/usr/local/bin/claude"],
  ) ||
  acharPrograma("claude") ||
  "claude";

// ── Codex CLI (instalador oficial, Homebrew ou npm global; o do npm é um .js que roda no node) ──
const codex =
  env("CODEX_BIN") ||
  primeiro(
    WIN
      ? [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "OpenAI", "Codex", "bin", "codex.exe"), process.env.APPDATA && path.join(process.env.APPDATA, "npm", "node_modules", "@openai", "codex", "bin", "codex.js")]
      : ["/opt/homebrew/bin/codex", "/usr/local/bin/codex", path.join(CASA, ".local", "bin", "codex"), path.join(CASA, ".npm-global", "bin", "codex")],
  ) ||
  acharPrograma("codex") ||
  null;

// ── Chrome (prints de página; o HyperFrames baixa o Chrome dele sozinho) ──
const PF = process.env.ProgramFiles || "C:\\Program Files";
const PF86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
const LOCAL = process.env.LOCALAPPDATA || path.join(CASA, "AppData", "Local");
const chrome =
  env("CHROME_BIN", "CHROME") ||
  primeiro(
    WIN
      ? [path.join(PF, "Google", "Chrome", "Application", "chrome.exe"), path.join(PF86, "Google", "Chrome", "Application", "chrome.exe"), path.join(LOCAL, "Google", "Chrome", "Application", "chrome.exe"), path.join(PF86, "Microsoft", "Edge", "Application", "msedge.exe"), path.join(PF, "Microsoft", "Edge", "Application", "msedge.exe")]
      : MAC
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", path.join(CASA, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"), "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
        : [],
  ) ||
  acharPrograma("google-chrome") ||
  acharPrograma("chromium") ||
  acharPrograma("chromium-browser") ||
  null;

// ── fonte do texto nas folhas de quadros (drawtext do ffmpeg precisa de .ttf/.ttc) ──
const WINDIR = process.env.WINDIR || process.env.SystemRoot || "C:\\Windows";
const fonte =
  env("EDITOR_FONTE") ||
  primeiro(
    WIN
      ? [path.join(WINDIR, "Fonts", "arialbd.ttf"), path.join(WINDIR, "Fonts", "segoeuib.ttf"), path.join(WINDIR, "Fonts", "arial.ttf")]
      : MAC
        ? ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/Library/Fonts/Arial Bold.ttf", "/System/Library/Fonts/Helvetica.ttc", "/System/Library/Fonts/SFNS.ttf"]
        : ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"],
  );

export const FERRAMENTAS = { ffmpeg, ffprobe, whisper, modelos, claude, codex, chrome, fonte };

/** [comando, ...args] de um programa que pode ser um .js (npm global) ou um executável. */
export const comoRodar = (bin) => (/\.(c|m)?js$/i.test(bin) ? [process.execPath, bin] : [bin]);

// ── HyperFrames (lint, snapshot e render) e GSAP, numa pasta do sistema ─────
// Instalados uma vez em editor/ferramentas (fora do git). O motor "codex" roda os comandos num
// sandbox sem internet que não enxerga o cache do npx: por isso não dá pra depender dele.
export const HF_VERSAO = "0.8.92";
const GSAP_VERSAO = "3.14.2";
export const PASTA_FERRAMENTAS = path.join(RAIZ_SISTEMA, "editor", "ferramentas");
const HF_BIN = path.join(PASTA_FERRAMENTAS, "node_modules", "hyperframes", "bin", "hyperframes.mjs");
export const GSAP_LOCAL = path.join(PASTA_FERRAMENTAS, `gsap-${GSAP_VERSAO}.min.js`);

/** O HyperFrames instalado (caminho do bin .mjs) ou null. */
export function hyperframesLocal() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(PASTA_FERRAMENTAS, "node_modules", "hyperframes", "package.json"), "utf8"));
    return pkg.version === HF_VERSAO && fs.existsSync(HF_BIN) ? HF_BIN : null;
  } catch {
    return null;
  }
}

/** Linha de comando do HyperFrames: o instalado (sem rede) ou, sem ele, o npx. */
export function comandoHyperframes() {
  const bin = hyperframesLocal();
  return bin ? `"${process.execPath}" "${bin}"` : `npx --yes hyperframes@${HF_VERSAO}`;
}

/**
 * Instala o HyperFrames e o GSAP em editor/ferramentas, se ainda não tiver (precisa de internet,
 * uns 130 MB na primeira vez). Não trava a estação: sem isso, o kit usa o npx e o GSAP da CDN.
 */
let garantidas = null;

// O estúdio de motion (editor/motion, Remotion): as dependências e o navegador dele, uma vez.
export const PASTA_MOTION = path.join(RAIZ_SISTEMA, "editor", "motion");
const motionPronto = () => {
  try {
    const quer = JSON.parse(fs.readFileSync(path.join(PASTA_MOTION, "package.json"), "utf8")).dependencies?.remotion;
    const tem = JSON.parse(fs.readFileSync(path.join(PASTA_MOTION, "node_modules", "remotion", "package.json"), "utf8")).version;
    return Boolean(quer) && quer === tem;
  } catch {
    return false;
  }
};
function garantirMotion(aviso) {
  if (!fs.existsSync(path.join(PASTA_MOTION, "package.json"))) return false;
  if (!motionPronto()) {
    aviso("instalando o estúdio de motion animado (uma vez só, uns 2 minutos)");
    const r = spawnSync("npm ci --no-audit --no-fund --loglevel=error", { cwd: PASTA_MOTION, shell: true, encoding: "utf8", windowsHide: true, timeout: 15 * 60_000 });
    if (!motionPronto()) {
      aviso(`não deu pra instalar o estúdio de motion (${String(r.stderr || r.stdout || "").trim().split("\n").pop()?.slice(0, 200)}): as edições saem sem motion animado`);
      return false;
    }
  }
  // o Chrome do Remotion (renderiza o motion): baixa uma vez
  if (!fs.existsSync(path.join(PASTA_MOTION, "node_modules", ".remotion"))) {
    aviso("baixando o navegador do motion animado (uma vez só)");
    spawnSync("npx --no-install remotion browser ensure", { cwd: PASTA_MOTION, shell: true, encoding: "utf8", windowsHide: true, timeout: 15 * 60_000 });
  }
  return true;
}
export async function garantirFerramentas({ aviso = () => {} } = {}) {
  if (garantidas?.hyperframes && garantidas.gsap && garantidas.motion && hyperframesLocal()) return garantidas;
  fs.mkdirSync(PASTA_FERRAMENTAS, { recursive: true });
  if (!hyperframesLocal()) {
    aviso(`instalando o HyperFrames ${HF_VERSAO} (uma vez só)`);
    fs.writeFileSync(path.join(PASTA_FERRAMENTAS, "package.json"), JSON.stringify({ private: true, dependencies: { hyperframes: HF_VERSAO } }, null, 2));
    const r = spawnSync(`npm install --omit=dev --no-audit --no-fund --loglevel=error --prefix "${PASTA_FERRAMENTAS}"`, { shell: true, encoding: "utf8", windowsHide: true, timeout: 15 * 60_000 });
    if (!hyperframesLocal()) aviso(`não deu pra instalar o HyperFrames (${String(r.stderr || r.stdout || "").trim().split("\n").pop()?.slice(0, 200)}): vou usar o npx`);
  }
  if (!fs.existsSync(GSAP_LOCAL)) {
    try {
      const r = await fetch(`https://cdn.jsdelivr.net/npm/gsap@${GSAP_VERSAO}/dist/gsap.min.js`, { signal: AbortSignal.timeout(60_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const js = await r.text();
      if (!js.includes("gsap")) throw new Error("arquivo estranho");
      fs.writeFileSync(GSAP_LOCAL, js);
    } catch (e) {
      aviso(`não deu pra baixar o GSAP (${e.message}): o vídeo usa o da internet`);
    }
  }
  // O Chrome do HyperFrames (snapshot e render): baixa uma vez
  const bin = hyperframesLocal();
  if (bin) spawnSync(process.execPath, [bin, "browser", "ensure"], { encoding: "utf8", windowsHide: true, timeout: 15 * 60_000, env: { ...process.env, HYPERFRAMES_NO_UPDATE_CHECK: "1" } });
  const motion = garantirMotion(aviso);
  garantidas = { hyperframes: hyperframesLocal(), gsap: fs.existsSync(GSAP_LOCAL) ? GSAP_LOCAL : null, motion };
  return garantidas;
}

/** `fontfile=…` pronto pro drawtext (caminho escapado pro filtro do ffmpeg), ou "" pra fonte padrão. */
export function fonteDrawtext() {
  if (!fonte) return "";
  return `fontfile='${fonte.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "")}':`;
}

/**
 * O que a estação usa do ffmpeg e falta em builds enxutos: devolve a lista do que não tem
 * (vazia = ok). zscale/tonemap = HDR do iPhone; drawtext = folhas de quadros; o resto = cor, som e vídeo.
 */
export function faltaNoFfmpeg() {
  const ler = (arg) => spawnSync(ffmpeg, ["-hide_banner", arg], { encoding: "utf8", windowsHide: true, timeout: 60_000, maxBuffer: 16 * 1024 * 1024 }).stdout ?? "";
  const filtros = ler("-filters");
  const codificadores = ler("-encoders");
  const tem = (texto, nome) => new RegExp(`\\s${nome}\\s`).test(texto);
  return [
    ...["zscale", "tonemap", "drawtext", "curves", "colorbalance", "unsharp", "loudnorm", "silenceremove", "aevalsrc"].filter((f) => !tem(filtros, f)),
    ...["libx264", "libmp3lame", "aac"].filter((c) => !tem(codificadores, c)),
  ];
}

/** Dica de instalação de cada ferramenta, no sistema do PC. */
export const COMO_INSTALAR = {
  ffmpeg: WIN ? "ffmpeg completo (winget install Gyan.FFmpeg) ou FFMPEG_BIN no .env.local" : "ffmpeg completo (brew install ffmpeg-full) ou FFMPEG_BIN no .env.local",
  whisper: WIN ? `whisper.cpp: whisper-cli.exe em ${path.join(CASA, "whisper-cpp", "Release")} ou WHISPER_BIN no .env.local` : "whisper.cpp (brew install whisper.cpp) ou WHISPER_BIN no .env.local",
  modelo: `modelo do whisper (${MODELO}) em ${path.join(CASA, "whisper-cpp", "models")} ou WHISPER_MODEL no .env.local`,
  claude: WIN ? "Claude Code (irm https://claude.ai/install.ps1 | iex) ou CLAUDE_BIN no .env.local" : "Claude Code (curl -fsSL https://claude.ai/install.sh | bash) ou CLAUDE_BIN no .env.local",
  codex: "Codex (npm install -g @openai/codex) ou CODEX_BIN no .env.local",
  node: "Node.js 22 ou mais novo (nodejs.org)",
};
