import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { conferirConteudo, dentroDaOficina } from "../carrosseis/kit/contrato.mjs";
import { renderizar } from "../carrosseis/kit/renderizar.mjs";
import { referenciasDoCarrossel, conferirReferencias } from "../lib/carrossel/comum.ts";
import { ambienteDoCarrossel } from "../carrosseis/agente.mjs";

test("usa todos os slides em ordem, incluindo os posteriores ao segundo e até 20", () => {
  const r = { arquivo: "01.png", slides: Array.from({ length: 19 }, (_, i) => `${String(i + 2).padStart(2, "0")}.png`) };
  const lista = referenciasDoCarrossel(r);
  assert.equal(lista.length, 20);
  assert.equal(lista[2], "03.png");
  assert.equal(lista[19], "20.png");
  conferirReferencias(lista);
  assert.throws(() => conferirReferencias(["01.png"]), /Só existe a capa/);
  assert.throws(() => conferirReferencias([...lista, "21.png"]), /até 20/);
  assert.throws(() => conferirReferencias(["01.png", "02.png"], 6), /original tem 6 slides/);
});
test("rejeita entrega parcial, ordem trocada, idioma errado e revisão incompleta", () => {
  const c = { idioma: "pt-BR", titulo: "Teste", legenda: "Mensagem preservada", slides: [1, 2, 3].map(n => ({ n, original: `Original ${n}`, ptbr: `Tradução ${n}` })) };
  conferirConteudo(c, 3);
  assert.throws(() => conferirConteudo(c, 4), /nenhuma referência/);
  assert.throws(() => conferirConteudo({ ...c, idioma: "en" }, 3), /pt-BR/);
  assert.throws(() => conferirConteudo({ ...c, slides: [c.slides[0], c.slides[2], c.slides[1]] }, 3), /ordem/);
  assert.throws(() => conferirConteudo(c, 3, true), /ainda não conferiu/);
});
test("bloqueia saída da oficina e remove chaves de API do ambiente do agente", () => {
  assert.throws(() => dentroDaOficina(process.cwd(), "../.env.local"), /fora da oficina/);
  const env = ambienteDoCarrossel();
  assert.equal(env.SUPABASE_SECRET_KEY, undefined);
  assert.equal(env.OPENROUTER_API_KEY, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.ANTHROPIC_API_KEY, undefined);
});
test("renderiza três PNGs completos com a marca e rejeita texto cortado no terceiro", async () => {
  const raiz = path.resolve("carrosseis/oficina/teste-render");
  await fs.mkdir(path.join(raiz, "dados"), { recursive: true });
  await fs.mkdir(path.join(raiz, "assets"), { recursive: true });
  await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ffc93c" } }).jpeg().toFile(path.join(raiz, "assets/perfil.jpg"));
  await fs.writeFile(path.join(raiz, "dados/pedido.json"), JSON.stringify({ total: 3 }));
  const c = { idioma: "pt-BR", titulo: "Três slides", legenda: "Confira os três slides.", slides: [1, 2, 3].map(n => ({ n, original: `Slide ${n}`, ptbr: `Texto em português ${n}` })) };
  await fs.writeFile(path.join(raiz, "conteudo.json"), JSON.stringify(c));
  const html = `<html lang="pt-BR"><style>.slide{position:relative;width:1080px;height:1350px;overflow:hidden;background:#efdece;color:#222}p{font:64px Arial;margin:80px} [data-marca]{position:absolute;bottom:30px;right:30px;width:240px;height:58px}</style><body>${c.slides.map(s => `<section class="slide" data-slide="${s.n}"><p data-texto>${s.ptbr}</p><div data-marca></div></section>`).join("")}</body></html>`;
  await fs.writeFile(path.join(raiz, "carrossel.html"), html);
  await renderizar(raiz);
  for (let i = 1; i <= 3; i++) {
    const img = sharp(path.join(raiz, "saida", `${String(i).padStart(2, "0")}.png`));
    const m = await img.metadata();
    assert.equal(m.width, 1080); assert.equal(m.height, 1350);
    const selo = await img.extract({ left: 810, top: 1262, width: 240, height: 58 }).toBuffer();
    const media = (await sharp(selo).stats()).channels[0].mean;
    assert.ok(media < 180, "o rodapé deve conter o selo escuro com foto e @");
  }
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace('<p data-texto>Texto em português 3', '<p data-texto style="position:absolute;top:1300px">Texto em português 3'));
  await assert.rejects(() => renderizar(raiz), /Slide 3: texto cortado/);
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace("Texto em português 3", "Texto divergente"));
  await assert.rejects(() => renderizar(raiz), /Slide 3: o texto da arte difere/);
  await fs.writeFile(path.join(raiz, "carrossel.html"), html);
});
test("slide em vídeo: recorta o motion e sai em MP4 1080x1350 com a arte e a marca", { skip: process.env.TESTE_SEM_FFMPEG === "1" ? "FFmpeg indisponível no ambiente" : false }, async () => {
  const { quadros, recortarVideo, sondar } = await import("../carrosseis/kit/video.mjs");
  const { execFileSync } = await import("node:child_process");
  const raiz = path.resolve("carrosseis/oficina/teste-render-video");
  await fs.rm(raiz, { recursive: true, force: true });
  for (const d of ["dados", "assets", "referencias"]) await fs.mkdir(path.join(raiz, d), { recursive: true });
  await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ffc93c" } }).jpeg().toFile(path.join(raiz, "assets/perfil.jpg"));
  // "original": 1080x1350, 3 s, motion colorido embaixo
  execFileSync(process.env.FFMPEG || "ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1080x1350:rate=30:duration=3", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-shortest", "-pix_fmt", "yuv420p", path.join(raiz, "referencias/02.mp4")]);
  const info = await sondar(path.join(raiz, "referencias/02.mp4"));
  assert.equal(info.largura, 1080); assert.ok(info.audio);
  await quadros(path.join(raiz, "referencias/02.mp4"), path.join(raiz, "referencias/02.png"), path.join(raiz, "referencias/02-quadros.jpg"), info.duracao_s);
  assert.ok((await sharp(path.join(raiz, "referencias/02-quadros.jpg")).metadata()).width > 700, "folha com os 6 momentos");
  const recorte = await recortarVideo(path.join(raiz, "referencias/02.mp4"), path.join(raiz, "assets/video-02.mp4"), { x: 0, y: 600, largura: 1080, altura: 700 });
  assert.equal(recorte.altura, 700);
  await fs.writeFile(path.join(raiz, "dados/pedido.json"), JSON.stringify({ total: 2, videos: [{ n: 2 }] }));
  const c = { idioma: "pt-BR", titulo: "Vídeo", legenda: "Teste com vídeo.", slides: [{ n: 1, original: "Cover", ptbr: "Capa estática" }, { n: 2, original: "Look", ptbr: "Olha isso Por cima" }] };
  await fs.writeFile(path.join(raiz, "conteudo.json"), JSON.stringify(c));
  const css = `<style>.slide{position:relative;width:1080px;height:1350px;overflow:hidden;background:#f2e6d8;color:#111}p{font:bold 70px Arial;margin:80px} [data-marca]{position:absolute;top:30px;right:30px;width:240px;height:58px}</style>`;
  const html = `<html lang="pt-BR">${css}<body><section class="slide" data-slide="1"><p data-texto>Capa estática</p><div data-marca></div></section><section class="slide" data-slide="2"><p data-texto>Olha isso</p><div data-video="assets/video-02.mp4" style="position:absolute;left:0;top:600px;width:1080px;height:700px"><img src="assets/video-02-capa.png" style="width:100%;height:100%;object-fit:cover" alt=""></div><p data-texto data-sobre-video style="position:absolute;left:0;top:1100px;margin:0;padding:10px 20px;background:#111;color:#fff">Por cima</p><div data-marca></div></section></body></html>`;
  await fs.writeFile(path.join(raiz, "carrossel.html"), html);
  const r = await renderizar(raiz);
  assert.deepEqual(r.videos, [2]);
  await assert.rejects(fs.access(path.join(raiz, "saida/01.mp4")));
  const final = await sondar(path.join(raiz, "saida/02.mp4"));
  assert.equal(final.largura, 1080); assert.equal(final.altura, 1350); assert.ok(final.audio); assert.ok(final.duracao_s >= 2.5 && final.duracao_s <= 3.5);
  // quadro do meio: em cima a arte (bege), embaixo o motion, a faixa "Por cima" escura sobre o vídeo e a marca no topo
  const quadro = path.join(raiz, "saida/02-meio.png");
  execFileSync(process.env.FFMPEG || "ffmpeg", ["-y", "-v", "error", "-ss", "1.5", "-i", path.join(raiz, "saida/02.mp4"), "-frames:v", "1", quadro]);
  const media = async (left, top, width, height) => (await sharp(await sharp(quadro).extract({ left, top, width, height }).toBuffer()).stats()).channels.map(ch => Math.round(ch.mean));
  const [rArte, , bArte] = await media(20, 300, 200, 200);
  assert.ok(rArte > 200 && bArte > 180, "a parte estática continua a arte");
  assert.ok((await media(840, 35, 200, 40))[0] < 120, "a marca fica por cima");
  assert.ok((await media(25, 1115, 150, 40))[0] < 90, "o elemento data-sobre-video fica por cima do vídeo");
  // slide de vídeo sem a área do motion é barrado
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace(/<div data-video[^]*?<\/div>/, ""));
  await assert.rejects(() => renderizar(raiz), /Slide 2: é vídeo no original/);
});
