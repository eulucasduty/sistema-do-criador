// Componentes que mexem no próprio vídeo do criador, dentro do palco em 3D:
//   camadas       o vídeo num cartão, com camadas de vidro entrando uma a uma (montagem em 3D)
//   profundidade  fundo, texto, pessoa, ícones e moldura em planos separados, girando
//   cenario       troca o fundo atrás da pessoa (cidade, neon, cor, imagem) com palavra gigante
//   celular       o vídeo (ou uma imagem) dentro de um celular, com chamadas apontando
// Profundidade e cenário precisam do recorte da pessoa (a estação gera antes do render).

import { W, H, clamp, esc, linhasDe, r3 } from "./util.mjs";
import { cssFonte } from "./fontes.mjs";
import { registrar } from "./cenas.mjs";
import { cor, papel, topoDaCabeca } from "./cenas-extra.mjs";
import { limpar } from "./legenda.mjs";
import { cabecalhoPasso } from "./cenas-extra3.mjs";

const CORES_CAMADA = ["#f2eafc", "#7f95ff", "#a78bfa", "#8b5cf6", "#f0a6d8", "#7df0a8"];
// alturas das barrinhas da "onda" de áudio (fixas: nada de sorteio no render)
const ONDA = [28, 46, 64, 38, 72, 90, 54, 80, 96, 60, 44, 76, 88, 52, 34, 66, 92, 70, 48, 82, 58, 40, 74, 86, 50, 32, 62, 44];

// ── camadas de vidro ─────────────────────────────────────────────────────────
// etapas: [{ t | i, selo: "CAMADA 02", nome: "Trilha", elemento: "onda" | "legenda" | "icones" |
//            "titulo" | "imagem" | "texto" | "vazio", icones: [...], texto: "LINHA 1 | LINHA 2",
//            material | arquivo }]
// A 1ª etapa é o próprio vídeo (sem vidro). "final": { selo, nome, t | i } junta tudo de volta.
registrar("camadas", {
  zona: () => "palco",
  preparar(M, c) {
    c._janela = c.janela ?? M.ESTILO.layout?.janelas?.cartao ?? { x: 210, y: 320, w: 660, h: 1010, r: 30 };
    c._rostoK = 0.44;
    if (c.legenda !== true) c._semLegenda = true; // a legenda vira uma das camadas
  },
  montar(M, c, id) {
    const j = c._janela;
    const etapas = (c.etapas ?? []).map((e) => ({ ...e }));
    if (etapas.length < 2) return M.avisar(`cena ${c.i} (camadas) precisa de pelo menos 2 etapas`);
    const dur = c.ate - c.de;
    if (dur < 3) M.avisar(`cena ${c.i} (camadas) dura ${dur.toFixed(1)} s: precisa de pelo menos 3 s pras camadas entrarem`);
    const paleta = M.ESTILO.camadas?.cores ?? CORES_CAMADA;
    const fim = c.final ? r3(clamp(M.tempoDe(c.final, c.ate - Math.min(2.2, dur * 0.28)), c.de + 0.5, c.ate - 0.4)) : null;
    const ultimo = fim ?? r3(c.ate - 0.4);
    const passo = (ultimo - c.de - 0.3) / etapas.length;
    etapas.forEach((e, k) => (e.t = r3(clamp(M.tempoDe(e, c.de + 0.15 + k * passo), c.de, ultimo - 0.2))));
    const destaques = new Set((M.plano.legenda?.destaques ?? []).flatMap((d) => String(typeof d === "string" ? d : (d.palavra ?? "")).split(/\s+/)).map((p) => limpar(p).toLowerCase()).filter(Boolean));

    // as camadas de vidro (dentro do palco, na frente do cartão do vídeo)
    const vidros = etapas.slice(1).map((e, k) => {
      const corK = e.cor ? cor(e.cor) : paleta[(k + 1) % paleta.length];
      let dentro = "";
      if (e.elemento === "onda") dentro = `<div class="vd-onda"><span class="vd-ic">${M.icone("music")}</span><span class="vd-barras">${ONDA.map((h) => `<i style="height:${h}%"></i>`).join("")}</span></div>`;
      else if (e.elemento === "icones") {
        const ics = (e.icones ?? ["scissors", "clapperboard", "zap", "sparkles", "circle-check", "video"]).slice(0, 6);
        const meio = Math.ceil(ics.length / 2);
        dentro = `<div class="vd-icones esq">${ics.slice(0, meio).map((n) => `<span>${M.icone(n)}</span>`).join("")}</div><div class="vd-icones dir">${ics.slice(meio).map((n) => `<span>${M.icone(n)}</span>`).join("")}</div>`;
      } else if (e.elemento === "titulo") {
        const ls = linhasDe(e.texto ?? e.nome);
        const fonte = papel(M, "lettering", "larga");
        const tam = Math.min(...ls.map((l) => M.ajustarFonte(l, fonte, j.w - 90, 30, 76)));
        dentro = `<div class="vd-titulo" style="${cssFonte(fonte)}font-size:${tam}px">${ls.map((l, n) => `<span class="l${Math.min(n, 1)}">${esc(l)}</span>`).join("")}</div>`;
      } else if (e.elemento === "imagem") {
        const m = M.midia(e, `cena ${c.i} (camadas)`);
        if (m?.tipo === "imagem") dentro = `<img class="vd-img" src="${esc(m.arquivo)}" alt="" />`;
      } else if (e.elemento === "texto") dentro = `<div class="vd-texto">${esc(e.texto ?? "")}</div>`;
      else if (e.elemento === "legenda") {
        // a legenda dentro do cartão: blocos de até 3 linhas; cada palavra acende na hora da fala
        const falas = M.palavras.filter((w) => w.texto && w.a >= e.t - 0.05 && w.a < c.ate);
        const blocos = [];
        let linhas = [[]];
        const fecha = () => {
          if (linhas[0].length) blocos.push(linhas);
          linhas = [[]];
        };
        falas.forEach((w, n) => {
          let atual = linhas[linhas.length - 1];
          if (atual.length && [...atual, w].map((x) => x.texto).join(" ").length > 15) {
            if (linhas.length >= 3) fecha();
            else linhas.push([]);
            atual = linhas[linhas.length - 1];
          }
          atual.push(w);
          const prox = falas[n + 1];
          if (/[.!?]$/.test(w.texto) || !prox || prox.a - w.b > 0.5) fecha();
        });
        fecha();
        let nW = 0;
        dentro = `<div class="vd-leg">${blocos
          .map(
            (ls, n) =>
              `<div class="vd-g" id="${id}-g${k}n${n}">${ls
                .map(
                  (ws) =>
                    `<span class="vd-ln">${ws
                      .map((w) => {
                        const d = destaques.has(limpar(w.texto).toLowerCase());
                        return `<span class="vd-w${d ? " dest" : ""}" id="${id}-w${k}n${nW++}">${esc(d ? limpar(w.texto).toUpperCase() : w.texto)}</span>`;
                      })
                      .join(" ")}</span>`,
                )
                .join("")}</div>`,
          )
          .join("")}</div>`;
        let cont = 0;
        blocos.forEach((ls, n) => {
          const ws = ls.flat();
          const a = r3(ws[0].a);
          const b = r3(Math.min(blocos[n + 1]?.[0][0].a ?? c.ate, ws[ws.length - 1].b + 0.7, c.ate));
          M.add(`tl.set("#${id}-g${k}n${n}", { opacity: 1 }, ${a});`);
          for (const w of ws) M.add(`tl.set("#${id}-w${k}n${cont++}", { opacity: 1 }, ${r3(clamp(w.a, a, b))});`);
          M.add(`tl.set("#${id}-g${k}n${n}", { opacity: 0 }, ${b});`);
        });
      }
      return `        <div id="${id}-v${k}" class="clip vidro" ${M.attrs(c)} style="left:${j.x}px;top:${j.y}px;width:${j.w}px;height:${j.h}px;border-radius:${j.r ?? 0}px;--cor:${corK}">${dentro}</div>`;
    });
    M.html.vidro.push(...vidros);

    // rodapé: tracinhos de progresso + o nome da etapa da vez
    const total = etapas.length;
    const rotulos = [...etapas, ...(c.final ? [{ ...c.final, t: fim }] : [])];
    const fonteNome = papel(M, "titulo", "display");
    const tamNome = Math.min(...rotulos.map((e) => M.ajustarFonte(e.nome ?? "", fonteNome, 940, 44, 96)));
    const etiquetas = rotulos.map((e, k) => `<div class="cm-et" id="${id}-e${k}">${e.selo ? `<span class="cm-selo" style="--cor:${paleta[Math.min(k, total - 1) % paleta.length]}"><i></i>${esc(e.selo)}</span>` : ""}<div class="cm-nome" style="${cssFonte(fonteNome)}font-size:${tamNome}px">${esc(e.nome ?? "")}</div></div>`).join("");
    const dashes = etapas.map((_, k) => `<i style="--cor:${paleta[k % paleta.length]}"><b id="${id}-d${k}"></b></i>`).join("");
    M.html.cenas.push(`      <div id="${id}" class="clip camadas-rodape" ${M.attrs(c)} style="top:${j.y + j.h + 36}px"><div class="cm-dashes">${dashes}</div><div class="cm-pilha">${etiquetas}</div></div>`);

    // movimento: o palco gira, as camadas chegam pela frente e ficam afastadas; no fim, juntam
    const ox = j.x + j.w / 2;
    const oy = j.y + j.h / 2;
    const t1 = etapas[1].t;
    M.add(`tl.set("#palco", { transformOrigin: "${ox}px ${oy}px" }, ${c.de});`);
    M.add(`tl.to("#palco", { rotationY: -17, rotationX: 8, duration: 0.6, ease: "power2.out" }, ${t1});`);
    if (ultimo - t1 - 0.6 > 0.3) M.add(`tl.to("#palco", { rotationY: -25, duration: ${r3(ultimo - t1 - 0.6)}, ease: "none" }, ${r3(t1 + 0.6)});`);
    etapas.forEach((e, k) => {
      M.add(`tl.fromTo("#${id}-d${k}", { scaleX: 0 }, { scaleX: 1, duration: 0.3, ease: "power2.out" }, ${e.t});`);
      if (k > 0) {
        M.add(`tl.fromTo("#${id}-v${k - 1}", { z: 620, opacity: 0, rotationY: 14 }, { z: ${k * 74}, opacity: 1, rotationY: 0, duration: 0.55, ease: "power3.out" }, ${e.t});`);
        M.somCena(c, "whoosh", e.t, 0.5);
      }
    });
    rotulos.forEach((e, k) => {
      const sai = rotulos[k + 1]?.t;
      M.add(`tl.fromTo("#${id}-e${k}", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.26, ease: "power3.out" }, ${e.t});`);
      if (sai !== undefined) M.add(`tl.to("#${id}-e${k}", { opacity: 0, y: -24, duration: 0.16, ease: "power2.in" }, ${r3(Math.max(e.t + 0.3, sai - 0.16))});`);
    });
    const volta = r3(c.ate - 0.3);
    if (fim !== null) {
      // tudo junto: as camadas encostam no cartão e ele vira de frente
      etapas.slice(1).forEach((_, k) => M.add(`tl.to("#${id}-v${k}", { z: ${(k + 1) * 6}, duration: 0.5, ease: "power3.inOut" }, ${fim});`));
      M.add(`tl.to("#palco", { rotationY: 0, rotationX: 0, scale: 1.1, duration: 0.55, ease: "power3.inOut" }, ${fim});`);
      M.somCena(c, "ding", fim + 0.4, 0.8);
      if (volta > fim + 0.6) M.add(`tl.to("#palco", { scale: 1, duration: 0.3, ease: "power2.inOut" }, ${volta});`);
    } else M.add(`tl.to("#palco", { rotationY: 0, rotationX: 0, duration: 0.3, ease: "power2.inOut" }, ${volta});`);
    M.add(`tl.set("#palco", { transformOrigin: "50% 50%", rotationY: 0, rotationX: 0, scale: 1 }, ${c.ate});`);
  },
});

// ── profundidade: os planos do vídeo separados em 3D ─────────────────────────
// { palavra: "PROFUNDIDADE | 3D", camadas: ["FUNDO", "TEXTO", "APRESENTADOR", "ÍCONES", "MOLDURA"],
//   icones: ["image", "layers", "captions"], rodape: "5 CAMADAS · PROFUNDIDADE REAL" }
registrar("profundidade", {
  zona: () => "palco",
  preparar(M, c) {
    M.recortes.push({ de: c.de, ate: c.ate, motivo: `profundidade (cena ${c.i})` });
    if (c.legenda !== true) c._semLegenda = true;
  },
  montar(M, c, id, camera) {
    const nomes = (c.camadas ?? ["FUNDO", "TEXTO", "APRESENTADOR", "ÍCONES", "MOLDURA"]).slice(0, 5);
    const Z = [0, 80, 160, 240, 320];
    // o texto fica entre o fundo e a pessoa
    const linhas = linhasDe(c.palavra ?? c.texto ?? "");
    const fonte = papel(M, "lettering", "larga");
    const tams = linhas.map((l) => M.ajustarFonte(l, fonte, 900, 60, 230));
    const altura = tams.reduce((s, t) => s + t * 0.98, 0);
    const topo = Number.isFinite(Number(c.y)) ? Number(c.y) : Math.round(clamp(topoDaCabeca(camera, c.de + 0.05) - altura * 0.72, 90, 900));
    if (linhas.length) M.html.atras.push(`        <div id="${id}-tx" class="clip prof-texto" ${M.attrs(c)} style="top:${topo}px">${linhas.map((l, k) => `<div class="prof-l l${Math.min(k, 1)}" id="${id}-t${k}" style="${cssFonte(fonte)}font-size:${tams[k]}px">${esc(l)}</div>`).join("")}</div>`);
    // molduras de arame de cada plano, com a etiqueta
    const quadros = nomes.map((n, k) => `        <div id="${id}-q${k}" class="clip prof-quadro" ${M.attrs(c)}><span class="prof-etq">${String(k + 1).padStart(2, "0")} · ${esc(n)}</span></div>`);
    const icones = (c.icones ?? ["image", "layers", "captions"]).slice(0, 3);
    const posIc = [[860, 520], [150, 1130], [880, 1210]];
    const ics = icones.map((n, k) => `        <div id="${id}-i${k}" class="clip prof-icone" ${M.attrs(c)} style="left:${posIc[k][0] - 60}px;top:${posIc[k][1] - 60}px">${M.icone(n)}</div>`);
    M.html.vidro.push(...quadros, ...ics);
    if (c.rodape !== false) M.html.cenas.push(`      <div id="${id}-rd" class="clip prof-rodape" ${M.attrs(c)}><span>${esc(c.rodape ?? `${nomes.length} CAMADAS · PROFUNDIDADE REAL`)}</span></div>`);
    M.html.fundo.push(`<div id="${id}-ch" class="clip prof-chao" ${M.attrs(c)}><i></i></div>`);

    const t0 = c.de;
    const volta = r3(c.ate - 0.42);
    M.add(`tl.set("#palco", { transformOrigin: "50% 50%" }, ${t0});`);
    M.add(`tl.to("#palco", { scale: 0.78, rotationY: -26, rotationX: 3, duration: 0.6, ease: "power3.out" }, ${t0});`);
    if (volta - t0 - 0.6 > 0.3) M.add(`tl.to("#palco", { rotationY: 16, duration: ${r3(volta - t0 - 0.6)}, ease: "sine.inOut" }, ${r3(t0 + 0.6)});`);
    M.add(`tl.to("#r-wrap", { z: ${Z[2]}, duration: 0.6, ease: "power3.out" }, ${t0});`);
    // o fundo desfoca: a pessoa (recorte) fica nítida na frente dele
    M.add(`tl.fromTo("#v-rot", { filter: "blur(0px) brightness(1)" }, { filter: "blur(14px) brightness(0.62)", duration: 0.5, ease: "power2.out", immediateRender: false }, ${t0});`);
    if (linhas.length) {
      M.add(`tl.set("#${id}-tx", { z: ${Z[1]} }, ${t0});`);
      linhas.forEach((_, k) => M.add(`tl.from("#${id}-t${k}", { opacity: 0, scale: 0.7, duration: 0.3, ease: "back.out(1.8)" }, ${r3(t0 + 0.35 + k * 0.18)});`));
    }
    nomes.forEach((_, k) => M.add(`tl.fromTo("#${id}-q${k}", { z: ${Z[k]}, opacity: 0 }, { z: ${Z[k]}, opacity: 1, duration: 0.3, ease: "none" }, ${r3(t0 + 0.15 + k * 0.1)});`));
    icones.forEach((_, k) => M.add(`tl.fromTo("#${id}-i${k}", { z: ${Z[3]}, scale: 0, opacity: 0 }, { z: ${Z[3]}, scale: 1, opacity: 1, duration: 0.3, ease: "back.out(2)" }, ${r3(t0 + 0.5 + k * 0.12)});`));
    // volta tudo pro lugar antes de a cena acabar
    M.add(`tl.to("#palco", { scale: 1, rotationY: 0, rotationX: 0, duration: 0.4, ease: "power3.inOut" }, ${volta});`);
    M.add(`tl.to("#r-wrap", { z: 0, duration: 0.4, ease: "power3.inOut" }, ${volta});`);
    M.add(`tl.to("#v-rot", { filter: "blur(0px) brightness(1)", duration: 0.4, ease: "power2.inOut" }, ${volta});`);
    M.add(`tl.set("#v-rot", { filter: "none" }, ${c.ate});`);
    nomes.forEach((_, k) => M.add(`tl.to("#${id}-q${k}", { opacity: 0, duration: 0.2, ease: "none" }, ${volta});`));
    icones.forEach((_, k) => M.add(`tl.to("#${id}-i${k}", { opacity: 0, duration: 0.2, ease: "none" }, ${volta});`));
    M.somCena(c, "whoosh", t0, 0.7);
  },
});

// ── cenário: troca o fundo atrás da pessoa ───────────────────────────────────
// { fundo: "bokeh" | "neon" | "cor" | "grade" | "xadrez" | "estudio" | { material | arquivo }
//          | [três fundos] (a tela em tiras, um fundo em cada),
//   cor: "#ffd84d", palavra: "SEM", palavra_estilo: "gradiente" | "contorno" | "sombra",
//   rotulo: "Cenário 1 · cidade à noite", contorno: "brilho" | "adesivo" | "nenhum",
//   entrada: "corte" | "varredura" }
const BOLHAS = [[8, 14, 190, "#f4b183"], [78, 9, 150, "#6f8cff"], [30, 30, 120, "#f48fb1"], [88, 34, 210, "#f4b183"], [12, 52, 160, "#f48fb1"], [62, 58, 130, "#7fd3ff"], [92, 70, 170, "#f48fb1"], [22, 78, 200, "#f4b183"], [50, 88, 140, "#6f8cff"], [74, 92, 180, "#f48fb1"], [4, 94, 120, "#7fd3ff"], [46, 12, 100, "#f48fb1"]];
const FUNDOS = new Set(["bokeh", "neon", "cor", "grade", "xadrez", "estudio"]);
/** Luminância (0 a 1) de uma cor #rrggbb; cor desconhecida conta como escura. */
function luminancia(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex ?? ""));
  if (!m) return 0;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function fundoCenario(M, c, f, corFundo, sufixo) {
  if (f && typeof f === "object") {
    const m = M.midia(f, `cena ${c.i} (cenário)`);
    if (m?.tipo === "imagem") return { classe: "imagem", estilo: "", dentro: `<img src="${esc(m.arquivo)}" alt="" />` };
    M.avisar(`cena ${c.i} (cenário): o fundo precisa ser uma imagem`);
    return { classe: "cor", estilo: `background:${cor("acento")}`, dentro: "" };
  }
  if (!FUNDOS.has(f)) {
    if (f) M.avisar(`cena ${c.i} (cenário): fundo desconhecido "${f}" (use ${[...FUNDOS].join(", ")} ou uma imagem)`);
    f = "cor";
  }
  if (f === "bokeh") return { classe: "bokeh", estilo: "", dentro: BOLHAS.map(([x, y, d, c0]) => `<i class="bolha-luz" style="left:${x}%;top:${y}%;width:${d}px;height:${d}px;margin:-${d / 2}px 0 0 -${d / 2}px;background:${c0}"></i>`).join("") + `<b class="predios"></b>` };
  if (f === "neon") {
    const h = c._cabeca;
    const d = Math.round(h.alt * 1.5);
    return { classe: "neon", estilo: "", dentro: `<i class="raios" style="left:${Math.round(h.x - 1300)}px;top:${Math.round(h.y - 1300)}px"></i><i class="chao"></i><i class="aro" id="${sufixo}-aro" style="left:${Math.round(h.x - d / 2)}px;top:${Math.round(h.y - d / 2 - h.alt * 0.04)}px;width:${d}px;height:${d}px"></i>` };
  }
  if (f === "grade") return { classe: "grade", estilo: "", dentro: `<i class="chao"></i>` };
  if (f === "xadrez") return { classe: "xadrez", estilo: "", dentro: "" };
  if (f === "estudio") return { classe: "estudio", estilo: corFundo ? `--estudio:${cor(corFundo)}` : "", dentro: "" };
  return { classe: "cor", estilo: `background:${cor(corFundo, "acento")}`, dentro: "" };
}
registrar("cenario", {
  zona: () => "fundo",
  preparar(M, c) {
    M.recortes.push({ de: c.de, ate: c.ate, motivo: `cenário (cena ${c.i})` });
    // a palavra gigante atrás da cabeça já é a mensagem: a legenda sai (volta com "legenda": true)
    if (c.palavra) {
      if (c.legenda !== true) c._semLegenda = true;
      const topo = M.espacoLivre(c.de + 0.05).topo;
      c._banda = [Math.max(80, topo - 250), topo + 60];
    }
    // fundo claro (xadrez, cor clara): a legenda troca pra tinta escura
    const claro = (f, cr) => f === "xadrez" || ((f ?? "cor") === "cor" && luminancia(cr) > 0.55);
    const fundos = Array.isArray(c.fundo) ? c.fundo : [c.fundo];
    const coresF = Array.isArray(c.cor) ? c.cor : [c.cor];
    if (fundos.length === 1 && claro(fundos[0], coresF[0])) M.fundosClaros.push([c.de, c.ate]);
  },
  montar(M, c, id, camera) {
    // onde está a cabeça (o aro e os raios de neon ficam centrados nela)
    const trc = camera.trechoEm(c.de + 0.05);
    const cabeca = { x: trc.camA.x + trc.camA.scale * trc.rosto.x * W, y: trc.camA.y + trc.camA.scale * trc.rosto.y * H, alt: trc.rosto.altura * H * trc.camA.scale };
    c._cabeca = cabeca;
    const lista = Array.isArray(c.fundo) ? c.fundo.slice(0, 3) : [c.fundo ?? "cor"];
    const coresTira = Array.isArray(c.cor) ? c.cor : [c.cor];
    const n = lista.length;
    // um fundo só, ou a tela em tiras verticais (um fundo em cada)
    const partes = lista.map((f, k) => {
      const { classe, estilo, dentro } = fundoCenario(M, c, f, coresTira[k] ?? coresTira[0], `${id}-f${k}`);
      const recorte = n > 1 ? `clip-path:inset(0 ${r3(100 - ((k + 1) * 100) / n)}% 0 ${r3((k * 100) / n)}%);` : "";
      return { classe, html: `<div class="cen-fundo ${classe}" id="${id}-bg${k}" style="${recorte}${estilo}">${dentro}</div>` };
    });
    const divisores = n > 1 ? Array.from({ length: n - 1 }, (_, k) => `<i class="cen-div" style="left:${Math.round(((k + 1) * W) / n) - 3}px"></i>`).join("") : "";
    if (n > 1 && Array.isArray(c.rotulos)) {
      const chips = c.rotulos.slice(0, n).map((t, k) => `<span class="cen-tc" style="left:${Math.round(((k + 0.5) * W) / n)}px"><span class="cen-chip tira${partes[k].classe === "cor" ? " clara" : ""}" id="${id}-tc${k}">${esc(t)}</span></span>`).join("");
      M.html.cenas.push(`      <div id="${id}-tcs" class="clip cen-tiras-chips" ${M.attrs(c)}>${chips}</div>`);
      c.rotulos.slice(0, n).forEach((_, k) => M.add(`tl.from("#${id}-tc${k}", { y: 30, opacity: 0, duration: 0.3, ease: "back.out(1.8)" }, ${r3(c.de + 0.4 + k * 0.12)});`));
    }
    // palavra gigante atrás da pessoa
    let palavra = "";
    if (c.palavra) {
      const fonte = c.fonte ?? papel(M, "lettering", "larga");
      const tam = M.ajustarFonte(c.palavra, fonte, 1000, 90, 330);
      const topo = Number.isFinite(Number(c.y)) ? Number(c.y) : Math.round(clamp(topoDaCabeca(camera, c.de + 0.05) - tam * 0.74, 80, 900));
      const letras = [...String(c.palavra)].map((ch, k) => `<span id="${id}-w${k}">${ch === " " ? "&nbsp;" : esc(ch)}</span>`).join("");
      palavra = `<div class="cen-palavra ${esc(c.palavra_estilo ?? "gradiente")}" style="top:${topo}px;${cssFonte(fonte)}font-size:${tam}px${c.palavra_cor ? `;color:${cor(c.palavra_cor)}` : ""}${c.palavra_cor2 ? `;--c2:${cor(c.palavra_cor2)}` : ""}">${letras}</div>`;
    }
    M.html.atras.push(`        <div id="${id}" class="clip cenario" ${M.attrs(c)}><div class="cen-tudo" id="${id}-tudo">${partes.map((p) => p.html).join("")}${divisores}${palavra}</div></div>`);
    // etiqueta no alto dizendo qual é o cenário
    if (c.rotulo) M.html.cenas.push(`      <div id="${id}-rt" class="clip cen-rotulo" ${M.attrs(c)}><span id="${id}-rti"><i></i>${esc(c.rotulo)}</span></div>`);

    // entrada: corte seco (o padrão), varredura de baixo pra cima com a linha de luz, ou as tiras caindo
    if (n > 1) partes.forEach((_, k) => M.add(`tl.from("#${id}-bg${k}", { yPercent: ${k % 2 ? 100 : -100}, duration: 0.45, ease: "power3.out" }, ${r3(c.de + k * 0.12)});`));
    else if (c.entrada === "varredura") {
      const d = r3(Math.min(1.4, (c.ate - c.de) * 0.5));
      // a linha de luz desce: em cima dela já é o cenário novo, embaixo ainda é o vídeo original
      const [novo, velho] = c.rotulos_varredura ?? ["SEM FUNDO", "ORIGINAL"];
      M.add(`tl.fromTo("#${id}-tudo", { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: ${d}, ease: "power1.inOut" }, ${c.de});`);
      M.html.cenas.push(`      <div id="${id}-ln" class="clip cen-linha" ${M.attrs({ ...c, ate: r3(c.de + d + 0.05) })}><div class="cen-varre" id="${id}-lni"><i></i>${c.rotulos_varredura === false ? "" : `<span class="cen-chip novo">↑ ${esc(novo)}</span><span class="cen-chip velho">↓ ${esc(velho)}</span>`}</div></div>`);
      M.add(`tl.fromTo("#${id}-lni", { y: 0 }, { y: ${H}, duration: ${d}, ease: "power1.inOut" }, ${c.de});`);
    } else M.add(`tl.from("#${id}-bg0", { opacity: 0, duration: 0.14, ease: "none" }, ${c.de});`);
    if (c.palavra) {
      const letras = [...String(c.palavra)].length;
      for (let k = 0; k < letras; k++) M.add(`tl.from("#${id}-w${k}", { y: 90, rotation: ${k % 2 ? 9 : -9}, opacity: 0, duration: 0.3, ease: "back.out(1.9)" }, ${r3(c.de + 0.12 + k * 0.07)});`);
      M.somCena(c, "impacto", c.de + 0.12, 0.6);
    }
    if (c.rotulo) M.add(`tl.from("#${id}-rti", { y: -20, opacity: 0, duration: 0.26, ease: "power2.out" }, ${r3(c.de + 0.05)});`);
    partes.forEach((p, k) => {
      if (p.classe === "bokeh") M.add(`tl.fromTo("#${id}-bg${k} .bolha-luz", { y: -24 }, { y: 24, duration: ${r3(c.ate - c.de)}, ease: "sine.inOut" }, ${c.de});`);
      if (p.classe === "neon") M.add(`tl.fromTo("#${id}-f${k}-aro", { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "back.out(1.6)" }, ${r3(c.de + 0.1)});`);
    });
    // contorno em volta da pessoa: brilho ou adesivo (borda branca)
    const contorno = c.contorno ?? M.ESTILO.cenario?.contorno ?? (n === 1 && partes[0].classe === "cor" ? "adesivo" : "brilho");
    if (contorno !== "nenhum") {
      const filtro = contorno === "adesivo" ? "drop-shadow(7px 0 0 #fff) drop-shadow(-7px 0 0 #fff) drop-shadow(0 7px 0 #fff) drop-shadow(0 -7px 0 #fff)" : `drop-shadow(0 0 5px ${M.ESTILO.cenario?.brilho ?? "rgba(196,181,253,1)"}) drop-shadow(0 0 26px ${M.ESTILO.cenario?.brilho2 ?? "rgba(139,92,246,0.9)"})`;
      M.add(`tl.set("#r-inner", { filter: "${filtro}" }, ${c.de});`);
      M.add(`tl.set("#r-inner", { filter: "none" }, ${c.ate});`);
    }
    M.somCena(c, "whoosh", c.de, 0.5);
  },
});

// ── celular: o vídeo dele (ou uma imagem) dentro de um celular, com chamadas ──
// { material | arquivo (sem eles, a tela do celular mostra o próprio vídeo),
//   itens: [{ texto: "Título animado", lado: "esquerda" | "direita", y: 0.2, icone, i | t }] }
const TELA = { x: 300, y: 330, w: 480, h: 1010, r: 50 };
registrar("celular", {
  pip: false,
  zona: (c) => (c.material || c.arquivo ? "cheia" : "palco"),
  preparar(M, c) {
    c._tela = c.titulo || c.numero !== undefined || c.rotulo ? { x: 310, y: 500, w: 460, h: 930, r: 48 } : TELA;
    if (c.zona === "palco") {
      c._janela = { ...c._tela, limpa: true };
      c._rostoK = 0.4;
      // a legenda vai dentro da tela do celular, menor
      c._legendaY = Math.round(c._tela.y + c._tela.h * 0.68);
      c._legendaEscala = 0.58;
    }
  },
  montar(M, c, id) {
    const T = c._tela;
    const naTela = c.zona === "cheia" ? M.midia(c, `cena ${c.i} (celular)`) : null;
    if (c.zona === "cheia" && !naTela) return;
    if (naTela && naTela.tipo !== "imagem") return M.avisar(`cena ${c.i} (celular): ${naTela.arquivo} é vídeo; na tela do celular entra imagem (ou nada: aí aparece o seu próprio vídeo)`);
    const itens = (c.itens ?? []).map((it) => (typeof it === "string" ? { texto: it } : it)).slice(0, 4);
    const moldura = `<div class="cel-moldura" id="${id}-m" style="left:${T.x - 16}px;top:${T.y - 16}px;width:${T.w + 32}px;height:${T.h + 32}px">${naTela ? `<img src="${esc(naTela.arquivo)}" alt="" />` : ""}<i class="cel-ilha"></i><i class="cel-reflexo"></i></div>`;
    const chips = itens.map((it, k) => {
      const lado = it.lado ?? (k % 2 ? "direita" : "esquerda");
      const y = Math.round(T.y + T.h * clamp(Number(it.y ?? 0.16 + k * 0.22), 0.04, 0.92));
      const pos = lado === "esquerda" ? `right:${W - (T.x + 92)}px` : `left:${T.x + T.w - 92}px`;
      return `<div class="cel-chip ${lado}" id="${id}-c${k}" style="top:${y}px;${pos}">${M.icone(it.icone ?? "sparkles")}<span>${esc(it.texto ?? "")}</span></div>`;
    });
    const passo = clamp((c.ate - c.de - 1) / Math.max(1, itens.length), 0.3, 1.2);
    const tempos = itens.map((it, k) => r3(clamp(M.tempoDe(it, c.de + 0.6 + k * passo), c.de + 0.2, c.ate - 0.2)));
    if (c.zona === "palco") {
      // dentro do palco: a janela do vídeo é a tela do celular
      M.html.vidro.push(`        <div id="${id}" class="clip cel-camada" ${M.attrs(c)}>${moldura}</div>`, ...chips.map((ch, k) => `        <div id="${id}-k${k}" class="clip cel-camada" ${M.attrs(c)}>${ch}</div>`));
      const ox = T.x + T.w / 2;
      const oy = T.y + T.h / 2;
      M.add(`tl.set("#palco", { transformOrigin: "${ox}px ${oy}px" }, ${c.de});`);
      M.add(`tl.to("#palco", { rotationY: -16, rotationX: 4, duration: 0.5, ease: "power3.out" }, ${c.de});`);
      const volta = r3(c.ate - 0.3);
      if (volta - c.de - 0.5 > 0.3) M.add(`tl.to("#palco", { rotationY: 12, duration: ${r3(volta - c.de - 0.5)}, ease: "sine.inOut" }, ${r3(c.de + 0.5)});`);
      M.add(`tl.to("#palco", { rotationY: 0, rotationX: 0, duration: 0.3, ease: "power2.inOut" }, ${volta});`);
      M.add(`tl.set("#palco", { transformOrigin: "50% 50%", rotationY: 0, rotationX: 0 }, ${c.ate});`);
      M.add(`tl.fromTo("#${id}-m", { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "none" }, ${r3(c.de + 0.12)});`);
      itens.forEach((_, k) => M.add(`tl.set("#${id}-k${k}", { z: 90 }, ${c.de});`));
    } else {
      M.html.cenas.push(`      <div id="${id}" class="clip tela-cheia celular" ${M.attrs(c)}><div class="tela-cheia-in void" id="${id}-bg"></div><div class="cel-palco"><div class="cel-gira" id="${id}-g">${moldura}${chips.join("")}</div></div></div>`);
      M.add(`tl.from("#${id}-bg", { opacity: 0, duration: 0.15, ease: "none" }, ${c.de});`);
      M.add(`tl.fromTo("#${id}-g", { rotationY: 34, rotationX: 10, y: 200, opacity: 0 }, { rotationY: -14, rotationX: 4, y: 0, opacity: 1, duration: 0.55, ease: "power3.out" }, ${c.de});`);
      if (c.ate - c.de - 0.55 > 0.3) M.add(`tl.to("#${id}-g", { rotationY: 12, duration: ${r3(c.ate - c.de - 0.55)}, ease: "sine.inOut" }, ${r3(c.de + 0.55)});`);
    }
    // cabeçalho de passo em cima do celular (número, rótulo e título), igual ao da janela
    if (c.titulo || c.numero !== undefined || c.rotulo) M.html.cenas.push(`      <div id="${id}-cw" class="clip jia-cab-solto" ${M.attrs(c)}>${cabecalhoPasso(M, c, id)}</div>`);
    itens.forEach((it, k) => {
      const lado = it.lado ?? (k % 2 ? "direita" : "esquerda");
      M.add(`tl.fromTo("#${id}-c${k}", { x: ${lado === "esquerda" ? -60 : 60}, scale: 0.6, opacity: 0 }, { x: 0, scale: 1, opacity: 1, duration: 0.34, ease: "back.out(1.9)" }, ${tempos[k]});`);
      M.somCena(c, "pop", tempos[k], 0.7);
    });
    M.somCena(c, "whoosh", c.de, 0.6);
  },
});
