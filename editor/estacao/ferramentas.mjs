// Onde estão os programas que a estação usa no PC do criador (Windows ou macOS).
// Cada um pode ser apontado no .env.local; sem isso, procura nos lugares de instalação
// mais comuns e depois no PATH.
//
//   FFMPEG_BIN     ffmpeg (o ffprobe é procurado na mesma pasta; ou FFPROBE_BIN)
//   WHISPER_BIN    whisper-cli do whisper.cpp
//   WHISPER_MODEL  modelo do whisper (o esperado é o ggml-large-v3-turbo-q5_0.bin)
//   CLAUDE_BIN     Claude Code (logado no plano do criador)
//   CHROME_BIN     Chrome/Chromium/Edge pros prints de página (kit/print.mjs)
//   EDITOR_FONTE   fonte .ttf das folhas de quadros (texto do tempo em cada quadro)

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const WIN = process.platform === "win32";
const MAC = process.platform === "darwin";
const CASA = os.homedir();
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

export const FERRAMENTAS = { ffmpeg, ffprobe, whisper, modelos, claude, chrome, fonte };

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
  claude: WIN ? "Claude Code (irm https://claude.ai/install.ps1 | iex, depois claude pra fazer login) ou CLAUDE_BIN no .env.local" : "Claude Code (curl -fsSL https://claude.ai/install.sh | bash, depois claude pra fazer login) ou CLAUDE_BIN no .env.local",
  node: "Node.js 22 ou mais novo (nodejs.org)",
};
