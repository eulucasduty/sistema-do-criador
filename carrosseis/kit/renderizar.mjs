// node kit/renderizar.mjs: confere o carrossel.html e salva os slides em saida/ (PNG 1080x1350,
// e MP4 nos slides que são vídeo no original), mais a folha saida/contato.jpg pra revisão.
// Confere: quantidade e ordem, tamanho, imagens, fontes, texto cortado, o texto da arte igual ao
// conteudo.json, a área da marca e a do vídeo. A marca do criador entra por cima de cada PNG.

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { abrirChrome } from "./chrome.mjs";
import { conferirConteudo, dentroDaOficina } from "./contrato.mjs";
import { ALTURA_MARCA, desenharMarca } from "./marca.mjs";
import { comporSlide, ehVideo } from "./video.mjs";

// Endereço de mentira: tudo que a página pede é respondido pelo renderizador, da oficina
const ORIGEM = "http://oficina.invalid";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
};
// Sem JS da página. O resto (imagem, fonte, estilo) passa pelo servir() abaixo, que só entrega
// arquivo da oficina e anota o que foi recusado
const CSP = "script-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";

export async function renderizar(raiz = process.cwd()) {
  const pedido = JSON.parse(await fs.readFile(path.join(raiz, "dados/pedido.json"), "utf8"));
  const conteudo = conferirConteudo(JSON.parse(await fs.readFile(path.join(raiz, "conteudo.json"), "utf8")), pedido.total);
  const raizReal = await fs.realpath(raiz);
  const emVideo = (pedido.videos ?? []).map((v) => v.n);
  const marca = pedido.marca?.texto ? pedido.marca : null;
  const falhas = [];
  const { aba, fechar } = await abrirChrome({
    perfil: path.join(raizReal, ".navegador"),
    servir: async (url) => {
      if (/^(data|blob):/.test(url)) return null;
      const u = new URL(url);
      const nome = decodeURIComponent(u.pathname).replace(/^\/+/, "") || "carrossel.html";
      if (u.origin === ORIGEM && nome === "favicon.ico") return null;
      try {
        if (u.origin !== ORIGEM || !/^(carrossel\.html|assets\/|referencias\/|kit\/fontes\/)/.test(nome)) throw new Error("fora");
        const arquivo = dentroDaOficina(raizReal, nome);
        dentroDaOficina(raizReal, await fs.realpath(arquivo));
        const corpo = await fs.readFile(arquivo);
        return { corpo, tipo: MIME[path.extname(arquivo).toLowerCase()] || "application/octet-stream", cabecalhos: nome === "carrossel.html" ? { "Content-Security-Policy": CSP } : {} };
      } catch {
        falhas.push(url.slice(0, 200));
        return null;
      }
    },
  });
  try {
    await aba.abrir(`${ORIGEM}/carrossel.html`);
    await aba.estilo("render-sem-animacao", "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}");
    // Sem funções nomeadas aqui dentro: roda no navegador, como texto
    const { slides, marcas, videos } = await aba.avaliar(
      ({ total, textos, emVideo, marcaMin }) => {
        const slides = [...document.querySelectorAll(".slide")];
        if (slides.length !== total) throw new Error(`O HTML tem ${slides.length} slides; esperado ${total}.`);
        const erros = [];
        const caixas = [];
        const regioes = [];
        const areas = [];
        slides.forEach((slide, i) => {
          const r = slide.getBoundingClientRect();
          caixas.push({ x: r.left + window.scrollX, y: r.top + window.scrollY, largura: r.width, altura: r.height });
          if (slide.dataset.slide !== String(i + 1) || Math.abs(r.width - 1080) > 1 || Math.abs(r.height - 1350) > 1) erros.push(`Slide ${i + 1}: ordem ou tamanho incorreto (1080x1350).`);
          for (const img of slide.querySelectorAll("img")) if (!img.complete || !img.naturalWidth) erros.push(`Slide ${i + 1}: imagem ausente.`);
          for (const el of slide.querySelectorAll("[data-texto],h1,h2,h3,p,li")) {
            const b = el.getBoundingClientRect();
            const css = getComputedStyle(el);
            const cortaX = el.scrollWidth > el.clientWidth + 3;
            const cortaY = /hidden|clip|auto|scroll/.test(css.overflowY) && el.scrollHeight > el.clientHeight + 2;
            const range = document.createRange();
            range.selectNodeContents(el);
            const fragmentos = [...range.getClientRects()];
            let fora = fragmentos.some((t) => t.left < r.left - 2 || t.top < r.top - 2 || t.right > r.right + 2 || t.bottom > r.bottom + 2);
            for (let pai = el.parentElement; pai && pai !== slide; pai = pai.parentElement) {
              const estilo = getComputedStyle(pai);
              const caixa = pai.getBoundingClientRect();
              const clipX = /hidden|clip|auto|scroll/.test(estilo.overflowX);
              const clipY = /hidden|clip|auto|scroll/.test(estilo.overflowY);
              if (fragmentos.some((t) => (clipX && (t.left < caixa.left - 2 || t.right > caixa.right + 2)) || (clipY && (t.top < caixa.top - 2 || t.bottom > caixa.bottom + 2)))) fora = true;
            }
            if (b.left < r.left - 1 || b.top < r.top - 1 || b.right > r.right + 1 || b.bottom > r.bottom + 1 || cortaX || cortaY || fora) erros.push(`Slide ${i + 1}: texto cortado: ${el.textContent.trim().slice(0, 70)}`);
          }
          let esperado = textos[i];
          // Um nome de site já impresso na foto pode ficar no bitmap original, com a descrição no
          // img; ele não deve ser desenhado duas vezes.
          for (const img of slide.querySelectorAll("img[data-nomes-originais]")) {
            for (const nome of img.dataset.nomesOriginais.split("|").filter(Boolean)) {
              if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/[a-z0-9/-]+)?$/i.test(nome)) erros.push(`Slide ${i + 1}: nome original inválido.`);
              else esperado = esperado.replace(nome, "");
            }
          }
          const visivel = slide.innerText.normalize("NFC").replace(/\s+/g, " ").trim();
          const transcrito = esperado.normalize("NFC").replace(/\s+/g, " ").trim();
          if (visivel !== transcrito) erros.push(`Slide ${i + 1}: o texto da arte difere da tradução em conteudo.json.`);
          const marca = slide.querySelector("[data-marca]");
          const b = marca?.getBoundingClientRect();
          if (!b || b.width < marcaMin.largura || b.height < marcaMin.altura || b.left < r.left || b.top < r.top || b.right > r.right + 1 || b.bottom > r.bottom + 1)
            erros.push(`Slide ${i + 1}: falta uma região válida para a marca (foto + @): [data-marca] com pelo menos ${marcaMin.largura}x${marcaMin.altura}, dentro do slide.`);
          regioes.push(b ? { x: Math.round(b.left - r.left), y: Math.round(b.top - r.top) } : null);
          // Slide em vídeo: uma área [data-video] onde entra o motion recortado (assets/…mp4)
          const vs = [...slide.querySelectorAll("[data-video]")];
          const deVideo = emVideo.includes(i + 1);
          if (deVideo && vs.length !== 1) erros.push(`Slide ${i + 1}: é vídeo no original e precisa de exatamente um [data-video] com o motion.`);
          if (!deVideo && vs.length) erros.push(`Slide ${i + 1}: é imagem no original; tire o [data-video].`);
          const v = vs[0]?.getBoundingClientRect();
          if (deVideo && v && (v.width < 80 || v.height < 80 || v.left < r.left - 1 || v.top < r.top - 1 || v.right > r.right + 1 || v.bottom > r.bottom + 1))
            erros.push(`Slide ${i + 1}: a área do vídeo precisa ter ao menos 80x80 e ficar dentro do slide.`);
          areas.push(deVideo && v ? { src: vs[0].dataset.video, x: v.left - r.left, y: v.top - r.top, largura: v.width, altura: v.height } : null);
        });
        if (erros.length) throw new Error(erros.join("\n"));
        return { slides: caixas, marcas: regioes, videos: areas };
      },
      { total: pedido.total, textos: conteudo.slides.map((s) => s.ptbr), emVideo, marcaMin: { largura: Math.max(240, marca?.largura ?? 0), altura: ALTURA_MARCA } },
    );
    if (falhas.length) throw new Error(`Arquivos ausentes, fora da oficina ou da internet (use só arquivos locais): ${falhas.join(", ")}`);
    for (const [i, v] of videos.entries()) {
      if (!v) continue;
      if (!/^assets\//.test(v.src) || !ehVideo(v.src)) throw new Error(`Slide ${i + 1}: data-video deve apontar para um MP4 em assets/ (gere com node kit/recortar-video.mjs).`);
      await fs.access(dentroDaOficina(raizReal, v.src)).catch(() => {
        throw new Error(`Slide ${i + 1}: ${v.src} não existe.`);
      });
    }
    const destino = path.join(raiz, "saida");
    await fs.mkdir(destino, { recursive: true });
    // A marca é aplicada ao PNG pelo renderizador, fora do controle do HTML da IA
    const selo = marca ? await desenharMarca(marca, path.join(raiz, "assets/perfil.jpg")) : null;
    const comMarca = (img, i) => (selo ? img.composite([{ input: selo, left: Math.min(marcas[i].x, 1080 - marca.largura), top: Math.min(marcas[i].y, 1350 - ALTURA_MARCA) }]) : img);
    const miniaturas = [];
    for (let i = 0; i < pedido.total; i++) {
      const png = await aba.foto(slides[i]);
      const final = await comMarca(sharp(png).resize(1080, 1350), i).png().toBuffer();
      const nn = String(i + 1).padStart(2, "0");
      await fs.writeFile(path.join(destino, `${nn}.png`), final);
      await fs.rm(path.join(destino, `${nn}.mp4`), { force: true });
      if (videos[i]) {
        // Camada de cima: só o que é [data-sobre-video], com fundo transparente, + a marca
        await aba.estilo(
          "render-topo",
          "html,body,.slide{background:transparent!important}.slide *,.slide::before,.slide::after{visibility:hidden!important}.slide [data-sobre-video],.slide [data-sobre-video] *{visibility:visible!important}",
        );
        await aba.fundoTransparente(true);
        const topo = await aba.foto(slides[i]);
        await aba.fundoTransparente(false);
        await aba.estilo("render-topo", "");
        const camada = path.join(destino, `${nn}-topo.png`);
        await comMarca(sharp(topo).resize(1080, 1350), i).png().toFile(camada);
        await comporSlide({ base: path.join(destino, `${nn}.png`), topo: camada, video: dentroDaOficina(raizReal, videos[i].src), area: videos[i], saida: path.join(destino, `${nn}.mp4`) });
        await fs.rm(camada, { force: true });
      }
      miniaturas.push({ input: await sharp(final).resize(216, 270).png().toBuffer(), left: (i % 5) * 224 + 8, top: Math.floor(i / 5) * 278 + 8 });
    }
    await sharp({ create: { width: Math.min(5, pedido.total) * 224 + 8, height: Math.ceil(pedido.total / 5) * 278 + 8, channels: 3, background: "#ddd" } })
      .composite(miniaturas)
      .jpeg({ quality: 90 })
      .toFile(path.join(destino, "contato.jpg"));
    return { total: pedido.total, largura: 1080, altura: 1350, videos: emVideo };
  } finally {
    await fechar();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  renderizar()
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => {
      console.error(e.message ?? e);
      process.exitCode = 1;
    });
}
