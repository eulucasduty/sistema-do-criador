// Componentes por cima do vídeo do criador e cards novos:
// cabeçalho (capítulo, passo com ícone), letreiro (tipografia que acompanha a fala), letreiro
// correndo, fotos (polaroid, card, janela de navegador), barra de prompt, grade de cards e carrossel.

import { W, H, clamp, esc, linhasDe, marcar, r3, semMarca } from "./util.mjs";
import { cssFonte, FONTES } from "./fontes.mjs";
import { abrir, faixaBaixo, fechar, registrar, zonaDeCard } from "./cenas.mjs";

export const papel = (M, chave, padrao) => M.ESTILO.fontes?.[chave] ?? padrao;
/**
 * Texto marcado (*trecho*) letra a letra: cada letra num <span> com o deslocamento dela na linha
 * (--lx, em "em"), pra um degradê continuar de uma letra pra outra mesmo com cada uma animada.
 */
export function porLetras(M, marcado, fonte, classe, caixa = (ch) => ch) {
  let x = 0;
  const espaco = FONTES[fonte]?.espaco ?? 0;
  const html = String(marcado)
    .split(/\*([^*]+)\*/)
    .map((parte, k) => {
      let dentro = "";
      for (const ch of parte) {
        dentro += ch === " " ? " " : `<span class="${classe}" style="--lx:${r3(x)}">${esc(ch)}</span>`;
        x += M.larguraEm(caixa(ch), fonte) + espaco;
      }
      return k % 2 ? `<em>${dentro}</em>` : dentro;
    })
    .join("");
  return { html, total: r3(Math.max(0.1, x)) };
}
const CORES = { texto: "var(--texto)", acento: "var(--acento)", acento2: "var(--acento2)", acento3: "var(--acento3)", dim: "var(--dim)", tinta: "var(--acento-tinta)", branco: "#ffffff", preto: "#0b0b0c", ok: "var(--ok)", erro: "var(--erro)" };
export const cor = (c, padrao = "texto") => (String(c ?? "").startsWith("#") ? c : (CORES[c ?? padrao] ?? CORES[padrao]));
/** Topo da cabeça na tela (px), no enquadramento do instante t. */
export function topoDaCabeca(camera, t) {
  const tr = camera.trechoEm(t);
  const cam = tr.cam(t);
  return cam.y + cam.scale * tr.rosto.y * H - 0.525 * tr.rosto.altura * H * cam.scale;
}

/**
 * Onde cabe algo de `altura` px por cima do vídeo sem cobrir o rosto: "baixo" (embaixo do queixo),
 * "topo" (em cima da cabeça) ou null (não cabe: o rosto ocupa a tela). Um cabeçalho ou manchete
 * no mesmo trecho já ocupa o alto.
 */
const ocupaOAlto = (M, o) => o.tipo === "cabecalho" || (o.tipo === "manchete" && Number(o.y ?? M.ESTILO.manchete?.y ?? 150) < 700) || (o.tipo === "lettering" && (o.area ?? "topo") === "topo");
const altoOcupado = (M, c) => (M.plano.cenas ?? []).some((o) => o !== c && ocupaOAlto(M, o) && Number(o.de) < c.ate && Number(o.ate) > c.de);
export function ondeCabe(M, c, altura) {
  if (c.posicao && c.posicao !== "auto") return c.posicao;
  const e = M.espacoLivre(c.de + 0.05);
  if (e.abaixo >= altura) return "baixo";
  // em cima da cabeça tem que sobrar lugar pra legenda também (uns 190 px), a não ser que a cena esconda a legenda
  if (e.acima - (altoOcupado(M, c) ? 240 : 0) - (c.legenda === false ? 0 : 190) >= altura) return "topo";
  return null;
}
/** Faixa da tela (y0, y1) de algo com `altura` px na posição dada, respeitando um cabeçalho no alto. */
export function bandaDe(M, c, posicao, altura) {
  if (posicao === "topo") {
    const y0 = (altoOcupado(M, c) ? 340 : 130) + Math.max(0, (M.ESTILO.margem_topo ?? 0) - 90);
    return [y0, y0 + altura];
  }
  if (posicao === "meio") return [Math.round(960 - altura / 2), Math.round(960 + altura / 2)];
  return [1540 - altura, 1540];
}

// ── cabeçalho ────────────────────────────────────────────────────────────────
// Fica no alto, por cima do rosto. Três formas, conforme os campos que vierem:
//   capítulo  { selo: "IDEIA 01", progresso: [1, 3], linhas: ["MOSTRE O", "RESULTADO"] }
//   passo     { numero: "01", icone: "target", linhas: ["ESCOLHA", "UMA ENTREGA"] }
//   título    { rotulo: "ALIMENTAÇÃO · VIDA REAL", linhas: ["TRÊS PONTOS", "PARA SUA ROTINA."] }
registrar("cabecalho", {
  zona: () => "sobre",
  preparar(M, c) {
    M.escurecer.push([c.de, c.ate, "topo"]);
    c._y = Number.isFinite(Number(c.y)) ? Number(c.y) : (M.ESTILO.cabecalho?.y ?? 78);
    const linhas = linhasDe(c.linhas ?? c.texto).length;
    c._banda = [c._y, c._y + (c.selo || c.progresso ? 60 : 0) + (c.rotulo ? 44 : 0) + linhas * 92 + 40];
  },
  montar(M, c, id) {
    const cfg = M.ESTILO.cabecalho ?? {};
    const passo = c.numero !== undefined || (c.icone && !c.selo);
    const alinhar = c.alinhar ?? (passo ? "centro" : (cfg.alinhar ?? "esquerda"));
    const linhas = linhasDe(c.linhas ?? c.texto);
    const fonte = c.fonte ?? (passo ? papel(M, "passo", "condensada-media") : papel(M, "cabecalho", "larga-media"));
    const largura = passo ? 600 : alinhar === "centro" ? 960 : 1000;
    const max = c.tamanho ?? (passo ? (cfg.tamanho_passo ?? 62) : (cfg.tamanho ?? 86));
    const caixa = (t) => M.naCaixa(t, "cab-caixa");
    const tam = Math.min(...linhas.map((l) => M.ajustarFonte(caixa(semMarca(l)), fonte, largura - (l.includes("*") ? 40 : 0), 34, max)));
    const letras = (c.entrada ?? cfg.entrada) === "letras";
    const ls = linhas
      .map((l, k) => {
        const pl = letras ? porLetras(M, l, fonte, "cab-c", caixa) : null;
        return `<div class="cab-l l${Math.min(k, 1)}${pl ? " por-letra" : ""}" id="${id}-l${k}" style="${cssFonte(fonte)}font-size:${tam}px${pl ? `;--lw:${pl.total}` : ""}">${pl ? pl.html : marcar(l)}</div>`;
      })
      .join("");
    const prog = Array.isArray(c.progresso) ? c.progresso.map(Number) : null;
    const dashes = prog ? `<span class="cab-prog">${Array.from({ length: prog[1] }, (_, k) => (k + 1 < prog[0] ? `<i class="feito"></i>` : k + 1 === prog[0] ? `<i><b id="${id}-pg"></b></i>` : `<i></i>`)).join("")}</span>` : "";
    const topo = c.selo || dashes ? `<div class="cab-topo" id="${id}-tp">${c.selo ? `<span class="cab-selo"><i></i>${esc(c.selo)}</span>` : ""}${dashes}</div>` : "";
    const rotulo = c.rotulo ? `<div class="cab-rotulo" id="${id}-rt">${esc(c.rotulo)}</div>` : "";
    const icone = c.icone ? `<span class="cab-icone" id="${id}-ic">${M.icone(c.icone, "ic", { id: `${id}-icn` })}</span>` : "";
    const numero = c.numero !== undefined ? `<span class="cab-num" id="${id}-nm" style="${cssFonte(papel(M, "numero", "condensada-media"))}font-size:${Math.round(tam * (linhas.length > 1 ? 1.95 : 1.2))}px">${esc(c.numero)}</span>` : "";
    // régua: traço curto (padrão), dois riscos à mão embaixo da última linha ("mao") ou nenhuma (false)
    const tipoRegua = c.regua ?? cfg.regua;
    const aMao = tipoRegua === "mao";
    const larguraMao = aMao ? Math.round(clamp(M.larguraEm(caixa(semMarca(linhas[linhas.length - 1])), fonte) * tam * 0.96, 160, 1000)) : 0;
    const risco = (d) => `<path d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" />`;
    const regua = tipoRegua === false ? "" : aMao ? `<svg class="cab-mao" id="${id}-rg" viewBox="0 0 ${larguraMao} 40" width="${larguraMao}" height="40" fill="none" stroke-linecap="round">${risco(`M5 13 C ${r3(larguraMao * 0.26)} 4, ${r3(larguraMao * 0.62)} 21, ${larguraMao - 5} 9`)}${risco(`M${r3(larguraMao * 0.07)} 30 C ${r3(larguraMao * 0.34)} 21, ${r3(larguraMao * 0.7)} 36, ${r3(larguraMao * 0.95)} 25`)}</svg>` : `<i class="cab-regua" id="${id}-rg"></i>`;
    const y = c._y;
    M.html.cenas.push(`      <div id="${id}" class="clip cabecalho ${alinhar}${passo ? " passo" : ""}" ${M.attrs(c)} style="top:${y}px"><div class="cab-in" id="${id}-in">${topo}${rotulo}<div class="cab-corpo">${icone}${numero}<div class="cab-linhas">${ls}</div></div>${regua}</div></div>`);

    // entra rolando de baixo quando vem logo depois de outro cabeçalho; senão desce de cima
    const outros = M.plano.cenas?.filter((o) => o.tipo === "cabecalho") ?? [];
    const colado = outros.some((o) => Math.abs(Number(o.ate) - c.de) < 0.3 && Number(o.de) < c.de);
    const proximo = outros.some((o) => Math.abs(Number(o.de) - c.ate) < 0.3 && Number(o.de) > c.de);
    const t0 = r3(c.de + 0.02);
    if (topo) M.add(`tl.from("#${id}-tp", { ${colado ? "opacity: 0" : "y: -24, opacity: 0"}, duration: 0.24, ease: "power2.out" }, ${t0});`);
    if (rotulo) M.add(`tl.from("#${id}-rt", { y: ${colado ? 16 : -16}, opacity: 0, duration: 0.24, ease: "power2.out" }, ${t0});`);
    if (icone) {
      M.add(`tl.from("#${id}-ic", { scale: 0.4, opacity: 0, duration: 0.3, ease: "back.out(2.2)" }, ${t0});`);
      M.desenharIcone(`${id}-icn`, t0 + 0.1, 0.6);
    }
    if (numero) M.add(`tl.from("#${id}-nm", { y: ${colado ? 46 : -30}, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(t0 + 0.03)});`);
    let fimTexto = t0 + 0.2;
    if (letras) {
      // as letras crescem uma a uma, da esquerda pra direita; a pílula do trecho marcado abre junto
      let t = t0 + 0.05;
      linhas.forEach((l, k) => {
        const n = [...semMarca(l)].filter((ch) => ch !== " ").length;
        const passoLetra = r3(clamp(0.55 / Math.max(1, n), 0.02, 0.05));
        M.add(`tl.from("#${id}-l${k} .cab-c", { scale: 0, opacity: 0, duration: 0.2, stagger: ${passoLetra}, ease: "back.out(1.8)" }, ${r3(t)});`);
        if (l.includes("*")) {
          const antes = [...l.slice(0, l.indexOf("*"))].filter((ch) => ch !== " ").length;
          M.add(`tl.from("#${id}-l${k} em", { scaleX: 0, opacity: 0, transformOrigin: "0 50%", duration: 0.22, ease: "power3.out" }, ${r3(t + antes * passoLetra)});`);
        }
        t += n * passoLetra + 0.06;
      });
      fimTexto = t + 0.1;
    } else linhas.forEach((_, k) => M.add(`tl.from("#${id}-l${k}", { y: ${colado ? 44 : -30}, opacity: 0, duration: 0.32, ease: "power3.out" }, ${r3(t0 + 0.05 + k * 0.07)});`));
    if (aMao) {
      M.add(`tl.fromTo("#${id}-rg > *", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.17, stagger: 0.15, ease: "power1.inOut" }, ${r3(Math.min(fimTexto + 0.1, c.ate - 0.5))});`);
      M.somCena(c, "whoosh", Math.min(fimTexto + 0.1, c.ate - 0.5), 0.35);
    } else if (regua) M.add(`tl.fromTo("#${id}-rg", { scaleX: 0 }, { scaleX: 1, duration: 0.4, ease: "power2.out" }, ${r3(t0 + 0.2)});`);
    if (prog) M.add(`tl.fromTo("#${id}-pg", { scaleX: 0 }, { scaleX: 1, duration: ${r3(Math.max(0.3, c.ate - c.de - 0.1))}, ease: "none" }, ${t0});`);
    if (proximo && c.ate - c.de > 0.6) M.add(`tl.to("#${id}-in", { y: -30, opacity: 0, duration: 0.16, ease: "power2.in" }, ${r3(c.ate - 0.16)});`);
    // saída "borra": sobe e some desfocado
    else if ((c.saida ?? cfg.saida) === "borra" && c.ate - c.de > 0.8 && c.ate < M.D - 0.2) M.add(`tl.to("#${id}-in", { y: -90, opacity: 0, filter: "blur(14px)", duration: 0.17, ease: "power2.in" }, ${r3(c.ate - 0.17)});`);
    M.somCena(c, c.som ?? "pop", t0, 0.6);
  },
});

// ── letreiro: tipografia que acompanha a fala ────────────────────────────────
// linhas: "TEXTO" ou { texto, fonte, cor, i | t, efeito, tamanho, palavras, contorno, extrusao,
// eco, pilula, colchetes, gradiente, sangrar, inclinar }.
// area: "topo" (por cima do rosto, no alto) | "meio" | "base" | "atras" (por trás da pessoa)
//       | "tela-cheia" (com o fundo do estilo)
function linhasLettering(M, c, id, larguraMax) {
  const cfg = M.ESTILO.lettering ?? {};
  const itens = (c.linhas ?? linhasDe(c.texto)).map((l) => (typeof l === "string" ? { texto: l } : { ...l }));
  let acum = 0;
  itens.forEach((l, k) => {
    l.fonte ??= cfg.fontes?.[k % (cfg.fontes?.length || 1)] ?? papel(M, "lettering", "larga");
    const f = FONTES[l.fonte] ?? FONTES.texto;
    const teto = l.tamanho ?? cfg.teto?.[l.fonte] ?? (f.largura === 62 || l.fonte === "impacto" ? 300 : f.largura === 125 || l.fonte === "display" ? 190 : 170);
    l.marcado = String(l.texto);
    l.texto = semMarca(l.texto);
    l.tam = M.ajustarFonte(M.naCaixa(l.texto, "let-caixa"), l.fonte, (l.sangrar ? larguraMax * 1.16 : larguraMax) - (l.pilula ? 90 : 0) - (l.marcado.includes("*") ? 60 : 0), 40, teto);
    l.alt = Math.round(l.tam * (l.pilula ? 1.5 : (cfg.entrelinha ?? 0.98)));
    l.y = acum;
    acum += l.alt + (l.espaco ?? 0);
    l.t = r3(clamp(M.tempoDe(l, c.de + 0.06 + k * (cfg.passo ?? 0.2)), c.de, c.ate - 0.15));
    l.efeito ??= cfg.efeito ?? "sobe";
  });
  const html = itens
    .map((l, k) => {
      // palavra a palavra: cada uma entra na hora em que é falada (i = índice da 1ª palavra da linha)
      const partes = String(l.texto).split(/\s+/);
      const sincroniza = l.palavras && Number.isFinite(Number(l.i)) && partes.length > 1;
      const pl = l.efeito === "letras" && !sincroniza ? porLetras(M, l.marcado, l.fonte, "let-c", (ch) => M.naCaixa(ch, "let-caixa")) : null;
      const classes = ["let-l", l.contorno ? "contorno" : "", l.extrusao ? "extrusao" : "", l.eco ? "eco" : "", l.pilula ? "pilula" : "", l.colchetes ? "colchetes" : "", l.gradiente ? "gradiente" : "", l.dupla ? "dupla" : "", pl ? "por-letra" : ""].filter(Boolean).join(" ");
      const estilo = `${cssFonte(l.fonte)}font-size:${l.tam}px;line-height:${l.alt}px;color:${cor(l.cor, k % 2 ? "acento2" : "texto")};${pl ? `--lw:${pl.total};` : ""}`;
      const dentro = (sincroniza ? partes.map((p, j) => `<span class="let-p" id="${id}-l${k}p${j}">${esc(p)}</span>`).join(" ") : pl ? pl.html : marcar(l.marcado)) + (l.cursor ? `<b class="let-cursor" id="${id}-l${k}c"></b>` : "");
      l.sincroniza = sincroniza;
      l.partes = partes;
      return `<div class="let-linha"><div class="${classes}" id="${id}-l${k}" data-t="${esc(l.texto)}" style="${estilo}">${dentro}</div></div>`;
    })
    .join("");
  return { itens, html, altura: acum };
}
function animarLinha(M, c, id, l, k) {
  const sel = (s) => `"#${id}-l${k}${s}"`;
  const entra = (alvo, t, efeito) => {
    if (efeito === "letras") M.add(`tl.from("#${id}-l${k} .let-c", { scale: 0, opacity: 0, duration: 0.2, stagger: ${r3(clamp(0.55 / Math.max(1, String(l.texto).length), 0.02, 0.06))}, ease: "back.out(2)" }, ${t});`);
    else if (efeito === "pop") M.add(`tl.from(${alvo}, { scale: 0.5, opacity: 0, duration: 0.3, ease: "back.out(2.2)" }, ${t});`);
    else if (efeito === "borra") M.add(`tl.fromTo(${alvo}, { x: ${k % 2 ? 90 : -90}, opacity: 0, filter: "blur(16px)" }, { x: 0, opacity: 1, filter: "blur(0px)", duration: 0.3, ease: "power3.out" }, ${t});`);
    else if (efeito === "desce") M.add(`tl.from(${alvo}, { y: -44, opacity: 0, duration: 0.28, ease: "power3.out" }, ${t});`);
    else if (efeito === "digita") M.add(`tl.fromTo(${alvo}, { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)", duration: ${r3(clamp(String(l.texto).length * 0.035, 0.2, 0.9))}, ease: "steps(${Math.max(3, String(l.texto).length)})" }, ${t});`);
    else if (efeito === "cresce") M.add(`tl.from(${alvo}, { scaleX: 0, opacity: 0, transformOrigin: "0 50%", duration: 0.3, ease: "power3.out" }, ${t});`);
    else if (efeito === "espaca") M.add(`tl.from(${alvo}, { scaleX: 1.5, opacity: 0, duration: 0.42, ease: "power3.out" }, ${t});`);
    else if (efeito === "glitch") M.add(`tl.from(${alvo}, { keyframes: [{ opacity: 0, x: -40, skewX: 20, duration: 0 }, { opacity: 1, x: 26, skewX: -14, duration: 0.05 }, { x: -14, skewX: 8, duration: 0.05 }, { x: 8, skewX: -4, duration: 0.05 }, { x: 0, skewX: 0, duration: 0.06 }], ease: "none" }, ${t});`);
    else if (efeito === "zoom") M.add(`tl.from(${alvo}, { scale: 2.2, opacity: 0, duration: 0.22, ease: "power4.out" }, ${t});`);
    else if (efeito === "pisca") M.add(`tl.from(${alvo}, { keyframes: [{ opacity: 0, duration: 0 }, { opacity: 1, duration: 0.03 }, { opacity: 0.2, duration: 0.03 }, { opacity: 1, duration: 0.03 }, { opacity: 0.5, duration: 0.03 }, { opacity: 1, duration: 0.04 }], ease: "none" }, ${t});`);
    else M.add(`tl.from(${alvo}, { y: 44, opacity: 0, duration: 0.28, ease: "power3.out" }, ${t});`);
  };
  if (l.sincroniza) {
    l.partes.forEach((_, j) => {
      const w = M.palavras[Number(l.i) + j];
      const t = r3(clamp(w?.a ?? l.t + j * 0.14, c.de, c.ate - 0.1));
      entra(sel(`p${j}`), t, l.efeito);
    });
  } else entra(sel(""), l.t, l.efeito);
  if (l.inclinar) M.add(`tl.set(${sel("")}, { rotation: ${Number(l.inclinar)} }, 0);`);
  if (l.cursor) {
    // o cursor de digitação pisca enquanto a linha está na vez e some quando a próxima entra
    const fim = r3(Math.min(c.ate, l.t + 1.4));
    M.add(`tl.fromTo(${sel("c")}, { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "steps(1)", yoyo: true, repeat: ${Math.max(1, Math.round((fim - l.t) / 0.2))}, immediateRender: false }, ${l.t});`);
    M.add(`tl.set(${sel("c")}, { opacity: 0 }, ${fim});`);
  }
  if (l.som !== false && k < 6) M.somCena(c, l.som ?? (l.pilula || l.extrusao ? "pop" : "tecla"), l.t, 0.5);
}
registrar("lettering", {
  pip: false,
  zona: (c) => (c.area === "tela-cheia" ? "cheia" : "sobre"),
  preparar(M, c) {
    c.area ??= M.ESTILO.lettering?.area ?? "topo";
    if (c.area === "atras") M.recortes.push({ de: c.de, ate: c.ate, motivo: `letreiro atrás (cena ${c.i})` });
    else if (c.area === "topo") M.escurecer.push([c.de, c.ate, "topo"]);
    else if (c.area === "base") M.escurecer.push([c.de, c.ate, "base"]);
    if (c.legenda !== true) c._semLegenda = true; // o letreiro já é a fala na tela
  },
  montar(M, c, id, camera) {
    const { itens, html, altura } = linhasLettering(M, c, id, c.largura ?? 1000);
    // régua de segmentos: um por linha, enchendo na hora de cada uma (com o cursor andando)
    const regua = c.regua ? `<div class="let-regua" id="${id}-rg">${itens.map((_, k) => `<i id="${id}-s${k}"${k === itens.length - 1 ? ' class="fim"' : ""}></i>`).join("")}<b id="${id}-cur"></b></div>` : "";
    const alturaTotal = altura + (c.regua ? 80 : 0);
    let topo;
    if (Number.isFinite(Number(c.y))) topo = Number(c.y);
    else if (c.area === "atras") topo = Math.round(clamp(topoDaCabeca(camera, c.de + 0.05) - alturaTotal * 0.7, 50, 1000));
    else if (c.area === "meio") topo = Math.round(960 - alturaTotal / 2);
    else if (c.area === "base") topo = Math.round(1500 - alturaTotal);
    else if (c.area === "tela-cheia") topo = Math.round(900 - alturaTotal / 2);
    else topo = M.ESTILO.lettering?.y ?? 84;
    const bloco = `<div id="${id}" class="clip lettering area-${esc(c.area)}" ${M.attrs(c)} style="top:${topo}px"><div class="let-in" id="${id}-in">${html}${regua}</div></div>`;
    if (c.area === "atras") M.html.atras.push(`      ${bloco}`);
    else if (c.area === "tela-cheia") {
      M.html.cenas.push(`      <div id="${id}-bg" class="clip tela-cheia" ${M.attrs(c)}><div class="tela-cheia-in void" id="${id}-bgi"></div></div>`, `      ${bloco}`);
      M.add(`tl.from("#${id}-bgi", { opacity: 0, duration: 0.12, ease: "none" }, ${c.de});`);
    } else M.html.cenas.push(`      ${bloco}`);
    itens.forEach((l, k) => animarLinha(M, c, id, l, k));
    if (c.regua) {
      M.add(`tl.from("#${id}-rg", { opacity: 0, y: 10, duration: 0.2, ease: "power2.out" }, ${r3(c.de + 0.04)});`);
      itens.forEach((l, k) => {
        const fim = itens[k + 1]?.t ?? Math.min(c.ate - 0.1, l.t + 0.6);
        M.add(`tl.fromTo("#${id}-s${k}", { scaleX: 0 }, { scaleX: 1, duration: ${r3(Math.max(0.12, fim - l.t))}, ease: "none" }, ${l.t});`);
      });
      const t0 = itens[0]?.t ?? c.de;
      M.add(`tl.fromTo("#${id}-cur", { x: 0 }, { x: 864, duration: ${r3(Math.max(0.3, Math.min(c.ate - 0.1, (itens[itens.length - 1]?.t ?? t0) + 0.6) - t0))}, ease: "none" }, ${t0});`);
    }
    if (c.sai !== false && c.ate - c.de > 0.8 && c.ate < M.D - 0.05) M.add(`tl.to("#${id}-in", { opacity: 0, y: -24, duration: 0.14, ease: "power2.in" }, ${r3(c.ate - 0.14)});`);
  },
});

// ── letreiro correndo: faixas de texto atravessando a tela (por trás dele, com "atras": true) ──
registrar("letreiro", {
  zona: () => "sobre",
  preparar(M, c) {
    if (c.atras) M.recortes.push({ de: c.de, ate: c.ate, motivo: `letreiro correndo atrás (cena ${c.i})` });
  },
  montar(M, c, id, camera) {
    const linhas = (c.linhas ?? linhasDe(c.texto)).map((l) => (typeof l === "string" ? { texto: l } : { ...l }));
    const tam = Number(c.tamanho ?? 96);
    const passo = Math.round(tam * 1.42);
    const faixas = linhas
      .map((l, k) => {
        const fonte = l.fonte ?? papel(M, "lettering", "larga");
        const larg = Math.ceil(M.larguraEm(`${l.texto}   `, fonte) * tam + tam * 0.5);
        l.larg = larg;
        const vezes = Math.ceil((W * 2) / larg) + 1;
        const classes = ["let-l", "corre", (l.contorno ?? k % 2 === 1) ? "contorno" : ""].filter(Boolean).join(" ");
        const um = `<span style="display:inline-block;width:${larg}px">${esc(l.texto)}</span>`;
        return `<div class="letreiro-faixa" style="top:${k * passo}px;height:${passo}px"><div class="${classes}" id="${id}-f${k}" style="${cssFonte(fonte)}font-size:${tam}px;line-height:${passo}px;color:${cor(l.cor, k % 3 === 2 ? "acento2" : "texto")};width:${larg * vezes}px">${um.repeat(vezes)}</div></div>`;
      })
      .join("");
    const alturaTotal = linhas.length * passo;
    const topo = Number.isFinite(Number(c.y)) ? Number(c.y) : c.atras ? Math.round(clamp(topoDaCabeca(camera, c.de + 0.05) - alturaTotal * 0.35, 30, 900)) : 90;
    const bloco = `      <div id="${id}" class="clip letreiro" ${M.attrs(c)} style="top:${topo}px;height:${alturaTotal}px">${faixas}</div>`;
    (c.atras ? M.html.atras : M.html.cenas).push(bloco);
    const dur = r3(c.ate - c.de);
    linhas.forEach((l, k) => {
      // cada faixa anda uma repetição inteira (ida ou volta), em velocidades diferentes
      const anda = Math.round(l.larg * clamp((dur * (150 + k * 40)) / l.larg, 0.3, 1.6));
      const [de, ate] = k % 2 === 0 ? [0, -anda] : [-anda, 0];
      M.add(`tl.fromTo("#${id}-f${k}", { x: ${de} }, { x: ${ate}, duration: ${dur}, ease: "none", immediateRender: false }, ${c.de});`);
      M.add(`tl.from("#${id}-f${k}", { opacity: 0, duration: 0.22, ease: "none" }, ${r3(c.de + k * 0.12)});`);
    });
    M.somCena(c, "whoosh", c.de, 0.5);
  },
});

// ── fotos: imagens por cima do vídeo, no ritmo da fala ───────────────────────
// modo "polaroid" (até 3, com legenda), "card" (uma por vez, com brilho e etiqueta) ou
// "janela" (janela de navegador inclinada, com destaque e cursor).
const POSICOES = {
  1: [[540, 1300, -3]],
  2: [[330, 1330, -6], [750, 1310, 5]],
  3: [[196, 1370, -7], [540, 1280, 2], [884, 1370, 7]],
};
const ALTURA_FOTOS = { polaroid: 430, card: 560, janela: 600, solta: 500 };
registrar("fotos", {
  // por cima do vídeo se couber sem cobrir o rosto; senão, na faixa de cima (tela dividida)
  zona(c, M) {
    const modo = c.modo ?? M.ESTILO.fotos?.modo ?? "polaroid";
    const area = c.area ?? M.ESTILO.fotos?.area ?? "auto";
    if (area === "faixa") return c.faixa === "baixo" ? "faixa-baixo" : "faixa";
    c._pos = ondeCabe(M, c, ALTURA_FOTOS[modo] ?? 500);
    if (area === "sobre") c._pos ??= "baixo";
    return c._pos ? "sobre" : "faixa";
  },
  preparar(M, c) {
    const modo = c.modo ?? M.ESTILO.fotos?.modo ?? "polaroid";
    if (c.zona === "sobre") c._banda = bandaDe(M, c, c._pos, ALTURA_FOTOS[modo] ?? 500);
  },
  limite: { todas: ["itens", 3] },
  montar(M, c, id) {
    const itens = (c.itens ?? (c.arquivo || c.material ? [c] : []))
      .map((it) => (typeof it === "string" ? { arquivo: it } : it))
      .map((it) => ({ ...it, m: M.midia(it, `cena ${c.i} (fotos)`) }))
      .filter((it) => it.m && (it.m.tipo === "imagem" || (M.avisar(`cena ${c.i} (fotos): ${it.m.arquivo} é vídeo; aqui só entra imagem`), false)))
      .slice(0, 3);
    if (!itens.length) return M.avisar(`cena ${c.i} (fotos) sem imagem`);
    const modo = c.modo ?? M.ESTILO.fotos?.modo ?? "polaroid";
    // onde as fotos ficam: embaixo do queixo, no meio, em cima da cabeça ou dentro da faixa
    const naFaixa = c.zona !== "sobre";
    const fb = faixaBaixo(M);
    // na faixa de cima, as fotos ficam embaixo do cabeçalho que estiver no mesmo trecho (e encolhem pra caber)
    const cab = naFaixa && c.zona === "faixa" ? (M.cenas ?? []).find((o) => o.tipo === "cabecalho" && o.de < c.ate - 0.2 && o.ate > c.de + 0.2) : null;
    const zonaY = c.zona === "faixa-baixo" ? [fb.topo, fb.topo + fb.altura] : [cab ? cab._banda[1] + 6 : 96, 744];
    const apertado = !naFaixa && modo === "polaroid" && c._pos === "topo";
    const f = naFaixa ? Math.min(1, (zonaY[1] - zonaY[0]) / ((ALTURA_FOTOS[modo] ?? 500) + 30)) : apertado ? 0.9 : 1;
    const centro = naFaixa ? Math.round((zonaY[0] + zonaY[1]) / 2) : Math.round((c._banda[0] + c._banda[1]) / 2) - (apertado ? 22 : 0);
    const sobe = centro - 1300;
    const classeFotos = naFaixa ? "fotos na-faixa" : "fotos";
    const passo = clamp((c.ate - c.de - 0.6) / itens.length, 0.3, 1.2);
    const tempos = itens.map((it, k) => r3(clamp(M.tempoDe(it, c.de + 0.15 + k * passo), c.de, c.ate - 0.2)));
    if (modo === "polaroid") {
      const larg = Math.round({ 1: 430, 2: 360, 3: 310 }[itens.length] * f);
      const pos = POSICOES[itens.length].map(([x, y, g]) => [x, Math.round(1300 + (y - 1300) * f), g]);
      const cartas = itens
        .map((it, k) => {
          const [x, y] = pos[k];
          return `<div class="polaroid" id="${id}-p${k}" style="left:${x - larg / 2}px;top:${y + sobe - larg / 2 - 30}px;width:${larg}px;z-index:${k === 1 ? 3 : 2}"><i class="fita"></i><div class="polaroid-foto" style="height:${larg - 28}px"><img src="${esc(it.m.arquivo)}" alt="" /></div>${it.legenda ? `<span class="polaroid-leg">${esc(it.legenda)}</span>` : ""}</div>`;
        })
        .join("");
      M.html.cenas.push(`      <div id="${id}" class="clip ${classeFotos}" ${M.attrs(c)}>${cartas}</div>`);
      itens.forEach((it, k) => {
        M.add(`tl.fromTo("#${id}-p${k}", { y: 150, rotation: ${k % 2 ? 22 : -22}, scale: 0.6, opacity: 0 }, { y: 0, rotation: ${it.girar ?? pos[k][2]}, scale: 1, opacity: 1, duration: 0.42, ease: "back.out(1.7)" }, ${tempos[k]});`);
        M.somCena(c, "pop", tempos[k], 0.8);
      });
      return;
    }
    if (modo === "solta") {
      // a imagem como ela é, sem moldura (PNG recortado, capa de livro, foto): estoura na tela de uma vez
      const n = itens.length;
      const caixa = n === 1 ? 640 : n === 2 ? 460 : 320;
      const passoX = n === 1 ? 0 : n === 2 ? 500 : 340;
      const cartas = itens
        .map((it, k) => {
          const esc0 = Math.min(caixa / it.m.w, 470 / it.m.h);
          const w = Math.round(it.m.w * esc0);
          const h = Math.round(it.m.h * esc0);
          const cx = 540 + (k - (n - 1) / 2) * passoX;
          return `<div class="foto-solta" id="${id}-p${k}" style="left:${Math.round(cx - w / 2)}px;top:${Math.round(1300 + sobe - h / 2)}px;width:${w}px;height:${h}px"><img src="${esc(it.m.arquivo)}" alt="" /></div>`;
        })
        .join("");
      M.html.cenas.push(`      <div id="${id}" class="clip ${classeFotos}" ${M.attrs(c)}>${cartas}</div>`);
      itens.forEach((it, k) => {
        M.add(`tl.fromTo("#${id}-p${k}", { scale: 0.55, opacity: 0, rotation: ${k % 2 ? 5 : -5} }, { scale: 1, opacity: 1, rotation: ${it.girar ?? 0}, duration: 0.2, ease: "back.out(1.8)" }, ${tempos[k]});`);
        M.somCena(c, "pop", tempos[k], 0.8);
      });
      return;
    }
    if (modo === "janela") {
      const it = itens[0];
      const larg = naFaixa ? Math.round(820 * Math.max(f, 0.8)) : 860;
      const altFoto = Math.round(clamp((larg * it.m.h) / it.m.w, 240, naFaixa ? Math.max(240, zonaY[1] - zonaY[0] - 80) : 560));
      const d = c.destaque;
      const caixa = d ? `<div class="destaque-box" id="${id}-box" style="left:${r3(d.x * 100)}%;top:${r3(d.y * 100)}%;width:${r3(d.w * 100)}%;height:${r3(d.h * 100)}%"></div>` : "";
      const cursor = d ? `<svg class="cursor" id="${id}-cur" viewBox="0 0 24 24"><path d="M4 2l15 9-7 1.6L9 20z" fill="#fff" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/></svg>` : "";
      M.html.cenas.push(
        `      <div id="${id}" class="clip ${classeFotos}" ${M.attrs(c)}><div class="foto-palco" style="top:${1300 + sobe - (altFoto + 52) / 2}px"><div class="foto-janela" id="${id}-j" style="width:${larg}px"><div class="janela"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span class="url">${esc(c.url ?? c.titulo ?? "")}</span></div><div class="foto-janela-midia" style="height:${altFoto}px"><img src="${esc(it.m.arquivo)}" alt="" />${caixa}${cursor}</div></div></div></div>`,
      );
      M.add(`tl.fromTo("#${id}-j", { rotationX: 34, rotationY: -24, y: 160, opacity: 0, scale: 0.7 }, { rotationX: 9, rotationY: -9, y: 0, opacity: 1, scale: 1, duration: 0.5, ease: "power3.out" }, ${tempos[0]});`);
      M.add(`tl.to("#${id}-j", { rotationX: 4, rotationY: 0, duration: ${r3(Math.max(0.3, c.ate - tempos[0] - 0.5))}, ease: "power1.inOut" }, ${r3(tempos[0] + 0.5)});`);
      M.somCena(c, "whoosh", tempos[0], 0.6);
      if (d) {
        const tb = r3(clamp(M.tempoDe(c.destaque, tempos[0] + 1), tempos[0] + 0.5, c.ate - 0.3));
        M.add(`tl.fromTo("#${id}-cur", { x: ${r3(larg * 0.88)}, y: ${r3(altFoto * 0.92)}, opacity: 0 }, { x: ${r3((d.x + d.w * 0.6) * larg)}, y: ${r3((d.y + d.h * 0.6) * altFoto)}, opacity: 1, duration: 0.5, ease: "power2.inOut" }, ${r3(tb - 0.5)});`);
        M.add(`tl.from("#${id}-box", { scale: 1.25, opacity: 0, duration: 0.26, ease: "back.out(2)" }, ${tb});`);
        M.somCena(c, "click", tb);
      }
      return;
    }
    // "card": uma imagem por vez, com explosão de brilho na entrada e etiqueta
    const larg = Math.round(600 * Math.max(f, 0.75));
    const cartas = itens
      .map((it, k) => {
        const alt = Math.round(clamp((larg * it.m.h) / it.m.w, 240, naFaixa ? Math.max(240, zonaY[1] - zonaY[0] - 50) : 640));
        const etq = it.rotulo ?? (k === 0 ? c.rotulo : null);
        return `<div class="foto-palco" style="top:${1300 + sobe - alt / 2}px"><i class="foto-brilho" id="${id}-b${k}"></i><div class="foto-card" id="${id}-p${k}" style="width:${larg}px;height:${alt}px"><img src="${esc(it.m.arquivo)}" alt="" />${etq ? `<span class="foto-etiqueta" id="${id}-e${k}">${esc(etq)}</span>` : ""}</div></div>`;
      })
      .join("");
    M.html.cenas.push(`      <div id="${id}" class="clip ${classeFotos}" ${M.attrs(c)}>${cartas}</div>`);
    itens.forEach((it, k) => {
      const t = tempos[k];
      const fim = r3(Math.min(c.ate, tempos[k + 1] ?? c.ate));
      M.add(`tl.fromTo("#${id}-b${k}", { scale: 0.2, opacity: 0.9 }, { scale: 1.5, opacity: 0, duration: 0.5, ease: "power2.out", immediateRender: false }, ${t});`);
      M.add(`tl.fromTo("#${id}-p${k}", { scale: 0.15, rotationY: 40, opacity: 0 }, { scale: 1, rotationY: -7, opacity: 1, duration: 0.42, ease: "back.out(1.6)" }, ${t});`);
      if (it.rotulo ?? (k === 0 && c.rotulo)) M.add(`tl.fromTo("#${id}-e${k}", { y: 18, opacity: 0, scale: 0.7, rotation: -6 }, { y: 0, opacity: 1, scale: 1, rotation: -6, duration: 0.26, ease: "back.out(2)" }, ${r3(t + 0.3)});`);
      if (fim - t > 0.7) M.add(`tl.to("#${id}-p${k}", { scale: 0.1, opacity: 0, duration: 0.2, ease: "power2.in" }, ${r3(fim - 0.2)});`);
      M.somCena(c, "brilho", t, 0.7);
    });
  },
});

// ── barra de prompt: o comando sendo digitado, por cima do vídeo ─────────────
registrar("prompt", {
  zona: () => "sobre",
  preparar(M, c) {
    const pos = ondeCabe(M, c, 230) ?? "topo";
    c._banda = Number.isFinite(Number(c.y)) ? [Number(c.y), Number(c.y) + 210] : bandaDe(M, c, pos, 210);
  },
  montar(M, c, id) {
    const texto = String(c.texto ?? "");
    const realces = new Set((c.realces ?? []).map((r) => String(r).toLowerCase()));
    let n = 0;
    const palavras = texto.split(/\s+/).map((p) => {
      const limpa = p.replace(/[.,;:!?]+$/, "").toLowerCase();
      const letras = [...p].map((ch) => `<i id="${id}-k${n++}">${esc(ch)}</i>`).join("");
      return `<span class="pr-p${realces.has(limpa) ? " realce" : ""}">${letras}</span>`;
    });
    const y = c._banda[0];
    M.html.cenas.push(
      `      <div id="${id}" class="clip prompt" ${M.attrs(c)} style="top:${y}px">${c.rotulo ? `<div class="pr-rotulo" id="${id}-rt">${esc(c.rotulo)}</div>` : ""}<div class="pr-barra" id="${id}-in"><span class="pr-ic">${M.icone(c.icone ?? "message-square-text")}</span><span class="pr-txt">${palavras.join(" ")}</span><span class="pr-envia" id="${id}-bt">${M.icone("arrow-up")}</span></div></div>`,
    );
    const t0 = r3(c.de + 0.3);
    const dur = r3(clamp(c.digitar ?? n * 0.035, 0.5, Math.max(0.6, c.ate - c.de - 0.9)));
    M.add(`tl.from("#${id}-in", { y: 40, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.02)});`);
    if (c.rotulo) M.add(`tl.from("#${id}-rt", { opacity: 0, duration: 0.25, ease: "none" }, ${r3(c.de + 0.1)});`);
    for (let k = 0; k < n; k++) M.add(`tl.set("#${id}-k${k}", { opacity: 1 }, ${r3(t0 + (dur * k) / Math.max(1, n))});`);
    for (let s = 0; s * 1.0 < dur; s++) M.somCena(c, "teclado", t0 + s * 1.0, 0.7);
    const tb = r3(Math.min(c.ate - 0.25, t0 + dur + 0.25));
    M.add(`tl.fromTo("#${id}-bt", { scale: 1 }, { scale: 1.25, duration: 0.14, ease: "power2.out", yoyo: true, repeat: 1, immediateRender: false }, ${tb});`);
    M.somCena(c, "click", tb);
  },
});

// ── grade: 2 colunas de cards com imagem (ou ícone) e rótulo ─────────────────
registrar("grade", {
  zona: zonaDeCard,
  limite: { faixa: ["itens", 4], "faixa-baixo": ["itens", 2], cheia: ["itens", 6] },
  montar(M, c, id) {
    const itens = c.itens ?? [];
    const [t1, t2] = String(c.titulo ?? "").split("|").map((s) => s.trim());
    const cab = c.titulo || c.rotulo ? `<div class="grade-cab" id="${id}-cab">${c.rotulo ? `<div class="rotulo">${esc(c.rotulo)}</div>` : ""}${c.titulo ? `<div class="grade-titulo">${esc(t1)}${t2 ? ` <em>${esc(t2)}</em>` : ""}</div>` : ""}</div>` : "";
    const celulas = itens
      .map((it, k) => {
        const m = it.arquivo || it.material ? M.midia(it, `cena ${c.i} (grade)`) : null;
        const logo = m && (it.logo === true || /^logos\/|\.svg$/i.test(m.arquivo));
        const topo = m && m.tipo === "imagem" ? `<div class="grade-foto${logo ? " logo" : ""}"><img src="${esc(m.arquivo)}" alt="" /></div>` : `<div class="grade-foto icone">${M.icone(it.icone ?? "sparkles")}</div>`;
        return `<div class="card grade-item" id="${id}-g${k}">${topo}<div class="grade-rotulo">${it.icone && m ? M.icone(it.icone) : ""}<span>${esc(it.texto ?? "")}</span></div></div>`;
      })
      .join("");
    M.html.cenas.push(`      ${abrir(M, c, id, "grade-centro")}${cab}<div class="grade">${celulas}</div>${fechar(c)}`);
    if (cab) M.add(`tl.from("#${id}-cab", { y: -24, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.04)});`);
    const passo = clamp((c.ate - c.de - 0.8) / Math.max(1, itens.length), 0.2, 0.9);
    itens.forEach((it, k) => {
      const t = r3(clamp(M.tempoDe(it, c.de + 0.25 + k * passo), c.de, c.ate - 0.15));
      M.add(`tl.from("#${id}-g${k}", { y: 40, scale: 0.9, opacity: 0, duration: 0.34, ease: "back.out(1.6)" }, ${t});`);
      M.somCena(c, "pop", t, 0.7);
    });
  },
});

// ── carrossel: fileira curva de imagens girando (referências, exemplos, prints) ──
registrar("carrossel", {
  zona: zonaDeCard,
  montar(M, c, id) {
    const itens = (c.itens ?? [])
      .map((it) => (typeof it === "string" ? (M.materiais[it] ? { material: it } : { arquivo: it }) : it))
      .map((it) => M.midia(it, `cena ${c.i} (carrossel)`))
      .filter((m) => m && (m.tipo === "imagem" || (M.avisar(`cena ${c.i} (carrossel): ${m.arquivo} é vídeo; aqui só entra imagem`), false)));
    if (!itens.length) return M.avisar(`cena ${c.i} (carrossel) sem imagem`);
    const N = 16; // lugares na roda
    const R = 640;
    const cartas = Array.from({ length: N }, (_, k) => {
      const m = itens[k % itens.length];
      return `<div class="car-card" style="transform:rotateY(${r3((k * 360) / N)}deg) translateZ(${-R}px)"><img src="${esc(m.arquivo)}" alt="" /></div>`;
    }).join("");
    M.html.cenas.push(`      ${abrir(M, c, id, "car-centro")}${c.titulo ? `<div class="cena-titulo" id="${id}-t">${esc(c.titulo)}</div>` : ""}<div class="car"><div class="car-pista" id="${id}-p">${cartas}</div></div>${fechar(c)}`);
    const dur = r3(c.ate - c.de);
    const giro = r3((c.velocidade ?? 14) * dur);
    M.add(`tl.fromTo("#${id}-p", { z: ${R}, rotationY: ${r3(giro / 2 + 20)}, opacity: 0 }, { z: ${R}, rotationY: ${r3(giro / 2)}, opacity: 1, duration: 0.4, ease: "power3.out" }, ${c.de});`);
    M.add(`tl.to("#${id}-p", { rotationY: ${r3(-giro / 2)}, duration: ${r3(Math.max(0.2, dur - 0.4))}, ease: "none" }, ${r3(c.de + 0.4)});`);
    if (c.titulo) M.add(`tl.from("#${id}-t", { y: -30, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.05)});`);
    M.somCena(c, "whoosh", c.de, 0.6);
  },
});
