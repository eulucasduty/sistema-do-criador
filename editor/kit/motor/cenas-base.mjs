// Os cards de sempre: print e gravação de tela, logos, fluxo, comparação, contador, chat,
// comentários, notificação, lista, terminal, palavra, chip de título, CTA e a cena livre.

import fs from "node:fs";
import { W, H, clamp, corDe, curto, encaixe, esc, js, linhasDe, marcar, r3, semMarca } from "./util.mjs";
import { cssFonte } from "./fontes.mjs";
import { abrir, cheia, entrada, faixaBaixo, fechar, logoImg, registrar, selo, zonaDeCard } from "./cenas.mjs";
import { PAINEL } from "./camera.mjs";

const BARRA = 52; // barra de janela (quando a cena tem url)
const MOLD = { x: 48, y: 122, w: 984, h: 560 }; // moldura de print/gravação dentro da faixa de cima
const MOLD_BAIXO = { x: 48, y: 1080, w: 984, h: 470 }; // …e na faixa de baixo
const titulo = (c, id) => (c.olho ? `<div class="cena-olho" id="${id}-o">${esc(c.olho)}</div>` : "") + (c.titulo ? `<div class="cena-titulo" id="${id}-t">${marcar(c.titulo)}</div>` : "");
const animarTitulo = (M, c, id) => {
  if (c.olho) M.add(`tl.from("#${id}-o", { opacity: 0, duration: 0.25, ease: "none" }, ${r3(c.de + 0.03)});`);
  if (c.titulo) M.add(`tl.from("#${id}-t", { y: -30, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.05)});`);
};
const rotuloCena = (c, id) => (c.rotulo ? `<div class="rotulo cena-rotulo" id="${id}-rt">${esc(c.rotulo)}</div>` : "");

// ── print (que o editor tirou) e material (que o criador subiu) ──────────────
function cenaMidia(M, c, id) {
  const { add, somCena } = M;
  const m = M.midia(c.tipo === "print" ? { arquivo: c.arquivo } : { material: c.material }, `cena ${c.i} (${c.tipo})`);
  if (!m) return;
  const iw = m.w;
  const ih = m.h;
  const bar = c.url ? BARRA : 0;
  // moldura: na faixa é fixa (~16:9); na tela cheia cresce no formato do que vai aparecer
  // (gravação de celular 9:16 fica quase inteira; print de computador fica largo)
  let Mo = MOLD;
  if (c.zona === "faixa-baixo") {
    const f = faixaBaixo(M);
    Mo = { ...MOLD_BAIXO, y: f.topo + 8, h: f.altura - 20 };
  }
  if (c.regua && c.zona === "faixa") Mo = { ...MOLD, h: 440 };
  // com título (ou olho) em cima, a moldura desce e encolhe
  const comTitulo = c.zona === "faixa" && (c.titulo || c.olho);
  if (comTitulo) Mo = { ...Mo, y: c.olho && c.titulo ? 232 : 196, h: Mo.h - (c.olho && c.titulo ? 110 : 74) };
  const cabeca = comTitulo ? `<div class="mid-cab">${titulo(c, id)}</div>` : "";
  if (cheia(c)) {
    const r = c.foco ?? c.foco_inicial ?? { x: 0, y: 0, w: 1, h: 1 };
    const prop = ((r.h ?? 1) * ih) / ((r.w ?? 1) * iw);
    const h = Math.round(clamp(976 * prop + 4 + bar, 520, 1240));
    Mo = { x: 50, y: Math.round(210 + (1240 - h) / 2), w: 980, h };
    // sangrada: a imagem cobre a tela inteira, sem moldura
    if (c.sangrar) Mo = { x: -2, y: -2, w: W + 4, h: H + 4 };
  }
  const classe = cheia(c) ? `cena-cheia${c.sangrar ? " sangra" : ""}` : `cena-topo${c.zona === "faixa-baixo" ? " baixo-livre" : ""}`;
  const fundo = cheia(c) ? `<div class="cheia-fundo void" id="${id}-bg"></div>` : "";
  if (cheia(c)) add(`tl.from("#${id}-bg", { opacity: 0, duration: 0.2, ease: "none" }, ${c.de});`);
  const cw = Mo.w - 4;
  const ch = Mo.h - 4 - bar;
  // sangrada: cobre a caixa (corta as sobras); na moldura: mostra o recorte inteiro
  const cobre = (r) => {
    const s = Math.max(cw / ((r.w ?? 1) * iw), ch / ((r.h ?? 1) * ih));
    return { s: r3(s), x: r3(cw / 2 - s * ((r.x ?? 0) + (r.w ?? 1) / 2) * iw), y: r3(ch / 2 - s * ((r.y ?? 0) + (r.h ?? 1) / 2) * ih) };
  };
  const cabe = cheia(c) && c.sangrar ? cobre : (r) => encaixe(r, iw, ih, cw, ch);
  const e0 = cabe(c.foco_inicial ?? { x: 0, y: 0, w: 1, h: 1 });
  const e1 = c.foco ? cabe(c.foco) : e0;
  const dur = c.ate - c.de;
  const dFoco = r3(Math.min(1.1, dur * 0.4));
  const tFoco = r3(c.de + 0.45);
  const janela = c.url ? `<div class="janela"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span class="url">${esc(c.url)}</span></div>` : "";
  const rot = c.rotulo ? `<div class="chip-rotulo" id="${id}-rot" style="right:${W - Mo.x - Mo.w + 24}px;top:${Mo.y - 24}px">${esc(c.rotulo)}</div>` : "";
  const d = c.destaque;
  const caixa = d ? { l: r3(e1.x + e1.s * d.x * iw), t: r3(e1.y + e1.s * d.y * ih), w: r3(e1.s * d.w * iw), h: r3(e1.s * d.h * ih) } : null;
  const moldStyle = `left:${Mo.x}px;top:${Mo.y}px;width:${Mo.w}px;height:${Mo.h}px`;
  if (m.tipo === "video") {
    // <video> não pode ficar dentro de elemento com tempo: moldura, vídeo e sobreposição são irmãos
    const ax = Mo.x + 2;
    const ay = Mo.y + 2 + bar;
    const box = caixa ? `<div class="destaque-box" id="${id}-box" style="left:${r3(ax + caixa.l)}px;top:${r3(ay + caixa.t)}px;width:${caixa.w}px;height:${caixa.h}px"></div>` : "";
    M.html.cenas.push(
      `      <div id="${id}" class="clip ${classe}" ${M.attrs(c)}>${fundo}${cabeca}<div class="mold" id="${id}-in" style="${moldStyle}">${janela}</div></div>`,
      `      <div class="topo-video${bar ? " com-barra" : ""}${cheia(c) ? " cheia" : ""}" id="${id}-vw" style="left:${ax}px;top:${ay}px;width:${cw}px;height:${ch}px"><div class="midia-in" id="${id}-m" style="width:${iw}px;height:${ih}px"><video id="${id}-v" class="clip" ${M.attrs(c)} data-media-start="${r3(Number(c.inicio ?? 0))}" src="${esc(m.arquivo)}" muted playsinline style="width:${iw}px;height:${ih}px"></video></div></div>`,
      `      <div id="${id}-ov" class="clip topo-over${cheia(c) ? " cheia" : ""}" ${M.attrs(c)}><div class="topo-over-in" id="${id}-ovi">${box}${rot}</div></div>`,
    );
    entrada(M, [`#${id}-in`, `#${id}-ovi`], c.de + 0.04);
    add(`tl.fromTo("#${id}-vw", { y: -50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.34, ease: "power3.out" }, ${r3(c.de + 0.04)});`);
    add(`tl.set("#${id}-vw", { opacity: 0 }, ${c.ate});`);
  } else {
    const box = caixa ? `<div class="destaque-box" id="${id}-box" style="left:${caixa.l}px;top:${caixa.t}px;width:${caixa.w}px;height:${caixa.h}px"></div>` : "";
    M.html.cenas.push(
      `      <div id="${id}" class="clip ${classe}" ${M.attrs(c)}>${fundo}${cabeca}<div class="mold" id="${id}-in" style="${moldStyle}">${janela}<div class="mold-midia" style="top:${bar}px;width:${cw}px;height:${ch}px"><div class="midia-in" id="${id}-m" style="width:${iw}px;height:${ih}px"><img src="${esc(m.arquivo)}" alt="" style="width:${iw}px;height:${ih}px" /></div>${box}</div></div>${rot}</div>`,
    );
    entrada(M, `#${id}-in`, c.de + 0.04);
  }
  if (c.regua && c.zona === "faixa") {
    // régua de quadros embaixo da imagem: a agulha anda e, no quadro-chave, a imagem ganha cor
    const em = clamp(Number(typeof c.regua === "object" ? c.regua.em : 0.62) || 0.62, 0.1, 0.95);
    const tK = r3(clamp(M.tempoDe(c, c.de + (c.ate - c.de) * 0.45), c.de + 0.5, c.ate - 0.4));
    M.html.cenas.push(`      <div id="${id}-rg" class="clip mid-regua" ${M.attrs(c)} style="left:${Mo.x}px;top:${Mo.y + Mo.h + 34}px;width:${Mo.w}px"><i class="mr-linha"></i><em class="mr-chave" id="${id}-rk" style="left:${r3(em * 100)}%"></em><b class="mr-agulha" id="${id}-ra"></b>${c.chip ? `<span class="mr-chip" id="${id}-rc">${M.icone("crosshair")}${esc(c.chip)}</span>` : ""}</div>`);
    add(`tl.fromTo("#${id}-ra", { x: 0 }, { x: ${r3(em * Mo.w)}, duration: ${r3(tK - c.de - 0.3)}, ease: "none" }, ${r3(c.de + 0.3)});`);
    add(`tl.fromTo("#${id}-rk", { scale: 1, opacity: 0.5 }, { scale: 1.7, opacity: 1, duration: 0.18, ease: "power2.out", immediateRender: false }, ${tK});`);
    add(`tl.fromTo("#${id}-in", { filter: "grayscale(0.85) brightness(1.3) contrast(0.75)" }, { filter: "grayscale(0) brightness(1) contrast(1)", duration: 0.22, ease: "power2.out" }, ${tK});`);
    if (c.chip) add(`tl.from("#${id}-rc", { y: 14, scale: 0.7, opacity: 0, duration: 0.28, ease: "back.out(2)" }, ${r3(tK + 0.08)});`);
    somCena(c, "ding-curto", tK, 0.8);
  }
  if (comTitulo) animarTitulo(M, c, id);
  add(`tl.set("#${id}-m", { x: ${e0.x}, y: ${e0.y}, scale: ${e0.s} }, ${c.de});`);
  let fim = e0;
  if (c.foco && dur > 1) {
    add(`tl.to("#${id}-m", { x: ${e1.x}, y: ${e1.y}, scale: ${e1.s}, duration: ${dFoco}, ease: "power2.inOut" }, ${tFoco});`);
    fim = e1;
    somCena(c, "whoosh", tFoco, 0.6);
  }
  if (!caixa && dur > 2) {
    const tD = r3(c.foco ? tFoco + dFoco : c.de + 0.4);
    const k = 1.04;
    const e2 = { s: r3(fim.s * k), x: r3(cw / 2 - (cw / 2 - fim.x) * k), y: r3(ch / 2 - (ch / 2 - fim.y) * k) };
    add(`tl.to("#${id}-m", { x: ${e2.x}, y: ${e2.y}, scale: ${e2.s}, duration: ${r3(c.ate - tD)}, ease: "none" }, ${tD});`);
  }
  if (c.rotulo) add(`tl.from("#${id}-rot", { y: 16, opacity: 0, duration: 0.26, ease: "back.out(2)" }, ${r3(c.de + 0.28)});`);
  if (caixa) {
    const tb = r3(c.foco ? tFoco + dFoco + 0.05 : c.de + 0.5);
    add(`tl.from("#${id}-box", { scale: 1.25, opacity: 0, duration: 0.26, ease: "back.out(2)" }, ${tb});`);
    somCena(c, "click", tb);
  }
}
registrar("material", { zona: zonaDeCard, montar: cenaMidia });
registrar("print", { zona: zonaDeCard, montar: cenaMidia });

// ── logos ────────────────────────────────────────────────────────────────────
registrar("logos", {
  zona: zonaDeCard,
  limite: { faixa: ["logos", 4], "faixa-baixo": ["logos", 4] },
  montar(M, c, id) {
    const itens = (c.logos ?? []).map((l) => (typeof l === "string" ? { arquivo: l } : l));
    const op = c.ligacao ? `<span class="logo-op">${esc(c.ligacao)}</span>` : "";
    const tiles = itens
      .map((l, k) => `<div class="logo-tile" id="${id}-l${k}"><div class="logo-caixa${l.fundo === "escuro" ? " escuro" : ""}">${logoImg(M, l.arquivo, `cena ${c.i}`)}</div>${l.nome ? `<span class="logo-nome">${esc(l.nome)}</span>` : ""}</div>`)
      .join(op);
    M.html.cenas.push(`      ${abrir(M, c, id)}${rotuloCena(c, id)}${titulo(c, id)}<div class="logos">${tiles}</div>${fechar(c)}`);
    animarTitulo(M, c, id);
    itens.forEach((_, k) => {
      const t = r3(c.de + 0.16 + k * 0.16);
      M.add(`tl.from("#${id}-l${k}", { scale: 0.3, opacity: 0, duration: 0.36, ease: "back.out(2.2)" }, ${t});`);
      if (k < 4) M.somCena(c, "pop", t);
    });
  },
});

// ── fluxo A → B → C ──────────────────────────────────────────────────────────
registrar("fluxo", {
  zona: zonaDeCard,
  limite: { faixa: ["nos", 4], "faixa-baixo": ["nos", 3] },
  montar(M, c, id) {
    const nos = c.nos ?? [];
    const eixo = cheia(c) ? "scaleY" : "scaleX"; // na tela cheia o fluxo desce
    const partes = nos.map((n, k) => {
      const marca = n.logo ? `<div class="logo-caixa pequena${n.fundo === "escuro" ? " escuro" : ""}">${logoImg(M, n.logo, `cena ${c.i}`)}</div>` : n.icone ? `<div class="icone-caixa pequena">${M.icone(n.icone)}</div>` : "";
      const no = `<div class="card no" id="${id}-n${k}">${marca}<span>${esc(n.nome ?? "")}</span>${n.sub ? `<small>${esc(n.sub)}</small>` : ""}</div>`;
      return k < nos.length - 1 ? `${no}<div class="liga"><div class="liga-linha" id="${id}-k${k}"></div></div>` : no;
    });
    const rodape = c.rotulo ? `<div class="chip-ouro" id="${id}-r">${esc(c.rotulo)}</div>` : "";
    M.html.cenas.push(`      ${abrir(M, c, id)}${titulo(c, id)}<div class="fluxo">${partes.join("")}</div>${rodape}${fechar(c)}`);
    animarTitulo(M, c, id);
    const passo = clamp((c.ate - c.de - 1) / Math.max(1, nos.length), 0.3, 0.6);
    nos.forEach((n, k) => {
      const t = r3(M.tempoDe(n, c.de + 0.2 + k * passo));
      M.add(`tl.from("#${id}-n${k}", { scale: 0.4, opacity: 0, duration: 0.34, ease: "back.out(2)" }, ${t});`);
      M.somCena(c, "pop", t);
      if (k > 0) M.add(`tl.fromTo("#${id}-k${k - 1}", { ${eixo}: 0 }, { ${eixo}: 1, duration: ${r3(passo * 0.8)}, ease: "power2.inOut" }, ${r3(Math.max(c.de, t - passo * 0.85))});`);
    });
    if (c.rotulo) {
      const t = r3(c.de + 0.3 + nos.length * passo);
      M.add(`tl.from("#${id}-r", { y: 20, opacity: 0, duration: 0.3, ease: "back.out(2)" }, ${t});`);
      M.somCena(c, "ding-curto", t);
    }
  },
});

// ── antes → depois ───────────────────────────────────────────────────────────
registrar("comparacao", {
  zona: zonaDeCard,
  montar(M, c, id) {
    // o valor cabe numa linha: fonte menor quando o texto é comprido ("R$ 3.000")
    const maiorValor = Math.max(String(c.antes?.valor ?? "").length, String(c.depois?.valor ?? "").length, 1);
    const tamValor = Math.round(clamp(390 / (maiorValor * 0.56), 56, 104));
    const lado = (x, qual) =>
      `<div class="card lado ${qual}" id="${id}-${qual}">${x?.logo ? `<div class="logo-caixa pequena${x.fundo === "escuro" ? " escuro" : ""}">${logoImg(M, x.logo, `cena ${c.i}`)}</div>` : x?.icone ? `<div class="icone-caixa pequena">${M.icone(x.icone)}</div>` : ""}<div class="rotulo">${esc(x?.rotulo ?? "")}</div><div class="valor" style="font-size:${tamValor}px"><span>${esc(x?.valor ?? "")}</span>${qual === "antes" ? `<i class="risco" id="${id}-risco"></i>` : ""}</div>${x?.detalhe ? `<div class="detalhe">${esc(x.detalhe)}</div>` : ""}</div>`;
    M.html.cenas.push(`      ${abrir(M, c, id)}${titulo(c, id)}<div class="compara">${lado(c.antes, "antes")}<div class="vs" id="${id}-vs">${cheia(c) ? "↓" : "→"}</div>${lado(c.depois, "depois")}</div>${fechar(c)}`);
    animarTitulo(M, c, id);
    const meio = c.de + clamp((c.ate - c.de) * 0.35, 0.6, 1.4);
    M.add(`tl.from("#${id}-antes", { x: -80, opacity: 0, duration: 0.36, ease: "power3.out" }, ${r3(c.de + 0.12)});`);
    M.add(`tl.fromTo("#${id}-risco", { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power2.inOut" }, ${r3(meio - 0.3)});`);
    M.somCena(c, "click", meio - 0.3);
    M.add(`tl.from("#${id}-vs", { scale: 0, opacity: 0, duration: 0.25, ease: "back.out(2)" }, ${r3(meio)});`);
    M.add(`tl.from("#${id}-depois", { scale: 0.5, opacity: 0, duration: 0.4, ease: "back.out(2.2)" }, ${r3(meio + 0.1)});`);
    M.somCena(c, "ding", meio + 0.1, 0.8);
  },
});

// ── contador ─────────────────────────────────────────────────────────────────
registrar("contador", {
  zona: zonaDeCard,
  montar(M, c, id) {
    const coresNum = { verde: "#7dff3d", vermelho: "#ff4d5e", dourado: "#ffc93c", branco: "#f5f4f0", ...(M.ESTILO.cores ?? {}) };
    const cor = coresNum[c.cor ?? "dourado"] ?? coresNum.dourado;
    const casas = Number(c.casas ?? 0);
    const fmt = (v) => `${c.prefixo ?? ""}${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}${c.sufixo ?? ""}`;
    // o número cabe no card: fonte menor quando o valor final é comprido
    const cabe = cheia(c) ? 660 : 870;
    const tamNum = Math.round(clamp(cabe / (Math.max(fmt(c.para_valor ?? 0).length, fmt(c.de_valor ?? 0).length, 4) * 0.62), 84, cheia(c) ? 150 : 176));
    M.html.cenas.push(
      `      ${abrir(M, c, id)}<div class="card contador" id="${id}-in"><div class="contador-topo">${selo(M, c, `cena ${c.i}`)}<span class="rotulo">${esc(c.rotulo ?? "")}</span></div><div class="num" id="${id}-n" style="font-size:${tamNum}px">${esc(fmt(c.de_valor ?? 0))}</div>${c.barra ? `<div class="xp"><div id="${id}-xp"></div></div>` : ""}${c.detalhe ? `<div class="detalhe">${esc(c.detalhe)}</div>` : ""}</div>${fechar(c)}`,
    );
    const t0 = r3(c.de + 0.3);
    const dt = r3(clamp((c.ate - c.de) * 0.55, 0.6, 1.6));
    entrada(M, `#${id}-in`, c.de + 0.04);
    M.add(`(() => { const o = { v: ${Number(c.de_valor ?? 0)} }; const el = document.getElementById("${id}-n"); tl.to(o, { v: ${Number(c.para_valor ?? 0)}, duration: ${dt}, ease: "power2.out", onUpdate: () => (el.textContent = ${js(c.prefixo ?? "")} + o.v.toLocaleString("pt-BR", { minimumFractionDigits: ${casas}, maximumFractionDigits: ${casas} }) + ${js(c.sufixo ?? "")}) }, ${t0}); })();`);
    M.add(`tl.set("#${id}-n", { color: "${cor}" }, ${r3(t0 + dt)});`);
    M.add(`tl.fromTo("#${id}-n", { scale: 1.18 }, { scale: 1, duration: 0.26, ease: "back.out(2)", immediateRender: false }, ${r3(t0 + dt)});`);
    if (c.barra) M.add(`tl.fromTo("#${id}-xp", { scaleX: 0 }, { scaleX: ${clamp(Number(c.barra) || 0.85, 0.05, 1)}, duration: ${dt}, ease: "power2.out" }, ${t0});`);
    for (let k = 0; k < 4; k++) M.somCena(c, "tecla", t0 + k * (dt / 4), 0.6);
    M.somCena(c, "ding", t0 + dt, 0.8);
  },
});

// ── direct / whatsapp ────────────────────────────────────────────────────────
registrar("chat", {
  zona: zonaDeCard,
  limite: { faixa: ["mensagens", 4], "faixa-baixo": ["mensagens", 3], cheia: ["mensagens", 7] },
  montar(M, c, id) {
    const app = c.app === "whatsapp" ? "whatsapp" : "instagram";
    const msgs = c.mensagens ?? [];
    const avatar = c.avatar === "perfil" ? M.avatarPerfil() : `<span class="av letra" style="background:${corDe(c.nome ?? "?")}">${esc((c.nome ?? "?").slice(0, 1).toUpperCase())}</span>`;
    const bolhas = msgs.map((m, k) => `<div class="bolha ${m.lado === "eu" ? "eu" : "ela"}" id="${id}-b${k}">${esc(m.texto)}</div>`).join("");
    const logo = c.logo ? `<span class="chat-logo">${logoImg(M, c.logo, `cena ${c.i}`)}</span>` : "";
    M.html.cenas.push(
      `      ${abrir(M, c, id)}<div class="card chat ${app}" id="${id}-in"><div class="chat-topo">${avatar}<div class="chat-nome"><b>${esc(c.nome ?? "")}</b><span>${esc(c.status ?? (app === "whatsapp" ? "online" : "Ativo(a) agora"))}</span></div>${logo}</div><div class="chat-corpo">${bolhas}</div></div>${fechar(c)}`,
    );
    entrada(M, `#${id}-in`, c.de + 0.04);
    const passo = clamp((c.ate - c.de - 0.7) / Math.max(1, msgs.length), 0.3, 0.8);
    msgs.forEach((m, k) => {
      const t = r3(M.tempoDe(m, c.de + 0.4 + k * passo));
      M.add(`tl.from("#${id}-b${k}", { x: ${m.lado === "eu" ? 60 : -60}, opacity: 0, duration: 0.28, ease: "back.out(1.7)" }, ${t});`);
      M.somCena(c, "pop", t, 0.8);
    });
  },
});

// ── comentários do instagram ─────────────────────────────────────────────────
registrar("comentarios", {
  zona: zonaDeCard,
  limite: { faixa: ["itens", 4], "faixa-baixo": ["itens", 3], cheia: ["itens", 6] },
  montar(M, c, id) {
    const itens = c.itens ?? [];
    const lis = itens
      .map((it, k) => `<div class="coment" id="${id}-c${k}"><span class="av letra" style="background:${corDe(it.usuario)}">${esc(String(it.usuario ?? "?").slice(0, 1).toUpperCase())}</span><div class="coment-txt"><div><b>${esc(it.usuario)}</b> ${esc(it.texto)}</div><span class="coment-meta">${esc(it.tempo ?? "agora")} · Responder</span></div><span class="coracao">♡</span></div>`)
      .join("");
    const quem = c.usuario ?? (M.arroba || M.perfil.nome || "voce");
    const resp = c.resposta ? `<div class="coment resposta" id="${id}-resp">${M.avatarPerfil()}<div class="coment-txt"><div><b>${esc(quem)}</b> ${esc(c.resposta)}</div><span class="coment-meta">agora · Responder</span></div></div>` : "";
    const topo = `<div class="coments-topo"><span>Comentários</span>${c.logo ? logoImg(M, c.logo, `cena ${c.i}`, "coments-logo") : ""}</div>`;
    M.html.cenas.push(`      ${abrir(M, c, id)}<div class="card coments" id="${id}-in">${topo}${lis}${resp}</div>${fechar(c)}`);
    entrada(M, `#${id}-in`, c.de + 0.04);
    const n = itens.length + (c.resposta ? 1 : 0);
    const passo = clamp((c.ate - c.de - 0.7) / Math.max(1, n), 0.22, 0.6);
    itens.forEach((_, k) => {
      const t = r3(c.de + 0.35 + k * passo);
      M.add(`tl.from("#${id}-c${k}", { x: -50, opacity: 0, duration: 0.28, ease: "power3.out" }, ${t});`);
      if (k < 5) M.somCena(c, "pop", t, 0.7);
    });
    if (c.resposta) {
      const t = r3(c.de + 0.35 + itens.length * passo);
      M.add(`tl.from("#${id}-resp", { x: 50, opacity: 0, duration: 0.3, ease: "back.out(1.7)" }, ${t});`);
      M.somCena(c, "ding-curto", t, 0.8);
    }
  },
});

// ── notificações do celular ──────────────────────────────────────────────────
registrar("notificacao", {
  zona: zonaDeCard,
  limite: { faixa: ["itens", 3], "faixa-baixo": ["itens", 2], cheia: ["itens", 5] },
  montar(M, c, id) {
    const itens = c.itens ?? [];
    const cards = itens
      .map(
        (n, k) =>
          `<div class="notif" id="${id}-n${k}"><div class="notif-icone${n.fundo === "escuro" ? " escuro" : ""}">${n.logo ? logoImg(M, n.logo, `cena ${c.i}`) : n.icone ? M.icone(n.icone) : ""}</div><div class="notif-txt"><div class="notif-cab"><span>${esc(n.app ?? "")}</span><span>${esc(n.hora ?? "agora")}</span></div><b>${esc(n.titulo ?? "")}</b><span class="notif-corpo">${esc(n.texto ?? "")}</span></div></div>`,
      )
      .join("");
    M.html.cenas.push(`      ${abrir(M, c, id, "notifs")}${cards}${fechar(c)}`);
    const passo = clamp((c.ate - c.de - 0.6) / Math.max(1, itens.length), 0.25, 0.7);
    itens.forEach((n, k) => {
      const t = r3(M.tempoDe(n, c.de + 0.12 + k * passo));
      M.add(`tl.from("#${id}-n${k}", { y: -90, opacity: 0, scale: 0.94, duration: 0.36, ease: "back.out(1.6)" }, ${t});`);
      M.somCena(c, k === 0 ? "notificacao" : "pop", t, k === 0 ? 1 : 0.7);
    });
  },
});

// ── lista ────────────────────────────────────────────────────────────────────
// itens: "texto" ou { texto, sub, icone, i | t }. "modo": "foco" = todos aparecem apagados e
// cada um acende na hora em que ele fala (i = índice da palavra, t = segundos).
registrar("lista", {
  zona: zonaDeCard,
  preparar(M, c) {
    if (c.zona !== "sobre") return;
    // por cima do vídeo: embaixo do queixo se couber, senão em cima da cabeça
    const altura = (c.titulo ? 90 : 0) + (c.itens?.length ?? 0) * 78 + 60;
    const e = M.espacoLivre(c.de + 0.05);
    c.posicao = c.posicao && c.posicao !== "auto" ? c.posicao : e.abaixo >= altura ? "baixo" : "topo";
    c._banda = c.posicao === "topo" ? [130, 130 + altura] : c.posicao === "meio" ? [760, 760 + altura] : [1540 - altura, 1540];
  },
  limite: { faixa: ["itens", 5], "faixa-baixo": ["itens", 3], cheia: ["itens", 7], sobre: ["itens", 4] },
  montar(M, c, id) {
    const itens = (c.itens ?? []).map((it) => (typeof it === "string" ? { texto: it } : it));
    const foco = c.modo === "foco";
    const lis = itens
      .map((it, k) => {
        const marca = it.imagem && M.arquivoOk(it.imagem, `cena ${c.i}`) ? `<span class="marca foto"><img src="${esc(it.imagem)}" alt="" /></span>` : it.ok !== undefined ? `<span class="marca ${it.ok ? "ok" : "nao"}">${M.icone(it.ok ? "check" : "x")}</span>` : it.icone ? `<span class="marca icone">${M.icone(it.icone, "ic", { id: `${id}-ic${k}` })}</span>` : `<span class="marca">${c.numerar === false ? "✓" : c.numerar === "00" ? String(k + 1).padStart(2, "0") : k + 1}</span>`;
        return `<div class="item${foco ? " foco" : ""}" id="${id}-i${k}">${foco ? `<i class="item-luz" id="${id}-f${k}"></i>` : ""}${marca}<span class="item-txt"><span>${esc(it.texto ?? it.titulo ?? "")}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ""}</span>${foco ? `<em>${String(k + 1).padStart(2, "0")}</em>` : ""}</div>`;
      })
      .join("");
    const cab = c.titulo ? `<div class="lista-titulo">${selo(M, c, `cena ${c.i}`)}<span>${linhasDe(c.titulo).map((l, k) => `<span class="l${k}">${marcar(l)}</span>`).join(" ")}</span></div>` : "";
    M.html.cenas.push(`      ${abrir(M, c, id)}<div class="card lista${foco ? " lista-foco" : ""}" id="${id}-in">${c.rotulo ? `<div class="rotulo">${esc(c.rotulo)}</div>` : ""}${cab}${lis}</div>${fechar(c)}`);
    // rodapé ao lado da janelinha do rosto (tela cheia com pip): ícone, duas linhas e um traço
    if (c.rodape && c.zona === "cheia" && c._pip) {
      const rod = typeof c.rodape === "object" && !Array.isArray(c.rodape) ? c.rodape : { linhas: c.rodape };
      const ls = linhasDe(rod.linhas ?? rod.texto);
      const tam = Math.min(...ls.map((l) => M.ajustarFonte(l, "condensada-media", 500, 40, 84)));
      M.html.cenas.push(`      <div id="${id}-rod" class="clip lista-rodape ${c._pip === "esquerda" ? "direita" : "esquerda"}" ${M.attrs(c)}><div id="${id}-rodi">${rod.icone ? `<span class="rod-ic">${M.icone(rod.icone)}</span>` : ""}${ls.map((l, k) => `<div class="rod-l l${Math.min(k, 1)}" style="font-size:${tam}px">${esc(l)}</div>`).join("")}<i class="rod-regua"></i></div></div>`);
      M.add(`tl.from("#${id}-rodi", { y: 30, opacity: 0, duration: 0.36, ease: "power3.out" }, ${r3(c.de + 0.5)});`);
    }
    M.add(`tl.from("#${id}-in", { y: -50, rotation: ${foco ? 0 : -2}, opacity: 0, duration: 0.36, ease: "power3.out" }, ${r3(c.de + 0.04)});`);
    const passo = clamp((c.ate - c.de - 0.7) / Math.max(1, itens.length), 0.25, foco ? 2.5 : 0.6);
    const tempos = itens.map((it, k) => r3(clamp(M.tempoDe(it, c.de + 0.42 + k * passo), c.de + 0.1, c.ate - 0.1)));
    itens.forEach((_, k) => {
      const t = tempos[k];
      if (foco) {
        // todos entram logo (apagados); o da vez acende e o anterior volta a ficar discreto
        M.add(`tl.from("#${id}-i${k}", { x: -30, opacity: 0, duration: 0.24, ease: "power2.out" }, ${r3(c.de + 0.2 + k * 0.08)});`);
        M.add(`tl.to("#${id}-i${k}", { opacity: 1, duration: 0.2, ease: "power2.out" }, ${t});`);
        M.add(`tl.fromTo("#${id}-f${k}", { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power2.out", immediateRender: false }, ${t});`);
        if (itens[k].icone && itens[k].ok === undefined && !itens[k].imagem) M.desenharIcone(`${id}-ic${k}`, t, 0.6);
        const fim = tempos[k + 1];
        if (fim !== undefined) {
          M.add(`tl.to("#${id}-i${k}", { opacity: 0.5, duration: 0.2, ease: "power2.out" }, ${fim});`);
          M.add(`tl.to("#${id}-f${k}", { opacity: 0, duration: 0.2, ease: "power2.out" }, ${fim});`);
        }
        M.somCena(c, "pop", t, 0.7);
      } else {
        M.add(`tl.from("#${id}-i${k}", { x: -40, opacity: 0, duration: 0.26, ease: "back.out(1.8)" }, ${t});`);
        M.somCena(c, "pop", t, 0.8);
      }
    });
  },
});

// ── terminal ─────────────────────────────────────────────────────────────────
registrar("terminal", {
  zona: zonaDeCard,
  limite: { faixa: ["linhas", 6], "faixa-baixo": ["linhas", 4], cheia: ["linhas", 10] },
  montar(M, c, id) {
    const linhas = c.linhas ?? [];
    const ls = linhas.map((l, k) => `<div class="t-linha${/^[✓✔]/.test(l) ? " ok" : /^[>$]/.test(l) ? " cmd" : ""}" id="${id}-t${k}">${esc(l)}</div>`).join("");
    const logo = c.logo ? logoImg(M, c.logo, `cena ${c.i}`, "t-logo") : "";
    M.html.cenas.push(
      `      ${abrir(M, c, id)}<div class="card terminal" id="${id}-in"><div class="janela-barra"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i>${logo}${c.titulo ? `<span class="rotulo">${esc(c.titulo)}</span>` : ""}</div><div class="t-corpo">${ls}</div></div>${fechar(c)}`,
    );
    entrada(M, `#${id}-in`, c.de + 0.04);
    let t = c.de + 0.4;
    const total = c.ate - c.de - 0.6;
    const pesos = linhas.map((l) => Math.max(6, l.length));
    const soma = pesos.reduce((x, y) => x + y, 0) || 1;
    linhas.forEach((l, k) => {
      const d = r3(clamp((total * pesos[k]) / soma - 0.05, 0.15, 1.3));
      const ok = /^[✓✔]/.test(l);
      if (ok) M.add(`tl.from("#${id}-t${k}", { x: -20, opacity: 0, duration: 0.2, ease: "power2.out" }, ${r3(t)});`);
      else M.add(`tl.fromTo("#${id}-t${k}", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: ${d}, ease: "steps(${Math.max(4, Math.min(40, l.length))})" }, ${r3(t)});`);
      M.somCena(c, ok ? "pop" : "teclado", t, ok ? 0.8 : 0.7);
      t += (ok ? 0.25 : d) + 0.05;
    });
  },
});

// ── palavra em tela cheia (ou atrás do criador, com "atras": true) ───────────
registrar("palavra", {
  pip: false,
  zona: (c) => (c.atras ? "sobre" : "cheia"),
  preparar(M, c) {
    c._semLegenda = c.legenda !== true;
    if (c.atras) M.recortes.push({ de: c.de, ate: c.ate, motivo: `palavra atrás (cena ${c.i})` });
  },
  montar(M, c, id, camera) {
    const linhas = linhasDe(c.texto);
    const maior = Math.max(...linhas.map((l) => semMarca(l).length), 1);
    // com fonte definida pelo estilo (ou pela cena), o tamanho é medido de verdade; senão, pela conta antiga
    const fonte = c.fonte ?? M.ESTILO.fontes?.palavra;
    const teto = c.tamanho ?? (c.atras ? (M.ESTILO.palavra?.teto_atras ?? 330) : (M.ESTILO.palavra?.teto ?? 210));
    const tam = fonte ? Math.min(...linhas.map((l) => M.ajustarFonte(semMarca(l), fonte, c.atras ? 1000 : 960, 70, teto))) : Math.round(clamp(960 / (maior * 0.6), 90, teto));
    const ls = linhas.map((l, k) => `<div class="palavra-linha${(c.ouro ?? [1]).includes(k) ? " ouro" : ""}" id="${id}-p${k}" style="${fonte ? cssFonte(fonte) : ""}font-size:${tam}px">${marcar(l)}</div>`).join("");
    if (c.atras) {
      // por trás da pessoa: fica dentro do palco, entre o vídeo e o recorte dela
      const tr = camera.trechoEm(c.de + 0.05);
      const cam = tr.camA;
      const topoCabeca = cam.y + cam.scale * tr.rosto.y * H - 0.525 * tr.rosto.altura * H * cam.scale;
      const alturaBloco = linhas.length * tam * 0.95;
      const y = Number.isFinite(Number(c.y)) ? Number(c.y) : Math.round(clamp(topoCabeca - alturaBloco * 0.72, 60, 900));
      M.html.atras.push(`      <div id="${id}" class="clip palavra-atras" ${M.attrs(c)} style="top:${y}px"><div class="palavra-atras-in" id="${id}-in">${ls}</div></div>`);
    } else {
      M.html.cenas.push(`      <div id="${id}" class="clip tela-cheia" ${M.attrs(c)}><div class="tela-cheia-in void" id="${id}-in">${ls}</div></div>`);
      M.add(`tl.from("#${id}-in", { opacity: 0, duration: 0.08, ease: "none" }, ${c.de});`);
    }
    const entrada = c.entrada ?? M.ESTILO.palavra?.entrada ?? "impacto";
    linhas.forEach((_, k) => {
      const t = r3(c.de + 0.04 + k * 0.14);
      if (entrada === "fade") M.add(`tl.from("#${id}-p${k}", { opacity: 0, y: 20, duration: 0.45, ease: "power2.out" }, ${t});`);
      else if (entrada === "borra") M.add(`tl.fromTo("#${id}-p${k}", { opacity: 0, filter: "blur(26px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.28, ease: "power2.out" }, ${t});`);
      else if (entrada === "seco") M.add(`tl.from("#${id}-p${k}", { opacity: 0, duration: 0.04, ease: "none" }, ${t});`);
      else M.add(`tl.from("#${id}-p${k}", { scale: 1.6, opacity: 0, duration: 0.24, ease: "power4.out" }, ${t});`);
    });
    if (c.som !== false && (c.som || M.ESTILO.palavra?.som !== false)) M.somCena(c, c.som ?? M.ESTILO.palavra?.som ?? "impacto", c.de, 1);
  },
});

// ── CTA: "comenta X" + card do perfil ────────────────────────────────────────
registrar("cta", {
  zona: () => "sobre",
  montar(M, c, id) {
    const palavra = String(c.palavra ?? "").toUpperCase();
    const frase = c.frase ?? "comenta";
    // card do perfil: @ e foto do criador (dados/perfil.json); o plano pode trocar com "usuario" e "bio"
    const usuario = String(c.usuario ?? M.arroba).replace(/^@+/, "").trim();
    const nome = usuario ? `@${usuario}` : (M.perfil.nome ?? "");
    const bio = curto(c.bio ?? M.perfil.nicho ?? "", 60);
    M.html.cenas.push(
      `      <div id="${id}" class="clip cta" ${M.attrs(c)}><div class="card cta-coment" id="${id}-c">${M.avatarPerfil()}<span class="cta-txt" id="${id}-tx">${esc(frase)} <b>${esc(palavra)}</b></span></div><div class="card cta-perfil" id="${id}-p">${M.avatarPerfil("grande")}<div class="cta-nome">${nome ? `<b>${esc(nome)}</b>` : ""}${bio ? `<span>${esc(bio)}</span>` : ""}</div><span class="seguir" id="${id}-s">Seguir</span></div></div>`,
    );
    const t0 = r3(c.de + 0.1);
    M.add(`tl.from("#${id}-c", { y: -80, opacity: 0, duration: 0.32, ease: "back.out(1.6)" }, ${t0});`);
    M.add(`tl.fromTo("#${id}-tx", { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: 0.9, ease: "steps(${Math.max(8, frase.length + palavra.length + 1)})" }, ${r3(t0 + 0.3)});`);
    M.somCena(c, "teclado", t0 + 0.3, 1);
    const tp = r3(Math.max(t0 + 0.3, Math.min(c.ate - 0.7, t0 + 0.9)));
    M.add(`tl.from("#${id}-p", { y: 160, opacity: 0, duration: 0.42, ease: "power3.out" }, ${tp});`);
    M.add(`tl.fromTo("#${id}-s", { scale: 1 }, { scale: 1.12, duration: 0.25, ease: "power2.inOut", yoyo: true, repeat: 3, immediateRender: false }, ${r3(tp + 0.45)});`);
    M.somCena(c, "pop", tp, 0.8);
  },
});

// ── chip de título ("DICA", "ATENÇÃO") ───────────────────────────────────────
registrar("titulo", {
  zona: () => "sobre",
  montar(M, c, id, camera) {
    const cor = ["verde", "vermelho", "branco"].includes(c.cor) ? c.cor : "";
    const tr = camera.trechoEm(c.de + 0.01);
    const y = Number.isFinite(Number(c.y)) ? Number(c.y) : c.posicao === "topo" ? 150 : c.posicao === "base" ? 1390 : tr.modo === "dividida" ? PAINEL + 130 : clamp(tr.legY - 135, 150, 1500);
    M.html.cenas.push(`      <div id="${id}" class="clip titulo-linha" ${M.attrs(c)} style="top:${y}px"><div class="chip-titulo ${cor}" id="${id}-t">${c.icone ? M.icone(c.icone) : ""}<span>${esc(c.texto)}</span></div></div>`);
    M.add(`tl.from("#${id}-t", { scale: 0.4, rotation: -6, opacity: 0, duration: 0.3, ease: "back.out(2.4)" }, ${c.de});`);
    if (c.som !== "nenhum") M.somCena(c, c.som ?? "ding", c.de, 1);
  },
});

// ── cena livre (sub-composição escrita pelo editor) ──────────────────────────
registrar("livre", {
  zona: (c) => (c.area === "tela-cheia" ? "cheia" : c.area === "sobre" ? "sobre" : "faixa"),
  preparar(M, c) {
    if (c.area === "tela-cheia" && c.legenda !== true) c._semLegenda = true;
  },
  montar(M, c) {
    if (!M.arquivoOk(c.arquivo, `cena ${c.i} (livre)`)) return;
    const conteudo = fs.readFileSync(c.arquivo, "utf8");
    const compId = conteudo.match(/data-composition-id="([^"]+)"/)?.[1];
    if (!compId) return M.avisar(`cena ${c.i}: ${c.arquivo} não tem data-composition-id`);
    M.html.cenas.push(`      <div id="${compId}-host" class="clip livre${c.area === "tela-cheia" ? " livre-cheia" : ""}" data-composition-id="${esc(compId)}" data-composition-src="${esc(c.arquivo)}" ${M.attrs(c)} data-width="${W}" data-height="${H}"></div>`);
  },
});
