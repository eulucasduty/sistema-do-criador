// Estúdio de motion: renderiza os motions (vídeos animados em Remotion) que o editor escreve numa
// oficina e que entram na edição como a cena "motion" do kit.
//
//   node motion.mjs render  <pasta-da-oficina> <id>              → motions/<id>.mp4 (ou .webm transparente)
//   node motion.mjs quadros <pasta-da-oficina> <id> [--em 0.4,1.2] → motions/quadros/<id>.jpg (folha pra conferir)
//
// O motion é um arquivo motions/<id>.tsx na oficina:
//   import { Cena, Claudinho } from "@motion";
//   export const config = { duracao: 3.7, area: "tela-cheia" };   // "tela-cheia" | "faixa" | "sobre"
//   export default function Motion() { return <Cena>…</Cena>; }
// "@motion" é a biblioteca do estúdio (src/lib). Logos, prints e materiais da oficina chegam no
// staticFile ("logos/x.svg"). O tema (cores e fontes) é o do estilo da edição.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const ESTUDIO = path.dirname(fileURLToPath(import.meta.url));
// O cache (o pacote do webpack, a pasta pública) fica no estúdio. Quando quem roda está numa caixa
// fechada que só escreve na oficina (o Codex no sandbox), o cache vai pra dentro da oficina.
function podeEscrever(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const teste = path.join(dir, `.teste-${process.pid}`);
    fs.writeFileSync(teste, "1");
    fs.rmSync(teste, { force: true });
    return true;
  } catch {
    return false;
  }
}
const TAMANHOS = { "tela-cheia": [1080, 1920], faixa: [1080, 760], sobre: [1080, 1920] };
const FPS = 30;
// o navegador que o Remotion baixou no estúdio (npx remotion browser ensure): sempre esse
const NAVEGADOR = path.join(ESTUDIO, "node_modules", ".remotion", "chrome-headless-shell", "win64", "chrome-headless-shell-win64", "chrome-headless-shell.exe");
const browserExecutable = fs.existsSync(NAVEGADOR) ? NAVEGADOR : null;

// não disputa o PC com o resto (a mesma regra da estação: metade dos núcleos, prioridade baixa)
try {
  os.setPriority(os.constants.priority.PRIORITY_BELOW_NORMAL);
} catch {}
const NUCLEOS = Math.max(1, Math.round((os.cpus().length * Math.min(100, Math.max(10, Number(process.env.EDITOR_CPU) || 50))) / 100));

const [cmd, pastaArg, id, ...resto] = process.argv.slice(2);
const opt = (n) => (resto.includes(n) ? resto[resto.indexOf(n) + 1] : null);
const USO = "uso: node motion.mjs render|quadros <pasta-da-oficina> <id> [--em 0.4,1.2]";
if (!["render", "quadros"].includes(cmd) || !pastaArg || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(id ?? "")) {
  console.error(USO);
  process.exit(1);
}
const PASTA = path.resolve(pastaArg);
const NO_ESTUDIO = podeEscrever(path.join(ESTUDIO, ".cache"));
const CACHE = NO_ESTUDIO ? path.join(ESTUDIO, ".cache") : path.join(PASTA, ".motion");

// limpeza: pacotes e pastas públicas de edições de mais de 2 dias (o disco do PC é apertado)
for (const sub of ["pacote", "publico", "entradas"]) {
  const dir = path.join(CACHE, sub);
  if (!fs.existsSync(dir)) continue;
  for (const d of fs.readdirSync(dir)) {
    const p = path.join(dir, d);
    try {
      if (Date.now() - fs.statSync(p).mtimeMs > 2 * 24 * 3600_000) fs.rmSync(p, { recursive: true, force: true });
    } catch {}
  }
}


const ARQ = path.join(PASTA, "motions", `${id}.tsx`);
if (!fs.existsSync(ARQ)) {
  console.error(`não achei motions/${id}.tsx na oficina`);
  process.exit(1);
}

/** O estilo da edição (dados/pedido.json → opcoes.estilo), pro tema. */
function estiloDaOficina() {
  if (opt("--estilo")) return opt("--estilo"); // pra testar o mesmo motion em outra identidade
  try {
    return JSON.parse(fs.readFileSync(path.join(PASTA, "dados", "pedido.json"), "utf8")).opcoes?.estilo ?? "classico";
  } catch {
    return "classico";
  }
}

/** A config do motion, lida do arquivo (duracao e area), pra saber o tamanho e o formato do vídeo. */
function configDoMotion() {
  const txt = fs.readFileSync(ARQ, "utf8");
  const bloco = txt.match(/export\s+const\s+config\s*=\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  const duracao = Number(bloco.match(/duracao\s*:\s*([\d.]+)/)?.[1]);
  const area = bloco.match(/area\s*:\s*["']([\w-]+)["']/)?.[1] ?? "tela-cheia";
  if (!(duracao > 0.2)) throw new Error(`motions/${id}.tsx precisa de: export const config = { duracao: <segundos>, area: "tela-cheia" | "faixa" | "sobre" }`);
  if (!TAMANHOS[area]) throw new Error(`area desconhecida em motions/${id}.tsx: ${area} (use tela-cheia, faixa ou sobre)`);
  // os sons de cada batida (export const sons = [{ em: 0.4, som: "pop" }, …]): a edição toca no lugar certo
  const listaSons = txt.match(/export\s+const\s+sons\s*=\s*\[([\s\S]*?)\]\s*;/)?.[1] ?? "";
  const sons = [...listaSons.matchAll(/\{\s*em\s*:\s*([\d.]+)\s*,\s*som\s*:\s*["']([\w-]+)["']\s*(?:,\s*volume\s*:\s*([\d.]+)\s*)?,?\s*\}/g)].map((m) => ({ em: Number(m[1]), som: m[2], ...(m[3] ? { volume: Number(m[3]) } : {}) })).filter((x) => x.em < duracao);
  return { duracao, area, transparente: area === "sobre" || /transparente\s*:\s*true/.test(bloco), noite: /noite\s*:\s*true/.test(bloco), sons };
}

/** Uma pasta pública com as fontes do estúdio e as imagens da oficina (logos, prints, materiais, foto do perfil). */
function pastaPublica() {
  const destino = path.join(CACHE, "publico", crypto.createHash("sha1").update(PASTA).digest("hex").slice(0, 12));
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });
  fs.cpSync(path.join(ESTUDIO, "public"), destino, { recursive: true });
  const imagem = /\.(png|jpe?g|webp|svg|gif)$/i;
  for (const sub of ["logos", "prints", "materiais"]) {
    const de = path.join(PASTA, sub);
    if (fs.existsSync(de)) fs.cpSync(de, path.join(destino, sub), { recursive: true, filter: (f) => fs.statSync(f).isDirectory() || imagem.test(f) });
  }
  const foto = path.join(PASTA, "assets", "perfil.jpg");
  if (fs.existsSync(foto)) fs.copyFileSync(foto, path.join(destino, "perfil.jpg"));
  return destino;
}

/** O ponto de entrada do Remotion: registra o motion com o tema do estilo e as fontes. */
function entrada(cfg, estilo) {
  const dir = path.join(CACHE, "entradas");
  fs.mkdirSync(dir, { recursive: true });
  const arq = path.join(dir, `${crypto.createHash("sha1").update(ARQ + estilo).digest("hex").slice(0, 12)}.tsx`);
  const [w, h] = TAMANHOS[cfg.area];
  fs.writeFileSync(
    arq,
    `import React from "react";
import { Composition, registerRoot } from "remotion";
import { TemaCtx, temaDoEstilo, carregarFontes } from "@motion";
import Motion from ${JSON.stringify(ARQ.replaceAll("\\", "/"))};
carregarFontes();
const Envolto: React.FC = () => (
  <TemaCtx.Provider value={temaDoEstilo(${JSON.stringify(estilo)})}>
    <Motion />
  </TemaCtx.Provider>
);
const Raiz: React.FC = () => <Composition id="Motion" component={Envolto} width={${w}} height={${h}} fps={${FPS}} durationInFrames={${Math.max(1, Math.round(cfg.duracao * FPS))}} />;
registerRoot(Raiz);
`,
  );
  return arq;
}

async function empacotar(cfg) {
  const estilo = estiloDaOficina();
  const t0 = Date.now();
  const serveUrl = await bundle({
    entryPoint: entrada(cfg, estilo),
    publicDir: pastaPublica(),
    outDir: path.join(CACHE, "pacote", crypto.createHash("sha1").update(PASTA + estilo).digest("hex").slice(0, 12)),
    enableCaching: NO_ESTUDIO, // o cache do webpack mora no node_modules do estúdio
    webpackOverride: (c) => ({
      ...c,
      resolve: {
        ...c.resolve,
        alias: { ...(c.resolve?.alias ?? {}), "@motion": path.join(ESTUDIO, "src", "lib", "index.ts") },
        modules: [path.join(ESTUDIO, "node_modules"), ...(c.resolve?.modules ?? ["node_modules"])],
      },
    }),
  });
  const composition = await selectComposition({ serveUrl, id: "Motion", inputProps: {}, browserExecutable });
  console.log(`motion ${id} · ${cfg.area} · ${cfg.duracao}s · estilo ${estilo} · montado em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return { serveUrl, composition };
}

const cfg = configDoMotion();
const { serveUrl, composition } = await empacotar(cfg);
const saidas = path.join(PASTA, "motions");

if (cmd === "render") {
  const t0 = Date.now();
  const sufixo = opt("--estilo") ? `-${opt("--estilo")}` : "";
  const arquivo = path.join(saidas, `${id}${sufixo}.${cfg.transparente ? "webm" : "mp4"}`);
  for (const ext of ["mp4", "webm"]) fs.rmSync(path.join(saidas, `${id}${sufixo}.${ext}`), { force: true });
  let ultimo = -1;
  await renderMedia({
    composition,
    serveUrl,
    outputLocation: arquivo,
    concurrency: NUCLEOS,
    browserExecutable,
    muted: true,
    ...(cfg.transparente ? { codec: "vp9", imageFormat: "png", pixelFormat: "yuva420p" } : { codec: "h264", crf: 17, imageFormat: "jpeg", jpegQuality: 92 }),
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 5) * 20;
      if (p > ultimo) {
        ultimo = p;
        console.log(`  renderizando ${p}%`);
      }
    },
  });
  const info = { id, arquivo: path.relative(PASTA, arquivo).replaceAll("\\", "/"), area: cfg.area, duracao: cfg.duracao, largura: composition.width, altura: composition.height, transparente: cfg.transparente, noite: cfg.noite, sons: cfg.sons, feito_em: new Date().toISOString() };
  fs.writeFileSync(path.join(saidas, `${id}${sufixo}.json`), JSON.stringify(info, null, 2));
  console.log(`pronto: ${info.arquivo} (${((Date.now() - t0) / 1000).toFixed(1)}s). Na cena: { "tipo": "motion", "motion": "${id}", "de": …, "ate": … } com ate - de = ${cfg.duracao}`);
} else {
  // folha de quadros pra conferir com os olhos (a regra da casa: nunca entregar sem olhar)
  const dir = path.join(saidas, "quadros");
  fs.mkdirSync(dir, { recursive: true });
  const pedidos = opt("--em");
  const tempos = pedidos ? pedidos.split(",").map(Number).filter((x) => x >= 0 && x < cfg.duracao) : Array.from({ length: 8 }, (_, k) => +(((k + 0.5) * cfg.duracao) / 8).toFixed(2));
  const pngs = [];
  for (const t of tempos) {
    const out = path.join(dir, `${id}${opt("--estilo") ? `-${opt("--estilo")}` : ""}-${t.toFixed(2)}.png`);
    await renderStill({ composition, serveUrl, browserExecutable, output: out, frame: Math.min(composition.durationInFrames - 1, Math.round(t * FPS)), imageFormat: "png", overwrite: true });
    pngs.push(out);
  }
  const folha = path.join(dir, `${id}${opt("--estilo") ? `-${opt("--estilo")}` : ""}.jpg`);
  if (pngs.length === 1) {
    spawnSync("ffmpeg", ["-y", "-v", "error", "-i", pngs[0], "-vf", "scale=540:-2", folha]);
    console.log(`folha: ${path.relative(PASTA, folha).replaceAll("\\", "/")} (${tempos[0]}s)`);
    process.exit(0);
  }
  const colunas = Math.min(4, pngs.length);
  const linhas = Math.ceil(pngs.length / colunas);
  const largura = cfg.area === "faixa" ? 480 : 300;
  const filtro = pngs.map((_, k) => `[${k}:v]scale=${largura}:-2,drawtext=fontfile='C\\:/Windows/Fonts/arialbd.ttf':text='${tempos[k].toFixed(2)}s':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=5[q${k}]`).join(";");
  const pads = Array.from({ length: colunas * linhas - pngs.length }, () => `color=c=black:s=${largura}x${Math.round((largura * composition.height) / composition.width)}`);
  const entradas = [...pngs.flatMap((p) => ["-i", p]), ...pads.flatMap((p) => ["-f", "lavfi", "-i", p])];
  const todos = [...pngs.map((_, k) => `[q${k}]`), ...pads.map((_, k) => `[${pngs.length + k}:v]`)].join("");
  const r = spawnSync("ffmpeg", ["-y", "-v", "error", ...entradas, "-filter_complex", `${filtro};${todos}xstack=inputs=${colunas * linhas}:layout=${Array.from({ length: colunas * linhas }, (_, k) => `${(k % colunas) === 0 ? "0" : Array.from({ length: k % colunas }, () => "w0").join("+")}_${Math.floor(k / colunas) === 0 ? "0" : Array.from({ length: Math.floor(k / colunas) }, () => "h0").join("+")}`).join("|")}`, "-frames:v", "1", folha], { encoding: "utf8" });
  if (r.status === 0) console.log(`folha: ${path.relative(PASTA, folha).replaceAll("\\", "/")} (${tempos.map((t) => `${t}s`).join(", ")})`);
  else console.log(`quadros soltos em motions/quadros/ (a folha falhou: ${(r.stderr ?? "").slice(-200)})`);
}
