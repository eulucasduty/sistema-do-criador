import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { conferirConteudo, dentroDaOficina } from "./contrato.mjs";
import { comporSlide, ehVideo } from "./video.mjs";

export async function renderizar(raiz = process.cwd()) {
  const pedido = JSON.parse(await fs.readFile(path.join(raiz, "dados/pedido.json"), "utf8"));
  const conteudo = conferirConteudo(JSON.parse(await fs.readFile(path.join(raiz, "conteudo.json"), "utf8")), pedido.total);
  const raizReal = await fs.realpath(raiz);
  const emVideo = (pedido.videos ?? []).map(v => v.n);
  const mime = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff": "font/woff", ".woff2": "font/woff2", ".ttf": "font/ttf", ".svg": "image/svg+xml" };
  const servidor = http.createServer(async (req, res) => {
    try {
      const nome = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "") || "carrossel.html";
      if (!/^(carrossel\.html|assets\/|referencias\/|kit\/fontes\/)/.test(nome)) throw new Error("Arquivo indisponível");
      const arquivo = dentroDaOficina(raizReal, nome);
      dentroDaOficina(raizReal, await fs.realpath(arquivo));
      const buf = await fs.readFile(arquivo);
      res.writeHead(200, { "Content-Type": mime[path.extname(arquivo)] || "application/octet-stream" });
      res.end(buf);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(ok => servidor.listen(0, "127.0.0.1", ok));
  let browser;
  try {
    const origem = `http://127.0.0.1:${servidor.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, headless: true, channel: process.env.CARROSSEL_CHROME || "chrome" });
    const contexto = await browser.newContext({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 2, javaScriptEnabled: false, serviceWorkers: "block" });
    await contexto.route("**/*", route => route.request().url().startsWith(`${origem}/`) ? route.continue() : route.abort());
    const pagina = await contexto.newPage();
    const falhas = [];
    pagina.on("requestfailed", r => falhas.push(r.url()));
    pagina.on("response", r => { if (r.status() >= 400) falhas.push(r.url()); });
    await pagina.goto(origem, { waitUntil: "networkidle" });
    await pagina.evaluate(() => document.fonts.ready);
    const { marcas, videos } = await pagina.evaluate(({ total, textos, emVideo }) => {
      const slides = [...document.querySelectorAll(".slide")];
      if (slides.length !== total) throw new Error(`O HTML tem ${slides.length} slides; esperado ${total}.`);
      const erros = [];
      const regioes = [];
      const areas = [];
      slides.forEach((slide, i) => {
        const r = slide.getBoundingClientRect();
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
          let fora = fragmentos.some(t => t.left < r.left - 2 || t.top < r.top - 2 || t.right > r.right + 2 || t.bottom > r.bottom + 2);
          for (let pai = el.parentElement; pai && pai !== slide; pai = pai.parentElement) {
            const estilo = getComputedStyle(pai);
            const caixa = pai.getBoundingClientRect();
            const clipX = /hidden|clip|auto|scroll/.test(estilo.overflowX);
            const clipY = /hidden|clip|auto|scroll/.test(estilo.overflowY);
            if (fragmentos.some(t => (clipX && (t.left < caixa.left - 2 || t.right > caixa.right + 2)) || (clipY && (t.top < caixa.top - 2 || t.bottom > caixa.bottom + 2)))) fora = true;
          }
          if (b.left < r.left - 1 || b.top < r.top - 1 || b.right > r.right + 1 || b.bottom > r.bottom + 1 || cortaX || cortaY || fora) erros.push(`Slide ${i + 1}: texto cortado: ${el.textContent.trim().slice(0, 70)}`);
        }
        let esperado = textos[i];
        // Um nome de site já impresso na foto pode permanecer no bitmap original,
        // com a descrição acessível no img; ele não deve ser desenhado duas vezes.
        for (const img of slide.querySelectorAll("img[data-nomes-originais]")) {
          for (const nome of img.dataset.nomesOriginais.split("|").filter(Boolean)) {
            if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\/[a-z0-9/-]+)?$/i.test(nome)) erros.push(`Slide ${i + 1}: nome original inválido.`);
            else esperado = esperado.replace(nome, "");
          }
        }
        // Sem funções locais nomeadas: o tsx injeta helpers nelas, que não existem no navegador.
        const visivel = slide.innerText.normalize("NFC").replace(/\s+/g, " ").trim();
        const transcrito = esperado.normalize("NFC").replace(/\s+/g, " ").trim();
        if (visivel !== transcrito) erros.push(`Slide ${i + 1}: o texto da arte difere da tradução em conteudo.json.`);
        const marca = slide.querySelector("[data-marca]");
        const b = marca?.getBoundingClientRect();
        if (!b || b.width < 240 || b.height < 58 || b.left < r.left || b.top < r.top || b.right > r.right + 1 || b.bottom > r.bottom + 1) erros.push(`Slide ${i + 1}: falta uma região válida para foto + @.`);
        regioes.push(b ? { x: Math.round(b.left - r.left), y: Math.round(b.top - r.top) } : null);
        // Slide em vídeo: uma área [data-video] onde entra o motion recortado (assets/…mp4)
        const vs = [...slide.querySelectorAll("[data-video]")];
        const deVideo = emVideo.includes(i + 1);
        if (deVideo && vs.length !== 1) erros.push(`Slide ${i + 1}: é vídeo no original e precisa de exatamente um [data-video] com o motion.`);
        if (!deVideo && vs.length) erros.push(`Slide ${i + 1}: é imagem no original; tire o [data-video].`);
        const v = vs[0]?.getBoundingClientRect();
        if (deVideo && v && (v.width < 80 || v.height < 80 || v.left < r.left - 1 || v.top < r.top - 1 || v.right > r.right + 1 || v.bottom > r.bottom + 1)) erros.push(`Slide ${i + 1}: a área do vídeo precisa ter ao menos 80x80 e ficar dentro do slide.`);
        areas.push(deVideo && v ? { src: vs[0].dataset.video, x: v.left - r.left, y: v.top - r.top, largura: v.width, altura: v.height } : null);
      });
      if (erros.length) throw new Error(erros.join("\n"));
      return { marcas: regioes, videos: areas };
    }, { total: pedido.total, textos: conteudo.slides.map(s => s.ptbr), emVideo });
    if (falhas.length) throw new Error(`Assets ausentes ou externos: ${falhas.join(", ")}`);
    for (const [i, v] of videos.entries()) {
      if (!v) continue;
      if (!/^assets\//.test(v.src) || !ehVideo(v.src)) throw new Error(`Slide ${i + 1}: data-video deve apontar para um MP4 em assets/ (gere com node kit/recortar-video.mjs).`);
      await fs.access(dentroDaOficina(raizReal, v.src)).catch(() => { throw new Error(`Slide ${i + 1}: ${v.src} não existe.`); });
    }
    const destino = path.join(raiz, "saida");
    await fs.mkdir(destino, { recursive: true });
    // A marca é aplicada ao PNG pelo renderizador, fora do controle do HTML do agente.
    const foto = await sharp(path.join(raiz, "assets/perfil.jpg")).resize(44, 44).composite([{ input: Buffer.from('<svg width="44" height="44"><circle cx="22" cy="22" r="22" fill="white"/></svg>'), blend: "dest-in" }]).png().toBuffer();
    const selo = Buffer.from(`<svg width="240" height="58" xmlns="http://www.w3.org/2000/svg"><rect width="240" height="58" rx="29" fill="#111" fill-opacity=".84"/><text x="61" y="36" fill="white" font-size="21" font-family="Arial,sans-serif">${String(pedido.perfil || "Criador").replace(/[<>&"\']/g, "")}</text></svg>`);
    const marca = await sharp(selo).composite([{ input: foto, left: 7, top: 7 }]).png().toBuffer();
    const miniaturas = [];
    for (let i = 0; i < pedido.total; i++) {
      const png = await pagina.locator(".slide").nth(i).screenshot({ animations: "disabled", type: "png" });
      const final = await sharp(png).resize(1080, 1350).composite([{ input: marca, left: marcas[i].x, top: marcas[i].y }]).png().toBuffer();
      const nn = String(i + 1).padStart(2, "0");
      await fs.writeFile(path.join(destino, `${nn}.png`), final);
      await fs.rm(path.join(destino, `${nn}.mp4`), { force: true });
      if (videos[i]) {
        // Camada de cima: só o que é [data-sobre-video], com fundo transparente, + a marca
        // (o `style` da captura vale só pra ela; addStyleTag trava com o JS da página desligado)
        const topo = await pagina.locator(".slide").nth(i).screenshot({
          animations: "disabled", type: "png", omitBackground: true,
          style: "html,body,.slide{background:transparent!important}.slide *,.slide::before,.slide::after{visibility:hidden!important}.slide [data-sobre-video],.slide [data-sobre-video] *{visibility:visible!important}",
        });
        const camada = path.join(destino, `${nn}-topo.png`);
        await sharp(topo).resize(1080, 1350).composite([{ input: marca, left: marcas[i].x, top: marcas[i].y }]).png().toFile(camada);
        await comporSlide({ base: path.join(destino, `${nn}.png`), topo: camada, video: dentroDaOficina(raizReal, videos[i].src), area: videos[i], saida: path.join(destino, `${nn}.mp4`) });
        await fs.rm(camada, { force: true });
      }
      miniaturas.push({ input: await sharp(final).resize(216, 270).png().toBuffer(), left: (i % 5) * 224 + 8, top: Math.floor(i / 5) * 278 + 8 });
    }
    await sharp({ create: { width: Math.min(5, pedido.total) * 224 + 8, height: Math.ceil(pedido.total / 5) * 278 + 8, channels: 3, background: "#ddd" } }).composite(miniaturas).jpeg({ quality: 90 }).toFile(path.join(destino, "contato.jpg"));
    return { total: pedido.total, largura: 1080, altura: 1350, videos: emVideo };
  } finally {
    await browser?.close();
    await new Promise(ok => servidor.close(ok));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  renderizar().then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e); process.exitCode = 1; });
}
