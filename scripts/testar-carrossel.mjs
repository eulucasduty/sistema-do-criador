// Copia um carrossel de uma pasta do PC, sem painel e sem banco (pra testar o kit e a IA).
// Uso: npm run carrossel:testar -- <pasta com 01.png, 02.jpg, 03.mp4…> [--motor claude|codex|openrouter]
//        [--modelo …] [--headline "…"] [--reformular] [--direcao "…"]
//        [--usuario @seu.perfil] [--nome "Seu nome"] [--foto <arquivo|https://…>]
// Os slides vão na ordem do nome (fotos PNG/JPG/WEBP e vídeos). No motor openrouter, a chave vem
// de OPENROUTER_API_KEY (no .env.local ou no terminal).
// A oficina fica em carrosseis/oficina/teste-<hora>; os slides saem em saida/ dela.

import fs from "node:fs";
import path from "node:path";
import { prepararOficina, produzirCarrossel, RAIZ_OFICINAS } from "../carrosseis/produzir.mjs";
import { FERRAMENTAS, hyperframesLocal } from "../editor/estacao/ferramentas.mjs";
import { prepararMotor } from "../editor/estacao/motor.mjs";

const USO = 'uso: npm run carrossel:testar -- <pasta dos slides> [--motor claude|codex|openrouter] [--modelo …] [--headline "…"] [--reformular] [--direcao "…"] [--usuario @perfil] [--nome "…"] [--foto <arquivo|link>]';
const args = process.argv.slice(2);
let origem = null;
const escolha = { motor: "claude", modelo: null };
const pedido = { modo_texto: "traduzir" };
const perfil = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--motor") escolha.motor = args[++i];
  else if (a === "--modelo") escolha.modelo = args[++i];
  else if (a === "--headline") pedido.headline = args[++i];
  else if (a === "--reformular") pedido.modo_texto = "reformular";
  else if (a === "--direcao") pedido.direcao = args[++i];
  else if (a === "--usuario") perfil.usuario = args[++i];
  else if (a === "--nome") perfil.nome = args[++i];
  else if (a === "--foto") {
    const f = args[++i];
    perfil.foto_url = /^https?:\/\//.test(f) ? f : path.resolve(f);
  } else if (!origem) origem = path.resolve(a);
}
if (!origem || !fs.existsSync(origem) || !fs.statSync(origem).isDirectory()) {
  console.error(USO);
  process.exit(1);
}
const natural = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const arquivos = fs
  .readdirSync(origem)
  .filter((f) => /\.(png|jpe?g|webp|mp4|mov|m4v|webm)$/i.test(f))
  .sort(natural.compare)
  .map((f) => ({ entrada: path.join(origem, f), video: /\.(mp4|mov|m4v|webm)$/i.test(f) }));

if (FERRAMENTAS.ffmpeg) process.env.FFMPEG_BIN ||= FERRAMENTAS.ffmpeg;
if (FERRAMENTAS.ffprobe) process.env.FFPROBE_BIN ||= FERRAMENTAS.ffprobe;
if (FERRAMENTAS.chrome) process.env.CHROME_BIN ||= FERRAMENTAS.chrome;
else if (hyperframesLocal()) process.env.HF_CLI ||= hyperframesLocal();

const pasta = path.join(RAIZ_OFICINAS, `teste-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`);
const t0 = Date.now();
const hora = () => `${Math.round((Date.now() - t0) / 1000)}s`.padStart(5);
try {
  const ia = await prepararMotor(escolha, { chaveOpenRouter: process.env.OPENROUTER_API_KEY?.trim() || null });
  console.log(`[${hora()}] quem faz: ${ia.id} (${ia.modelo ?? "padrão"}) · ${arquivos.length} slides`);
  const oficina = await prepararOficina({ pasta, arquivos, pedido, perfil, aviso: (m) => console.log(`[${hora()}] ${m}`) });
  console.log(`[${hora()}] oficina: ${pasta}`);
  const r = await produzirCarrossel({
    pasta,
    total: oficina.total,
    videos: oficina.videos,
    ia,
    aoPasso: (p) => console.log(`[${hora()}]   ${p}`),
    etapa: async (m) => console.log(`[${hora()}] ${m}`),
  });
  console.log(`\n[${hora()}] pronto: "${r.conteudo.titulo}" · ${r.conteudo.slides.length} slides em ${path.join(pasta, "saida")}`);
  if (r.resumo) console.log(`\n${r.resumo}`);
} catch (e) {
  console.error(`\n[${hora()}] não deu: ${e.message}`);
  console.error(`(a oficina fica em ${pasta} pra você olhar)`);
  process.exitCode = 1;
}
