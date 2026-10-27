// Edita um vídeo local sem passar pelo painel nem pelo banco (pra testar o kit e a IA).
// Uso: npm run editor:testar -- <video> [--motor claude|codex|openrouter] [--modelo …]
//        [--titulo "…"] [--estilo <pasta de editor/kit/estilos>] [--legenda <tipo do estilo>]
//        [--cor original|natural|quente|contraste]
//        [--usuario @seu.perfil] [--nome "Seu nome"] [--nicho "…"] [--foto <arquivo|https://…>]
//        [--material <arquivo|https://…> "descrição"]…
// O perfil vem das opções acima (no painel ele vem do Perfil do criador). No motor openrouter,
// a chave vem de OPENROUTER_API_KEY (no .env.local ou no terminal).
// A oficina fica em editor/oficina/teste-<hora>; o vídeo sai em renders/final.mp4 dela.
//
// Montar de novo uma oficina pronta com o kit de agora e o mesmo plano (sem IA, só o render):
//   npm run editor:testar -- --remontar editor/oficina/<pasta>   (com --usuario/--foto, troca o perfil)
// Como a estação, roda em prioridade baixa e numa parte do processador (EDITOR_CPU, em %; padrão 50).

import fs from "node:fs";
import path from "node:path";
import { editar, podeRemontar } from "../editor/estacao/fluxo.mjs";
import { prepararMotor } from "../editor/estacao/motor.mjs";
import { pouparMaquina } from "../editor/estacao/preparar.mjs";

pouparMaquina();

const USO = 'uso: npm run editor:testar -- <video> [--motor claude|codex|openrouter] [--modelo …] [--titulo "…"] [--estilo classico] [--legenda <tipo do estilo>] [--cor original|natural|quente|contraste] [--usuario @perfil] [--nome "…"] [--nicho "…"] [--foto <arquivo|link>] [--material <arquivo|link> "descrição"]\n   ou: npm run editor:testar -- --remontar <pasta da oficina pronta>';
const args = process.argv.slice(2);
let video = null;
let remontar = null;
let titulo = "Teste do editor";
const escolha = { motor: "claude", modelo: null };
const opcoes = {};
const perfil = {};
const materiais = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--titulo") titulo = args[++i];
  else if (a === "--remontar") remontar = path.resolve(args[++i]);
  else if (a === "--motor") escolha.motor = args[++i];
  else if (a === "--modelo") escolha.modelo = args[++i];
  else if (a === "--estilo") opcoes.estilo = args[++i];
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
if (remontar ? !podeRemontar(remontar) : !video || !fs.existsSync(video)) {
  console.error(remontar ? `${remontar} não tem uma edição pronta do kit atual (plano.json e dados/pedido.json)` : USO);
  process.exit(1);
}

const pasta = remontar ?? path.resolve("editor", "oficina", `teste-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`);
const t0 = Date.now();
const hora = () => `${Math.round((Date.now() - t0) / 1000)}s`.padStart(5);
try {
  const motor = remontar ? null : await prepararMotor(escolha, { chaveOpenRouter: process.env.OPENROUTER_API_KEY?.trim() || null });
  if (motor) console.log(`[${hora()}] quem edita: ${motor.id} (${motor.modelo ?? "padrão"})`);
  const r = await editar({
    pasta,
    bruto: video,
    materiais,
    pedido: { titulo, roteiro: null, opcoes: remontar ? { remontar: true } : opcoes },
    perfil: remontar && !Object.keys(perfil).length ? null : perfil,
    motor,
    aviso: (m) => console.log(`[${hora()}] ${m}`),
    aoPasso: (p) => console.log(`[${hora()}]   ${motor?.id}: ${p}`),
  });
  console.log(`${r.resumo ? `\n${r.resumo}\n` : ""}\nvídeo: ${r.final}\nuso: ${JSON.stringify({ ...r.uso, tokens: undefined })}`);
} catch (e) {
  console.error(`[${hora()}] falhou: ${e.message}`);
  process.exitCode = 1;
}
