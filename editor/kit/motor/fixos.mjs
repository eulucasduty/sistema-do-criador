// O que fica o vídeo inteiro (ou entra por conta do estilo, sem o plano pedir): o fundo atrás das
// janelas, o escurecido de cima pra dar leitura a cabeçalho e letreiro, o tratamento de filme
// (grão, vinheta, barras de cinema, banho de cor) e a barra de progresso.

import { r3, unir } from "./util.mjs";

export function montarFixos(M, cenas, camera) {
  const { ESTILO, D, add } = M;
  const V = ESTILO.video ?? {};

  // escurecido no topo/base enquanto tem texto por cima do rosto (cabeçalho, letreiro). Só vale
  // onde o vídeo está em tela cheia: com o rosto numa janela, o texto já está sobre o fundo do estilo.
  const cheio = unir(camera.trechos.filter((tr) => tr.modo === "rosto" && !tr.jan).map((tr) => [tr.a, tr.b]), 0.01);
  for (const onde of ["topo", "base"]) {
    const pedidos = unir(M.escurecer.filter((e) => e[2] === onde).map((e) => [e[0], e[1]]), 0.25);
    const trechos = [];
    for (const [a, b] of pedidos)
      for (const [x, y] of cheio) {
        const i0 = Math.max(a, x);
        const i1 = Math.min(b, y);
        if (i1 - i0 > 0.3) trechos.push([i0, i1]);
      }
    // "cor_intocada": o vídeo dele não escurece (o texto por cima se vira com a sombra dele)
    if (!trechos.length || ESTILO.escurecer === false || M.corIntocada) continue;
    M.html.sobre.unshift(`      <div id="escurece-${onde}" class="escurece ${onde}"></div>`);
    add(`tl.set("#escurece-${onde}", { opacity: 0 }, 0);`);
    for (const [a, b] of trechos) {
      add(`tl.to("#escurece-${onde}", { opacity: 1, duration: 0.25, ease: "none" }, ${r3(Math.max(0, a - 0.05))});`);
      if (b < D - 0.3) add(`tl.to("#escurece-${onde}", { opacity: 0, duration: 0.25, ease: "none" }, ${r3(b - 0.1)});`);
    }
  }

  // tratamento de filme: cada camada é um <div> que o tema.css do estilo pinta
  const camadas = M.corIntocada ? V.camadas?.filter((k) => k === "barras" || k === "moldura") ?? [] : V.camadas ?? [];
  if (camadas.includes("tom")) M.html.fixos.push(`      <div id="tom" class="pelicula"></div>`);
  if (camadas.includes("vinheta")) M.html.fixos.push(`      <div id="vinheta" class="pelicula"></div>`);
  if (camadas.includes("grao")) {
    M.html.fixos.push(`      <div id="grao" class="pelicula"></div>`);
    // o grão "ferve": a textura pula de lugar 12 vezes por segundo
    const n = Math.max(2, Math.round(D * 12));
    add(`tl.fromTo("#grao", { backgroundPosition: "0px 0px" }, { backgroundPosition: "${n * 37}px ${n * 53}px", duration: ${D}, ease: "steps(${n})" }, 0);`);
  }
  if (camadas.includes("barras")) M.html.fixos.push(`      <div id="barras-cine" class="pelicula"><i></i><i></i></div>`);
  if (camadas.includes("moldura")) M.html.fixos.push(`      <div id="moldura-cheia" class="pelicula"></div>`);

  // barra de progresso do vídeo
  const prog = ESTILO.barra_progresso;
  if (prog) {
    M.html.fixos.push(`      <div id="progresso" class="${prog.posicao === "base" ? "base" : "topo"}"><i id="progresso-in"></i></div>`);
    add(`tl.fromTo("#progresso-in", { scaleX: 0 }, { scaleX: 1, duration: ${D}, ease: "none" }, 0);`);
  }
}
