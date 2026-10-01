// Câmera e layout: onde o vídeo do criador aparece em cada trecho.
//
//   rosto            tela cheia, com angulação (aberto, médio, fechado, empurrar, inclinar)
//   dividida         motion na faixa de cima, o rosto embaixo (numa janela, se o estilo tiver uma)
//   dividida-baixo   o contrário: o rosto numa janela em cima, o motion embaixo
//   pip              motion em tela cheia e o rosto numa janelinha no canto
//   palco            a cena pede uma janela própria (cartão em 3D, celular…)
//
// A janela é um recorte (clip-path) do #v-wrap + uma borda (#janela-borda). Fora dela aparece o
// fundo do estilo (#fundo). Tudo é animado: o vídeo encolhe pra dentro da janela e volta.

import { W, H, clamp, dentro, r3, unir } from "./util.mjs";

export const PAINEL = 760; // faixa de cima da tela dividida
const COSTURA = 772; // legenda na tela dividida clássica: logo abaixo da faixa
const LEG_CHEIA = 1480; // legenda embaixo de um card em tela cheia
const PLANOS = { aberto: 1, medio: 1.22, fechado: 1.45 };
const ALT_PADRAO = 0.4; // altura do rosto (cabelo ao queixo) em fração da altura do quadro
export const JANELAS_PADRAO = {
  dividida_baixo: { x: 36, y: 60, w: 1008, h: 820, r: 46 },
  pip: {
    direita: { x: 610, y: 950, w: 430, h: 510, r: 30 },
    esquerda: { x: 40, y: 950, w: 430, h: 510, r: 30 },
  },
};

// sempre com os quatro raios (cima-esq, cima-dir, baixo-dir, baixo-esq) pra animar de uma forma pra outra
export const recorteCss = (j) => {
  if (!j) return "inset(0px 0px 0px 0px round 0px 0px 0px 0px)";
  const r = j.r ?? 0;
  const rt = j.sem_raio_em_cima ? 0 : r;
  return `inset(${r3(j.y)}px ${r3(W - j.x - j.w)}px ${r3(H - j.y - j.h)}px ${r3(j.x)}px round ${rt}px ${rt}px ${r}px ${r}px)`;
};

/**
 * Angulação automática do estilo (quando o plano não traz "angulos"): alterna os planos a cada
 * poucos segundos, sempre numa emenda ou num fim de frase. É o "punch-in" dos cortes de Shorts.
 * estilo.json → camera.auto: { alterna: ["aberto", "medio"], cada: [3, 6], empurrar: true }
 */
function angulosAutomaticos(M, emendas) {
  const cfg = M.ESTILO.camera?.auto;
  if (!cfg || (M.plano.angulos ?? []).length || M.plano.camera_auto === false) return [];
  const seq = cfg.alterna ?? ["aberto", "medio"];
  const [min, max] = cfg.cada ?? [3, 6];
  const D = M.D;
  const bons = [...emendas.map((e) => e.t), ...M.palavras.filter((w) => /[.!?]$/.test(w.texto) && Number.isFinite(w.b)).map((w) => w.b + 0.06)].sort((a, b) => a - b);
  const inicios = M.palavras.filter((w) => Number.isFinite(w.a)).map((w) => w.a - 0.03);
  const cortes = [0];
  let u = 0;
  while (D - u > min * 1.5) {
    // o primeiro ponto bom dentro da janela [min, max]; sem ele, o começo de palavra mais perto do meio
    let t = bons.find((x) => x - u >= min && x - u <= max);
    if (t === undefined) {
      const alvo = u + (min + max) / 2;
      t = inicios.filter((x) => x - u >= min && x - u <= max).sort((a, b) => Math.abs(a - alvo) - Math.abs(b - alvo))[0] ?? alvo;
    }
    if (D - t < min * 0.6) break;
    cortes.push(r3(t));
    u = t;
  }
  cortes.push(D);
  return cortes.slice(0, -1).map((de, k) => ({ de, ate: cortes[k + 1], plano: seq[k % seq.length], ...(cfg.empurrar ? { empurrar: cfg.empurrar } : {}) }));
}

export function montarCamera(M, cenas, emendas = []) {
  const { plano, ESTILO, D, add, avisar } = M;
  const L = ESTILO.layout ?? {};
  const P = M.LEG;
  const planos = { ...PLANOS, ...(ESTILO.camera?.planos ?? {}) };

  // ── rosto: centro (entre olhos e nariz) e altura, medidos pelo editor em dados/tomadas.jpg ──
  const rostoPadrao = { x: 0.5, y: 0.5, altura: ALT_PADRAO, ...(plano.rosto ?? {}) };
  const rostos = (plano.rostos ?? []).map((r) => ({ ...r, de: Number(r.de), ate: Number(r.ate) }));
  const rostoEm = (t) => ({ ...rostoPadrao, ...(rostos.find((r) => t >= r.de && t < r.ate) ?? {}) });

  const angulos = [...(plano.angulos ?? []), ...angulosAutomaticos(M, emendas)]
    .map((a) => ({ ...a, de: clamp(Number(a.de), 0, D), ate: clamp(Number(a.ate), 0, D) }))
    .filter((a) => a.ate > a.de)
    .sort((a, b) => a.de - b.de);
  for (let k = 1; k < angulos.length; k++) if (angulos[k - 1].ate > angulos[k].de) angulos[k - 1].ate = angulos[k].de;
  for (const a of angulos) if (a.plano && !planos[a.plano]) avisar(`plano de câmera desconhecido: ${a.plano} (use aberto, medio ou fechado)`);

  // ── o que cada cena pede do layout ──
  const janelaDe = (v) => (typeof v === "string" ? (L.janelas?.[v] ?? null) : (v ?? null));
  const divididas = unir(cenas.filter((c) => c.zona === "faixa").map((c) => [c.de, c.ate]), 0.35);
  const divididasB = unir(cenas.filter((c) => c.zona === "faixa-baixo").map((c) => [c.de, c.ate]), 0.35);
  const pips = cenas.filter((c) => c.zona === "cheia" && c._pip).map((c) => ({ de: c.de, ate: c.ate, jan: janelaDe(c._janela) ?? L.pip?.[c._pip] ?? JANELAS_PADRAO.pip[c._pip] ?? JANELAS_PADRAO.pip.direita, k: c._rostoK ?? 0.62 }));
  const palcos = cenas.filter((c) => c.zona === "palco" && c._janela).map((c) => ({ de: c.de, ate: c.ate, jan: janelaDe(c._janela), k: c._rostoK ?? 0.5, legY: c._legendaY, legEscala: c._legendaEscala }));
  const ctas = cenas.filter((c) => c.tipo === "cta").map((c) => [c.de, c.ate]);
  const cheiasComLegenda = cenas.filter((c) => c.zona === "cheia" && !c._semLegenda && !c._pip).map((c) => [c.de, c.ate]);
  const saltos = cenas.filter((c) => c.saltar === true).map((c) => [c.de, c.ate]); // a pessoa sai da janela (precisa do recorte)
  for (const [de, ate] of saltos) M.recortes.push({ de, ate, motivo: "a pessoa sai da janela" });
  const posicoes = (plano.legenda?.posicoes ?? []).map((p) => ({ de: Number(p.de), ate: Number(p.ate), y: Number(p.y) }));
  // faixas da tela ocupadas por algo por cima do vídeo (cabeçalho, fotos, prompt…): a legenda desvia
  const bandas = cenas.filter((c) => Array.isArray(c._banda) && !c._semLegenda).map((c) => ({ de: c.de, ate: c.ate, y0: c._banda[0], y1: c._banda[1], i: c.i }));
  const janelaBase = janelaDe(L.base);

  // ── enquadramento ──
  function cobertura(graus) {
    const a = (Math.abs(graus) * Math.PI) / 180;
    return r3(Math.max(Math.cos(a) + (H / W) * Math.sin(a), Math.cos(a) + (W / H) * Math.sin(a)));
  }
  function camRosto(rosto, s) {
    if (s <= 1.0001) return { x: 0, y: 0, scale: 1 };
    const fx = rosto.x * W;
    const fy = rosto.y * H;
    const tx = clamp(W / 2 - s * fx, W - s * W, 0);
    const ty = clamp(fy - s * fy, H - s * H, 0); // o rosto fica na mesma altura, maior
    return { x: r3(tx), y: r3(ty), scale: r3(s) };
  }
  function camDivididaClassica(rosto, s) {
    // rosto em ~67% da altura, embaixo da faixa; o topo que sobra fica atrás da faixa
    const tx = clamp(W / 2 - s * rosto.x * W, W - s * W, 0);
    const ty = clamp(0.67 * H - s * rosto.y * H, H - s * H, PAINEL - 90);
    return { x: r3(tx), y: r3(ty), scale: r3(s) };
  }
  function camJanela(j, rosto, k, empurra, salta) {
    // o rosto ocupa a fração k da altura da janela, sem deixar a janela descoberta
    const cobre = Math.max(j.w / W, j.h / H);
    const s = clamp((k * j.h) / (rosto.altura * H), cobre, Math.max(cobre, 1.7)) * empurra;
    const cx = j.x + j.w / 2;
    // quando a pessoa "sai" da janela, a cabeça passa um pouco da borda de cima
    const cy = salta ? j.y + 0.385 * rosto.altura * H * s : j.y + j.h * (j.ancora ?? 0.46);
    const tx = clamp(cx - s * rosto.x * W, j.x + j.w - s * W, j.x);
    const ty = clamp(cy - s * rosto.y * H, j.y + j.h - s * H, j.y);
    return { x: r3(tx), y: r3(ty), scale: r3(s) };
  }
  /**
   * Onde a legenda fica no trecho. Com "ancora": "auto" o y é o PÉ do bloco (ele cresce pra cima:
   * um bloco de uma linha encosta na cabeça, na janela ou no card do mesmo jeito que um de duas);
   * sem isso, o y é o topo do bloco (o jeito antigo).
   */
  const PE = P.ancora === "auto";
  const BLOCO = P.altura_bloco ?? 175;
  const doTopo = (yTopo) => Math.round(PE ? yTopo + BLOCO : yTopo);
  function legendaY(tr, cam) {
    if (tr.modo === "dividida") {
      if (P.dividida_y !== undefined) return doTopo(P.dividida_y);
      // com a pessoa saindo da janela, a legenda sobe o tanto que a cabeça passa da borda
      if (tr.jan) return Math.round(PE ? tr.jan.y - 12 - (tr.salta ? 0.17 * tr.rosto.altura * H * cam.scale : 0) : tr.jan.y - 84);
      return doTopo(COSTURA);
    }
    if (tr.modo === "dividida-baixo") return doTopo(P.dividida_baixo_y ?? tr.jan.y + tr.jan.h + 18);
    if (tr.modo === "pip") return doTopo(P.pip_y ?? 1476);
    if (tr.modo === "palco") return doTopo(tr.legY ?? P.palco_y ?? clamp(tr.jan.y + tr.jan.h + 24, 300, 1500));
    if (tr.jan) {
      // janela fixa do estilo: a legenda vai onde o estilo manda (dentro do clipe, embaixo dele…)
      if (P.janela_y !== undefined) return doTopo(P.janela_y <= 1 ? tr.jan.y + tr.jan.h * P.janela_y : P.janela_y);
      return doTopo(clamp(tr.jan.y + tr.jan.h + 24, 300, 1500));
    }
    const pos = P.posicao ?? "auto";
    const s = cam.scale;
    const rostoNaTela = cam.y + s * tr.rosto.y * H;
    const alt = tr.rosto.altura * H * s;
    const topo = rostoNaTela - 0.525 * alt;
    const queixo = rostoNaTela + 0.625 * alt;
    const limite = P.limite_y ?? 1560;
    const acima = PE ? Math.round(clamp(topo - (P.margem ?? 30), 170 + BLOCO, 1360 + BLOCO)) : Math.round(clamp(topo - BLOCO, 170, 1360));
    const abaixo = Math.round(queixo + 40);
    // lugar fixo que o estilo prefere (fração da altura ou px): vale se não cobrir o rosto
    const fixo = P.prefere_y ?? (["base", "centro", "topo"].includes(pos) ? (P.y ?? { base: 1400, centro: 1060, topo: 240 }[pos]) : null);
    if (fixo !== null && fixo !== undefined) {
      const y = Math.round(fixo <= 1 ? fixo * H : fixo);
      if (P.cobre_rosto === true || y + BLOCO <= topo - 6 || y >= queixo + 6) return doTopo(y);
      // não coube: do mesmo lado do rosto em que o estilo queria, se der
      if (y > rostoNaTela && abaixo + BLOCO <= limite) return doTopo(abaixo);
      return acima;
    }
    if (pos === "cabeca") return acima;
    if (pos === "peito") return abaixo + BLOCO <= limite ? doTopo(abaixo) : acima;
    // auto: rosto na metade de baixo (o normal de selfie): legenda em cima da cabeça; senão, embaixo do queixo
    if (rostoNaTela >= 0.5 * H) return acima;
    return doTopo(clamp(abaixo, 300, 1360));
  }

  /** Se a legenda cai em cima de algo que está por cima do vídeo, acha outro lugar (sem cobrir o rosto). */
  function desviar(tr, y, a, b) {
    const ocupadas = bandas.filter((o) => o.de < b - 0.05 && o.ate > a + 0.05);
    if (!ocupadas.length) return y;
    const bloco = P.altura_bloco ?? 175;
    const livre = (v) => v >= 150 && v + bloco <= (P.limite_y ?? 1560) && !ocupadas.some((o) => v < o.y1 + 14 && v + bloco > o.y0 - 14);
    if (livre(y)) return y;
    const cam = tr.camA;
    const centro = cam.y + cam.scale * tr.rosto.y * H;
    const alt = tr.rosto.altura * H * cam.scale;
    const topo = centro - 0.525 * alt;
    const queixo = centro + 0.625 * alt;
    // primeiro encostado no rosto (em cima da cabeça, embaixo do queixo); depois sobe ou desce até achar lugar
    const tentativas = [Math.round(topo - bloco), Math.round(queixo + 40)];
    for (let v = Math.round(topo - bloco) - 40; v >= 150; v -= 40) tentativas.push(v);
    for (let v = Math.round(queixo + 40) + 40; v + bloco <= 1560; v += 40) tentativas.push(v);
    const achou = tentativas.find(livre);
    if (achou !== undefined) return achou;
    avisar(`legenda sem lugar entre ${a.toFixed(2)} e ${b.toFixed(2)} s: a cena ${ocupadas.map((o) => o.i).join(", ")} ocupa a tela; esconda a legenda nela ("legenda": false) ou mude a posição`);
    return y;
  }

  // ── trechos: entre dois marcos, o layout é um só ──
  const marcos = [0, D, ...divididas.flat(), ...divididasB.flat(), ...pips.flatMap((p) => [p.de, p.ate]), ...palcos.flatMap((p) => [p.de, p.ate]), ...angulos.flatMap((a) => [a.de, a.ate]), ...rostos.flatMap((r) => [r.de, r.ate]), ...ctas.flat(), ...cheiasComLegenda.flat(), ...saltos.flat(), ...posicoes.flatMap((p) => [p.de, p.ate]), ...bandas.flatMap((b) => [b.de, b.ate])];
  const ts = [...new Set(marcos.map((t) => r3(clamp(t, 0, D))))].sort((a, b) => a - b);
  const trechos = [];
  for (let k = 0; k < ts.length - 1; k++) {
    const a = ts[k];
    const b = ts[k + 1];
    if (b - a < 0.001) continue;
    const tm = (a + b) / 2;
    const ang = angulos.find((g) => tm >= g.de && tm < g.ate) ?? { plano: "aberto", de: 0, ate: D };
    const rosto = { ...rostoEm(tm), ...(ang.rosto ?? {}) };
    const tr = { a, b, rosto, modo: "rosto", jan: janelaBase, k: L.base_k ?? 0.5, bloco: [0, D] };
    const pal = palcos.find((p) => tm >= p.de && tm < p.ate);
    const pip = pips.find((p) => tm >= p.de && tm < p.ate);
    const dvb = dentro(divididasB, tm);
    const dv = dentro(divididas, tm);
    if (pal) Object.assign(tr, { modo: "palco", jan: pal.jan, k: pal.k, bloco: [pal.de, pal.ate], legY: pal.legY, legEscala: pal.legEscala });
    else if (pip) Object.assign(tr, { modo: "pip", jan: pip.jan, k: pip.k, bloco: [pip.de, pip.ate] });
    else if (dvb) Object.assign(tr, { modo: "dividida-baixo", jan: L.dividida_baixo ?? JANELAS_PADRAO.dividida_baixo, k: 0.45, bloco: dvb });
    else if (dv) Object.assign(tr, { modo: "dividida", jan: L.dividida ?? null, k: 0.45, bloco: dv });
    const prog = (t) => clamp((t - tr.bloco[0]) / Math.max(0.01, tr.bloco[1] - tr.bloco[0]), 0, 1);
    const empurra = ang.empurrar === true ? 0.06 : Number(ang.empurrar) || 0;
    tr.escala = (t) => {
      // dividida, pip e palco: uma aproximação bem leve ao longo do bloco
      if (tr.modo !== "rosto") return 1 + 0.03 * prog(t);
      // tela cheia (ou a janela fixa do estilo): o plano do ângulo, com ou sem empurrar
      const base = planos[ang.plano] ?? 1;
      return empurra ? base * (1 + empurra * clamp((t - ang.de) / (ang.ate - ang.de), 0, 1)) : base;
    };
    tr.salta = Boolean(dentro(saltos, tm)) && Boolean(tr.jan);
    tr.cam = (t) => (tr.jan ? camJanela(tr.jan, rosto, tr.k, tr.escala(t), tr.salta) : tr.modo === "dividida" ? camDivididaClassica(rosto, tr.escala(t)) : camRosto(rosto, tr.escala(t)));
    tr.camA = tr.cam(a);
    tr.camB = tr.cam(b);
    tr.rot = tr.modo === "rosto" && !tr.jan ? Number(ang.inclinar ?? 0) : 0;
    let legY = legendaY(tr, tr.camA);
    const livreDeJanela = tr.modo === "rosto" && !tr.jan;
    const manual = livreDeJanela ? posicoes.find((p) => tm >= p.de && tm < p.ate)?.y : undefined;
    if (manual !== undefined) legY = doTopo(manual);
    else if (livreDeJanela) {
      const topoBloco = PE ? legY - BLOCO : legY;
      const novo = desviar(tr, topoBloco, a, b);
      if (novo !== topoBloco) legY = doTopo(novo);
    }
    if (dentro(cheiasComLegenda, tm)) legY = doTopo(P.cheia_y ?? LEG_CHEIA); // card em tela cheia: legenda embaixo dele
    if (dentro(ctas, tm)) legY = doTopo(clamp(PE ? legY - BLOCO : legY, 300, 1320)); // o card do perfil do CTA fica embaixo
    tr.legY = legY;
    tr.legEscala = tr.modo === "palco" ? (tr.legEscala ?? 1) : 1;
    trechos.push(tr);
  }

  // ── emite a linha do tempo da câmera ──
  // @INNER, @ROT e @WRAP viram os seletores de verdade no fim (com o vídeo do recorte junto, se tiver)
  const igual = (p, q) => p.x === q.x && p.y === q.y && p.scale === q.scale;
  const cam = (c) => `x: ${c.x}, y: ${c.y}, scale: ${c.scale}`;
  const mesmaJanela = (p, q) => recorteCss(p) === recorteCss(q);
  // a borda de cada janela é um elemento fixo no lugar dela: só a opacidade anima
  const bordas = [];
  const bordaDe = (j) => {
    if (!j) return null;
    const chave = recorteCss(j);
    let k = bordas.findIndex((b) => b.chave === chave);
    if (k < 0) {
      k = bordas.length;
      bordas.push({ chave, j });
      M.html.bordas.push(`        <div class="janela-borda${j.limpa ? " limpa" : ""}" id="jb${k}" style="left:${j.x}px;top:${j.y}px;width:${j.w}px;height:${j.h}px;border-radius:${j.r ?? 0}px"><i></i><i></i><i></i><i></i></div>`);
    }
    return `#jb${k}`;
  };
  // recorte da pessoa quando ela "sai" da janela: abre só um trecho acima da borda (o tanto da cabeça)
  const semTopo = (j, tr) => {
    if (!j) return null;
    const folga = Math.min(j.y, Math.round(0.36 * tr.rosto.altura * H * tr.camA.scale));
    return { ...j, y: j.y - folga, h: j.h + folga, sem_raio_em_cima: true };
  };
  const temPainel = L.painel !== false && !L.dividida;
  // troca de plano no meio da tela cheia: corte seco (o padrão) ou um zoom rápido
  const trocaSuave = Number(ESTILO.camera?.troca ?? 0);
  let ant = null;
  for (const tr of trechos) {
    const trocou = ant && (ant.modo !== tr.modo || !mesmaJanela(ant.jan, tr.jan));
    const dur = tr.jan || ant?.jan ? 0.34 : 0.26; // com janela o vídeo encolhe/cresce: um pouco mais lento
    if (trocou && tr.b - tr.a > 0.4) {
      const tm = r3(tr.a + dur);
      const camM = tr.cam(tm);
      add(`tl.to("@INNER", { ${cam(camM)}, duration: ${dur}, ease: "power3.out" }, ${tr.a});`);
      if (!igual(camM, tr.camB)) add(`tl.to("@INNER", { ${cam(tr.camB)}, duration: ${r3(tr.b - tm)}, ease: "none" }, ${tm});`);
    } else if (ant && trocaSuave > 0 && tr.b - tr.a > trocaSuave + 0.2 && !igual(ant.camB, tr.camA)) {
      const tm = r3(tr.a + trocaSuave);
      add(`tl.to("@INNER", { ${cam(tr.cam(tm))}, duration: ${trocaSuave}, ease: "power3.out" }, ${tr.a});`);
      if (!igual(tr.cam(tm), tr.camB)) add(`tl.to("@INNER", { ${cam(tr.camB)}, duration: ${r3(tr.b - tm)}, ease: "none" }, ${tm});`);
    } else {
      add(`tl.set("@INNER", { ${cam(tr.camA)} }, ${tr.a});`);
      if (!igual(tr.camA, tr.camB)) add(`tl.to("@INNER", { ${cam(tr.camB)}, duration: ${r3(tr.b - tr.a)}, ease: "none" }, ${tr.a});`);
    }
    // janela (recorte do vídeo) e a borda dela
    const janR = tr.salta ? semTopo(tr.jan, tr) : tr.jan;
    const antJanR = ant ? (ant.salta ? semTopo(ant.jan, ant) : ant.jan) : null;
    if (!ant) {
      add(`tl.set("#v-wrap", { clipPath: "${recorteCss(tr.jan)}" }, 0);`);
      add(`tl.set("#r-wrap", { clipPath: "${recorteCss(janR)}" }, 0);`);
      if (tr.jan) add(`tl.set("${bordaDe(tr.jan)}", { opacity: 1 }, 0);`);
    } else {
      if (!mesmaJanela(ant.jan, tr.jan)) {
        const d = Math.min(dur, r3(tr.b - tr.a));
        add(`tl.to("#v-wrap", { clipPath: "${recorteCss(tr.jan)}", duration: ${d}, ease: "power3.out" }, ${tr.a});`);
        if (ant.jan) add(`tl.to("${bordaDe(ant.jan)}", { opacity: 0, duration: 0.12, ease: "none" }, ${tr.a});`);
        if (tr.jan) add(`tl.to("${bordaDe(tr.jan)}", { opacity: 1, duration: 0.2, ease: "none" }, ${r3(tr.a + d * 0.6)});`);
      }
      if (!mesmaJanela(antJanR, janR)) add(`tl.to("#r-wrap", { clipPath: "${recorteCss(janR)}", duration: ${Math.min(dur, r3(tr.b - tr.a))}, ease: "power3.out" }, ${tr.a});`);
    }
    // o rosto por cima de um card em tela cheia (pip)
    const acima = tr.modo === "pip";
    if (!ant) add(`tl.set("#cena3d", { zIndex: ${acima ? 27 : 1} }, 0);`);
    else if ((ant.modo === "pip") !== acima) add(`tl.set("#cena3d", { zIndex: ${acima ? 27 : 1} }, ${tr.a});`);
    // faixa de cima clássica (sem janela): o painel desce por cima do vídeo
    if (temPainel) {
      const aberto = tr.modo === "dividida";
      if (!ant) add(`tl.set("#painel-in", { yPercent: ${aberto ? 0 : -106} }, 0);`);
      else if ((ant.modo === "dividida") !== aberto) add(`tl.to("#painel-in", { yPercent: ${aberto ? 0 : -106}, duration: 0.26, ease: "${aberto ? "power3.out" : "power2.in"}" }, ${tr.a});`);
    }
    if (!ant || ant.rot !== tr.rot) add(`tl.set("@ROT", { rotation: ${tr.rot}, scale: ${tr.rot ? cobertura(tr.rot) : 1} }, ${tr.a});`);
    if (!ant || ant.legY !== tr.legY || ant.legEscala !== tr.legEscala) add(`tl.set("#leg-pos", { y: ${tr.legY}, scale: ${tr.legEscala} }, ${tr.a});`);
    ant = tr;
  }
  const trechoEm = (t) => trechos.find((tr) => t >= tr.a && t < tr.b) ?? trechos[trechos.length - 1];
  return { trechos, trechoEm, divididas, cheiasComLegenda, rostoEm, temPainel, janelaBase, angulos };
}
