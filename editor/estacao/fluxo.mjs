// Uma edição do começo ao fim, na máquina local: oficina → IA (Claude, ChatGPT ou OpenRouter)
// → conferência → render. Quem chama é a estação (scripts/estacao-edicao.mjs), que cuida do banco
// e do storage.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ambienteDaIA } from "./ambiente.mjs";
import { comandoHyperframes, garantirFerramentas } from "./ferramentas.mjs";
import { prepararMotor } from "./motor.mjs";
import { FERRAMENTAS, estiloValido, gravarPerfil, kitAntigo, legendaValida, lookValido, perfilLimpo, prepararOficina, prepararPasta, rodar, sondar } from "./preparar.mjs";
import { gerarRecortes } from "./recortes.mjs";

/** "Você é o editor de vídeo do criador @ana." + nicho, público e tom, quando o perfil tem. */
function quemE(perfil) {
  const p = perfilLimpo(perfil);
  const linhas = [`Você é o editor de vídeo do criador${p.usuario ? ` @${p.usuario}` : ""}${p.nome ? ` (${p.nome})` : ""}.`];
  const sobre = [p.nicho && `nicho: ${p.nicho}`, p.publico && `público: ${p.publico}`, p.tom && `tom: ${p.tom}`].filter(Boolean);
  if (sobre.length) linhas.push(`Sobre o criador: ${sobre.join(" · ")}.`);
  return linhas;
}

/**
 * O pedido pra IA. São três manuais: kit/EDITOR.md (fluxo e formato do plano), kit/ESTILO.md (o
 * estilo de edição deste vídeo) e kit/COMPONENTES.md (as cenas). O Codex já recebe os dois
 * primeiros como AGENTS.md. `antigo`: oficina do kit de antes dos estilos (um manual só).
 */
export function promptEdicao({ versao = 1, ajuste, perfil, motor = "claude", antigo = false } = {}) {
  const manual = antigo
    ? motor === "codex"
      ? "Siga o manual das suas instruções (AGENTS.md: as notas deste ambiente + o kit/EDITOR.md)."
      : "Leia kit/EDITOR.md (o manual, com o padrão de edição)."
    : motor === "codex"
      ? "Siga os manuais das suas instruções (AGENTS.md: as notas deste ambiente, o kit/EDITOR.md e o kit/ESTILO.md, que é o estilo de edição deste vídeo e vale por cima do manual) e leia kit/COMPONENTES.md (as cenas que existem). Se o pedido falar em motion ou animação, ou o estilo pedir motion, leia também kit/MOTION.md e os exemplos em kit/motion-exemplos/ (vídeos animados que entram na edição)."
      : "Leia os três manuais: kit/EDITOR.md (o fluxo de trabalho e o formato do plano), kit/ESTILO.md (o estilo de edição deste vídeo, que vale por cima do manual onde disser diferente) e kit/COMPONENTES.md (as cenas que existem). Se o pedido falar em motion ou animação, ou o estilo pedir motion, leia também kit/MOTION.md e os exemplos em kit/motion-exemplos/ (vídeos animados que entram na edição).";
  if (versao > 1 && ajuste)
    return [
      ...quemE(perfil),
      "Esta pasta é a oficina de uma edição que já existe:",
      `plano.json e index.html são da versão ${versao - 1}. O criador assistiu e pediu este ajuste pra versão ${versao}:`,
      "",
      `«${ajuste.trim()}»`,
      "",
      `${manual} Mude o plano só no que foi pedido e mantenha o resto.`,
      "Rode o montador e o lint (0 erros) e confira nos snapshots os trechos que mudaram. Não renderize.",
      "Termine com um resumo curto pro criador (2 a 4 linhas, português simples) do que mudou.",
    ].join("\n");
  return [
    ...quemE(perfil),
    "Esta pasta é a oficina de uma edição nova.",
    `${manual} Leia dados/perfil.json e siga o fluxo de trabalho até o fim:`,
    "pedido e materiais, emendas, medida do rosto, assets reais (logos e prints), plano.json no estilo desta edição,",
    "montador, lint com 0 erros e conferência nos snapshots. Não renderize (a estação renderiza depois).",
    "Termine com o resumo curto pro criador (3 a 6 linhas, português simples).",
  ].join("\n");
}

/**
 * Motor "codex" (sem internet nos comandos): se ele pediu logos em dados/buscar.json, a estação
 * busca (com o kit/logo.mjs, que só aceita nome de marca e domínio) e chama ele de novo, na mesma
 * conversa, com o resultado. Devolve o resultado final da IA (o uso das duas rodadas somado).
 */
export async function rodadaDasLogos(pasta, motor, cerebro, { aviso, aoPasso }) {
  const arquivo = path.join(pasta, "dados", "buscar.json");
  if (!fs.existsSync(arquivo)) return cerebro;
  let pedidas = [];
  try {
    pedidas = (JSON.parse(fs.readFileSync(arquivo, "utf8")).logos ?? []).filter((l) => l && typeof l.marca === "string").slice(0, 8);
  } catch {}
  fs.renameSync(arquivo, path.join(pasta, "dados", "buscar-feito.json"));
  aviso(`buscando ${pedidas.length} logo(s) pro ${motor.nome.replace(/^o /, "")}`);
  const achadas = [];
  for (const l of pedidas) {
    const args = [path.join(pasta, "kit", "logo.mjs"), l.marca, ...(typeof l.site === "string" && l.site ? ["--site", l.site] : [])];
    const r = spawnSync(process.execPath, args, { cwd: pasta, encoding: "utf8", windowsHide: true, timeout: 4 * 60_000, env: ambienteDaIA() });
    const linha = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split(/\r?\n/).filter(Boolean).pop() ?? "sem resposta";
    achadas.push(`- ${l.marca}: ${r.status === 0 ? linha.replace(/^logo: /, "") : `não achei (${linha.slice(0, 160)})`}`);
  }
  const continuar = [
    "A estação buscou as logos que você pediu:",
    ...achadas,
    "",
    "Olhe as logos antes de usar (as .png com view_image; as .svg você confere no snapshot). Agora continue de onde parou e vá até o fim: plano.json, montador,",
    "lint com 0 erros e conferência nos snapshots. Não renderize. Termine com o resumo curto pro criador (3 a 6 linhas).",
  ].join("\n");
  let segunda;
  try {
    segunda = await motor.rodar(pasta, continuar, { aoPasso, retomar: cerebro.sessao });
  } catch (e) {
    if (!cerebro.sessao || /limite|logado/.test(e.message)) throw e;
    // A conversa não deu pra retomar: começa outra, com o mesmo pedido e as logos prontas
    segunda = await motor.rodar(pasta, `${continuar}\n\n(Se ainda não existir plano.json, comece pelo fluxo de trabalho do manual.)`, { aoPasso });
  }
  return {
    ...segunda,
    passos: [...cerebro.passos, ...segunda.passos],
    uso: { ...segunda.uso, turnos: (cerebro.uso.turnos ?? 0) + (segunda.uso.turnos ?? 0), duracao_s: (cerebro.uso.duracao_s ?? 0) + (segunda.uso.duracao_s ?? 0), rodadas: 2 },
  };
}

/** Lint do HyperFrames: quantos erros (avisos de organização são esperados neste kit). */
export function conferir(pasta) {
  const r = spawnSync(`${comandoHyperframes()} lint`, { cwd: pasta, shell: true, encoding: "utf8", windowsHide: true, timeout: 300_000 });
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
    const p = spawn(`${comandoHyperframes()} render --quality ${qualidade} --output renders/final-bruto.mp4`, { cwd: pasta, shell: true, windowsHide: true });
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
 *  - ajuste: copia a oficina da versão anterior (base) e a IA muda só o pedido
 * perfil: o perfil do criador (configuracao "perfil"): @, foto, nicho, público, tom e os
 * padrões de look (cor) e de legenda, que valem quando o pedido não diz.
 * motor: quem edita, já conferido (motor.mjs → prepararMotor). Sem ele: o Claude no plano.
 */
export async function editar({ pasta, base, bruto, materiais, pedido, perfil, versao = 1, ajuste, motor = null, aviso = () => {}, aoPasso = () => {}, aoPreparar = async () => {} }) {
  const ia = motor ?? (await prepararMotor({ motor: "claude" }));
  await garantirFerramentas({ aviso }); // HyperFrames e GSAP locais (só baixa na primeira vez)
  const p = perfilLimpo(perfil);
  const opcoes = { ...(pedido?.opcoes ?? {}) };
  opcoes.cor = lookValido(opcoes.cor, p.cor);
  opcoes.estilo = estiloValido(opcoes.estilo, p.estilo);
  const legenda = legendaValida(opcoes.legenda, p.legenda);
  if (legenda) opcoes.legenda = legenda;
  else delete opcoes.legenda;
  let antigo = false;
  if (versao > 1 && base) {
    if (!fs.existsSync(path.join(base, "plano.json"))) throw new Error("a oficina da versão anterior não está neste PC (o ajuste precisa dela)");
    aviso(`copiando a oficina da versão ${versao - 1}`);
    fs.cpSync(base, pasta, { recursive: true, filter: (f) => !/[\\/](renders|snapshots|\.cache)([\\/]|$)/.test(f.slice(base.length)) });
    const anterior = JSON.parse(fs.readFileSync(path.join(base, "dados", "pedido.json"), "utf8"));
    // edição feita com o kit de antes dos estilos: o ajuste continua nele (o plano e o visual são daquele kit)
    antigo = kitAntigo(pasta);
    const estilo = antigo ? undefined : prepararPasta(pasta, anterior.opcoes?.estilo); // kit atualizado, no estilo da versão anterior
    fs.writeFileSync(path.join(pasta, "dados", "pedido.json"), JSON.stringify({ ...anterior, ...(estilo ? { opcoes: { ...(anterior.opcoes ?? {}), estilo } } : {}), versao, ajuste }, null, 2));
  } else {
    await prepararOficina({ pasta, bruto, materiais, pedido: { ...pedido, opcoes, versao }, aviso });
  }
  await gravarPerfil(pasta, perfil, { aviso }); // dados/perfil.json + assets/perfil.jpg (o CTA usa)
  await aoPreparar(pasta); // a estação põe aqui os sons da biblioteca do criador (dados/sons.json)

  aviso(`${ia.nome} está montando a edição`);
  let cerebro = await ia.rodar(pasta, promptEdicao({ versao, ajuste, perfil: p, motor: ia.id, antigo }), { aoPasso });
  if (ia.id === "codex") cerebro = await rodadaDasLogos(pasta, ia, cerebro, { aviso, aoPasso });
  if (!fs.existsSync(path.join(pasta, "index.html"))) throw new Error(`${ia.nome} terminou sem montar o vídeo (sem index.html)`);

  let lint = conferir(pasta);
  if (lint.erros > 0) {
    aviso(`o lint achou ${lint.erros} erro(s); ${ia.nome} vai corrigir`);
    const conserto = await ia.rodar(pasta, `O lint do HyperFrames achou erros nesta oficina. Corrija no plano.json (ou na cena livre) e rode node kit/montar.mjs e node kit/hf.mjs lint de novo até dar 0 erros. Não renderize. Responda numa linha o que corrigiu.\n\nSaída do lint:\n${lint.saida.slice(-4000)}`, { aoPasso, minutos: 20 });
    cerebro.uso.conserto = conserto.uso;
    lint = conferir(pasta);
    if (lint.erros > 0) throw new Error(`o vídeo ficou com ${lint.erros} erro(s) no lint: ${lint.saida.slice(-600)}`);
  }

  // estilos que põem coisa atrás da pessoa (texto, cenário): recorta ela do fundo nos trechos que o
  // plano pediu e monta de novo, agora com os recortes no lugar
  const t1 = Date.now();
  const recortes = await gerarRecortes(pasta, { aviso });
  if (recortes) {
    const m = spawnSync(process.execPath, ["kit/montar.mjs"], { cwd: pasta, encoding: "utf8", windowsHide: true, timeout: 120_000, env: ambienteDaIA() });
    if (m.status !== 0 && m.status !== 2) throw new Error(`o montador falhou depois dos recortes: ${`${m.stdout ?? ""}${m.stderr ?? ""}`.slice(-600)}`);
    lint = conferir(pasta);
    if (lint.erros > 0) throw new Error(`o vídeo ficou com ${lint.erros} erro(s) no lint depois dos recortes: ${lint.saida.slice(-600)}`);
    cerebro.uso.recortes = { trechos: recortes, duracao_s: Math.round((Date.now() - t1) / 1000) };
  }

  aviso("renderizando");
  const t0 = Date.now();
  const final = await renderizar(pasta, { aviso });
  const info = await sondar(final);
  return { final, info, resumo: cerebro.resumo, uso: { ...cerebro.uso, render_s: Math.round((Date.now() - t0) / 1000) }, passos: cerebro.passos };
}
