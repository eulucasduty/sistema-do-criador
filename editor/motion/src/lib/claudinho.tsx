// O Claudinho: o asterisco do Claude com cara. Os raios mexem (vivo), ele pisca, muda de humor e
// estica um raio pra dar soco. O DESENHO vem do tema (tema.visual.personagem):
//   chapado  cor lisa (o padrão)            adesivo  contorno grosso + sombra dura (gibi)
//   pixel    vira pixel art de 8 bits         massinha volume, brilho e sombra macia (brinquedo)
//   traco    só o contorno, line-art (revista)
import React from "react";
import { acaso, seno, useAnim } from "./anim";
import { useTema, type Visual } from "./tema";

export type Humor = "normal" | "feliz" | "bravo" | "nocaute" | "surpreso" | "pensando";

const N = 12;
const BASE = Array.from({ length: N }, (_, i) => ({ ang: i * (360 / N) + (acaso(i, 3) - 0.5) * 9, len: 36 + acaso(i, 7) * 11 }));
const TINTA = "#2a1a14";

/** Os raios no instante t (comprimento e ângulo), já com o balanço e o soco. */
function raiosEm(t: number, fase: number, vivo: boolean, nocaute: boolean, estica?: { angulo: number; quanto: number }) {
  return BASE.map((r, i) => {
    let len = r.len * (nocaute ? 0.8 : 1) + (vivo && !nocaute ? seno(t, 0.9 + acaso(i, 5) * 0.6, 2.2, i + fase) : 0);
    if (estica) {
      const d = Math.abs(((r.ang - estica.angulo + 540) % 360) - 180);
      if (d < 17) len += estica.quanto * (1 - d / 17);
    }
    const a = (r.ang * Math.PI) / 180;
    return { x: Math.cos(a) * len, y: Math.sin(a) * len };
  });
}

/** A cara (olhos, sobrancelha, boca) em vetor. */
function Cara({ humor, olhar, pisca, tinta, olhoBranco }: { humor: Humor; olhar: [number, number]; pisca: boolean; tinta: string; olhoBranco?: boolean }) {
  const ox = olhar[0] * 1.8;
  const oy = olhar[1] * 1.6;
  const olho = (x: number) => {
    if (humor === "nocaute")
      return (
        <g key={x} stroke={tinta} strokeWidth={2.6} strokeLinecap="round">
          <line x1={x - 3.4} y1={-6} x2={x + 3.4} y2={0.6} />
          <line x1={x - 3.4} y1={0.6} x2={x + 3.4} y2={-6} />
        </g>
      );
    if (humor === "feliz") return <path key={x} d={`M ${x - 3.6} -1.5 Q ${x} -7.5 ${x + 3.6} -1.5`} stroke={tinta} strokeWidth={2.6} fill="none" strokeLinecap="round" />;
    const r = humor === "surpreso" ? 4.6 : 3.3;
    const ry = pisca ? 0.6 : humor === "surpreso" ? 4.6 : humor === "bravo" ? 3.6 : 4.7;
    return (
      <g key={x}>
        {olhoBranco && !pisca && <ellipse cx={x} cy={-3} rx={r + 2} ry={ry + 1.8} fill="#ffffff" stroke={tinta} strokeWidth={1.4} />}
        <ellipse cx={x + ox} cy={-3 + oy} rx={r} ry={ry} fill={tinta} />
        {!pisca && <circle cx={x + ox - 1.1} cy={-4.6 + oy} r={1.15} fill="#ffffff" />}
      </g>
    );
  };
  const boca = humor === "feliz" ? "M -6.5 5.5 Q 0 12.5 6.5 5.5" : humor === "bravo" ? "M -4.5 9.5 Q 0 6 4.5 9.5" : humor === "nocaute" ? "M -5 8 Q -2.5 5.8 0 8 Q 2.5 10.2 5 8" : humor === "pensando" ? "M -3.5 8 L 3.5 7.2" : humor === "surpreso" ? "" : "M -4.5 6.8 Q 0 10 4.5 6.8";
  return (
    <>
      {olho(-7.5)}
      {olho(7.5)}
      {humor === "bravo" && (
        <g stroke={tinta} strokeWidth={2.8} strokeLinecap="round">
          <line x1={-12.5} y1={-11.5} x2={-3.5} y2={-7.8} />
          <line x1={12.5} y1={-11.5} x2={3.5} y2={-7.8} />
        </g>
      )}
      {humor === "surpreso" ? <circle cx={0} cy={8.5} r={2.6} fill={tinta} /> : <path d={boca} stroke={tinta} strokeWidth={2.4} fill="none" strokeLinecap="round" />}
    </>
  );
}

/** Pixel art: o desenho vira uma grade de pixels (raios e corpo), com a cara em blocos. */
function Pixel({ raios, cor, humor, pisca, olhar }: { raios: { x: number; y: number }[]; cor: string; humor: Humor; pisca: boolean; olhar: [number, number] }) {
  const G = 22;
  const c = 120 / G;
  const dentro = (x: number, y: number) => {
    if (x * x + y * y <= 19.5 * 19.5) return true;
    for (const r of raios) {
      const L = r.x * r.x + r.y * r.y;
      const u = Math.max(0, Math.min(1, (x * r.x + y * r.y) / L));
      const dx = x - u * r.x;
      const dy = y - u * r.y;
      if (dx * dx + dy * dy <= 6.6 * 6.6) return true;
    }
    return false;
  };
  let corpo = "";
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const x = -60 + (i + 0.5) * c;
    const y = -60 + (j + 0.5) * c;
    if (dentro(x, y)) corpo += `M${(-60 + i * c).toFixed(2)} ${(-60 + j * c).toFixed(2)}h${c.toFixed(2)}v${c.toFixed(2)}h${(-c).toFixed(2)}z`;
  }
  // a cara em blocos do tamanho do pixel
  const bloco = (gx: number, gy: number, w = 1, h = 1) => `M${(gx * c).toFixed(2)} ${(gy * c).toFixed(2)}h${(w * c).toFixed(2)}v${(h * c).toFixed(2)}h${(-w * c).toFixed(2)}z`;
  const ox = Math.round(olhar[0]);
  let cara = "";
  if (humor === "nocaute") cara = bloco(-3, -2) + bloco(-2, -1) + bloco(-3, 0) + bloco(-1, -2) + bloco(-1, 0) + bloco(2, -2) + bloco(1, -1) + bloco(2, 0) + bloco(0, -2) + bloco(0, 0);
  else if (humor === "feliz") cara = bloco(-3, -1) + bloco(-2, -2) + bloco(-1, -1) + bloco(1, -1) + bloco(2, -2) + bloco(3, -1) + bloco(-2, 1, 4, 1) + bloco(-1, 2, 2, 1);
  else {
    const h = pisca ? 1 : 2;
    cara = bloco(-2 + ox, -2 + (pisca ? 1 : 0), 1, h) + bloco(1 + ox, -2 + (pisca ? 1 : 0), 1, h);
    if (humor === "bravo") cara += bloco(-3, -3, 2, 1) + bloco(1, -3, 2, 1);
    cara += humor === "surpreso" ? bloco(0, 1, 1, 1) : bloco(-1, 1, 2, 1);
  }
  return (
    <>
      <path d={corpo} fill={cor} />
      <path d={corpo} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={0.5} />
      <path d={cara} fill={TINTA} />
    </>
  );
}

export const Claudinho: React.FC<{
  tamanho?: number;
  humor?: Humor;
  cor?: string;
  /** pra onde ele olha: [-1..1, -1..1] */
  olhar?: [number, number];
  /** defasagem do piscar e do balanço (dê um número diferente pra cada Claudinho) */
  fase?: number;
  /** raios mexendo e piscando */
  vivo?: boolean;
  /** estica o raio mais perto do ângulo (graus, 0 = direita, 90 = baixo): o soco */
  estica?: { angulo: number; quanto: number };
  /** força um desenho (senão é o do tema) */
  desenho?: Visual["personagem"];
  style?: React.CSSProperties;
}> = ({ tamanho = 160, humor = "normal", cor, olhar = [0, 0], fase = 0, vivo = true, estica, desenho, style }) => {
  const { t } = useAnim();
  const tema = useTema();
  const modo = desenho ?? tema.visual.personagem;
  const nocaute = humor === "nocaute";
  const c = cor ?? (nocaute ? (tema.claro ? "#c4ada1" : "#6b5d55") : tema.cores.claudinho);
  const raios = raiosEm(t, fase, vivo, nocaute, estica);
  const pisca = vivo && !nocaute && humor !== "feliz" && (t + fase * 1.37) % 2.9 < 0.1;
  const linha = (r: { x: number; y: number }, i: number, cor: string, w: number, dx = 0, dy = 0) => <line key={i} x1={dx} y1={dy} x2={r.x + dx} y2={r.y + dy} stroke={cor} strokeWidth={w} strokeLinecap="round" />;
  const contorno = tema.visual.contorno;
  const corId = c.replace(/[^a-z0-9]/gi, "");

  let corpo: React.ReactNode;
  if (modo === "pixel") {
    corpo = <Pixel raios={raios} cor={c} humor={humor} pisca={pisca} olhar={olhar} />;
  } else if (modo === "adesivo") {
    corpo = (
      <>
        {/* sombra dura deslocada, contorno grosso, cor, brilho de adesivo */}
        {raios.map((r, i) => linha(r, i, contorno, 19.5, 5, 5))}
        <circle cx={5} cy={5} r={22.5} fill={contorno} />
        {raios.map((r, i) => linha(r, i, contorno, 19.5))}
        <circle r={22.5} fill={contorno} />
        {raios.map((r, i) => linha(r, i, c, 12.5))}
        <circle r={19} fill={c} />
        <ellipse cx={-8} cy={-11} rx={6} ry={3} fill="rgba(255,255,255,0.45)" transform="rotate(-25 -8 -11)" />
        <Cara humor={humor} olhar={olhar} pisca={pisca} tinta={TINTA} olhoBranco />
      </>
    );
  } else if (modo === "massinha") {
    corpo = (
      <>
        <defs>
          <radialGradient id={`ms-${corId}`} gradientUnits="userSpaceOnUse" cx={-16} cy={-18} r={78}>
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
            <stop offset="0.35" stopColor={c} stopOpacity={0} />
            <stop offset="1" stopColor="#5a1f10" stopOpacity={0.38} />
          </radialGradient>
          <filter id="ms-sombra" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={4} />
          </filter>
        </defs>
        <ellipse cx={4} cy={52} rx={38} ry={7} fill="rgba(60,20,40,0.28)" filter="url(#ms-sombra)" />
        {raios.map((r, i) => linha(r, i, c, 16))}
        <circle r={22} fill={c} />
        {raios.map((r, i) => linha(r, i, `url(#ms-${corId})`, 16))}
        <circle r={22} fill={`url(#ms-${corId})`} />
        <ellipse cx={-9} cy={-12} rx={7} ry={3.6} fill="rgba(255,255,255,0.7)" transform="rotate(-30 -9 -12)" />
        <Cara humor={humor} olhar={olhar} pisca={pisca} tinta={TINTA} />
      </>
    );
  } else if (modo === "traco") {
    // line-art: contorno da silhueta inteira (tinta embaixo, papel em cima) e um traço da cor em cada raio
    corpo = (
      <>
        {raios.map((r, i) => linha(r, i, contorno, 15.6))}
        <circle r={20.6} fill={contorno} />
        {raios.map((r, i) => linha(r, i, tema.cores.card, 11.8))}
        <circle r={18.7} fill={tema.cores.card} />
        <circle r={18.7} fill={c} opacity={0.14} />
        {raios.map((r, i) => {
          const l = Math.hypot(r.x, r.y);
          return <line key={`h${i}`} x1={(r.x / l) * 22} y1={(r.y / l) * 22} x2={r.x * 0.97} y2={r.y * 0.97} stroke={c} strokeWidth={3.4} strokeLinecap="round" />;
        })}
        <Cara humor={humor} olhar={olhar} pisca={pisca} tinta={contorno} />
      </>
    );
  } else {
    corpo = (
      <>
        {raios.map((r, i) => linha(r, i, c, 12.5))}
        <circle r={19} fill={c} />
        {/* no fundo escuro os olhos ganham o branco (senão somem no corpo) */}
        <Cara humor={humor} olhar={olhar} pisca={pisca} tinta={tema.claro ? TINTA : tema.visual.contorno} olhoBranco={!tema.claro} />
      </>
    );
  }
  return (
    <svg width={tamanho} height={tamanho} viewBox="-60 -60 120 120" style={{ overflow: "visible", display: "block", ...style }}>
      {corpo}
    </svg>
  );
};
