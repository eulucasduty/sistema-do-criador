// Mais componentes: tutorial numa janela em 3D, modelo isométrico em camadas, etiqueta de preço,
// placar, banho de cor, lugar e hora datilografados, documento com marca-texto, selo "ao vivo",
// moldura e chamadas apontando pra um ponto da tela.

import fs from "node:fs";
import { W, H, clamp, esc, linhasDe, marcar, r3 } from "./util.mjs";
import { cssFonte } from "./fontes.mjs";
import { abrir, fechar, registrar, zonaDeCard } from "./cenas.mjs";
import { bandaDe, cor, ondeCabe, papel } from "./cenas-extra.mjs";

/** Texto que se digita letra a letra entre t0 e t0+dur. `realces`: palavras que ficam marcadas. */
function digitado(M, id, texto, realces, t0, dur) {
  const marca = new Set((realces ?? []).map((r) => String(r).toLowerCase()));
  let n = 0;
  const html = String(texto)
    .split(/\s+/)
    .map((p) => {
      const limpa = p.replace(/[.,;:!?]+$/, "").toLowerCase();
      const letras = [...p].map((ch) => (n++, `<i>${esc(ch)}</i>`)).join("");
      return `<span class="dg-p${marca.has(limpa) ? " realce" : ""}">${letras}</span>`;
    })
    .join(" ");
  M.add(`tl.to("#${id} i", { opacity: 1, duration: 0.001, stagger: ${r3(dur / Math.max(1, n))}, ease: "none" }, ${r3(t0)});`);
  return { html, n };
}

// ── janela em 3D: o passo de um tutorial (comando digitado, lista de tarefas, linha do tempo) ──
// { numero: "01", rotulo: "EM PORTUGUÊS", titulo: "Você pede | a edição.", janela: "Editor IA",
//   prompt: "Corta as pausas e põe legenda", realces: ["pausas", "legenda"], anexo: "take-01.mp4",
//   digitado: true (o comando já aparece escrito), itens: ["Pausas cortadas", …] (lista de tarefas,
//   embaixo do comando), progresso: "Exportando vídeo…", tira: "cortes" | "montada" }
const ESTRELAS = [[120, 420], [960, 380], [90, 1080], [990, 1010], [540, 300], [860, 1300]];
/** Cabeçalho de passo: selo com o número, rótulo e título em duas linhas (o mesmo na janela e no celular). */
export function cabecalhoPasso(M, c, id) {
  const fonteT = c.fonte ?? papel(M, "titulo", "display");
  const linhas = linhasDe(c.titulo);
  const tamT = linhas.length ? Math.min(...linhas.map((l) => M.ajustarFonte(l, fonteT, 940, 44, 92))) : 0;
  const topo = c.numero !== undefined || c.rotulo ? `<div class="jia-topo">${c.numero !== undefined ? `<span class="jia-num">${esc(c.numero)}</span>` : ""}${c.rotulo ? `<span class="jia-rotulo">${esc(c.rotulo)}</span>` : ""}</div>` : "";
  if (topo) M.add(`tl.from("#${id}-cab .jia-topo", { y: -20, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.05)});`);
  linhas.forEach((_, k) => M.add(`tl.from("#${id}-t${k}", { y: 40, opacity: 0, duration: 0.36, ease: "power3.out" }, ${r3(c.de + 0.1 + k * 0.08)});`));
  return `<div class="jia-cab" id="${id}-cab">${topo}${linhas.map((l, k) => `<div class="jia-t l${Math.min(k, 1)}" id="${id}-t${k}" style="${cssFonte(fonteT)}font-size:${tamT}px">${esc(l)}</div>`).join("")}</div>`;
}
registrar("janela-ia", {
  zona: () => "cheia",
  montar(M, c, id) {
    const dur = c.ate - c.de;
    const cab = cabecalhoPasso(M, c, id);
    const t0 = r3(c.de + 0.55);
    let corpo = "";
    let fimPrompt = t0;
    const itens = (c.itens ?? []).map((it) => (typeof it === "string" ? { texto: it } : it)).slice(0, 4);
    if (c.prompt) {
      const realces = new Set((c.realces ?? []).map((r) => String(r).toLowerCase()));
      let texto;
      if (c.digitado) {
        // o comando já está escrito (passo seguinte do mesmo tutorial)
        texto = String(c.prompt).split(/\s+/).map((p) => `<span class="dg-p pronto${realces.has(p.replace(/[.,;:!?]+$/, "").toLowerCase()) ? " realce" : ""}">${esc(p)}</span>`).join(" ");
      } else {
        const d = r3(clamp(c.digitar ?? String(c.prompt).length * 0.04, 0.6, Math.max(0.8, dur - (itens.length ? 2.4 : 1.6))));
        texto = digitado(M, `${id}-tx`, c.prompt, c.realces, t0, d).html;
        fimPrompt = r3(t0 + d);
        for (let s = 0; s * 1.0 < d; s++) M.somCena(c, "teclado", t0 + s, 0.7);
        const tb = r3(Math.min(c.ate - 0.3, fimPrompt + 0.25));
        M.add(`tl.fromTo("#${id}-bt", { scale: 1 }, { scale: 1.28, duration: 0.14, ease: "power2.out", yoyo: true, repeat: 1, immediateRender: false }, ${tb});`);
        M.somCena(c, "click", tb);
        fimPrompt = r3(tb + 0.2);
      }
      corpo += `<div class="jia-texto${itens.length ? " curto" : ""}"><div class="jia-frase" id="${id}-tx">${texto}</div><div class="jia-acoes">${c.anexo ? `<span class="jia-anexo" id="${id}-ax">${M.icone("film")}<span>${esc(c.anexo)}</span></span>` : "<span></span>"}<span class="jia-enviar" id="${id}-bt">${M.icone("arrow-up")}</span></div></div>`;
      if (c.anexo && !c.digitado) M.add(`tl.from("#${id}-ax", { x: -24, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.4)});`);
    }
    if (itens.length) {
      const inicio = c.prompt && !c.digitado ? fimPrompt : c.de + 0.5;
      const passo = clamp((c.ate - inicio - (c.progresso ? 1.2 : 0.5)) / itens.length, 0.3, 1.4);
      corpo += `<div class="jia-lista">${itens.map((it, k) => `<div class="jia-item" id="${id}-i${k}"><span class="jia-check"><b id="${id}-c${k}">${M.icone("check")}</b></span><span>${esc(it.texto ?? "")}</span></div>`).join("")}</div>`;
      itens.forEach((it, k) => {
        const t = r3(clamp(M.tempoDe(it, inicio + 0.1 + k * passo), c.de + 0.3, c.ate - 0.2));
        M.add(`tl.from("#${id}-i${k}", { x: -26, opacity: 0, duration: 0.26, ease: "power3.out" }, ${r3(Math.max(c.de + 0.3, t - 0.3))});`);
        M.add(`tl.from("#${id}-c${k}", { scale: 0, duration: 0.26, ease: "back.out(2.6)" }, ${t});`);
        M.add(`tl.to("#${id}-i${k}", { opacity: 1, duration: 0.2, ease: "none" }, ${t});`);
        M.somCena(c, "pop", t, 0.7);
      });
    }
    if (c.progresso) {
      const de = Number(c.de_valor ?? 22);
      corpo += `<div class="jia-prog" id="${id}-pg"><div class="jia-prog-topo"><span>${esc(c.progresso)}</span><b id="${id}-pc">${de}%</b></div><div class="jia-barra"><i id="${id}-pb"></i></div></div>`;
      const tp = r3(clamp(c.ate - Math.min(2.2, dur * 0.4), c.de + 0.4, c.ate - 0.6));
      const d = r3(Math.max(0.4, c.ate - tp - 0.35));
      M.add(`tl.from("#${id}-pg", { opacity: 0, duration: 0.2, ease: "none" }, ${r3(tp - 0.2)});`);
      M.add(`(() => { const o = { v: ${de} }; const el = document.getElementById("${id}-pc"); tl.to(o, { v: 100, duration: ${d}, ease: "power1.inOut", onUpdate: () => (el.textContent = Math.round(o.v) + "%") }, ${tp}); })();`);
      M.add(`tl.fromTo("#${id}-pb", { scaleX: ${r3(de / 100)} }, { scaleX: 1, duration: ${d}, ease: "power1.inOut" }, ${tp});`);
      M.somCena(c, "ding", tp + d, 0.8);
    }
    // a tira da linha do tempo embaixo da janela: os clipes (com os buracos das pausas, em "cortes",
    // ou já montados, com a trilha de legendas), a onda do áudio e a agulha andando
    let tira = "";
    if (c.tira) {
      const montada = c.tira === "montada";
      const mini = (k) => (fs.existsSync(`assets/miniaturas/m${k}.jpg`) ? ` style="background-image:url('assets/miniaturas/m${k}.jpg')"` : "");
      const clipes = [22, 14, 18, 12, 16, 12].map((w, k) => `<i class="jia-clipe${k % 2 ? " b" : ""}" style="flex:${w}"><b${mini(k)}></b></i>${!montada && k < 5 && k % 2 === 0 ? `<i class="jia-pausa" style="flex:${6 + (k % 3) * 2}"></i>` : ""}`).join("");
      const legs = montada ? `<div class="jia-legs">${[18, 26, 14, 22, 12].map((w) => `<i style="flex:${w}"></i>`).join("")}</div>` : "";
      // a janela cresce com a lista e a barra: a tira desce junto
      const alturaJanela = 76 + 62 + (c.prompt ? (itens.length ? 200 : 300) + 22 : 0) + (itens.length ? itens.length * 74 + 22 : 0) + (c.progresso ? 92 : 0);
      const topoTira = Math.round(clamp(520 + alturaJanela + 46, 1200, 1280));
      tira = `<div class="jia-tira${montada ? " montada" : ""}" id="${id}-tr" style="top:${topoTira}px"><div class="jia-clipes">${clipes}</div><div class="jia-onda">${Array.from({ length: 44 }, (_, k) => `<i style="height:${24 + ((k * 37) % 62)}%"></i>`).join("")}</div>${legs}<b class="jia-agulha" id="${id}-ag"></b></div>`;
    }
    const estrelas = ESTRELAS.map(([x, y], k) => `<i class="jia-estrela" style="left:${x}px;top:${y}px;width:${k % 2 ? 26 : 38}px;height:${k % 2 ? 26 : 38}px"></i>`).join("");
    M.html.cenas.push(
      `      <div id="${id}" class="clip tela-cheia jia${c._pip ? " com-pip" : ""}${c.tira ? "" : " sem-tira"}" ${M.attrs(c)}><div class="jia-fundo void" id="${id}-bg"><i class="jia-chao"></i>${estrelas}</div>${cab}<div class="jia-palco"><div class="jia-janela" id="${id}-j"><div class="jia-barra-topo"><i></i><i></i><i></i><span>${M.icone("sparkles")}${esc(c.janela ?? "Editor IA")}</span></div><div class="jia-corpo">${corpo}</div></div></div>${tira}</div>`,
    );
    M.add(`tl.from("#${id}-bg", { opacity: 0, duration: 0.18, ease: "none" }, ${c.de});`);
    M.add(`tl.fromTo("#${id}-j", { rotationX: 30, rotationY: -26, y: 180, opacity: 0 }, { rotationX: 9, rotationY: -13, y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }, ${r3(c.de + 0.12)});`);
    if (dur > 1.4) M.add(`tl.to("#${id}-j", { rotationX: 4, rotationY: -3, duration: ${r3(dur - 0.8)}, ease: "sine.inOut" }, ${r3(c.de + 0.72)});`);
    M.add(`tl.fromTo("#${id}-bg .jia-estrela", { scale: 0.3, opacity: 0.15 }, { scale: 1, opacity: 0.95, duration: 0.7, ease: "sine.inOut", stagger: 0.18, yoyo: true, repeat: ${Math.max(1, Math.round(dur / 0.7))} }, ${c.de});`);
    if (c.tira) {
      M.add(`tl.from("#${id}-tr", { y: 60, opacity: 0, duration: 0.4, ease: "power3.out" }, ${r3(c.de + 0.3)});`);
      M.add(`tl.fromTo("#${id}-ag", { x: 0 }, { x: 812, duration: ${r3(Math.max(0.5, dur - 0.6))}, ease: "none" }, ${r3(c.de + 0.5)});`);
    }
    M.somCena(c, "whoosh", c.de + 0.1, 0.6);
  },
});

// ── modelo isométrico em camadas (uma ideia desmontada em andares) ───────────
// { rotulo: "COMO FUNCIONA", titulo: "TRÊS CAMADAS",
//   camadas: [{ nome: "ENTRADA", sub: "o que chega", icone: "inbox", i | t }, …] (de baixo pra cima) }
registrar("isometrico", {
  zona: () => "cheia",
  montar(M, c, id) {
    const camadas = (c.camadas ?? []).map((x) => (typeof x === "string" ? { nome: x } : x)).slice(0, 4);
    if (!camadas.length) return M.avisar(`cena ${c.i} (isometrico) sem camadas`);
    const n = camadas.length;
    const dur = c.ate - c.de;
    const S = 380; // lado da placa
    const T = 44; // espessura
    const INCL = 58;
    const SEN = Math.sin((INCL * Math.PI) / 180);
    const cx = 372;
    const yBase = 800;
    // os andares cabem entre o título e o bloco de baixo: a distância entre eles se ajusta
    const meiaAltura = S * 0.7071 * Math.cos((INCL * Math.PI) / 180);
    const tetoTitulo = 150 + (c.rotulo ? 46 : 0) + linhasDe(c.titulo).length * 112 + 40;
    const GAP = n > 1 ? Math.round(clamp((yBase - meiaAltura - SEN * T - tetoTitulo) / (SEN * (n - 1)), 70, 156)) : 0;
    const paleta = M.ESTILO.isometrico?.cores ?? ["var(--acento)", "var(--acento2)", "var(--acento3)", "var(--texto)"];
    const passo = clamp((dur - 1) / n, 0.4, 3);
    const tempos = camadas.map((x, k) => r3(clamp(M.tempoDe(x, c.de + 0.3 + k * passo), c.de + 0.1, c.ate - 0.3)));
    const fonteN = papel(M, "isometrico", "condensada");
    // o desenho em cima de cada andar: o ícone (padrão), um caminho, um facho de luz, blocos ou grade
    const cubo = (x, y, w, d, h) => `<i class="iso-cubo t" style="left:${x}px;top:${y}px;width:${w}px;height:${d}px;transform:translateZ(${h}px)"></i><i class="iso-cubo a" style="left:${x}px;top:${y + d}px;width:${w}px;height:${h}px"></i><i class="iso-cubo b" style="left:${x + w}px;top:${y}px;width:${h}px;height:${d}px"></i>`;
    const desenho = (x, k) => {
      if (x.desenho === "caminho") return `<svg class="iso-caminho" viewBox="0 0 100 100" fill="none"><path id="${id}-ds${k}" d="M14 86 L14 44 Q14 24 34 24 L68 24 Q86 24 86 44 L86 64" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" /></svg>`;
      if (x.desenho === "luz") return `<i class="iso-luz" id="${id}-ds${k}"></i>`;
      if (x.desenho === "blocos") return cubo(50, 60, 130, 90, 70) + cubo(220, 50, 100, 100, 110) + cubo(110, 210, 170, 90, 46);
      if (x.desenho === "grade") return `<i class="iso-grade"></i>`;
      return M.icone(x.icone ?? "layers");
    };
    const placas = camadas.map((x, k) => `<div class="iso-placa" id="${id}-p${k}" style="--cor:${paleta[k % paleta.length]}"><div class="iso-topo">${desenho(x, k)}</div><i class="iso-lado a"></i><i class="iso-lado b"></i></div>`).join("");
    const rotulos = camadas
      .map((x, k) => {
        const y = Math.round(yBase - SEN * (k * GAP + T));
        const tam = M.ajustarFonte(x.nome ?? "", fonteN, 300, 30, 56);
        return `<div class="iso-rotulo" id="${id}-r${k}" style="left:${Math.round(cx + S * 0.7071 + 8)}px;top:${y - 44}px;--cor:${paleta[k % paleta.length]}"><i></i><div><span>${String(k + 1).padStart(2, "0")}</span><b style="${cssFonte(fonteN)}font-size:${tam}px">${esc(x.nome ?? "")}</b></div></div>`;
      })
      .join("");
    // o bloco de baixo: os ícones das camadas (o da vez aceso) e o texto dela
    const comPip = Boolean(c._pip);
    const bx = comPip ? (c._pip === "esquerda" ? 510 : 40) : 90;
    const bw = comPip ? 530 : 900;
    const fonteB = papel(M, "cabecalho", "condensada");
    const tamB = Math.min(...camadas.map((x) => M.ajustarFonte(x.sub ?? x.nome ?? "", fonteB, bw, 34, comPip ? 66 : 84)));
    const bloco = `<div class="iso-bloco" style="left:${bx}px;top:${comPip ? 1010 : 1090}px;width:${bw}px"><div class="iso-icones">${camadas.map((x, k) => `<span id="${id}-ic${k}" style="--cor:${paleta[k % paleta.length]}">${M.icone(x.icone ?? "layers")}</span>`).join("")}</div><div class="iso-textos">${camadas.map((x, k) => `<div class="iso-tx" id="${id}-x${k}" style="${cssFonte(fonteB)}font-size:${tamB}px">${esc(x.sub ?? x.nome ?? "")}</div>`).join("")}</div></div>`;
    const fonteT = papel(M, "cabecalho", "condensada");
    const linhas = linhasDe(c.titulo);
    const tamT = linhas.length ? Math.min(...linhas.map((l) => M.ajustarFonte(l, fonteT, 960, 50, 110))) : 0;
    const cab = c.titulo || c.rotulo ? `<div class="iso-cab" id="${id}-cab">${c.rotulo ? `<div class="iso-olho">${esc(c.rotulo)}</div>` : ""}${linhas.map((l, k) => `<div class="iso-t l${Math.min(k, 1)}" style="${cssFonte(fonteT)}font-size:${tamT}px">${esc(l)}</div>`).join("")}</div>` : "";
    M.html.cenas.push(
      `      <div id="${id}" class="clip cena-cheia isometrico" ${M.attrs(c)}><div class="cheia-fundo void" id="${id}-bg"></div>${cab}<div class="iso-cena" style="left:${cx}px;top:${yBase}px"><div class="iso-incl"><div class="iso-giro" id="${id}-g">${placas}</div></div></div>${rotulos}${bloco}</div>`,
    );
    M.add(`tl.from("#${id}-bg", { opacity: 0, duration: 0.2, ease: "none" }, ${c.de});`);
    if (cab) M.add(`tl.from("#${id}-cab", { y: -30, opacity: 0, duration: 0.34, ease: "power3.out" }, ${r3(c.de + 0.05)});`);
    M.add(`tl.fromTo("#${id}-g", { rotationZ: 50 }, { rotationZ: 41, duration: ${r3(dur)}, ease: "none" }, ${c.de});`);
    camadas.forEach((x, k) => {
      const t = tempos[k];
      const z = k * GAP;
      // cada andar cai de cima e assenta; o da vez sobe um pouco e o rótulo dele acende
      M.add(`tl.fromTo("#${id}-p${k}", { z: ${z + 1500} }, { z: ${z + 22}, duration: 0.55, ease: "power3.out" }, ${t});`);
      M.add(`tl.fromTo("#${id}-r${k}", { opacity: 0, x: 30 }, { opacity: 1, x: 0, duration: 0.3, ease: "power3.out" }, ${r3(t + 0.3)});`);
      M.add(`tl.fromTo("#${id}-ic${k}", { opacity: 0.3, scale: 0.86 }, { opacity: 1, scale: 1, duration: 0.24, ease: "back.out(2)" }, ${t});`);
      M.add(`tl.fromTo("#${id}-x${k}", { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.26, ease: "power3.out" }, ${r3(t + 0.05)});`);
      if (x.desenho === "caminho") M.add(`tl.to("#${id}-ds${k}", { attr: { "stroke-dashoffset": 0 }, duration: 0.9, ease: "power2.inOut" }, ${r3(t + 0.5)});`);
      if (x.desenho === "luz") M.add(`tl.fromTo("#${id}-ds${k}", { opacity: 0, scaleX: 0.3 }, { opacity: 1, scaleX: 1, duration: 0.9, ease: "power2.out" }, ${r3(t + 0.5)});`);
      const fim = tempos[k + 1];
      if (fim !== undefined) {
        M.add(`tl.to("#${id}-p${k}", { z: ${z}, duration: 0.3, ease: "power2.inOut" }, ${fim});`);
        M.add(`tl.to("#${id}-r${k}", { opacity: 0.5, duration: 0.2, ease: "none" }, ${fim});`);
        M.add(`tl.to("#${id}-ic${k}", { opacity: 0.3, scale: 0.86, duration: 0.2, ease: "none" }, ${fim});`);
        M.add(`tl.to("#${id}-x${k}", { opacity: 0, y: -20, duration: 0.16, ease: "power2.in" }, ${r3(Math.max(t + 0.3, fim - 0.16))});`);
      }
      M.somCena(c, "pop", t + 0.4, 0.8);
    });
  },
});

// ── etiqueta: um preço ou número preso num ponto da tela, com brilho ─────────
const CORES_ETIQUETA = { verde: "#39ff14", vermelho: "#ff2a2a", amarelo: "#ffee00", branco: "#ffffff" };
registrar("etiqueta", {
  zona: () => "sobre",
  montar(M, c, id) {
    const x = clamp(Number(c.x ?? 0.5), 0, 1) * W;
    const y = clamp(Number(c.y ?? 0.3), 0, 1) * H;
    const fonte = c.fonte ?? papel(M, "etiqueta", "bangers");
    const tam = M.ajustarFonte(c.texto ?? "", fonte, 760, 60, Number(c.tamanho ?? 150));
    const tinta = CORES_ETIQUETA[c.cor] ?? cor(c.cor, "acento");
    const giro = Number(c.inclinar ?? (c.i % 2 ? 4 : -4));
    M.html.cenas.push(`      <div id="${id}" class="clip etiqueta" ${M.attrs(c)} style="left:${r3(x - 450)}px;top:${r3(y - tam * 0.62)}px"><span id="${id}-e" style="${cssFonte(fonte)}font-size:${tam}px;color:${tinta};--brilho:${tinta}">${esc(c.texto ?? "")}</span></div>`);
    M.add(`tl.fromTo("#${id}-e", { scale: 0, rotation: ${giro * 3} }, { scale: 1, rotation: ${giro}, duration: 0.3, ease: "back.out(2.6)" }, ${c.de});`);
    M.somCena(c, c.som ?? "pop", c.de, 0.9);
  },
});

// ── placar: contador numa caixa clara no alto ────────────────────────────────
registrar("placar", {
  zona: () => "sobre",
  preparar(M, c) {
    c._y = Number.isFinite(Number(c.y)) ? Number(c.y) : (M.ESTILO.placar?.y ?? 352);
    c._banda = [c._y - 8, c._y + 180];
  },
  montar(M, c, id) {
    const casas = Number(c.casas ?? 0);
    const fmt = (v) => `${c.prefixo ?? ""}${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}${c.sufixo ?? ""}`;
    const fonte = papel(M, "etiqueta", "bangers");
    const maior = [fmt(c.de_valor ?? 0), fmt(c.para_valor ?? 0)].sort((a, b) => b.length - a.length)[0];
    const tam = M.ajustarFonte(maior, fonte, c.icone ? 360 : 480, 60, 124);
    M.html.cenas.push(`      <div id="${id}" class="clip placar" ${M.attrs(c)} style="top:${c._y}px"><div class="placar-in" id="${id}-in">${c.icone ? `<span class="placar-ic">${M.icone(c.icone)}</span>` : ""}<span class="placar-num" id="${id}-n" style="${cssFonte(fonte)}font-size:${tam}px">${esc(fmt(c.de_valor ?? 0))}</span>${c.rotulo ? `<span class="placar-rot">${esc(c.rotulo)}</span>` : ""}</div></div>`);
    const t0 = r3(c.de + 0.3);
    const dt = r3(clamp((c.ate - c.de) * 0.6, 0.5, 2.4));
    M.add(`tl.from("#${id}-in", { y: -70, scale: 0.7, opacity: 0, duration: 0.3, ease: "back.out(2)" }, ${c.de});`);
    M.add(`(() => { const o = { v: ${Number(c.de_valor ?? 0)} }; const el = document.getElementById("${id}-n"); tl.to(o, { v: ${Number(c.para_valor ?? 0)}, duration: ${dt}, ease: "power1.out", onUpdate: () => (el.textContent = ${JSON.stringify(c.prefixo ?? "")} + o.v.toLocaleString("pt-BR", { minimumFractionDigits: ${casas}, maximumFractionDigits: ${casas} }) + ${JSON.stringify(c.sufixo ?? "")}) }, ${t0}); })();`);
    M.add(`tl.fromTo("#${id}-in", { scale: 1 }, { scale: 1.1, duration: 0.12, ease: "power2.out", yoyo: true, repeat: 1, immediateRender: false }, ${r3(t0 + dt)});`);
    for (let k = 0; k < 4; k++) M.somCena(c, "tecla", t0 + (k * dt) / 4, 0.6);
    M.somCena(c, "ding", t0 + dt, 0.8);
  },
});

// ── banho de cor: a tela pisca verde (acertou) ou vermelha (errou) ───────────
registrar("tinta", {
  zona: () => "sobre",
  montar(M, c, id) {
    const tinta = CORES_ETIQUETA[c.cor] ?? cor(c.cor, "acento");
    M.html.cenas.push(`      <div id="${id}" class="clip tinta" ${M.attrs(c)}><i id="${id}-t" style="background:${tinta}"></i></div>`);
    M.add(`tl.fromTo("#${id}-t", { opacity: 0 }, { opacity: ${Number(c.forca ?? 0.36)}, duration: 0.06, ease: "none" }, ${c.de});`);
    M.add(`tl.to("#${id}-t", { opacity: 0, duration: ${r3(Math.min(0.5, c.ate - c.de - 0.06))}, ease: "power2.out" }, ${r3(c.de + 0.06)});`);
    if (c.som) M.somCena(c, c.som, c.de, 0.8);
  },
});

// ── lugar e hora, datilografados (abertura de documentário) ──────────────────
// { linhas: ["SÃO PAULO, BRASIL", "14 DE MARÇO · 09:42"], posicao: "auto" | "baixo" | "topo" | "centro" }
registrar("local", {
  zona: () => "sobre",
  preparar(M, c) {
    const linhas = linhasDe(c.linhas ?? c.texto);
    const altura = linhas.length * 64 + 30;
    c._pos = c.posicao === "centro" ? "centro" : (ondeCabe(M, c, altura) ?? "topo");
    c._banda = c._pos === "centro" ? [Math.round(960 - altura / 2), Math.round(960 + altura / 2)] : bandaDe(M, c, c._pos, altura);
    if (c._pos === "centro" && c.legenda !== true) c._semLegenda = true;
  },
  montar(M, c, id) {
    const linhas = linhasDe(c.linhas ?? c.texto);
    const fonte = c.fonte ?? papel(M, "local", "maquina");
    const tam = Math.min(...linhas.map((l) => M.ajustarFonte(l, fonte, 900, 30, Number(c.tamanho ?? 50))));
    let t = c.de + 0.2;
    const html = linhas
      .map((l, k) => {
        const d = r3(clamp(l.length / 16, 0.3, 1.6)); // 16 letras por segundo
        const dg = digitado(M, `${id}-l${k}`, l, [], t, d);
        for (let s = 0; s * 0.5 < d; s++) M.somCena(c, "tecla", t + s * 0.5, 0.5);
        t += d + 0.15;
        return `<div class="local-l${k === 0 ? " l0" : ""}" id="${id}-l${k}" style="${cssFonte(fonte)}font-size:${tam}px">${dg.html}</div>`;
      })
      .join("");
    M.html.cenas.push(`      <div id="${id}" class="clip local pos-${c._pos}" ${M.attrs(c)} style="top:${c._banda[0]}px"><div class="local-in" id="${id}-in">${html}<b class="local-cursor" id="${id}-cur"></b></div></div>`);
    M.add(`tl.fromTo("#${id}-cur", { opacity: 1 }, { opacity: 0, duration: 0.4, ease: "steps(1)", yoyo: true, repeat: ${Math.max(1, Math.floor((c.ate - c.de) / 0.4))}, immediateRender: false }, ${c.de});`);
    if (c.ate - c.de > 1.2 && c.ate < M.D - 0.1) M.add(`tl.to("#${id}-in", { opacity: 0, duration: 0.4, ease: "none" }, ${r3(c.ate - 0.4)});`);
  },
});

// ── documento: uma folha com um trecho marcado de marca-texto ────────────────
// { cabecalho: "DIÁRIO OFICIAL", data: "12 de março", titulo: "…", texto: "… ==trecho marcado== …",
//   fonte: "onde saiu", marcas: [{ i | t }] }
registrar("documento", {
  zona: zonaDeCard,
  montar(M, c, id) {
    let n = 0;
    const corpo = String(c.texto ?? "")
      .split(/(==[^=]+==)/)
      .map((p) => (p.startsWith("==") ? `<mark id="${id}-m${n++}">${esc(p.slice(2, -2))}</mark>` : esc(p)))
      .join("");
    const cab = c.cabecalho || c.data ? `<div class="doc-cab"><b>${esc(c.cabecalho ?? "")}</b><span>${esc(c.data ?? "")}</span></div>` : "";
    M.html.cenas.push(`      ${abrir(M, c, id)}<div class="doc" id="${id}-in">${cab}${c.titulo ? `<div class="doc-titulo">${marcar(c.titulo)}</div>` : ""}<p class="doc-texto">${corpo}</p>${c.fonte ? `<div class="doc-fonte">${esc(c.fonte)}</div>` : ""}</div>${fechar(c)}`);
    // a folha "entra em foco": chega borrada e maior, assenta torta
    const giro = Number(c.inclinar ?? -1.6);
    M.add(`tl.fromTo("#${id}-in", { opacity: 0, scale: 1.12, rotation: ${giro * 3}, filter: "blur(26px)" }, { opacity: 1, scale: 1, rotation: ${giro}, filter: "blur(0px)", duration: 0.28, ease: "power2.out" }, ${r3(c.de + 0.04)});`);
    const passo = clamp((c.ate - c.de - 1.1) / Math.max(1, n), 0.4, 1.4);
    for (let k = 0; k < n; k++) {
      const t = r3(clamp(M.tempoDe(c.marcas?.[k], c.de + 0.7 + k * passo), c.de + 0.3, c.ate - 0.3));
      M.add(`tl.fromTo("#${id}-m${k}", { backgroundSize: "0% 82%" }, { backgroundSize: "100% 82%", duration: 0.5, ease: "power1.inOut" }, ${t});`);
      M.somCena(c, "whoosh", t, 0.4);
    }
    M.somCena(c, c.som ?? "obturador", c.de + 0.04, 0.5);
  },
});

// ── selo de canto: "AO VIVO", hora, nome do canal ────────────────────────────
registrar("bug", {
  zona: () => "sobre",
  montar(M, c, id) {
    const canto = ["topo-esquerda", "topo-direita"].includes(c.canto) ? c.canto : "topo-esquerda";
    const dur = r3(c.ate - c.de);
    M.html.cenas.push(`      <div id="${id}" class="clip bug ${canto}" ${M.attrs(c)}>${c.texto === false ? "" : `<span class="bug-vivo"><i id="${id}-p"></i>${esc(c.texto ?? "AO VIVO")}</span>`}${c.hora ? `<span class="bug-hora">${esc(c.hora)}</span>` : ""}${c.canal ? `<span class="bug-canal">${esc(c.canal)}</span>` : ""}</div>`);
    if (c.texto !== false) M.add(`tl.fromTo("#${id}-p", { opacity: 1 }, { opacity: 0.2, duration: 0.6, ease: "steps(1)", yoyo: true, repeat: ${Math.max(1, Math.floor(dur / 0.6))}, immediateRender: false }, ${c.de});`);
  },
});

// ── moldura fina em volta do vídeo, com uma pílula embaixo ───────────────────
registrar("moldura", {
  zona: () => "sobre",
  montar(M, c, id) {
    M.html.cenas.push(`      <div id="${id}" class="clip moldura-cena" ${M.attrs(c)}><i class="mol-quadro" id="${id}-q"></i>${c.pilula ? `<div class="mol-linha"><span class="mol-pilula" id="${id}-p">${c.icone ? M.icone(c.icone) : ""}${esc(c.pilula)}</span></div>` : ""}</div>`);
    M.add(`tl.fromTo("#${id}-q", { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" }, ${c.de});`);
    if (c.pilula) {
      M.add(`tl.from("#${id}-p", { y: 40, opacity: 0, scale: 0.8, duration: 0.34, ease: "back.out(1.8)" }, ${r3(c.de + 0.25)});`);
      M.somCena(c, "pop", c.de + 0.25, 0.7);
    }
  },
});

// ── chamadas: etiquetas apontando pra um ponto da tela ───────────────────────
// itens: [{ texto: "Título animado", x: 0.22, y: 0.3, alvo: { x: 0.5, y: 0.38 }, icone, i | t }]
registrar("chamadas", {
  zona: () => "sobre",
  limite: { todas: ["itens", 4] },
  montar(M, c, id) {
    const itens = (c.itens ?? []).slice(0, 4);
    const passo = clamp((c.ate - c.de - 0.6) / Math.max(1, itens.length), 0.25, 1.2);
    const linhas = [];
    const chips = itens.map((it, k) => {
      const meia = (M.larguraEm(it.texto ?? "", "texto") * 30 + 96) / 2;
      const x = clamp(clamp(Number(it.x ?? 0.25), 0, 1) * W, meia + 24, W - meia - 24);
      const y = clamp(Number(it.y ?? 0.3 + k * 0.1), 0.02, 0.98) * H;
      if (it.alvo) {
        const ax = clamp(Number(it.alvo.x), 0, 1) * W;
        const ay = clamp(Number(it.alvo.y), 0, 1) * H;
        linhas.push(`<path id="${id}-l${k}" d="M${r3(x)} ${r3(y)} L${r3(ax)} ${r3(ay)}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" /><circle id="${id}-d${k}" cx="${r3(ax)}" cy="${r3(ay)}" r="9" />`);
      }
      return `<div class="chamada" style="left:${r3(x)}px;top:${r3(y)}px"><span id="${id}-c${k}">${M.icone(it.icone ?? "sparkles")}${esc(it.texto ?? "")}</span></div>`;
    });
    M.html.cenas.push(`      <div id="${id}" class="clip chamadas" ${M.attrs(c)}><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none">${linhas.join("")}</svg>${chips.join("")}</div>`);
    itens.forEach((it, k) => {
      const t = r3(clamp(M.tempoDe(it, c.de + 0.15 + k * passo), c.de, c.ate - 0.2));
      M.add(`tl.from("#${id}-c${k}", { scale: 0.5, opacity: 0, duration: 0.3, ease: "back.out(2)" }, ${t});`);
      if (it.alvo) {
        M.add(`tl.to("#${id}-l${k}", { attr: { "stroke-dashoffset": 0 }, duration: 0.3, ease: "power2.out" }, ${r3(t + 0.12)});`);
        M.add(`tl.from("#${id}-d${k}", { opacity: 0, duration: 0.15, ease: "none" }, ${r3(t + 0.36)});`);
      }
      M.somCena(c, "pop", t, 0.7);
    });
  },
});
