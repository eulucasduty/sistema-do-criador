// O Chrome sem janela que fotografa os slides, sem nenhuma dependência: fala com ele pelo
// protocolo do DevTools num cano (--remote-debugging-pipe), sem porta aberta e sem internet.
// Todo pedido da página passa por aqui (Fetch): só sai arquivo da oficina, o resto é recusado.
//
// Chrome: CHROME_BIN (a estação passa o que achou); senão Chrome/Edge nos lugares de costume
// (Windows e macOS); senão o Chrome que o HyperFrames do editor baixou (HF_CLI).

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function acharChrome() {
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
  if (process.env.HF_CLI && fs.existsSync(process.env.HF_CLI)) {
    const r = spawnSync(process.execPath, [process.env.HF_CLI, "browser", "path"], { encoding: "utf8", timeout: 60_000, windowsHide: true });
    const linha = `${r.stdout ?? ""}`.split(/\r?\n/).map((l) => l.trim()).reverse().find((l) => l && fs.existsSync(l));
    if (linha) return linha;
  }
  return null;
}

/** Conversa com o Chrome pelo cano: mensagens JSON separadas por um byte zero. */
class Cano {
  constructor(processo) {
    this.processo = processo;
    this.id = 0;
    this.pendentes = new Map();
    this.ouvintes = new Set();
    this.fechado = null;
    let resto = Buffer.alloc(0);
    processo.stdio[4].on("data", (d) => {
      resto = Buffer.concat([resto, d]);
      let i;
      while ((i = resto.indexOf(0)) >= 0) {
        const texto = resto.subarray(0, i).toString("utf8");
        resto = resto.subarray(i + 1);
        let m;
        try {
          m = JSON.parse(texto);
        } catch {
          continue;
        }
        if (m.id && this.pendentes.has(m.id)) {
          const { ok, falha } = this.pendentes.get(m.id);
          this.pendentes.delete(m.id);
          if (m.error) falha(new Error(`${m.error.message}${m.error.data ? ` (${m.error.data})` : ""}`));
          else ok(m.result ?? {});
        } else if (m.method) for (const f of this.ouvintes) f(m);
      }
    });
    processo.stdio[3].on("error", () => {});
    processo.on("close", () => {
      this.fechado = new Error("o Chrome fechou no meio da conferência dos slides");
      for (const { falha } of this.pendentes.values()) falha(this.fechado);
      this.pendentes.clear();
    });
  }
  enviar(method, params = {}, sessionId, segundos = 90) {
    if (this.fechado) return Promise.reject(this.fechado);
    const id = ++this.id;
    return new Promise((ok, falha) => {
      const t = setTimeout(() => {
        this.pendentes.delete(id);
        falha(new Error(`o Chrome não respondeu (${method})`));
      }, segundos * 1000);
      this.pendentes.set(id, { ok: (r) => (clearTimeout(t), ok(r)), falha: (e) => (clearTimeout(t), falha(e)) });
      this.processo.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
    });
  }
  esperar(method, sessionId, segundos = 60) {
    return new Promise((ok, falha) => {
      const f = (m) => {
        if (m.method === method && (!sessionId || m.sessionId === sessionId)) {
          this.ouvintes.delete(f);
          clearTimeout(t);
          ok(m.params);
        }
      };
      const t = setTimeout(() => {
        this.ouvintes.delete(f);
        falha(new Error(`o Chrome não terminou de carregar a página (${method})`));
      }, segundos * 1000);
      this.ouvintes.add(f);
    });
  }
}

/**
 * Abre o Chrome sem janela e uma aba. `servir(url)` responde cada pedido da página:
 * { corpo: Buffer, tipo, cabecalhos? } pra entregar, ou null pra recusar.
 * Devolve { aba, fechar } (aba: abrir, avaliar, foto, estilo, fundoTransparente).
 */
export async function abrirChrome({ perfil, servir, largura = 1200, altura = 1500, escala = 2 }) {
  const bin = acharChrome();
  if (!bin) throw new Error("não achei o Chrome neste PC: instale o Google Chrome ou aponte CHROME_BIN no .env.local");
  fs.rmSync(perfil, { recursive: true, force: true });
  fs.mkdirSync(perfil, { recursive: true });
  const args = [
    "--headless=new",
    "--remote-debugging-pipe",
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-sync",
    "--disable-default-apps",
    "--mute-audio",
    "--hide-scrollbars",
    "--force-color-profile=srgb",
    "about:blank",
  ];
  const processo = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"], windowsHide: true });
  let erroDoChrome = "";
  processo.stderr.on("data", (d) => {
    erroDoChrome = (erroDoChrome + d).slice(-2000);
  });
  const abriu = await new Promise((ok) => {
    processo.once("spawn", () => ok(null));
    processo.once("error", (e) => ok(e));
  });
  if (abriu) throw new Error(`o Chrome não abriu (${abriu.message})`);
  const cano = new Cano(processo);

  async function fechar() {
    await cano.enviar("Browser.close", {}, undefined, 10).catch(() => {});
    if (processo.exitCode === null) {
      await new Promise((ok) => {
        const t = setTimeout(() => {
          processo.kill();
          ok();
        }, 5000);
        processo.once("close", () => {
          clearTimeout(t);
          ok();
        });
      });
    }
    try {
      fs.rmSync(perfil, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
    } catch {}
  }

  try {
    const { targetId } = await cano.enviar("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cano.enviar("Target.attachToTarget", { targetId, flatten: true });
    const s = (metodo, params, segundos) => cano.enviar(metodo, params, sessionId, segundos);
    // Toda requisição da página passa por aqui: só arquivo da oficina, nada da internet
    cano.ouvintes.add((m) => {
      if (m.method !== "Fetch.requestPaused" || m.sessionId !== sessionId) return;
      const { requestId, request } = m.params;
      Promise.resolve()
        .then(() => servir(request.url))
        .then((r) =>
          r
            ? s("Fetch.fulfillRequest", {
                requestId,
                responseCode: 200,
                responseHeaders: [{ name: "Content-Type", value: r.tipo }, ...Object.entries(r.cabecalhos ?? {}).map(([name, value]) => ({ name, value }))],
                body: r.corpo.toString("base64"),
              })
            : s("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }),
        )
        .catch(() => s("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => {}));
    });
    await s("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
    await s("Page.enable");
    await s("Emulation.setDeviceMetricsOverride", { width: largura, height: altura, deviceScaleFactor: escala, mobile: false });

    const avaliar = async (expressao) => {
      const r = await s("Runtime.evaluate", { expression: expressao, awaitPromise: true, returnByValue: true }, 120);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description?.split("\n    at ")[0].replace(/^Error: /, "") ?? r.exceptionDetails.text);
      return r.result?.value;
    };
    const aba = {
      /** Abre a página e espera as imagens e as fontes. */
      async abrir(url) {
        const carregou = cano.esperar("Page.loadEventFired", sessionId, 90);
        const r = await s("Page.navigate", { url });
        if (r.errorText) throw new Error(`a página não abriu (${r.errorText})`);
        await carregou;
        await avaliar("document.fonts.ready.then(() => true)");
      },
      /** Roda `funcao(arg)` dentro da página (com o JS da página desligado, só a conferência roda). */
      avaliar: (funcao, arg) => avaliar(`(${funcao.toString()})(${JSON.stringify(arg ?? null)})`),
      /** Foto PNG de um retângulo (pixels CSS da página inteira); sai na escala do aparelho (2x). */
      async foto({ x, y, largura: w, altura: h }) {
        const r = await s("Page.captureScreenshot", { format: "png", clip: { x, y, width: w, height: h, scale: 1 }, captureBeyondViewport: true, fromSurface: true }, 120);
        return Buffer.from(r.data, "base64");
      },
      /** Acrescenta (ou tira, com css vazio) uma folha de estilo com esse id. */
      estilo: (id, css) =>
        avaliar(
          `(() => { document.getElementById(${JSON.stringify(id)})?.remove(); const css = ${JSON.stringify(css)}; if (css) { const e = document.createElement("style"); e.id = ${JSON.stringify(id)}; e.textContent = css; document.head.append(e); } return true; })()`,
        ),
      /** Fundo transparente na foto (a camada que vai por cima do vídeo). */
      fundoTransparente: (sim) => s("Emulation.setDefaultBackgroundColorOverride", sim ? { color: { r: 0, g: 0, b: 0, a: 0 } } : {}),
    };
    return { aba, fechar };
  } catch (e) {
    await fechar();
    throw new Error(`${e.message}${erroDoChrome.trim() ? `\n${erroDoChrome.trim().slice(-600)}` : ""}`);
  }
}
