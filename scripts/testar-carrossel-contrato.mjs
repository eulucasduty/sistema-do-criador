// Testes do kit de carrossel, sem banco e sem IA: usam o Chrome, o ffmpeg e o sharp do PC.
//   npm run carrossel:verificar
// As oficinas de teste ficam em carrosseis/oficina/teste-* (fora do git).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { conferirConteudo, dentroDaOficina } from "../carrosseis/kit/contrato.mjs";
import { medirMarca } from "../carrosseis/kit/marca.mjs";
import { renderizar } from "../carrosseis/kit/renderizar.mjs";
import { quadros, recortarVideo, sondar } from "../carrosseis/kit/video.mjs";
import { referenciasDoCarrossel, conferirReferencias } from "../lib/esteira/carrossel.ts";
import { ambienteDaIA } from "../editor/estacao/ambiente.mjs";
import { FERRAMENTAS } from "../editor/estacao/ferramentas.mjs";

const FFMPEG = FERRAMENTAS.ffmpeg;
process.env.FFMPEG_BIN ||= FFMPEG;
if (FERRAMENTAS.chrome) process.env.CHROME_BIN ||= FERRAMENTAS.chrome;

/** Oficina limpa com uma foto de perfil qualquer (um quadrado colorido) e o pedido. */
async function oficina(nome, pedido) {
  const raiz = path.resolve("carrosseis/oficina", nome);
  await fs.rm(raiz, { recursive: true, force: true });
  for (const d of ["dados", "assets", "referencias"]) await fs.mkdir(path.join(raiz, d), { recursive: true });
  await sharp({ create: { width: 320, height: 320, channels: 3, background: "#3a7bd5" } }).jpeg().toFile(path.join(raiz, "assets/perfil.jpg"));
  await fs.writeFile(path.join(raiz, "dados/pedido.json"), JSON.stringify(pedido));
  return raiz;
}

test("usa todos os slides em ordem, incluindo os depois do segundo e até 20", () => {
  const r = { arquivo: "01.png", slides: Array.from({ length: 19 }, (_, i) => `${String(i + 2).padStart(2, "0")}.png`) };
  const lista = referenciasDoCarrossel(r);
  assert.equal(lista.length, 20);
  assert.equal(lista[2], "03.png");
  assert.equal(lista[19], "20.png");
  conferirReferencias(lista);
  assert.throws(() => conferirReferencias(["01.png"]), /Só tem a capa/);
  assert.throws(() => conferirReferencias([...lista, "21.png"]), /Até 20/);
  assert.throws(() => conferirReferencias(["01.png", "02.png"], 6), /original tem 6 slides/);
});

test("rejeita entrega parcial, ordem trocada, idioma errado e revisão incompleta", () => {
  const c = { idioma: "pt-BR", titulo: "Teste", legenda: "Mensagem preservada", slides: [1, 2, 3].map((n) => ({ n, original: `Original ${n}`, ptbr: `Tradução ${n}` })) };
  conferirConteudo(c, 3);
  assert.throws(() => conferirConteudo(c, 4), /nenhuma referência/);
  assert.throws(() => conferirConteudo({ ...c, idioma: "en" }, 3), /pt-BR/);
  assert.throws(() => conferirConteudo({ ...c, slides: [c.slides[0], c.slides[2], c.slides[1]] }, 3), /ordem/);
  assert.throws(() => conferirConteudo(c, 3, true), /ainda não conferiu/);
});

test("bloqueia saída da oficina e tira as chaves do ambiente da IA", () => {
  assert.throws(() => dentroDaOficina(process.cwd(), "../.env.local"), /fora da oficina/);
  const antes = { ...process.env };
  Object.assign(process.env, { SUPABASE_SECRET_KEY: "x", OPENROUTER_API_KEY: "x", OPENAI_API_KEY: "x", ANTHROPIC_API_KEY: "x", NEXT_PUBLIC_SUPABASE_URL: "x" });
  try {
    const env = ambienteDaIA();
    for (const k of ["SUPABASE_SECRET_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "NEXT_PUBLIC_SUPABASE_URL"]) assert.equal(env[k], undefined, k);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in antes)) delete process.env[k];
  }
});

test("a marca cresce com o @ e some sem perfil", async () => {
  const curta = await medirMarca({ usuario: "ana" });
  assert.equal(curta.texto, "@ana");
  assert.equal(curta.largura, 240);
  const longa = await medirMarca({ usuario: "@um.arroba.bem.comprido.de.criador" });
  assert.equal(longa.texto, "@um.arroba.bem.comprido.de.criador");
  assert.ok(longa.largura > 300, `largura ${longa.largura}`);
  assert.equal((await medirMarca({ nome: "Ana Souza" })).texto, "Ana Souza");
  assert.equal(await medirMarca({}), null);
});

test("renderiza três PNGs completos com a marca e barra texto cortado, texto divergente e arquivo de fora", async () => {
  const marca = await medirMarca({ usuario: "criador.teste" });
  const raiz = await oficina("teste-render", { total: 3, marca });
  const c = { idioma: "pt-BR", titulo: "Três slides", legenda: "Confira os três slides.", slides: [1, 2, 3].map((n) => ({ n, original: `Slide ${n}`, ptbr: `Texto em português ${n}` })) };
  await fs.writeFile(path.join(raiz, "conteudo.json"), JSON.stringify(c));
  const html = `<html lang="pt-BR"><style>.slide{position:relative;width:1080px;height:1350px;overflow:hidden;background:#efdece;color:#222}p{font:64px Arial;margin:80px} [data-marca]{position:absolute;bottom:30px;right:30px;width:${marca.largura}px;height:58px}</style><body>${c.slides
    .map((s) => `<section class="slide" data-slide="${s.n}"><p data-texto>${s.ptbr}</p><div data-marca></div></section>`)
    .join("")}</body></html>`;
  await fs.writeFile(path.join(raiz, "carrossel.html"), html);
  await renderizar(raiz);
  for (let i = 1; i <= 3; i++) {
    const img = sharp(path.join(raiz, "saida", `${String(i).padStart(2, "0")}.png`));
    const m = await img.metadata();
    assert.equal(m.width, 1080);
    assert.equal(m.height, 1350);
    const selo = await img.extract({ left: 1050 - marca.largura + 70, top: 1262, width: marca.largura - 80, height: 58 }).toBuffer();
    assert.ok((await sharp(selo).stats()).channels[0].mean < 180, "o rodapé tem a pílula escura com a foto e o @");
  }
  await fs.access(path.join(raiz, "saida/contato.jpg"));
  // o JS da página não roda (só a conferência do renderizador)
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace("<body>", `<body><script>document.querySelectorAll("p").forEach(p => p.textContent = "trocado")</script>`));
  await renderizar(raiz);
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace('<p data-texto>Texto em português 3', '<p data-texto style="position:absolute;top:1300px">Texto em português 3'));
  await assert.rejects(() => renderizar(raiz), /Slide 3: texto cortado/);
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace("Texto em português 3", "Texto divergente"));
  await assert.rejects(() => renderizar(raiz), /Slide 3: o texto da arte difere/);
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace("<body>", '<body><img src="https://example.com/x.png" style="display:none">'));
  await assert.rejects(() => renderizar(raiz), /fora da oficina ou da internet/);
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace("<body>", '<body><img src="../../../package.json" style="display:none">'));
  await assert.rejects(() => renderizar(raiz), /fora da oficina|imagem ausente/);
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace(`width:${marca.largura}px`, "width:120px"));
  await assert.rejects(() => renderizar(raiz), /região válida para a marca/);
  await fs.writeFile(path.join(raiz, "carrossel.html"), html);
});

test("slide em vídeo: recorta o motion e sai em MP4 1080x1350 com a arte e a marca", async () => {
  const marca = await medirMarca({ usuario: "criador.teste" });
  const raiz = await oficina("teste-render-video", { total: 2, videos: [{ n: 2 }], marca });
  // "original": 1080x1350, 3 s, motion colorido
  execFileSync(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1080x1350:rate=30:duration=3", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-shortest", "-pix_fmt", "yuv420p", path.join(raiz, "referencias/02.mp4")]);
  const info = await sondar(path.join(raiz, "referencias/02.mp4"));
  assert.equal(info.largura, 1080);
  assert.ok(info.audio);
  await quadros(path.join(raiz, "referencias/02.mp4"), path.join(raiz, "referencias/02.png"), path.join(raiz, "referencias/02-quadros.jpg"), info.duracao_s);
  assert.ok((await sharp(path.join(raiz, "referencias/02-quadros.jpg")).metadata()).width > 700, "folha com os 6 momentos");
  const recorte = await recortarVideo(path.join(raiz, "referencias/02.mp4"), path.join(raiz, "assets/video-02.mp4"), { x: 0, y: 600, largura: 1080, altura: 700 });
  assert.equal(recorte.altura, 700);
  const c = { idioma: "pt-BR", titulo: "Vídeo", legenda: "Teste com vídeo.", slides: [{ n: 1, original: "Cover", ptbr: "Capa estática" }, { n: 2, original: "Look", ptbr: "Olha isso Por cima" }] };
  await fs.writeFile(path.join(raiz, "conteudo.json"), JSON.stringify(c));
  const css = `<style>.slide{position:relative;width:1080px;height:1350px;overflow:hidden;background:#f2e6d8;color:#111}p{font:bold 70px Arial;margin:80px} [data-marca]{position:absolute;top:30px;right:30px;width:${marca.largura}px;height:58px}</style>`;
  const html = `<html lang="pt-BR">${css}<body><section class="slide" data-slide="1"><p data-texto>Capa estática</p><div data-marca></div></section><section class="slide" data-slide="2"><p data-texto>Olha isso</p><div data-video="assets/video-02.mp4" style="position:absolute;left:0;top:600px;width:1080px;height:700px"><img src="assets/video-02-capa.png" style="width:100%;height:100%;object-fit:cover" alt=""></div><p data-texto data-sobre-video style="position:absolute;left:0;top:1100px;margin:0;padding:10px 20px;background:#111;color:#fff">Por cima</p><div data-marca></div></section></body></html>`;
  await fs.writeFile(path.join(raiz, "carrossel.html"), html);
  const r = await renderizar(raiz);
  assert.deepEqual(r.videos, [2]);
  await assert.rejects(fs.access(path.join(raiz, "saida/01.mp4")));
  const final = await sondar(path.join(raiz, "saida/02.mp4"));
  assert.equal(final.largura, 1080);
  assert.equal(final.altura, 1350);
  assert.ok(final.audio);
  assert.ok(final.duracao_s >= 2.5 && final.duracao_s <= 3.5);
  // quadro do meio: em cima a arte (bege), embaixo o motion, a faixa "Por cima" escura sobre o vídeo e a marca no topo
  const quadro = path.join(raiz, "saida/02-meio.png");
  execFileSync(FFMPEG, ["-y", "-v", "error", "-ss", "1.5", "-i", path.join(raiz, "saida/02.mp4"), "-frames:v", "1", quadro]);
  const media = async (left, top, width, height) => (await sharp(await sharp(quadro).extract({ left, top, width, height }).toBuffer()).stats()).channels.map((ch) => Math.round(ch.mean));
  const [rArte, , bArte] = await media(20, 300, 200, 200);
  assert.ok(rArte > 200 && bArte > 180, "a parte estática continua a arte");
  assert.ok((await media(1050 - marca.largura + 70, 35, marca.largura - 90, 40))[0] < 120, "a marca fica por cima");
  assert.ok((await media(25, 1115, 150, 40))[0] < 90, "o elemento data-sobre-video fica por cima do vídeo");
  // slide de vídeo sem a área do motion é barrado
  await fs.writeFile(path.join(raiz, "carrossel.html"), html.replace(/<div data-video[^]*?<\/div>/, ""));
  await assert.rejects(() => renderizar(raiz), /Slide 2: é vídeo no original/);
});

test("estação: pega da fila, baixa os slides, a IA faz a arte, renderiza, sobe e publica (banco e IA de mentira)", async () => {
  const { iniciarCarrosseis } = await import("../editor/estacao/carrosseis.mjs");
  const { RAIZ_OFICINAS } = await import("../carrosseis/produzir.mjs");
  // os "originais": duas fotos e um vídeo
  const fontes = path.resolve("carrosseis/oficina/teste-estacao-originais");
  await fs.rm(fontes, { recursive: true, force: true });
  await fs.mkdir(fontes, { recursive: true });
  await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#204060" } }).png().toFile(path.join(fontes, "a.png"));
  await sharp({ create: { width: 1080, height: 1350, channels: 3, background: "#602040" } }).jpeg().toFile(path.join(fontes, "b.jpg"));
  execFileSync(FFMPEG, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=1080x1350:rate=30:duration=2", "-pix_fmt", "yuv420p", path.join(fontes, "c.mp4")]);
  const storage = { "2026-10-15/a.png": "a.png", "2026-10-15/b.jpg": "b.jpg", "2026-10-15/c.mp4": "c.mp4" };
  const id = "teste-estacao-0000-4000-8000-000000000001";
  let trabalho = { id, referencia_id: "ref-1", status: "aguardando_estacao", headline: "Headline nova", modo_texto: "traduzir", pedido: null, referencias: Object.keys(storage), motor: null };
  const subidos = [];
  const removidos = [];
  const etapas = [];
  let concluido = null;
  let batidas = 0;
  // supabase-js de mentira: guarda o que pediram e responde o mínimo
  const consulta = (tabela) => {
    const q = { tabela, filtros: {}, op: "select", valor: null };
    const resolver = () => {
      if (tabela === "configuracao" && q.op === "upsert") return (batidas++, { data: null, error: null });
      if (tabela === "configuracao") return { data: { valor: { usuario: "criador.teste", nome: "Criador" } }, error: null };
      if (tabela === "referencia") return { data: { copia_cli: { arquivos: ["carrosseis/velho/01.png", "carrosseis/velho/02.mp4"] } }, error: null };
      if (q.op === "update" && q.filtros.status === "aguardando_estacao" && q.filtros.id === id && trabalho.status === "aguardando_estacao") return { data: (trabalho = { ...trabalho, ...q.valor }), error: null };
      if (q.op === "update" && q.filtros.id === id) {
        Object.assign(trabalho, q.valor);
        if (q.valor.etapa) etapas.push(q.valor.etapa);
        return { data: null, error: null };
      }
      if (q.op === "update") return { data: null, error: null };
      return { data: trabalho.status === "aguardando_estacao" ? { id } : null, error: null };
    };
    const encadear = new Proxy(q, {
      get(alvo, nome) {
        if (nome === "then") return (ok, erro) => Promise.resolve(resolver()).then(ok, erro);
        if (nome === "update" || nome === "upsert") return (v) => ((alvo.op = nome), (alvo.valor = v), encadear);
        if (nome === "eq") return (c, v) => ((alvo.filtros[c] = v), encadear);
        return () => encadear;
      },
    });
    return encadear;
  };
  const db = {
    from: consulta,
    rpc: async (fn, args) => ((concluido = { fn, args }), (trabalho.status = "pronto"), { data: null, error: null }),
    storage: {
      from: () => ({
        download: async (c) => ({ data: new Blob([await fs.readFile(path.join(fontes, storage[c]))]), error: null }),
        upload: async (c, buf, o) => (subidos.push({ c, tamanho: buf.length, tipo: o.contentType }), { error: null }),
        remove: async (l) => (removidos.push(...l), { data: [], error: null }),
      }),
    },
  };
  // a "IA": lê o pedido, recorta o motion pelo kit da oficina e escreve o HTML e o conteúdo
  const ia = {
    id: "claude",
    nome: "o Claude",
    modelo: null,
    rodar: async (pasta, prompt, opcoes) => {
      assert.match(prompt, /kit\/CRIAR\.md/);
      assert.ok(opcoes.permitidas.includes("Bash(node kit/renderizar.mjs)"));
      const pedido = JSON.parse(await fs.readFile(path.join(pasta, "dados/pedido.json"), "utf8"));
      assert.equal(pedido.total, 3);
      assert.deepEqual(pedido.videos.map((v) => v.n), [3]);
      assert.equal(pedido.marca.texto, "@criador.teste");
      assert.equal(pedido.headline, "Headline nova");
      execFileSync(process.execPath, ["kit/recortar-video.mjs", "referencias/03.mp4", "assets/video-03.mp4", "0", "400", "1080", "800"], { cwd: pasta, env: process.env });
      const textos = ["Headline nova", "Segundo slide", "Terceiro slide"];
      const html = `<html lang="pt-BR"><style>.slide{position:relative;width:1080px;height:1350px;overflow:hidden;background:#f2e6d8}p{font:bold 60px Arial;margin:80px}[data-marca]{position:absolute;bottom:30px;left:30px;width:${pedido.marca.largura}px;height:58px}</style><body>${textos
        .map((t, i) => `<section class="slide" data-slide="${i + 1}"><p data-texto>${t}</p>${i === 2 ? '<div data-video="assets/video-03.mp4" style="position:absolute;left:0;top:400px;width:1080px;height:800px"><img src="assets/video-03-capa.png" style="width:100%;height:100%;object-fit:cover" alt=""></div>' : ""}<div data-marca></div></section>`)
        .join("")}</body></html>`;
      await fs.writeFile(path.join(pasta, "carrossel.html"), html);
      const c = { idioma: "pt-BR", titulo: "Teste", legenda: "Legenda em português.", slides: textos.map((t, i) => ({ n: i + 1, original: `Original ${i + 1}`, ptbr: t })), revisao: { todos_slides_vistos: true, mensagem_preservada: true, ptbr_conferido: true, visual_conferido: true } };
      await fs.writeFile(path.join(pasta, "conteudo.json"), JSON.stringify(c));
      return { resumo: "pronto", passos: [], uso: { motor: "claude", duracao_s: 1 } };
    },
  };
  const estacao = iniciarCarrosseis({ db, maquina: "PC-teste", prepararIA: async () => ia, esperaMs: 200 });
  for (let i = 0; i < 300 && !concluido && trabalho.status !== "erro"; i++) await new Promise((r) => setTimeout(r, 200));
  await estacao.parar();
  assert.equal(trabalho.erro ?? null, null, trabalho.erro);
  assert.ok(concluido, "publicou");
  assert.equal(concluido.fn, "concluir_carrossel");
  assert.deepEqual(concluido.args.p_resultado.arquivos, [`carrosseis/${id}/01.png`, `carrosseis/${id}/02.png`, `carrosseis/${id}/03.mp4`]);
  assert.equal(concluido.args.p_resultado.motor, "claude");
  assert.deepEqual(subidos.map((s) => s.c), [`carrosseis/${id}/01.png`, `carrosseis/${id}/02.png`, `carrosseis/${id}/03.png`, `carrosseis/${id}/03.mp4`]);
  assert.equal(subidos.at(-1).tipo, "video/mp4");
  assert.deepEqual(removidos.sort(), ["carrosseis/velho/01.png", "carrosseis/velho/02.mp4", "carrosseis/velho/02.png"]);
  assert.equal(trabalho.motor, "claude");
  assert.ok(etapas.some((e) => /renderizando/.test(e)));
  assert.ok(batidas >= 2);
  await assert.rejects(fs.access(path.join(RAIZ_OFICINAS, id, "_entrada")));
  const final = await sondar(path.join(RAIZ_OFICINAS, id, "saida/03.mp4"));
  assert.equal(final.altura, 1350);
});
