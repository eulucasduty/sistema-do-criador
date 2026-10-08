// Câmera virtual: aproxima, afasta, passeia e treme. Sempre com uma deriva lenta por cima, pra
// cena nunca ficar com cara de slide parado.
import React from "react";
import { AbsoluteFill } from "remotion";
import { acaso, passos, seno, useAnim } from "./anim";

export type Passo = { em: number; zoom?: number; x?: number; y?: number; giro?: number };

export const Camera: React.FC<{
  /** onde a câmera está em cada instante: [{ em: 0, zoom: 1.6, y: 200 }, { em: 1.2, zoom: 1 }] */
  passos?: Passo[];
  /** deriva lenta em px (0 desliga) */
  deriva?: number;
  /** tremidas de impacto: [{ em: 2.1, dur: 0.35, forca: 18 }] */
  tremores?: { em: number; dur?: number; forca?: number }[];
  children: React.ReactNode;
}> = ({ passos: lista = [], deriva = 10, tremores = [], children }) => {
  const { t, frame } = useAnim();
  // completa cada passo com o valor anterior (o que não muda não precisa ser repetido)
  const cheio: Required<Passo>[] = [];
  for (const p of lista) {
    const ant = cheio[cheio.length - 1] ?? { em: 0, zoom: 1, x: 0, y: 0, giro: 0 };
    cheio.push({ em: p.em, zoom: p.zoom ?? ant.zoom, x: p.x ?? ant.x, y: p.y ?? ant.y, giro: p.giro ?? ant.giro });
  }
  const val = (k: "zoom" | "x" | "y" | "giro", padrao: number) => (cheio.length ? passos(t, cheio.map((p) => ({ em: p.em, v: p[k] }))) : padrao);
  let x = val("x", 0) + seno(t, 6.5, deriva);
  let y = val("y", 0) + seno(t, 8.3, deriva * 0.7, 1);
  for (const tr of tremores) {
    const d = tr.dur ?? 0.35;
    if (t >= tr.em && t < tr.em + d) {
      const k = 1 - (t - tr.em) / d;
      x += (acaso(frame, 11) - 0.5) * 2 * (tr.forca ?? 16) * k;
      y += (acaso(frame, 23) - 0.5) * 2 * (tr.forca ?? 16) * k;
    }
  }
  return <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) scale(${val("zoom", 1)}) rotate(${val("giro", 0)}deg)`, transformOrigin: "50% 50%" }}>{children}</AbsoluteFill>;
};
