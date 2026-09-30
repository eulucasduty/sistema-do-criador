// Montador do editor de vídeo do criador: plano.json (decidido pelo Claude) → index.html (HyperFrames).
//
// Roda dentro da pasta da edição (a "oficina"), que a estação monta assim:
//   assets/video.mp4        o vídeo bruto já tratado (look de cor, SDR, 30 fps, voz nivelada)
//   assets/sons, fontes     biblioteca do kit · assets/perfil.jpg foto do perfil (pode não existir)
//   materiais/…             prints e gravações de tela que o criador subiu (com descrição)
//   logos/…, prints/…       logos oficiais e prints de sites que o Claude buscou
//   dados/video.json        {duracao, largura, altura}
//   dados/palavras.json     transcrição palavra a palavra [{text, start, end}]
//   dados/cortes.json       emendas das tomadas no bruto [segundos]
//   dados/materiais.json    [{id, tipo, arquivo, descricao, largura, altura, duracao}]
//   dados/perfil.json       {nome, usuario, nicho, publico, tom, foto} do criador (CTA, comentários, chat)
//   dados/pedido.json       título, roteiro e opções (opcoes.legenda = estilo padrão da legenda)
//   plano.json              o plano da edição (formato em kit/EDITOR.md)
//
// O padrão de edição mora aqui, não no plano: onda de calor + obturador nas emendas,
// legenda com a palavra falada em destaque, tela dividida com a faixa de cima (~40%)
// pra print/gravação/card, sons do kit. O plano só diz o quê e quando.
//
// Uso: node kit/montar.mjs   (na pasta da oficina) → escreve index.html e mostra a linha do tempo

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KIT = path.dirname(fileURLToPath(import.meta.url));
const W = 1080;
const H = 1920;
const PAINEL = 760; // faixa de cima da tela dividida
const COSTURA = 772; // legenda na tela dividida: logo abaixo da faixa
const MOLD = { x: 48, y: 122, w: 984, h: 560 }; // moldura de print/gravação dentro da faixa
const BARRA = 52; // barra de janela (quando a cena tem url)

const problemas = [];
const avisar = (m) => problemas.push(m);
function ler(p, padrao) {
  if (!fs.existsSync(p)) return padrao;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`${p} não é um JSON válido: ${e.message}`);
  }
}
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const js = (v) => JSON.stringify(v);

const video = ler("dados/video.json", null);
if (!video) throw new Error("dados/video.json não existe (a estação cria)");
const plano = ler("plano.json", null);
if (!plano) throw new Error("plano.json não existe");
const D = r3(video.duracao);
const materiais = Object.fromEntries(ler("dados/materiais.json", []).map((m) => [m.id, m]));
const pedido = ler("dados/pedido.json", {}) ?? {};

// ── perfil do criador (dados/perfil.json): o @ e a foto do CTA, da resposta nos comentários e
//    do chat. Sem foto (assets/perfil.jpg), a inicial num círculo colorido. ──
const perfil = ler("dados/perfil.json", {}) ?? {};
const arroba = String(perfil.usuario ?? "").replace(/^@+/, "").trim();
const temFoto = fs.existsSync("assets/perfil.jpg");
const inicial = (txt) => [...String(txt ?? "")].find((ch) => /[\p{L}\p{N}]/u.test(ch))?.toUpperCase() ?? "?";
function avatarPerfil(classe = "") {
  const mais = classe ? ` ${classe}` : "";
  if (temFoto) return `<img class="av${mais}" src="assets/perfil.jpg" alt="" />`;
  const quem = perfil.nome || arroba || "?";
  return `<span class="av letra${mais}" style="background:${corDe(quem)}">${esc(inicial(quem))}</span>`;
}
const curto = (txt, max) => (String(txt ?? "").length > max ? `${String(txt).slice(0, max - 1).trimEnd()}…` : String(txt ?? ""));

// ── utilidades de arquivo ──────────────────────────────────────────
function dimensoes(arquivo) {
  try {
    const b = fs.readFileSync(arquivo);
    if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) {
          i++;
          continue;
        }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const t = b.toString("ascii", 12, 16);
      if (t === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (t === "VP8L") {
        const v = b.readUInt32LE(21);
        return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) };
      }
      if (t === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    }
    const txt = b.toString("utf8", 0, Math.min(b.length, 5000));
    if (/<svg/i.test(txt)) {
      const w = txt.match(/<svg[^>]*\swidth="([\d.]+)(px)?"/i);
      const h = txt.match(/<svg[^>]*\sheight="([\d.]+)(px)?"/i);
      if (w && h) return { w: +w[1], h: +h[1] };
      const vb = txt.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      if (vb) return { w: +vb[1], h: +vb[2] };
    }
  } catch {}
  return null;
}
function arquivoOk(arq, onde) {
  if (!arq) return false;
  if (!fs.existsSync(arq)) {
    avisar(`${onde}: arquivo não existe (${arq})`);
    return false;
  }
  return true;
}

// ── faixas (data-track-index): clipes da mesma faixa não podem se sobrepor ──
function alocador(base) {
  const fins = [];
  return (a, b) => {
    for (let i = 0; i < fins.length; i++)
      if (fins[i] <= a + 1e-3) {
        fins[i] = b;
        return base + i;
      }
    fins.push(b);
    return base + fins.length - 1;
  };
}
const faixaCena = alocador(10);
const faixaSom = alocador(60);

// ── sons: "Meus sons" do criador (dados/sons.json, a estação baixa da biblioteca do painel) ou,
//    sem ela, o catálogo do kit (assets/sons/sons.json). Todo arquivo vem nivelado (pico -3 dB).
//    Cada som tem nome próprio; o nome da FUNÇÃO (obturador, ding, teclado…) toca o principal dela.
//    Nome que não existe ("ding-curto" numa biblioteca sem ele) cai no principal da função.
//    nome → [arquivo em assets/sons, duração, volume] ──
// volume de cada função em cima do arquivo nivelado (o mixador abaixa tudo se os efeitos estourarem)
const VOL_FUNCAO = { obturador: 0.75, ding: 0.42, teclado: 0.42, tecla: 0.38, whoosh: 0.5, riser: 0.42, pop: 0.38, click: 0.46, impacto: 0.6, notificacao: 0.47 };
const catalogoKit = ler("assets/sons/sons.json", []);
const biblioteca = ler("dados/sons.json", null);
const SONS = {};
const porFuncao = {};
for (const s of [...catalogoKit, ...(biblioteca ?? [])]) {
  SONS[s.nome] = [s.arquivo, Number(s.duracao) || 1, (VOL_FUNCAO[s.funcao] ?? 0.4) * (Number(s.volume) || 1)];
  if (s.funcao) (porFuncao[s.funcao] ??= []).push(s);
}
for (const [funcao, lista] of Object.entries(porFuncao)) {
  // o principal da biblioteca do criador manda; sem biblioteca, o principal do kit
  const escolhido = (biblioteca ?? []).find((s) => s.funcao === funcao && s.principal) ?? lista.find((s) => s.principal) ?? lista[0];
  SONS[funcao] = SONS[escolhido.nome];
}
const APELIDOS = { typing: "teclado", keyboard: "teclado", swoosh: "whoosh", sparkle: "brilho", impact: "impacto", notification: "notificacao", shutter: "obturador", chime: "ding", ping: "ding-curto", "impacto-2": "impacto-longo" };
const sons = [];
function resolverSom(nome) {
  nome = APELIDOS[nome] ?? nome;
  if (SONS[nome]) return nome;
  const funcao = String(nome ?? "").split("-")[0];
  return VOL_FUNCAO[funcao] !== undefined && SONS[funcao] ? funcao : null;
}
function som(pedido, t, volume) {
  const nome = resolverSom(pedido);
  if (!nome) return avisar(`som desconhecido: ${APELIDOS[pedido] ?? pedido}`);
  const s = SONS[nome];
  if (!(t >= 0) || t >= D - 0.05) return;
  sons.push({ nome, arquivo: s[0], t: r3(t), dur: r3(Math.min(s[1], D - t)), volume: r3(clamp((volume ?? 1) * s[2], 0, 1)) });
}

// ── linha do tempo (JS gerado) ─────────────────────────────────────
const tl = [];
const add = (linha) => tl.push("      " + linha);

// ── cenas ──────────────────────────────────────────────────────────
const TOPO = new Set(["material", "print", "logos", "contador", "chat", "comentarios", "notificacao", "lista", "terminal", "fluxo", "comparacao"]);
const ehTopo = (c) => (TOPO.has(c.tipo) || c.tipo === "livre") && c.area !== "tela-cheia";
// tela cheia 9:16: a palavra solta e qualquer card/print/cena livre com "area": "tela-cheia"
const ehCheia = (c) => c.tipo === "palavra" || ((TOPO.has(c.tipo) || c.tipo === "livre") && c.area === "tela-cheia");
// a legenda some na palavra (e na cena livre em tela cheia, se ela não pedir); nos cards em tela cheia ela desce pra base
const semLegenda = (c) => c.tipo === "palavra" || c.legenda === false || (c.tipo === "livre" && c.area === "tela-cheia" && c.legenda !== true);
const LEG_CHEIA = 1480;
let cenas = (plano.cenas ?? [])
  .map((c, i) => ({ ...c, i, de: r3(clamp(Number(c.de), 0, D)), ate: r3(clamp(Number(c.ate), 0, D)) }))
  .filter((c) => {
    if (!(c.ate - c.de >= 0.3)) return avisar(`cena ${c.i} (${c.tipo}) com duração inválida (${c.de}→${c.ate}), ignorada`), false;
    return true;
  })
  .sort((a, b) => a.de - b.de);
// cenas da mesma área não se sobrepõem: a anterior termina quando a próxima começa
for (const grupo of [cenas.filter(ehTopo), cenas.filter(ehCheia)])
  for (let k = 1; k < grupo.length; k++)
    if (grupo[k - 1].ate > grupo[k].de) {
      avisar(`cenas ${grupo[k - 1].i} e ${grupo[k].i} se sobrepõem: a ${grupo[k - 1].i} termina em ${grupo[k].de}`);
      grupo[k - 1].ate = grupo[k].de;
    }
cenas = cenas.filter((c) => c.ate - c.de >= 0.3);

// ── câmera: tela cheia (com angulação) ou dividida (rosto embaixo da faixa) ──
const rostoPadrao = plano.rosto ?? { x: 0.5, y: 0.5 };
const rostos = (plano.rostos ?? []).map((r) => ({ ...r, de: Number(r.de), ate: Number(r.ate) }));
const rostoEm = (t) => rostos.find((r) => t >= r.de && t < r.ate) ?? rostoPadrao;
const PLANOS = { aberto: 1, medio: 1.22, fechado: 1.45 };
const angulos = (plano.angulos ?? [])
  .map((a) => ({ ...a, de: clamp(Number(a.de), 0, D), ate: clamp(Number(a.ate), 0, D) }))
  .filter((a) => a.ate > a.de)
  .sort((a, b) => a.de - b.de);
for (let k = 1; k < angulos.length; k++) if (angulos[k - 1].ate > angulos[k].de) angulos[k - 1].ate = angulos[k].de;
for (const a of angulos) if (a.plano && !PLANOS[a.plano]) avisar(`plano de câmera desconhecido: ${a.plano} (use aberto, medio ou fechado)`);

function unir(intervalos, folga) {
  const r = [];
  for (const [a, b] of intervalos.sort((x, y) => x[0] - y[0])) {
    const u = r[r.length - 1];
    if (u && a - u[1] <= folga) u[1] = Math.max(u[1], b);
    else r.push([a, b]);
  }
  return r;
}
const divididas = unir(cenas.filter(ehTopo).map((c) => [c.de, c.ate]), 0.35);
const ctas = cenas.filter((c) => c.tipo === "cta").map((c) => [c.de, c.ate]);
const cheiasComLegenda = cenas.filter((c) => ehCheia(c) && !semLegenda(c)).map((c) => [c.de, c.ate]);
const posicoes = (plano.legenda?.posicoes ?? []).map((p) => ({ de: Number(p.de), ate: Number(p.ate), y: Number(p.y) }));
const dentro = (lista, t) => lista.find(([a, b]) => t >= a && t < b);

function cobertura(graus) {
  const a = (Math.abs(graus) * Math.PI) / 180;
  return r3(Math.max(Math.cos(a) + (H / W) * Math.sin(a), Math.cos(a) + (W / H) * Math.sin(a)));
}
function camera(modo, rosto, s) {
  const fx = rosto.x * W;
  const fy = rosto.y * H;
  if (modo === "dividida") {
    // rosto em ~67% da altura, embaixo da faixa; o topo que sobra fica atrás da faixa
    const tx = clamp(W / 2 - s * fx, W - s * W, 0);
    const ty = clamp(0.67 * H - s * fy, H - s * H, PAINEL - 90);
    return { x: r3(tx), y: r3(ty), scale: r3(s) };
  }
  if (s <= 1.0001) return { x: 0, y: 0, scale: 1 };
  const tx = clamp(W / 2 - s * fx, W - s * W, 0);
  const ty = clamp(fy - s * fy, H - s * H, 0); // o rosto fica na mesma altura, maior
  return { x: r3(tx), y: r3(ty), scale: r3(s) };
}
function legendaY(modo, cam, rosto) {
  if (modo === "dividida") return COSTURA;
  const s = cam.scale;
  const rostoNaTela = cam.y + s * rosto.y * H;
  // rosto na metade de baixo (é o normal dele): legenda em cima da cabeça; senão, embaixo do queixo
  if (rostoNaTela >= 0.5 * H) return Math.round(clamp(rostoNaTela - 0.21 * H * s - 175, 170, 1360));
  return Math.round(clamp(rostoNaTela + 0.25 * H * s + 40, 300, 1360));
}

const marcos = [0, D, ...divididas.flat(), ...angulos.flatMap((a) => [a.de, a.ate]), ...rostos.flatMap((r) => [r.de, r.ate]), ...ctas.flat(), ...cheiasComLegenda.flat(), ...posicoes.flatMap((p) => [p.de, p.ate])];
const ts = [...new Set(marcos.map((t) => r3(clamp(t, 0, D))))].sort((a, b) => a - b);
const trechos = [];
for (let k = 0; k < ts.length - 1; k++) {
  const a = ts[k];
  const b = ts[k + 1];
  if (b - a < 0.001) continue;
  const tm = (a + b) / 2;
  const div = divididas.find(([x, y]) => tm >= x && tm < y);
  const modo = div ? "dividida" : "rosto";
  const ang = angulos.find((g) => tm >= g.de && tm < g.ate) ?? { plano: "aberto", de: 0, ate: D };
  const rosto = ang.rosto ?? rostoEm(tm);
  const escala = (t) => {
    if (div) return 1 + 0.03 * clamp((t - div[0]) / (div[1] - div[0]), 0, 1);
    const base = PLANOS[ang.plano] ?? 1;
    return ang.empurrar ? base * (1 + 0.06 * clamp((t - ang.de) / (ang.ate - ang.de), 0, 1)) : base;
  };
  const camA = camera(modo, rosto, escala(a));
  const camB = camera(modo, rosto, escala(b));
  const rot = modo === "rosto" ? Number(ang.inclinar ?? 0) : 0;
  // na tela dividida a legenda fica sempre na costura; a posição manual vale na tela cheia
  let legY = modo === "dividida" ? COSTURA : (posicoes.find((p) => tm >= p.de && tm < p.ate)?.y ?? legendaY(modo, camA, rosto));
  if (dentro(cheiasComLegenda, tm)) legY = LEG_CHEIA; // card em tela cheia: legenda embaixo dele
  if (dentro(ctas, tm)) legY = clamp(legY, 300, 1320); // o card do perfil do CTA fica embaixo
  trechos.push({ a, b, modo, rosto, escala, camA, camB, rot, legY });
}
const igual = (p, q) => p.x === q.x && p.y === q.y && p.scale === q.scale;
const cam = (c) => `x: ${c.x}, y: ${c.y}, scale: ${c.scale}`;
let ant = null;
for (const tr of trechos) {
  const trocou = ant && ant.modo !== tr.modo;
  if (trocou && tr.b - tr.a > 0.4) {
    const tm = r3(tr.a + 0.26);
    const camM = camera(tr.modo, tr.rosto, tr.escala(tm));
    add(`tl.to("#v-inner", { ${cam(camM)}, duration: 0.26, ease: "power3.out" }, ${tr.a});`);
    if (!igual(camM, tr.camB)) add(`tl.to("#v-inner", { ${cam(tr.camB)}, duration: ${r3(tr.b - tm)}, ease: "none" }, ${tm});`);
  } else {
    add(`tl.set("#v-inner", { ${cam(tr.camA)} }, ${tr.a});`);
    if (!igual(tr.camA, tr.camB)) add(`tl.to("#v-inner", { ${cam(tr.camB)}, duration: ${r3(tr.b - tr.a)}, ease: "none" }, ${tr.a});`);
  }
  if (!ant) add(`tl.set("#painel-in", { yPercent: ${tr.modo === "dividida" ? 0 : -106} }, 0);`);
  else if (trocou) add(`tl.to("#painel-in", { yPercent: ${tr.modo === "dividida" ? 0 : -106}, duration: 0.26, ease: "${tr.modo === "dividida" ? "power3.out" : "power2.in"}" }, ${tr.a});`);
  if (!ant || ant.rot !== tr.rot) add(`tl.set("#v-rot", { rotation: ${tr.rot}, scale: ${tr.rot ? cobertura(tr.rot) : 1} }, ${tr.a});`);
  if (!ant || ant.legY !== tr.legY) add(`tl.set("#leg-pos", { y: ${tr.legY} }, ${tr.a});`);
  ant = tr;
}
const trechoEm = (t) => trechos.find((tr) => t >= tr.a && t < tr.b) ?? trechos[trechos.length - 1];

// ── emendas: onda de calor (0,5 s) + obturador; o plano pode trocar o estilo de alguma ──
const cfgCortes = plano.cortes ?? {};
const trocas = cfgCortes.trocar ?? [];
const brutos = [
  ...ler("dados/cortes.json", []).map((t) => ({ t: Number(t), estilo: cfgCortes.estilo_padrao ?? "onda", som: "obturador" })),
  ...(cfgCortes.extras ?? []).map((c) => ({ t: Number(c.t), estilo: c.estilo ?? "onda", som: c.som ?? "obturador" })),
]
  .map((c) => {
    const tr = trocas.find((x) => Math.abs(Number(x.t) - c.t) < 0.12);
    return tr ? { ...c, estilo: tr.estilo ?? c.estilo, som: tr.som === undefined ? c.som : tr.som } : c;
  })
  .filter((c) => c.t > 0.2 && c.t < D - 0.3 && c.estilo !== "nenhum" && !(cfgCortes.ignorar ?? []).some((x) => Math.abs(Number(x) - c.t) < 0.12))
  .sort((a, b) => a.t - b.t);
const emendas = [];
for (const c of brutos) if (!emendas.length || c.t - emendas[emendas.length - 1].t >= 0.55) emendas.push(c);
for (const c of emendas) {
  const t = r3(c.t);
  const t0 = r3(t - 0.16);
  if (c.estilo === "onda") {
    add(`tl.set("#v-wrap", { filter: "url(#calor)" }, ${t0});`);
    add(`tl.fromTo("#calor-map", { attr: { scale: 0 } }, { attr: { scale: 80 }, duration: 0.16, ease: "power2.in", immediateRender: false }, ${t0});`);
    add(`tl.to("#calor-map", { attr: { scale: 0 }, duration: 0.34, ease: "power2.out" }, ${t});`);
    add(`tl.fromTo("#calor-turb", { attr: { baseFrequency: "0.002 0.014" } }, { attr: { baseFrequency: "0.01 0.045" }, duration: 0.5, ease: "none", immediateRender: false }, ${t0});`);
    add(`tl.fromTo("#v-wrap", { scale: 1 }, { scale: 1.04, duration: 0.16, ease: "power2.in", immediateRender: false }, ${t0});`);
    add(`tl.to("#v-wrap", { scale: 1, duration: 0.34, ease: "power2.out" }, ${t});`);
    add(`tl.set("#v-wrap", { filter: "none" }, ${r3(t + 0.36)});`);
  } else if (c.estilo === "flash") {
    add(`tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.75, duration: 0.04, ease: "none", immediateRender: false }, ${t});`);
    add(`tl.to("#flash", { opacity: 0, duration: 0.24, ease: "power2.out" }, ${r3(t + 0.04)});`);
  } else if (c.estilo === "zoom") {
    add(`tl.fromTo("#v-wrap", { scale: 1.16 }, { scale: 1, duration: 0.32, ease: "power3.out", immediateRender: false }, ${t});`);
  } else if (c.estilo === "glitch") {
    add(`tl.to("#v-wrap", { keyframes: [{ x: -28, duration: 0.03 }, { x: 20, duration: 0.03 }, { x: -12, duration: 0.03 }, { x: 6, duration: 0.03 }, { x: 0, duration: 0.05 }], ease: "none" }, ${t});`);
  } else if (c.estilo !== "seco") avisar(`estilo de corte desconhecido: ${c.estilo}`);
  if (c.som) som(c.som, t - 0.03);
}

// ── legenda: grupos curtos, a palavra falada em destaque ───────────
// estilo: o do plano; senão o do pedido (o padrão do perfil do criador); senão bangers
// "limpa" (o nome antigo "labs" ainda vale); o resto é bangers
const estiloLeg = ["limpa", "labs"].includes(plano.legenda?.estilo ?? pedido.opcoes?.legenda) ? "limpa" : "bangers";
const limpar = (t) => t.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}%]+$/gu, "");
let palavras = ler("dados/palavras.json", []).map((w) => ({ texto: String(w.text ?? w.texto ?? "").trim(), a: Number(w.start ?? w.a), b: Number(w.end ?? w.b) }));
for (const e of plano.legenda?.edicoes ?? []) if (palavras[e.i]) palavras[e.i].texto = String(e.texto ?? "");
for (const c of plano.legenda?.correcoes ?? [])
  for (const w of palavras) if (limpar(w.texto).toLowerCase() === String(c.de).toLowerCase()) w.texto = w.texto.replace(limpar(w.texto), c.para);
palavras = palavras.filter((w) => w.texto && Number.isFinite(w.a) && w.a < D);
const destaques = new Set((plano.legenda?.destaques ?? []).map((d) => limpar(String(d)).toLowerCase()));
const maxChars = estiloLeg === "bangers" ? 16 : 18;
const grupos = [];
let atual = [];
palavras.forEach((w, i) => {
  const prox = palavras[i + 1];
  const junto = [...atual, w].map((x) => x.texto).join(" ");
  if (atual.length && junto.length > maxChars) {
    grupos.push(atual);
    atual = [];
  }
  atual.push(w);
  const pausa = prox ? prox.a - w.b > 0.35 : true;
  const quebra = emendas.some((c) => prox && c.t > w.b - 0.05 && c.t <= prox.a + 0.05); // não atravessa emenda
  if (atual.length >= 3 || /[.,!?;:]$/.test(w.texto) || pausa || quebra) {
    grupos.push(atual);
    atual = [];
  }
});
if (atual.length) grupos.push(atual);
const ocultar = [...cenas.filter(semLegenda).map((c) => [c.de, c.ate]), ...(plano.legenda?.ocultar ?? []).map(([a, b]) => [Number(a), Number(b)])];
const legHtml = [];
const ON = estiloLeg === "bangers" ? `color: "#ffc93c"` : `backgroundColor: "#ffc93c", color: "#111111"`;
const OFF = estiloLeg === "bangers" ? `color: "#ffffff"` : `backgroundColor: "rgba(255,201,60,0)", color: "#ffffff"`;
const OFF_DEST = estiloLeg === "bangers" ? `color: "#ffc93c"` : `backgroundColor: "rgba(255,201,60,0)", color: "#ffc93c"`;
grupos.forEach((g, gi) => {
  const a = r3(g[0].a);
  if (dentro(ocultar, a + 0.02)) return;
  const prox = grupos[gi + 1];
  // o próximo grupo sempre corta este (senão duas legendas se sobrepõem quando a fala é rápida)
  let b = r3(Math.min(prox ? prox[0].a : D, Math.max(a + 0.3, g[g.length - 1].b + 0.5)));
  const fimOculto = ocultar.find(([x]) => x > a && x < b);
  if (fimOculto) b = r3(fimOculto[0]);
  if (b - a < 0.06) return; // palavra que o whisper deu com tempo zero: pula
  const spans = g
    .map((w, wi) => {
      const dest = destaques.has(limpar(w.texto).toLowerCase());
      const txt = estiloLeg === "bangers" ? w.texto.toUpperCase() : w.texto;
      return `<span id="g${gi}w${wi}" class="p${dest ? " dest" : ""}">${esc(txt)}</span>`;
    })
    .join(" ");
  legHtml.push(`          <div id="g${gi}" class="grupo">${spans}</div>`);
  add(`tl.set("#g${gi}", { opacity: 1 }, ${a});`);
  add(`tl.from("#g${gi}", { scale: 0.8, duration: 0.12, ease: "back.out(2.4)" }, ${a});`);
  g.forEach((w, wi) => {
    const wa = r3(clamp(w.a, a, b));
    const wb = r3(clamp(g[wi + 1] ? g[wi + 1].a : b, wa, b));
    const dest = destaques.has(limpar(w.texto).toLowerCase());
    add(`tl.set("#g${gi}w${wi}", { ${ON} }, ${wa});`);
    add(`tl.fromTo("#g${gi}w${wi}", { scale: 1.18 }, { scale: 1, duration: 0.14, ease: "power2.out", immediateRender: false }, ${wa});`);
    if (wb > wa) add(`tl.set("#g${gi}w${wi}", { ${dest ? OFF_DEST : OFF} }, ${wb});`);
  });
  add(`tl.set("#g${gi}", { opacity: 0 }, ${b});`);
});

// ── componentes de cena ────────────────────────────────────────────
const cenasHtml = [];
const attrs = (c) => `data-start="${c.de}" data-duration="${r3(c.ate - c.de)}" data-track-index="${faixaCena(c.de, c.ate)}"`;
const cheia = (c) => c.area === "tela-cheia";
// Contêiner da cena: faixa de cima (tela dividida) ou tela cheia 9:16 (fundo void, tudo maior, legenda embaixo)
function abrir(c, id, extra = "") {
  const mais = extra ? ` ${extra}` : "";
  if (!cheia(c)) return `<div id="${id}" class="clip cena-topo" ${attrs(c)}><div class="topo-centro${mais}">`;
  add(`tl.from("#${id}-bg", { opacity: 0, duration: 0.2, ease: "none" }, ${c.de});`);
  add(`tl.from("#${id}-z", { scale: 0.92, duration: 0.35, ease: "power3.out" }, ${c.de});`);
  return `<div id="${id}" class="clip cena-cheia" ${attrs(c)}><div class="cheia-fundo void" id="${id}-bg"></div><div class="cheia-centro"><div class="cheia-zoom${mais}" id="${id}-z">`;
}
const fechar = (c) => (cheia(c) ? "</div></div></div>" : "</div></div>");
const semSom = (c) => c.sons === false;
const somCena = (c, nome, t, vol) => {
  if (!semSom(c)) som(nome, t, vol);
};
const entrada = (sel, t, ease = "power3.out") => add(`tl.from(${js(sel)}, { y: -50, opacity: 0, duration: 0.34, ease: "${ease}" }, ${r3(t)});`);
function logoImg(arq, onde, classe = "logo-img") {
  if (!arq || !arquivoOk(arq, onde)) return "";
  return `<img class="${classe}" src="${esc(arq)}" alt="" />`;
}
function encaixe(r, iw, ih, cw, ch) {
  // mostra o retângulo r (0–1 na imagem) inteiro e centralizado na caixa cw×ch
  const rw = clamp(r.w ?? 1, 0.02, 1) * iw;
  const rh = clamp(r.h ?? 1, 0.02, 1) * ih;
  const s = Math.min(cw / rw, ch / rh);
  let x = cw / 2 - s * ((r.x ?? 0) * iw + rw / 2);
  let y = ch / 2 - s * ((r.y ?? 0) * ih + rh / 2);
  x = iw * s >= cw ? clamp(x, cw - iw * s, 0) : (cw - iw * s) / 2;
  y = ih * s >= ch ? clamp(y, ch - ih * s, 0) : (ch - ih * s) / 2;
  return { s: r3(s), x: r3(x), y: r3(y) };
}
const deriva = (e, cw, ch, k) => ({ s: r3(e.s * k), x: r3(cw / 2 - (cw / 2 - e.x) * k), y: r3(ch / 2 - (ch / 2 - e.y) * k) });

function cenaMidia(c, id) {
  let m;
  if (c.tipo === "print") {
    if (!arquivoOk(c.arquivo, `cena ${c.i} (print)`)) return;
    m = { tipo: "imagem", arquivo: c.arquivo };
  } else {
    m = materiais[c.material];
    if (!m) return avisar(`cena ${c.i}: material "${c.material}" não existe (veja dados/materiais.json)`);
    if (!m.arquivo) return avisar(`cena ${c.i}: o material ${c.material} não tem arquivo (${m.erro ?? "falhou na preparação"})`);
    if (!arquivoOk(m.arquivo, `cena ${c.i}`)) return;
  }
  const dim = m.largura && m.altura ? { w: m.largura, h: m.altura } : dimensoes(m.arquivo);
  if (!dim) return avisar(`cena ${c.i}: não consegui ler o tamanho de ${m.arquivo}`);
  const iw = dim.w;
  const ih = dim.h;
  const bar = c.url ? BARRA : 0;
  // moldura: na faixa de cima é fixa (~16:9); na tela cheia cresce no formato do que vai aparecer
  // (gravação de celular 9:16 fica quase inteira; print de computador fica largo)
  let M = MOLD;
  if (cheia(c)) {
    const r = c.foco ?? c.foco_inicial ?? { x: 0, y: 0, w: 1, h: 1 };
    const prop = ((r.h ?? 1) * ih) / ((r.w ?? 1) * iw);
    const h = Math.round(clamp(976 * prop + 4 + bar, 520, 1240));
    M = { x: 50, y: Math.round(210 + (1240 - h) / 2), w: 980, h };
  }
  const classe = cheia(c) ? "cena-cheia" : "cena-topo";
  const fundo = cheia(c) ? `<div class="cheia-fundo void" id="${id}-bg"></div>` : "";
  if (cheia(c)) add(`tl.from("#${id}-bg", { opacity: 0, duration: 0.2, ease: "none" }, ${c.de});`);
  const cw = M.w - 4;
  const ch = M.h - 4 - bar;
  const e0 = encaixe(c.foco_inicial ?? { x: 0, y: 0, w: 1, h: 1 }, iw, ih, cw, ch);
  const e1 = c.foco ? encaixe(c.foco, iw, ih, cw, ch) : e0;
  const dur = c.ate - c.de;
  const dFoco = r3(Math.min(1.1, dur * 0.4));
  const tFoco = r3(c.de + 0.45);
  const janela = c.url ? `<div class="janela"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span class="url">${esc(c.url)}</span></div>` : "";
  const rot = c.rotulo ? `<div class="chip-rotulo" id="${id}-rot" style="right:${W - M.x - M.w + 24}px;top:${M.y - 24}px">${esc(c.rotulo)}</div>` : "";
  const d = c.destaque;
  const caixa = d ? { l: r3(e1.x + e1.s * d.x * iw), t: r3(e1.y + e1.s * d.y * ih), w: r3(e1.s * d.w * iw), h: r3(e1.s * d.h * ih) } : null;
  const moldStyle = `left:${M.x}px;top:${M.y}px;width:${M.w}px;height:${M.h}px`;
  if (m.tipo === "video") {
    // <video> não pode ficar dentro de elemento com tempo: moldura, vídeo e sobreposição são irmãos
    const ax = M.x + 2;
    const ay = M.y + 2 + bar;
    const box = caixa ? `<div class="destaque-box" id="${id}-box" style="left:${r3(ax + caixa.l)}px;top:${r3(ay + caixa.t)}px;width:${caixa.w}px;height:${caixa.h}px"></div>` : "";
    cenasHtml.push(
      `      <div id="${id}" class="clip ${classe}" ${attrs(c)}>${fundo}<div class="mold" id="${id}-in" style="${moldStyle}">${janela}</div></div>`,
      `      <div class="topo-video${bar ? " com-barra" : ""}${cheia(c) ? " cheia" : ""}" id="${id}-vw" style="left:${ax}px;top:${ay}px;width:${cw}px;height:${ch}px"><div class="midia-in" id="${id}-m" style="width:${iw}px;height:${ih}px"><video id="${id}-v" class="clip" ${attrs(c)} data-media-start="${r3(Number(c.inicio ?? 0))}" src="${esc(m.arquivo)}" muted playsinline style="width:${iw}px;height:${ih}px"></video></div></div>`,
      `      <div id="${id}-ov" class="clip topo-over${cheia(c) ? " cheia" : ""}" ${attrs(c)}><div class="topo-over-in" id="${id}-ovi">${box}${rot}</div></div>`,
    );
    entrada([`#${id}-in`, `#${id}-ovi`], c.de + 0.04);
    add(`tl.fromTo("#${id}-vw", { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.34, ease: "power3.out" }, ${r3(c.de + 0.04)});`);
    add(`tl.set("#${id}-vw", { opacity: 0 }, ${c.ate});`);
  } else {
    const box = caixa ? `<div class="destaque-box" id="${id}-box" style="left:${caixa.l}px;top:${caixa.t}px;width:${caixa.w}px;height:${caixa.h}px"></div>` : "";
    cenasHtml.push(
      `      <div id="${id}" class="clip ${classe}" ${attrs(c)}>${fundo}<div class="mold" id="${id}-in" style="${moldStyle}">${janela}<div class="mold-midia" style="top:${bar}px;width:${cw}px;height:${ch}px"><div class="midia-in" id="${id}-m" style="width:${iw}px;height:${ih}px"><img src="${esc(m.arquivo)}" alt="" style="width:${iw}px;height:${ih}px" /></div>${box}</div></div>${rot}</div>`,
    );
    entrada(`#${id}-in`, c.de + 0.04);
  }
  add(`tl.set("#${id}-m", { x: ${e0.x}, y: ${e0.y}, scale: ${e0.s} }, ${c.de});`);
  let fim = e0;
  if (c.foco && dur > 1) {
    add(`tl.to("#${id}-m", { x: ${e1.x}, y: ${e1.y}, scale: ${e1.s}, duration: ${dFoco}, ease: "power2.inOut" }, ${tFoco});`);
    fim = e1;
    somCena(c, "whoosh", tFoco, 0.6);
  }
  if (!caixa && dur > 2) {
    const tD = r3(c.foco ? tFoco + dFoco : c.de + 0.4);
    const e2 = deriva(fim, cw, ch, 1.04);
    add(`tl.to("#${id}-m", { x: ${e2.x}, y: ${e2.y}, scale: ${e2.s}, duration: ${r3(c.ate - tD)}, ease: "none" }, ${tD});`);
  }
  if (c.rotulo) add(`tl.from("#${id}-rot", { y: 16, opacity: 0, duration: 0.26, ease: "back.out(2)" }, ${r3(c.de + 0.28)});`);
  if (caixa) {
    const tb = r3(c.foco ? tFoco + dFoco + 0.05 : c.de + 0.5);
    add(`tl.from("#${id}-box", { scale: 1.25, opacity: 0, duration: 0.26, ease: "back.out(2)" }, ${tb});`);
    somCena(c, "click", tb);
  }
}

function cenaLogos(c, id) {
  const itens = (c.logos ?? []).map((l) => (typeof l === "string" ? { arquivo: l } : l));
  const op = c.ligacao ? `<span class="logo-op">${esc(c.ligacao)}</span>` : "";
  const tiles = itens
    .map((l, k) => `<div class="logo-tile" id="${id}-l${k}"><div class="logo-caixa${l.fundo === "escuro" ? " escuro" : ""}">${logoImg(l.arquivo, `cena ${c.i}`)}</div>${l.nome ? `<span class="logo-nome">${esc(l.nome)}</span>` : ""}</div>`)
    .join(op);
  const titulo = c.titulo ? `<div class="cena-titulo" id="${id}-t">${esc(c.titulo)}</div>` : "";
  cenasHtml.push(`      ${abrir(c, id)}${titulo}<div class="logos">${tiles}</div>${fechar(c)}`);
  if (c.titulo) add(`tl.from("#${id}-t", { y: -30, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.05)});`);
  itens.forEach((_, k) => {
    const t = r3(c.de + 0.16 + k * 0.16);
    add(`tl.from("#${id}-l${k}", { scale: 0.3, opacity: 0, duration: 0.36, ease: "back.out(2.2)" }, ${t});`);
    if (k < 4) somCena(c, "pop", t);
  });
}

function cenaFluxo(c, id) {
  const nos = c.nos ?? [];
  const eixo = cheia(c) ? "scaleY" : "scaleX"; // na tela cheia o fluxo desce
  const partes = nos.map((n, k) => {
    const no = `<div class="card no" id="${id}-n${k}"><div class="logo-caixa pequena${n.fundo === "escuro" ? " escuro" : ""}">${logoImg(n.logo, `cena ${c.i}`)}</div><span>${esc(n.nome ?? "")}</span></div>`;
    return k < nos.length - 1 ? `${no}<div class="liga"><div class="liga-linha" id="${id}-k${k}"></div></div>` : no;
  });
  const titulo = c.titulo ? `<div class="cena-titulo" id="${id}-t">${esc(c.titulo)}</div>` : "";
  const rodape = c.rotulo ? `<div class="chip-ouro" id="${id}-r">${esc(c.rotulo)}</div>` : "";
  cenasHtml.push(`      ${abrir(c, id)}${titulo}<div class="fluxo">${partes.join("")}</div>${rodape}${fechar(c)}`);
  if (c.titulo) add(`tl.from("#${id}-t", { y: -30, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.05)});`);
  const passo = clamp((c.ate - c.de - 1) / Math.max(1, nos.length), 0.3, 0.6);
  nos.forEach((_, k) => {
    const t = r3(c.de + 0.2 + k * passo);
    add(`tl.from("#${id}-n${k}", { scale: 0.4, opacity: 0, duration: 0.34, ease: "back.out(2)" }, ${t});`);
    somCena(c, "pop", t);
    if (k > 0) add(`tl.fromTo("#${id}-k${k - 1}", { ${eixo}: 0 }, { ${eixo}: 1, duration: ${r3(passo * 0.8)}, ease: "power2.inOut" }, ${r3(t - passo * 0.85)});`);
  });
  if (c.rotulo) {
    const t = r3(c.de + 0.3 + nos.length * passo);
    add(`tl.from("#${id}-r", { y: 20, opacity: 0, duration: 0.3, ease: "back.out(2)" }, ${t});`);
    somCena(c, "ding-curto", t);
  }
}

function cenaComparacao(c, id) {
  // o valor cabe numa linha: fonte menor quando o texto é comprido ("R$ 3.000")
  const maiorValor = Math.max(String(c.antes?.valor ?? "").length, String(c.depois?.valor ?? "").length, 1);
  const tamValor = Math.round(clamp(390 / (maiorValor * 0.56), 56, 104));
  const lado = (x, qual) =>
    `<div class="card lado ${qual}" id="${id}-${qual}">${x?.logo ? `<div class="logo-caixa pequena${x.fundo === "escuro" ? " escuro" : ""}">${logoImg(x.logo, `cena ${c.i}`)}</div>` : ""}<div class="rotulo">${esc(x?.rotulo ?? "")}</div><div class="valor" style="font-size:${tamValor}px"><span>${esc(x?.valor ?? "")}</span>${qual === "antes" ? `<i class="risco" id="${id}-risco"></i>` : ""}</div>${x?.detalhe ? `<div class="detalhe">${esc(x.detalhe)}</div>` : ""}</div>`;
  const titulo = c.titulo ? `<div class="cena-titulo" id="${id}-t">${esc(c.titulo)}</div>` : "";
  cenasHtml.push(`      ${abrir(c, id)}${titulo}<div class="compara">${lado(c.antes, "antes")}<div class="vs" id="${id}-vs">${cheia(c) ? "↓" : "→"}</div>${lado(c.depois, "depois")}</div>${fechar(c)}`);
  if (c.titulo) add(`tl.from("#${id}-t", { y: -30, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.05)});`);
  const meio = c.de + clamp((c.ate - c.de) * 0.35, 0.6, 1.4);
  add(`tl.from("#${id}-antes", { x: -80, opacity: 0, duration: 0.36, ease: "power3.out" }, ${r3(c.de + 0.12)});`);
  add(`tl.fromTo("#${id}-risco", { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power2.inOut" }, ${r3(meio - 0.3)});`);
  somCena(c, "click", meio - 0.3);
  add(`tl.from("#${id}-vs", { scale: 0, opacity: 0, duration: 0.25, ease: "back.out(2)" }, ${r3(meio)});`);
  add(`tl.from("#${id}-depois", { scale: 0.5, opacity: 0, duration: 0.4, ease: "back.out(2.2)" }, ${r3(meio + 0.1)});`);
  somCena(c, "ding", meio + 0.1, 0.8);
}

function cenaContador(c, id) {
  const cor = { verde: "#7dff3d", vermelho: "#ff4d5e", dourado: "#ffc93c", branco: "#f5f4f0" }[c.cor ?? "dourado"] ?? "#ffc93c";
  const casas = Number(c.casas ?? 0);
  const fmt = (v) => `${c.prefixo ?? ""}${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}${c.sufixo ?? ""}`;
  const logo = c.logo ? `<div class="logo-caixa mini${c.fundo === "escuro" ? " escuro" : ""}">${logoImg(c.logo, `cena ${c.i}`)}</div>` : "";
  cenasHtml.push(
    `      ${abrir(c, id)}<div class="card contador" id="${id}-in"><div class="contador-topo">${logo}<span class="rotulo">${esc(c.rotulo ?? "")}</span></div><div class="num" id="${id}-n">${esc(fmt(c.de_valor ?? 0))}</div>${c.barra ? `<div class="xp"><div id="${id}-xp"></div></div>` : ""}${c.detalhe ? `<div class="detalhe">${esc(c.detalhe)}</div>` : ""}</div>${fechar(c)}`,
  );
  const t0 = r3(c.de + 0.3);
  const dt = r3(clamp((c.ate - c.de) * 0.55, 0.6, 1.6));
  entrada(`#${id}-in`, c.de + 0.04);
  add(`(() => { const o = { v: ${Number(c.de_valor ?? 0)} }; const el = document.getElementById("${id}-n"); tl.to(o, { v: ${Number(c.para_valor ?? 0)}, duration: ${dt}, ease: "power2.out", onUpdate: () => (el.textContent = ${js(c.prefixo ?? "")} + o.v.toLocaleString("pt-BR", { minimumFractionDigits: ${casas}, maximumFractionDigits: ${casas} }) + ${js(c.sufixo ?? "")}) }, ${t0}); })();`);
  add(`tl.set("#${id}-n", { color: "${cor}" }, ${r3(t0 + dt)});`);
  add(`tl.fromTo("#${id}-n", { scale: 1.18 }, { scale: 1, duration: 0.26, ease: "back.out(2)", immediateRender: false }, ${r3(t0 + dt)});`);
  if (c.barra) add(`tl.fromTo("#${id}-xp", { scaleX: 0 }, { scaleX: ${clamp(Number(c.barra) || 0.85, 0.05, 1)}, duration: ${dt}, ease: "power2.out" }, ${t0});`);
  for (let k = 0; k < 4; k++) somCena(c, "tecla", t0 + k * (dt / 4), 0.6);
  somCena(c, "ding", t0 + dt, 0.8);
}

function corDe(txt) {
  const cores = ["#e1306c", "#833ab4", "#fd1d1d", "#f77737", "#405de6", "#5851db", "#c13584", "#fcaf45", "#25d366", "#128c7e"];
  let h = 0;
  for (const ch of String(txt)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return cores[h % cores.length];
}

function cenaChat(c, id) {
  const app = c.app === "whatsapp" ? "whatsapp" : "instagram";
  const msgs = c.mensagens ?? [];
  const avatar = c.avatar === "perfil" ? avatarPerfil() : `<span class="av letra" style="background:${corDe(c.nome ?? "?")}">${esc((c.nome ?? "?").slice(0, 1).toUpperCase())}</span>`;
  const bolhas = msgs.map((m, k) => `<div class="bolha ${m.lado === "eu" ? "eu" : "ela"}" id="${id}-b${k}">${esc(m.texto)}</div>`).join("");
  const logo = c.logo ? `<span class="chat-logo">${logoImg(c.logo, `cena ${c.i}`)}</span>` : "";
  cenasHtml.push(
    `      ${abrir(c, id)}<div class="card chat ${app}" id="${id}-in"><div class="chat-topo">${avatar}<div class="chat-nome"><b>${esc(c.nome ?? "")}</b><span>${esc(c.status ?? (app === "whatsapp" ? "online" : "Ativo(a) agora"))}</span></div>${logo}</div><div class="chat-corpo">${bolhas}</div></div>${fechar(c)}`,
  );
  entrada(`#${id}-in`, c.de + 0.04);
  const passo = clamp((c.ate - c.de - 0.7) / Math.max(1, msgs.length), 0.3, 0.8);
  msgs.forEach((m, k) => {
    const t = r3(c.de + 0.4 + k * passo);
    add(`tl.from("#${id}-b${k}", { x: ${m.lado === "eu" ? 60 : -60}, opacity: 0, duration: 0.28, ease: "back.out(1.7)" }, ${t});`);
    somCena(c, "pop", t, 0.8);
  });
}

function cenaComentarios(c, id) {
  const itens = c.itens ?? [];
  const lis = itens
    .map((it, k) => `<div class="coment" id="${id}-c${k}"><span class="av letra" style="background:${corDe(it.usuario)}">${esc(String(it.usuario ?? "?").slice(0, 1).toUpperCase())}</span><div class="coment-txt"><div><b>${esc(it.usuario)}</b> ${esc(it.texto)}</div><span class="coment-meta">${esc(it.tempo ?? "agora")} · Responder</span></div><span class="coracao">♡</span></div>`)
    .join("");
  const resp = c.resposta ? `<div class="coment resposta" id="${id}-resp">${avatarPerfil()}<div class="coment-txt"><div><b>${esc(c.usuario ?? (arroba || perfil.nome || "voce"))}</b> ${esc(c.resposta)}</div><span class="coment-meta">agora · Responder</span></div></div>` : "";
  const topo = `<div class="coments-topo"><span>Comentários</span>${c.logo ? logoImg(c.logo, `cena ${c.i}`, "coments-logo") : ""}</div>`;
  cenasHtml.push(`      ${abrir(c, id)}<div class="card coments" id="${id}-in">${topo}${lis}${resp}</div>${fechar(c)}`);
  entrada(`#${id}-in`, c.de + 0.04);
  const n = itens.length + (c.resposta ? 1 : 0);
  const passo = clamp((c.ate - c.de - 0.7) / Math.max(1, n), 0.22, 0.6);
  itens.forEach((_, k) => {
    const t = r3(c.de + 0.35 + k * passo);
    add(`tl.from("#${id}-c${k}", { x: -50, opacity: 0, duration: 0.28, ease: "power3.out" }, ${t});`);
    if (k < 5) somCena(c, "pop", t, 0.7);
  });
  if (c.resposta) {
    const t = r3(c.de + 0.35 + itens.length * passo);
    add(`tl.from("#${id}-resp", { x: 50, opacity: 0, duration: 0.3, ease: "back.out(1.7)" }, ${t});`);
    somCena(c, "ding-curto", t, 0.8);
  }
}

function cenaNotificacao(c, id) {
  const itens = c.itens ?? [];
  const cards = itens
    .map(
      (n, k) =>
        `<div class="notif" id="${id}-n${k}"><div class="notif-icone${n.fundo === "escuro" ? " escuro" : ""}">${n.logo ? logoImg(n.logo, `cena ${c.i}`) : ""}</div><div class="notif-txt"><div class="notif-cab"><span>${esc(n.app ?? "")}</span><span>${esc(n.hora ?? "agora")}</span></div><b>${esc(n.titulo ?? "")}</b><span class="notif-corpo">${esc(n.texto ?? "")}</span></div></div>`,
    )
    .join("");
  cenasHtml.push(`      ${abrir(c, id, "notifs")}${cards}${fechar(c)}`);
  const passo = clamp((c.ate - c.de - 0.6) / Math.max(1, itens.length), 0.25, 0.7);
  itens.forEach((_, k) => {
    const t = r3(c.de + 0.12 + k * passo);
    add(`tl.from("#${id}-n${k}", { y: -90, opacity: 0, scale: 0.94, duration: 0.36, ease: "back.out(1.6)" }, ${t});`);
    somCena(c, k === 0 ? "notificacao" : "pop", t, k === 0 ? 1 : 0.7);
  });
}

function cenaLista(c, id) {
  const itens = c.itens ?? [];
  const lis = itens.map((it, k) => `<div class="item" id="${id}-i${k}"><span class="marca">${c.numerar === false ? "✓" : k + 1}</span><span>${esc(it)}</span></div>`).join("");
  const logo = c.logo ? `<div class="logo-caixa mini${c.fundo === "escuro" ? " escuro" : ""}">${logoImg(c.logo, `cena ${c.i}`)}</div>` : "";
  cenasHtml.push(`      ${abrir(c, id)}<div class="card lista" id="${id}-in">${c.titulo ? `<div class="lista-titulo">${logo}<span>${esc(c.titulo)}</span></div>` : ""}${lis}</div>${fechar(c)}`);
  add(`tl.from("#${id}-in", { y: -50, rotation: -2, opacity: 0, duration: 0.36, ease: "power3.out" }, ${r3(c.de + 0.04)});`);
  const passo = clamp((c.ate - c.de - 0.7) / Math.max(1, itens.length), 0.25, 0.6);
  itens.forEach((_, k) => {
    const t = r3(c.de + 0.42 + k * passo);
    add(`tl.from("#${id}-i${k}", { x: -40, opacity: 0, duration: 0.26, ease: "back.out(1.8)" }, ${t});`);
    somCena(c, "pop", t, 0.8);
  });
}

function cenaTerminal(c, id) {
  const linhas = c.linhas ?? [];
  const ls = linhas.map((l, k) => `<div class="t-linha${/^[✓✔]/.test(l) ? " ok" : /^[>$]/.test(l) ? " cmd" : ""}" id="${id}-t${k}">${esc(l)}</div>`).join("");
  const logo = c.logo ? logoImg(c.logo, `cena ${c.i}`, "t-logo") : "";
  cenasHtml.push(
    `      ${abrir(c, id)}<div class="card terminal" id="${id}-in"><div class="janela-barra"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>${logo}${c.titulo ? `<span class="rotulo">${esc(c.titulo)}</span>` : ""}</div><div class="t-corpo">${ls}</div></div>${fechar(c)}`,
  );
  entrada(`#${id}-in`, c.de + 0.04);
  let t = c.de + 0.4;
  const total = c.ate - c.de - 0.6;
  const pesos = linhas.map((l) => Math.max(6, l.length));
  const soma = pesos.reduce((x, y) => x + y, 0) || 1;
  linhas.forEach((l, k) => {
    const d = r3(clamp((total * pesos[k]) / soma - 0.05, 0.15, 1.3));
    const ok = /^[✓✔]/.test(l);
    if (ok) add(`tl.from("#${id}-t${k}", { x: -20, opacity: 0, duration: 0.2, ease: "power2.out" }, ${r3(t)});`);
    else add(`tl.fromTo("#${id}-t${k}", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: ${d}, ease: "steps(${Math.max(4, Math.min(40, l.length))})" }, ${r3(t)});`);
    somCena(c, ok ? "pop" : "teclado", t, ok ? 0.8 : 0.7);
    t += (ok ? 0.25 : d) + 0.05;
  });
}

function cenaPalavra(c, id) {
  const linhas = Array.isArray(c.texto) ? c.texto : String(c.texto ?? "").split("|").map((s) => s.trim()).filter(Boolean);
  const maior = Math.max(...linhas.map((l) => l.length), 1);
  const tam = Math.round(clamp(960 / (maior * 0.6), 90, 210));
  const ls = linhas.map((l, k) => `<div class="palavra-linha${(c.ouro ?? [1]).includes(k) ? " ouro" : ""}" id="${id}-p${k}" style="font-size:${tam}px">${esc(l)}</div>`).join("");
  cenasHtml.push(`      <div id="${id}" class="clip tela-cheia" ${attrs(c)}><div class="tela-cheia-in void" id="${id}-in">${ls}</div></div>`);
  add(`tl.from("#${id}-in", { opacity: 0, duration: 0.08, ease: "none" }, ${c.de});`);
  linhas.forEach((_, k) => add(`tl.from("#${id}-p${k}", { scale: 1.6, opacity: 0, duration: 0.24, ease: "power4.out" }, ${r3(c.de + 0.04 + k * 0.14)});`));
  somCena(c, c.som ?? "impacto", c.de, 1);
}

function cenaCta(c, id) {
  const palavra = String(c.palavra ?? "").toUpperCase();
  const frase = c.frase ?? "comenta";
  // card do perfil: @ e foto do criador (dados/perfil.json); o plano pode trocar com "usuario" e "bio"
  const usuario = String(c.usuario ?? arroba).replace(/^@+/, "").trim();
  const nome = usuario ? `@${usuario}` : (perfil.nome ?? "");
  const bio = curto(c.bio ?? perfil.nicho ?? "", 60);
  cenasHtml.push(
    `      <div id="${id}" class="clip cta" ${attrs(c)}><div class="card cta-coment" id="${id}-c">${avatarPerfil()}<span class="cta-txt" id="${id}-tx">${esc(frase)} <b>${esc(palavra)}</b></span></div><div class="card cta-perfil" id="${id}-p">${avatarPerfil("grande")}<div class="cta-nome">${nome ? `<b>${esc(nome)}</b>` : ""}${bio ? `<span>${esc(bio)}</span>` : ""}</div><span class="seguir" id="${id}-s">Seguir</span></div></div>`,
  );
  const t0 = r3(c.de + 0.1);
  add(`tl.from("#${id}-c", { y: -80, opacity: 0, duration: 0.32, ease: "back.out(1.6)" }, ${t0});`);
  add(`tl.fromTo("#${id}-tx", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "steps(${Math.max(8, frase.length + palavra.length + 1)})" }, ${r3(t0 + 0.3)});`);
  somCena(c, "teclado", t0 + 0.3, 1);
  const tp = r3(Math.max(t0 + 0.3, Math.min(c.ate - 0.7, t0 + 0.9)));
  add(`tl.from("#${id}-p", { y: 160, opacity: 0, duration: 0.42, ease: "power3.out" }, ${tp});`);
  add(`tl.fromTo("#${id}-s", { scale: 1 }, { scale: 1.12, duration: 0.25, ease: "power2.inOut", yoyo: true, repeat: 3, immediateRender: false }, ${r3(tp + 0.45)});`);
  somCena(c, "pop", tp, 0.8);
}

function cenaTitulo(c, id) {
  const cor = ["verde", "vermelho", "branco"].includes(c.cor) ? c.cor : "";
  const tr = trechoEm(c.de + 0.01);
  const y = Number.isFinite(Number(c.y)) ? Number(c.y) : c.posicao === "topo" ? 150 : tr.modo === "dividida" ? PAINEL + 130 : clamp(tr.legY - 135, 150, 1500);
  cenasHtml.push(`      <div id="${id}" class="clip titulo-linha" ${attrs(c)} style="top:${y}px"><div class="chip-titulo ${cor}" id="${id}-t">${esc(c.texto)}</div></div>`);
  add(`tl.from("#${id}-t", { scale: 0.4, rotation: -6, opacity: 0, duration: 0.3, ease: "back.out(2.4)" }, ${c.de});`);
  if (c.som !== "nenhum") somCena(c, c.som ?? "ding", c.de, 1);
}

function cenaLivre(c) {
  if (!arquivoOk(c.arquivo, `cena ${c.i} (livre)`)) return;
  const conteudo = fs.readFileSync(c.arquivo, "utf8");
  const compId = conteudo.match(/data-composition-id="([^"]+)"/)?.[1];
  if (!compId) return avisar(`cena ${c.i}: ${c.arquivo} não tem data-composition-id`);
  cenasHtml.push(`      <div id="${compId}-host" class="clip livre${c.area === "tela-cheia" ? " livre-cheia" : ""}" data-composition-id="${esc(compId)}" data-composition-src="${esc(c.arquivo)}" ${attrs(c)} data-width="${W}" data-height="${H}"></div>`);
}

const COMPONENTES = { material: cenaMidia, print: cenaMidia, logos: cenaLogos, fluxo: cenaFluxo, comparacao: cenaComparacao, contador: cenaContador, chat: cenaChat, comentarios: cenaComentarios, notificacao: cenaNotificacao, lista: cenaLista, terminal: cenaTerminal, palavra: cenaPalavra, cta: cenaCta, titulo: cenaTitulo, livre: cenaLivre };
// quanto cabe na faixa de cima sem vazar
const LIMITES = { lista: ["itens", 5], comentarios: ["itens", 4], chat: ["mensagens", 4], terminal: ["linhas", 6], notificacao: ["itens", 3], logos: ["logos", 4], fluxo: ["nos", 4] };
for (const c of cenas) {
  const f = COMPONENTES[c.tipo];
  if (!f) {
    avisar(`cena ${c.i}: tipo desconhecido "${c.tipo}"`);
    continue;
  }
  const lim = LIMITES[c.tipo];
  if (lim && (c[lim[0]]?.length ?? 0) > lim[1]) avisar(`cena ${c.i} (${c.tipo}): ${c[lim[0]].length} ${lim[0]}, o máximo que cabe é ${lim[1]}`);
  if (c.tipo === "cta" && cenas.some((o) => ehTopo(o) && o.de < c.ate && o.ate > c.de)) avisar(`cena ${c.i} (cta) está junto de uma cena da faixa de cima: o comentário do CTA fica por cima dela`);
  f(c, `c${c.i}`);
}

// ── padrão 2x1: a cada 2 motions na faixa de cima, 1 em tela cheia ──
const sequencia = [];
let seguidas = 0;
for (const c of cenas) {
  if (ehTopo(c)) {
    sequencia.push(`faixa(${c.i})`);
    if (++seguidas === 3) avisar(`padrão 2x1: a cena ${c.i} é a 3ª seguida na faixa de cima; ponha uma das 3 em tela cheia ("area": "tela-cheia")`);
  } else if (ehCheia(c) && c.tipo !== "palavra") {
    sequencia.push(`CHEIA(${c.i})`);
    seguidas = 0;
  }
}

// ── sons do plano (ding em dica, riser antes de corte/suspense, whoosh de vez em quando…) ──
for (const s of plano.sons ?? []) {
  const nome = resolverSom(s.som) ?? s.som;
  // "ate" = o som TERMINA nesse instante (riser que acaba na revelação); "t" = começa nele
  if (s.ate !== undefined && SONS[nome]) som(nome, Number(s.ate) - SONS[nome][1], s.volume);
  else som(nome, Number(s.t), s.volume);
}

// ── HTML final ─────────────────────────────────────────────────────
sons.sort((a, b) => a.t - b.t);
const audioHtml = sons.map((s, k) => `      <audio id="sfx${k}" data-start="${s.t}" data-duration="${s.dur}" data-track-index="${faixaSom(s.t, s.t + s.dur)}" src="assets/sons/${s.arquivo}" data-volume="${s.volume}"></audio>`).join("\n");
const css = fs.readFileSync(path.join(KIT, "estilo.css"), "utf8");
// GSAP: a cópia que a estação pôs na oficina (funciona sem internet); sem ela, a da CDN
const GSAP = fs.existsSync("assets/gsap.min.js") ? "assets/gsap.min.js" : "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>${esc(plano.titulo ?? "Edição")}</title>
    <script src="${GSAP}"></script>
    <style>
${css}
    </style>
  </head>
  <body class="leg-${estiloLeg}">
    <div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${D}">
      <svg class="filtros" width="0" height="0" aria-hidden="true"><filter id="calor" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence id="calor-turb" type="turbulence" baseFrequency="0.002 0.014" numOctaves="2" seed="7" result="ruido" /><feDisplacementMap id="calor-map" in="SourceGraphic" in2="ruido" scale="0" xChannelSelector="R" yChannelSelector="G" /></filter></svg>
      <div id="v-wrap"><div id="v-rot"><div id="v-inner"><video id="v" class="clip" data-start="0" data-duration="${D}" data-track-index="0" src="assets/video.mp4" muted playsinline></video></div></div></div>
${video.temAudio === false ? "" : `      <audio id="a-voz" data-start="0" data-duration="${D}" data-track-index="1" src="assets/video.mp4" data-volume="1"></audio>\n`}      <div id="painel"><div id="painel-in"></div></div>

${cenasHtml.join("\n")}

      <div id="flash"></div>
      <div id="legendas" class="clip" data-start="0" data-duration="${D}" data-track-index="2">
        <div id="leg-pos">
${legHtml.join("\n")}
        </div>
      </div>

${audioHtml}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
${tl.join("\n")}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
fs.writeFileSync("index.html", html);

// ── resumo pro Claude conferir ─────────────────────────────────────
const fmtT = (t) => t.toFixed(2).padStart(6);
console.log(`index.html pronto · ${D}s · legenda ${estiloLeg} (${grupos.length} grupos) · ${emendas.length} emendas · ${cenas.length} cenas · ${sons.length} sons`);
console.log("\ncâmera:");
for (const tr of trechos) console.log(`  ${fmtT(tr.a)} → ${fmtT(tr.b)}  ${tr.modo.padEnd(8)} escala ${tr.camA.scale}${tr.rot ? ` · inclina ${tr.rot}°` : ""} · legenda y=${tr.legY}`);
console.log("\ncenas:");
for (const c of cenas) console.log(`  ${fmtT(c.de)} → ${fmtT(c.ate)}  ${c.tipo}${c.material ? ` (${c.material})` : ""}${c.rotulo ? ` · ${c.rotulo}` : c.titulo ? ` · ${c.titulo}` : c.texto ? ` · ${[].concat(c.texto).join(" ")}` : ""}`);
console.log(`\nmotions (2x1): ${sequencia.join(" ") || "nenhum"}`);
console.log(`emendas: ${emendas.map((c) => `${c.t.toFixed(2)} ${c.estilo}`).join(" · ") || "nenhuma"}`);
const contagem = {};
for (const s of sons) contagem[s.nome] = (contagem[s.nome] ?? 0) + 1;
console.log(`sons: ${Object.entries(contagem).map(([k, v]) => `${k}×${v}`).join(" · ")}`);
if (problemas.length) {
  console.log(`\n⚠ ${problemas.length} problema(s):`);
  for (const p of problemas) console.log(`  - ${p}`);
  process.exitCode = 2;
}
