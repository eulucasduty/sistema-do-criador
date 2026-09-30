// Logo OFICIAL de uma marca → logos/<nome>.svg|png, pronta pro plano (nunca desenhada à mão).
// Primeiro o media-use (theSVG → avatar do GitHub → favicon); se vier só um favicon pequeno,
// tenta o ícone grande do próprio site (apple-touch-icon) e o favicon de 256 px do Google.
//
// Uso: node kit/logo.mjs "ManyChat" --site manychat.com [--nome manychat]

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opcao = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const marca = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
if (!marca) {
  console.error('uso: node kit/logo.mjs "Marca" [--site dominio.com] [--nome arquivo]');
  process.exit(1);
}
const site = opcao("site")?.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
const nome = (opcao("nome") ?? marca)
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
fs.mkdirSync("logos", { recursive: true });

function tamanho(b) {
  if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return Math.min(b.readUInt32BE(16), b.readUInt32BE(20));
  if (b[0] === 0xff && b[1] === 0xd8) return 999; // jpeg: aceita
  return 0;
}
function mediaUse(intencao) {
  const cmd = `npx --yes hyperframes@0.8.92 media-use resolve --type logo --intent "${intencao.replace(/["%^&|<>]/g, "")}" --project .`;
  const r = spawnSync(cmd, { encoding: "utf8", shell: true, timeout: 180_000, windowsHide: true });
  return `${r.stdout}${r.stderr}`.match(/resolved \S+ → (\S+)/)?.[1];
}
async function baixar(url) {
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch {
    return null;
  }
}
function comoPng(de, para) {
  // .ico/.webp/.gif → png (pega o maior quadro do ícone)
  const r = spawnSync(process.env.FFMPEG_BIN || "ffmpeg", ["-y", "-v", "error", "-i", de, "-frames:v", "1", para], { windowsHide: true });
  return r.status === 0 && fs.existsSync(para);
}
function pronto(arquivo) {
  const b = fs.readFileSync(arquivo);
  const t = arquivo.endsWith(".svg") ? "vetor" : `${tamanho(b)} px`;
  console.log(`logo: ${arquivo.replace(/\\/g, "/")} (${t}) — confira a imagem antes de usar`);
  process.exit(0);
}

const achado = mediaUse(`${marca} official logo`) ?? mediaUse(`${marca} logo`);
if (achado?.endsWith(".svg")) {
  const destino = path.join("logos", `${nome}.svg`);
  fs.copyFileSync(achado, destino);
  pronto(destino);
}
let melhor = null;
if (achado) {
  const png = path.join("logos", `${nome}-mu.png`);
  if (/\.png$/i.test(achado)) fs.copyFileSync(achado, png);
  else comoPng(achado, png);
  if (fs.existsSync(png)) melhor = { arquivo: png, px: tamanho(fs.readFileSync(png)) };
}
if ((!melhor || melhor.px < 150) && site) {
  for (const url of [`https://${site}/apple-touch-icon.png`, `https://www.${site}/apple-touch-icon.png`, `https://www.google.com/s2/favicons?domain=${site}&sz=256`]) {
    const b = await baixar(url);
    if (!b) continue;
    const px = tamanho(b);
    if (px > (melhor?.px ?? 0)) {
      const arq = path.join("logos", `${nome}-site.png`);
      fs.writeFileSync(arq, b);
      melhor = { arquivo: arq, px };
    }
    if (px >= 150) break;
  }
}
if (!melhor) {
  console.error(`não achei logo oficial de "${marca}"${site ? "" : " (tente com --site dominio.com)"}`);
  process.exit(1);
}
const destino = path.join("logos", `${nome}.png`);
fs.renameSync(melhor.arquivo, destino);
for (const f of [`${nome}-mu.png`, `${nome}-site.png`]) fs.rmSync(path.join("logos", f), { force: true });
if (melhor.px < 120) console.log(`atenção: só achei um ícone pequeno (${melhor.px} px); use pequeno ou prefira um print`);
pronto(destino);
