// Ferramentas de tempo. Tudo em SEGUNDOS (o fps vem do vídeo): nada de número mágico de quadro.
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { CURVA, MOLA } from "./tema";

/** O instante atual: t (segundos), dur (duração do motion), fps, largura e altura. */
export function useAnim() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  return { frame, fps, t: frame / fps, dur: durationInFrames / fps, largura: width, altura: height };
}

/** Vai de v0 a v1 entre os instantes a e b (segundos), com curva e sem passar dos limites. */
export function entre(t: number, [a, b]: [number, number], [v0, v1]: [number, number], curva: (x: number) => number = CURVA.entra) {
  if (b <= a) return t >= a ? v1 : v0;
  return interpolate(t, [a, b], [v0, v1], { easing: curva, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
}

/** Mola que começa no instante `em` (segundos): 0 antes, ~1 depois de assentar. */
export function mola(t: number, em: number, fps: number, tipo: keyof typeof MOLA = "suave") {
  return spring({ frame: Math.round((t - em) * fps), fps, config: MOLA[tipo] });
}

/** Uma sequência de valores no tempo: [{ em: 0, v: 1 }, { em: 1.2, v: 1.3 }] com curva entre eles. */
export function passos(t: number, lista: { em: number; v: number }[], curva: (x: number) => number = CURVA.move) {
  if (!lista.length) return 0;
  if (t <= lista[0].em) return lista[0].v;
  for (let k = 1; k < lista.length; k++) if (t <= lista[k].em) return entre(t, [lista[k - 1].em, lista[k].em], [lista[k - 1].v, lista[k].v], curva);
  return lista[lista.length - 1].v;
}

/** Onda seno (respiração, balanço): período em segundos, amplitude, fase. */
export const seno = (t: number, periodo: number, amp: number, fase = 0) => Math.sin((t / periodo) * Math.PI * 2 + fase) * amp;

/** "Acaso" que é sempre o mesmo pro mesmo índice (o render é feito em pedaços: nada de Math.random). */
export const acaso = (i: number, semente = 1) => {
  const x = Math.sin(i * 127.1 + semente * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** Liga e desliga em degraus (piscar, alternar quadro de animação). */
export const degrau = (t: number, periodo: number) => Math.floor(t / periodo);
