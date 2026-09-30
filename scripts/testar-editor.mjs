// Edita um vídeo local sem passar pelo painel nem pelo banco (pra testar o kit e o Claude).
// Uso: npm run editor:testar -- <video> [--titulo "…"] [--legenda bangers|labs] [--cor natural|quente|duty]
//        [--usuario @seu.perfil] [--nome "Seu nome"] [--nicho "…"] [--foto <arquivo|https://…>]
//        [--material <arquivo|https://…> "descrição"]…
// O perfil vem das opções acima (no painel ele vem do Perfil do criador).
// A oficina fica em editor/oficina/teste-<hora>; o vídeo sai em renders/final.mp4 dela.

import fs from "node:fs";
import path from "node:path";
import { editar } from "../editor/estacao/fluxo.mjs";

const USO = 'uso: npm run editor:testar -- <video> [--titulo "…"] [--legenda bangers|labs] [--cor natural|quente|duty] [--usuario @perfil] [--nome "…"] [--nicho "…"] [--foto <arquivo|link>] [--material <arquivo|link> "descrição"]';
const args = process.argv.slice(2);
let video = null;
let titulo = "Teste do editor";
const opcoes = {};
const perfil = {};
const materiais = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--titulo") titulo = args[++i];
  else if (a === "--legenda") opcoes.legenda = args[++i];
  else if (a === "--cor") opcoes.cor = args[++i];
  else if (a === "--usuario") perfil.usuario = args[++i];
  else if (a === "--nome") perfil.nome = args[++i];
  else if (a === "--nicho") perfil.nicho = args[++i];
  else if (a === "--foto") {
    const f = args[++i];
    perfil.foto_url = /^https?:\/\//.test(f) ? f : path.resolve(f);
  } else if (a === "--material") {
    const fonte = args[++i];
    const descricao = args[++i];
    const id = `m${materiais.length + 1}`;
    if (/^https?:\/\//.test(fonte)) materiais.push({ id, tipo: "link", url: fonte, descricao });
    else materiais.push({ id, tipo: /\.(mp4|mov|m4v|webm)$/i.test(fonte) ? "video" : "imagem", entrada: path.resolve(fonte), descricao });
  } else if (!video) video = path.resolve(a);
}
if (!video || !fs.existsSync(video)) {
  console.error(USO);
  process.exit(1);
}

const pasta = path.resolve("editor", "oficina", `teste-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`);
const t0 = Date.now();
const hora = () => `${Math.round((Date.now() - t0) / 1000)}s`.padStart(5);
try {
  const r = await editar({
    pasta,
    bruto: video,
    materiais,
    pedido: { titulo, roteiro: null, opcoes },
    perfil,
    aviso: (m) => console.log(`[${hora()}] ${m}`),
    aoPasso: (p) => console.log(`[${hora()}]   claude: ${p}`),
  });
  console.log(`\n${r.resumo}\n\nvídeo: ${r.final}\nuso: ${JSON.stringify({ ...r.uso, tokens: undefined })}`);
} catch (e) {
  console.error(`[${hora()}] falhou: ${e.message}`);
  process.exitCode = 1;
}
