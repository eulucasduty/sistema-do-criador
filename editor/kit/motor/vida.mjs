// Movimento "de vídeo" (estilo.json → "movimento": "video"): o motion não para depois que entra.
//
// Sem isto, cada card entra em ~0,3 s e fica congelado até sumir de corte seco (medido num vídeo
// de teste: 60 a 66% dos quadros de cada cena eram o mesmo quadro). Aqui cada cena ganha:
//   - uma câmera própria que anda a cena inteira (aproxima devagar, de 95% a 101,5%, e inclina
//     um pouco em 3D, uma cena pra um lado e a seguinte pro outro: card largo não encosta na borda);
//   - uma saída com movimento (afasta, inclina e some) no lugar do corte seco;
//   - o fundo de papel deslizando (a grade de pontinhos anda), na faixa de cima e na tela cheia.
// O resto da vida (cursor que clica, pacote correndo no fluxo, "digitando…", ícone se desenhando)
// fica em cada componente, olhando M.vivo.

import fs from "node:fs";
import path from "node:path";
import { r3 } from "./util.mjs";

export const SAIDA = 0.3; // a saída acaba junto com a cena
const PERSPECTIVA = 1600;

/** Entrada de card em 3D (vem de baixo, deitado, e assenta). alvos: seletor, lista, ou [{ sel, origem }]. */
export function entradaViva(M, alvos, t) {
  for (const a of [].concat(alvos).map((x) => (typeof x === "string" ? { sel: x } : x))) {
    const origem = a.origem ?? "50% 0%";
    M.add(`tl.fromTo(${JSON.stringify(a.sel)}, { y: 64, rotationX: -24, scale: 0.92, opacity: 0, transformPerspective: ${PERSPECTIVA}, transformOrigin: "${origem}" }, { y: 0, rotationX: 0, scale: 1, opacity: 1, transformPerspective: ${PERSPECTIVA}, duration: 0.55, ease: "power3.out" }, ${r3(t)});`);
  }
}

/** Onde mora a câmera de cada cena: o que o componente disse (c._cam) ou o contêiner que o abrir() criou. */
function alvosDaCamera(c) {
  if (c._cam) return c._cam;
  if (!c._abriu) return null;
  const id = `c${c.i}`;
  if (c.zona === "cheia") return [{ sel: `#${id} .cheia-centro` }];
  if (c.zona === "sobre") return [{ sel: `#${id} .sobre-centro`, leve: true }];
  return [{ sel: `#${id} > .topo-centro` }];
}

/** Quantas camadas tem o fundo do estilo e quais delas são padrão repetido (a grade de pontinhos). */
function camadasDoFundo(M) {
  const achar = (css) => [...String(css ?? "").matchAll(/--void-tam:\s*([^;]+);/g)].pop()?.[1];
  const base = path.join(M.KIT, "css", "01-base.css");
  const tam = achar(M.temaCss) ?? (fs.existsSync(base) ? achar(fs.readFileSync(base, "utf8")) : null);
  if (!tam) return null;
  return tam.split(",").map((s) => s.trim() !== "auto");
}

export function montarVida(M, cenas, camera) {
  if (!M.vivo) return;
  const { add, D } = M;

  let lado = -1;
  for (const c of cenas) {
    const alvos = alvosDaCamera(c);
    const dur = c.ate - c.de;
    if (!alvos || c._semVida || dur < 1) continue;
    lado = -lado; // uma cena inclina pra um lado, a seguinte pro outro
    const fimCam = r3(c.ate - SAIDA);
    for (const a of alvos) {
      const f = a.leve ? 0.5 : 1;
      const origem = a.origem ? `, transformOrigin: "${a.origem}"` : "";
      const sel = JSON.stringify(a.sel);
      if (a.plano) {
        // imagem sangrada (cobre a tela): só aproxima, sem inclinar (senão aparece a borda)
        add(`tl.fromTo(${sel}, { scale: 1${origem} }, { scale: 1.05, duration: ${r3(fimCam - c.de - 0.01)}, ease: "sine.inOut", immediateRender: false }, ${c.de});`);
        add(`tl.to(${sel}, { opacity: 0, duration: ${SAIDA - 0.03}, ease: "power2.in" }, ${fimCam});`);
        continue;
      }
      add(`tl.fromTo(${sel}, { scale: ${r3(1 - 0.05 * f)}, y: ${r3(16 * f)}, rotationX: ${r3(6 * f)}, rotationY: ${r3(-3 * f * lado)}, transformPerspective: ${PERSPECTIVA}${origem} }, { scale: ${r3(1 + 0.015 * f)}, y: ${r3(-12 * f)}, rotationX: ${r3(-1.5 * f)}, rotationY: ${r3(2.5 * f * lado)}, transformPerspective: ${PERSPECTIVA}, duration: ${r3(fimCam - c.de - 0.01)}, ease: "sine.inOut", immediateRender: false }, ${c.de});`);
      add(`tl.to(${sel}, { scale: 0.9, y: -70, rotationX: 16, opacity: 0, duration: ${SAIDA - 0.03}, ease: "power2.in" }, ${fimCam});`);
    }
    // tela cheia: o papel some junto com o card, e o rosto volta sem corte seco
    if (c.zona === "cheia" && (c._abriu || c._fundo)) add(`tl.to("#c${c.i}-bg", { opacity: 0, duration: 0.24, ease: "power1.in" }, ${r3(c.ate - 0.25)});`);
  }

  // ── o papel do fundo desliza: a grade de pontinhos anda devagar (as outras camadas, as luzes, ficam) ──
  const camadas = camadasDoFundo(M);
  if (!camadas || !camadas.some(Boolean)) return;
  const pos = (dx, dy) => camadas.map((anda) => (anda ? `${r3(dx)}px ${r3(dy)}px` : "0px 0px")).join(", ");
  const VX = 9; // px por segundo
  const VY = 14;
  if (camera.temPainel) add(`tl.fromTo("#painel-in", { backgroundPosition: "${pos(0, 0)}" }, { backgroundPosition: "${pos(VX * D, VY * D)}", duration: ${D}, ease: "none" }, 0);`);
  for (const c of cenas) {
    if (c.ate - c.de < 0.5) continue;
    const sel = c.zona === "cheia" && (c._abriu || c._fundo) ? `#c${c.i}-bg` : c.tipo === "palavra" && !c.atras ? `#c${c.i}-in` : null;
    if (sel) add(`tl.fromTo("${sel}", { backgroundPosition: "${pos(0, 0)}" }, { backgroundPosition: "${pos(VX * 2.2 * (c.ate - c.de), VY * 2.2 * (c.ate - c.de))}", duration: ${r3(c.ate - c.de)}, ease: "none", immediateRender: false }, ${c.de});`);
  }
}
