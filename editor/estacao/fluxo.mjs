// Uma edição do começo ao fim, na máquina local: oficina → Claude → conferência → render.
// Quem chama é a estação (scripts/estacao-edicao.mjs), que cuida do banco e do storage.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { rodarClaude } from "./claude.mjs";
import { FERRAMENTAS, gravarPerfil, lookValido, perfilLimpo, prepararOficina, prepararPasta, rodar, sondar } from "./preparar.mjs";

const HF = "npx --yes hyperframes@0.8.92";

/** "Você é o editor de vídeo do criador @ana." + nicho, público e tom, quando o perfil tem. */
function quemE(perfil) {
  const p = perfilLimpo(perfil);
  const linhas = [`Você é o editor de vídeo do criador${p.usuario ? ` @${p.usuario}` : ""}${p.nome ? ` (${p.nome})` : ""}.`];
  const sobre = [p.nicho && `nicho: ${p.nicho}`, p.publico && `público: ${p.publico}`, p.tom && `tom: ${p.tom}`].filter(Boolean);
  if (sobre.length) linhas.push(`Sobre o criador: ${sobre.join(" · ")}.`);
  return linhas;
}

export function promptEdicao({ versao = 1, ajuste, perfil } = {}) {
  if (versao > 1 && ajuste)
    return [
      ...quemE(perfil),
      "Esta pasta é a oficina de uma edição que já existe:",
      `plano.json e index.html são da versão ${versao - 1}. O criador assistiu e pediu este ajuste pra versão ${versao}:`,
      "",
      `«${ajuste.trim()}»`,
      "",
      "Leia kit/EDITOR.md (o manual com o padrão de edição). Mude o plano só no que foi pedido e mantenha o resto.",
      "Rode o montador e o lint (0 erros) e confira nos snapshots os trechos que mudaram. Não renderize.",
      "Termine com um resumo curto pro criador (2 a 4 linhas, português simples) do que mudou.",
    ].join("\n");
  return [
    ...quemE(perfil),
    "Esta pasta é a oficina de uma edição nova.",
    "Leia kit/EDITOR.md (o manual, com o padrão de edição) e dados/perfil.json, e siga o fluxo de trabalho até o fim:",
    "pedido e materiais, emendas, assets reais (logos e prints), plano.json, montador, lint com 0 erros",
    "e conferência nos snapshots. Não renderize (a estação renderiza depois).",
    "Termine com o resumo curto pro criador (3 a 6 linhas, português simples).",
  ].join("\n");
}

/** Lint do HyperFrames: quantos erros (avisos de organização são esperados neste kit). */
export function conferir(pasta) {
  const r = spawnSync(`${HF} lint`, { cwd: pasta, shell: true, encoding: "utf8", windowsHide: true, timeout: 300_000 });
  const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const m = saida.match(/(\d+) error\(s\)/);
  return { erros: m ? Number(m[1]) : r.status === 0 ? 0 : 1, saida };
}

/**
 * Render final (no PC do criador; usa a placa de vídeo quando tem) e o volume final em -14 LUFS
 * (padrão do Instagram): o mixador do HyperFrames abaixa tudo quando os efeitos têm pico alto.
 */
export async function renderizar(pasta, opcoes = {}) {
  const bruto = await renderizarBruto(pasta, opcoes);
  const saida = path.join(pasta, "renders", "final.mp4");
  await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", bruto, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", saida], { timeoutMs: 10 * 60_000 });
  fs.rmSync(bruto, { force: true });
  return saida;
}

function renderizarBruto(pasta, { aviso = () => {}, qualidade = "standard", minutos = 150 } = {}) {
  const saida = path.join(pasta, "renders", "final-bruto.mp4");
  fs.mkdirSync(path.dirname(saida), { recursive: true });
  fs.rmSync(saida, { force: true });
  return new Promise((resolve, reject) => {
    const p = spawn(`${HF} render --quality ${qualidade} --output renders/final-bruto.mp4`, { cwd: pasta, shell: true, windowsHide: true });
    let log = "";
    let ultimo = -10;
    const ler = (d) => {
      const txt = String(d);
      log += txt;
      if (log.length > 300_000) log = log.slice(-150_000);
      const pcts = txt.match(/(\d{1,3}(?:\.\d+)?)\s*%/g);
      if (pcts) {
        const pct = Math.floor(parseFloat(pcts[pcts.length - 1]));
        if (pct >= ultimo + 10 && pct <= 100) {
          ultimo = pct;
          aviso(`renderizando ${pct}%`);
        }
      }
    };
    p.stdout.on("data", ler);
    p.stderr.on("data", ler);
    const relogio = setTimeout(() => {
      p.kill();
      reject(new Error(`o render passou de ${minutos} min`));
    }, minutos * 60_000);
    p.on("error", (e) => {
      clearTimeout(relogio);
      reject(e);
    });
    p.on("close", (codigo) => {
      clearTimeout(relogio);
      if (codigo === 0 && fs.existsSync(saida)) resolve(saida);
      else reject(new Error(`o render falhou (código ${codigo}): ${log.slice(-1500)}`));
    });
  });
}

/** Cópia que cabe no limite do storage (50 MB por arquivo) pra ver e baixar pelo painel. */
export async function versaoWeb(arquivo, limiteMB = 48) {
  if (fs.statSync(arquivo).size <= limiteMB * 1024 * 1024) return arquivo;
  const info = await sondar(arquivo);
  const kbps = Math.max(1200, Math.floor(((limiteMB - 2) * 8192) / Math.max(1, info.duracao)) - 160);
  const saida = arquivo.replace(/\.mp4$/i, "-web.mp4");
  await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", arquivo, "-c:v", "libx264", "-preset", "medium", "-b:v", `${kbps}k`, "-maxrate", `${Math.round(kbps * 1.4)}k`, "-bufsize", `${kbps * 2}k`, "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", saida], { timeoutMs: 40 * 60_000 });
  return saida;
}

/**
 * Edição completa numa pasta local.
 *  - versão 1: bruto + materiais → oficina nova
 *  - ajuste: copia a oficina da versão anterior (base) e o Claude muda só o pedido
 * perfil: o perfil do criador (criador.configuracao "perfil"): @, foto, nicho, público, tom e os
 * padrões de look (cor) e de legenda, que valem quando o pedido não diz.
 */
export async function editar({ pasta, base, bruto, materiais, pedido, perfil, versao = 1, ajuste, aviso = () => {}, aoPasso = () => {}, aoPreparar = async () => {} }) {
  const p = perfilLimpo(perfil);
  const opcoes = { ...(pedido?.opcoes ?? {}) };
  opcoes.cor = lookValido(opcoes.cor, p.cor);
  opcoes.legenda = ["bangers", "labs"].includes(opcoes.legenda) ? opcoes.legenda : p.legenda;
  if (versao > 1 && base) {
    if (!fs.existsSync(path.join(base, "plano.json"))) throw new Error("a oficina da versão anterior não está neste PC (o ajuste precisa dela)");
    aviso(`copiando a oficina da versão ${versao - 1}`);
    fs.cpSync(base, pasta, { recursive: true, filter: (f) => !/[\\/](renders|snapshots|\.cache)([\\/]|$)/.test(f.slice(base.length)) });
    prepararPasta(pasta); // kit atualizado
    fs.writeFileSync(path.join(pasta, "dados", "pedido.json"), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(base, "dados", "pedido.json"), "utf8")), versao, ajuste }, null, 2));
  } else {
    await prepararOficina({ pasta, bruto, materiais, pedido: { ...pedido, opcoes, versao }, aviso });
  }
  await gravarPerfil(pasta, perfil, { aviso }); // dados/perfil.json + assets/perfil.jpg (o CTA usa)
  await aoPreparar(pasta); // a estação põe aqui os sons da biblioteca do criador (dados/sons.json)

  aviso("o Claude está montando a edição");
  const cerebro = await rodarClaude(pasta, promptEdicao({ versao, ajuste, perfil: p }), { aoPasso });
  if (!fs.existsSync(path.join(pasta, "index.html"))) throw new Error("o Claude terminou sem montar o vídeo (sem index.html)");

  let lint = conferir(pasta);
  if (lint.erros > 0) {
    aviso(`o lint achou ${lint.erros} erro(s); o Claude vai corrigir`);
    const conserto = await rodarClaude(pasta, `O lint do HyperFrames achou erros nesta oficina. Corrija no plano.json (ou na cena livre) e rode node kit/montar.mjs e o lint de novo até dar 0 erros. Não renderize. Responda numa linha o que corrigiu.\n\nSaída do lint:\n${lint.saida.slice(-4000)}`, { aoPasso, minutos: 20 });
    cerebro.uso.conserto = conserto.uso;
    lint = conferir(pasta);
    if (lint.erros > 0) throw new Error(`o vídeo ficou com ${lint.erros} erro(s) no lint: ${lint.saida.slice(-600)}`);
  }

  aviso("renderizando");
  const t0 = Date.now();
  const final = await renderizar(pasta, { aviso });
  const info = await sondar(final);
  return { final, info, resumo: cerebro.resumo, uso: { ...cerebro.uso, render_s: Math.round((Date.now() - t0) / 1000) }, passos: cerebro.passos };
}
