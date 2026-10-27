// Gera uma imagem NOVA pelo gerador de imagem do ChatGPT (Codex CLI logado na conta do criador, sem API paga)
// e grava no tamanho pedido. Usado no modo visual "recriar" (pedido do criador, 17/10).
//
//   node kit/gerar-imagem.mjs assets/img-01.png 1080 760 "descrição da imagem" [--ref referencias/01.png]
//   node kit/gerar-imagem.mjs --lote dados/imagens-pedido.json      ([{saida, largura, altura, prompt, ref?, perfil?}], 3 por vez)
//   --perfil (ou "perfil": true no lote): a pessoa da cena é o criador; manda as fotos de kit/perfil/ como referência do rosto.
//
// --ref manda o slide original junto, só como referência de clima, cor e enquadramento.
// Cada imagem gerada fica registrada em dados/imagens.json.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const CODEX = process.env.CODEX_BIN || path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
const MINUTOS = 6;

const FOTOS_PERFIL = [path.resolve("assets/perfil.jpg")];

function gerarUma({ saida, largura, altura, prompt, ref, perfil }) {
  largura = Number(largura); altura = Number(altura);
  if (!saida || !(largura > 0) || !(altura > 0) || !prompt) throw new Error("uso: node kit/gerar-imagem.mjs <saida.png> <largura> <altura> \"<prompt>\" [--ref referencias/NN.png]");
  const formato = largura / altura > 1.15 ? "horizontal (landscape)" : largura / altura < 0.87 ? "vertical (portrait)" : "quadrada (square)";
  const pedido = `Use the built-in image generation tool to generate exactly ONE image. Do not run commands, do not write files, do not ask questions.
Image: ${prompt}
Format: ${formato}, it will be cropped to ${largura}x${altura}. Keep the main subject centered with some margin.
Rules: no text, letters, numbers, captions, logos or watermarks inside the image. ${perfil ? "The main person in the scene is the person in the attached profile photo: keep their real face and appearance so he is clearly recognizable; pose, clothes and setting follow the description. Any other person is generic. No celebrities." : "No real, identifiable people (no celebrities, no real faces from the reference)."}${ref ? "\nThe first attached image is ONLY a style reference (mood, colors, lighting, framing). Create a NEW, different image; do not copy it." : ""}`;
  const args = [CODEX, "exec", "--ignore-user-config", "--skip-git-repo-check", "--ephemeral", "--json", "--color", "never", "--sandbox", "read-only", "-c", 'approval_policy="never"'];
  if (process.platform === "win32") args.push("-c", 'windows.sandbox="unelevated"');
  if (ref) args.push("--image", path.resolve(ref));
  if (perfil) for (const f of FOTOS_PERFIL) args.push("--image", f);
  args.push("-");
  const inicio = Date.now();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gerar-imagem-"));
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, { cwd: tmp, windowsHide: true });
    let resto = "", erro = "", sessao = null;
    p.stdout.on("data", d => {
      resto += d; let i;
      while ((i = resto.indexOf("\n")) >= 0) {
        const l = resto.slice(0, i); resto = resto.slice(i + 1);
        try {
          const ev = JSON.parse(l);
          if (ev.type === "thread.started") sessao = ev.thread_id;
          if (ev.type === "error" || ev.type === "turn.failed") erro += `${ev.message ?? ev.error?.message ?? ""} `;
        } catch {}
      }
    });
    p.stderr.on("data", d => { erro = (erro + d).slice(-3000); });
    p.stdin.end(pedido);
    const t = setTimeout(() => { p.kill(); reject(new Error(`a geração passou de ${MINUTOS} minutos`)); }, MINUTOS * 60_000);
    p.on("close", async () => {
      clearTimeout(t);
      try {
        // O Codex guarda o que gerou em $CODEX_HOME/generated_images/<sessão>/
        const raiz = path.join(CODEX_HOME, "generated_images");
        const pastas = sessao && fs.existsSync(path.join(raiz, sessao)) ? [path.join(raiz, sessao)]
          : fs.existsSync(raiz) ? fs.readdirSync(raiz).map(n => path.join(raiz, n)).filter(d => fs.statSync(d).mtimeMs >= inicio - 2000) : [];
        const imagens = pastas.flatMap(d => fs.readdirSync(d).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).map(f => path.join(d, f)))
          .filter(f => fs.statSync(f).mtimeMs >= inicio - 2000).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
        if (!imagens.length) {
          const bloqueado = /403|forbidden/i.test(erro);
          throw new Error(bloqueado ? "a geração de imagem está BLOQUEADA na conta do ChatGPT logada no Codex (403). Avise o criador para trocar de conta." : `o Codex não gerou a imagem: ${erro.slice(-600) || "sem detalhes"}`);
        }
        fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
        await sharp(imagens[0]).resize(largura, altura, { fit: "cover", position: "attention" }).png().toFile(path.resolve(saida));
        const log = path.resolve("dados/imagens.json");
        let lista = [];
        try { lista = JSON.parse(fs.readFileSync(log, "utf8")); } catch {}
        lista.push({ saida, largura, altura, prompt, ref: ref ?? null, gerada_em: new Date().toISOString() });
        fs.mkdirSync(path.dirname(log), { recursive: true });
        fs.writeFileSync(log, JSON.stringify(lista, null, 2));
        resolve(saida);
      } catch (e) { reject(e); }
      finally { fs.rmSync(tmp, { recursive: true, force: true }); }
    });
  });
}

async function principal() {
  const a = process.argv.slice(2);
  if (a[0] === "--lote") {
    const pedidos = JSON.parse(fs.readFileSync(a[1], "utf8"));
    const fila = [...pedidos]; let falhas = 0;
    await Promise.all(Array.from({ length: Math.min(3, fila.length) }, async () => {
      for (let item; (item = fila.shift());) {
        try { console.log(`ok ${await gerarUma(item)}`); }
        catch (e) { falhas++; console.error(`ERRO ${item.saida}: ${e.message}`); if (/BLOQUEADA/.test(e.message)) fila.length = 0; }
      }
    }));
    if (falhas) process.exitCode = 1;
    return;
  }
  const iRef = a.indexOf("--ref");
  const ref = iRef >= 0 ? a.splice(iRef, 2)[1] : undefined;
  const icriador = a.indexOf("--perfil");
  const perfil = icriador >= 0 && a.splice(icriador, 1).length > 0;
  const [saida, largura, altura, ...resto] = a;
  console.log(`ok ${await gerarUma({ saida, largura, altura, prompt: resto.join(" "), ref, perfil })}`);
}
principal().catch(e => { console.error(`ERRO ${e.message}`); process.exitCode = 1; });
