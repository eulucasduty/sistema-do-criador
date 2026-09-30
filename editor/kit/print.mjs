// Print de uma página pública de verdade (Chrome sem janela). É assim que entra a
// interface ORIGINAL de uma plataforma (GitHub, site, documentação) em vez de uma imitação.
//
// Uso: node kit/print.mjs <url> <saida.png> [--largura 1280] [--altura 1600] [--celular] [--escuro] [--espera 9000]
//   --celular  abre como iPhone (página mobile, 430×932)
//   --escuro   pede o tema escuro do site (quando ele tem)
// Páginas com login (Instagram, painéis) não dão: pra essas, use o material que o criador subiu.
// Chrome: CHROME_BIN (a estação passa o que achou); senão Chrome/Edge nos lugares de costume
// (Windows e macOS); senão o Chrome que o HyperFrames baixa pro render.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const opcao = (nome, padrao) => {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : padrao;
};
const tem = (nome) => args.includes(`--${nome}`);
const [url, saida] = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["--celular", "--escuro"].includes(args[i - 1])));
if (!url || !saida || !/^https?:\/\//.test(url)) {
  console.error("uso: node kit/print.mjs <url https://…> <saida.png> [--largura 1280] [--altura 1600] [--celular] [--escuro]");
  process.exit(1);
}

const celular = tem("celular");
const largura = Number(opcao("largura", celular ? 430 : 1280));
const altura = Number(opcao("altura", celular ? 932 : 1600));
function acharChrome() {
  const env = process.env.CHROME_BIN || process.env.CHROME;
  if (env && fs.existsSync(env)) return env;
  const casa = os.homedir();
  const pf = process.env.ProgramFiles || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || path.join(casa, "AppData", "Local");
  const lugares =
    process.platform === "win32"
      ? [path.join(pf, "Google", "Chrome", "Application", "chrome.exe"), path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"), path.join(local, "Google", "Chrome", "Application", "chrome.exe"), path.join(pf86, "Microsoft", "Edge", "Application", "msedge.exe"), path.join(pf, "Microsoft", "Edge", "Application", "msedge.exe")]
      : process.platform === "darwin"
        ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", path.join(casa, "Applications", "Google Chrome.app", "Contents", "MacOS", "Google Chrome"), "/Applications/Chromium.app/Contents/MacOS/Chromium", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"]
        : ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  const achado = lugares.find((p) => fs.existsSync(p));
  if (achado) return achado;
  // o Chrome do HyperFrames (o mesmo do render)
  const r = spawnSync("npx --yes hyperframes@0.8.92 browser path", { shell: true, encoding: "utf8", timeout: 180_000, windowsHide: true });
  const linha = `${r.stdout ?? ""}`.split(/\r?\n/).map((l) => l.trim()).reverse().find((l) => l && fs.existsSync(l));
  return linha ?? null;
}
const chrome = acharChrome();
if (!chrome) {
  console.error("não achei o Chrome neste PC: instale o Google Chrome ou aponte CHROME_BIN no .env.local");
  process.exit(1);
}
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "print-"));
const destino = path.resolve(saida);
fs.mkdirSync(path.dirname(destino), { recursive: true });

const flags = [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  "--mute-audio",
  `--user-data-dir=${perfil}`,
  `--window-size=${largura},${altura}`,
  `--force-device-scale-factor=${celular ? 3 : 1}`,
  `--virtual-time-budget=${Number(opcao("espera", 9000))}`,
  "--lang=pt-BR",
  `--screenshot=${destino}`,
];
if (celular) flags.push("--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1");
if (tem("escuro")) flags.push("--force-dark-mode", "--blink-settings=preferredColorScheme=0");
flags.push(url);

function sair(codigo, msg) {
  try {
    fs.rmSync(perfil, { recursive: true, force: true });
  } catch {}
  console.error(msg);
  process.exit(codigo);
}

// Página que exige login não mostra nada de útil sem a conta do criador
if (/(^|\.)(instagram\.com|facebook\.com|web\.whatsapp\.com|tiktok\.com|x\.com|twitter\.com|linkedin\.com)$/i.test(new URL(url).hostname))
  sair(2, `${url} pede login: use o material que o criador subiu ou a logo oficial (kit/logo.mjs)`);

// Proteção contra robô (Cloudflare etc.): confere o texto da página antes de fotografar
const dom = spawnSync(chrome, [...flags.filter((f) => !f.startsWith("--screenshot") && f !== url), "--dump-dom", url], { encoding: "utf8", timeout: 60_000, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const texto = `${dom.stdout ?? ""}`;
if (/challenge-platform|cf-browser-verification|cf-turnstile|Just a moment|Checking your browser|Verifying you are human|verificação de segurança|Attention Required|captcha-delivery|px-captcha/i.test(texto))
  sair(3, `${url} bloqueou o print (proteção contra robô): use o material do criador, a logo oficial ou outra página`);

const r = spawnSync(chrome, flags, { encoding: "utf8", timeout: 60_000, windowsHide: true });
try {
  fs.rmSync(perfil, { recursive: true, force: true });
} catch {}
if (!fs.existsSync(destino)) {
  console.error(`não consegui o print de ${url}\n${(r.stderr || "").slice(-800)}`);
  process.exit(1);
}
const b = fs.readFileSync(destino);
console.log(`print: ${saida} (${b.readUInt32BE(16)}×${b.readUInt32BE(20)}) de ${url}`);
