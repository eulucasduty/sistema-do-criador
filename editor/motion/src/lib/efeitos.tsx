// Efeitos: faíscas, onda de impacto, nuvem de briga de desenho animado, estrela, coroa e brilho.
// Todos em posição absoluta (x, y = centro, em px do motion) e com tempo próprio (em, segundos).
import React from "react";
import { acaso, entre, mola, seno, useAnim } from "./anim";
import { CURVA, useTema } from "./tema";

/** Faíscas saindo de um ponto (impacto, revelação). */
export const Faiscas: React.FC<{ em: number; x: number; y: number; n?: number; raio?: number; cor?: string; dur?: number; tamanho?: number }> = ({ em, x, y, n = 14, raio = 190, cor, dur = 0.6, tamanho = 1 }) => {
  const { t } = useAnim();
  const { cores } = useTema();
  if (t < em || t > em + dur) return null;
  const p = (t - em) / dur;
  const anda = 1 - Math.pow(1 - p, 3);
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const ang = (i / n) * Math.PI * 2 + (acaso(i, 2) - 0.5) * 0.5;
        const r = raio * (0.55 + acaso(i, 4) * 0.6) * anda;
        const comp = (16 + acaso(i, 6) * 22) * (1 - p) * tamanho;
        return <div key={i} style={{ position: "absolute", left: x + Math.cos(ang) * r, top: y + Math.sin(ang) * r, width: comp, height: 7 * tamanho, marginLeft: -comp / 2, marginTop: -3.5 * tamanho, borderRadius: 4, background: i % 3 === 0 ? cores.ouro : (cor ?? cores.heroi), transform: `rotate(${(ang * 180) / Math.PI}deg)`, opacity: 1 - p * p }} />;
      })}
    </>
  );
};

/** Onda de impacto: um anel que cresce e some. */
export const Onda: React.FC<{ em: number; x: number; y: number; raio?: number; cor?: string; dur?: number; espessura?: number }> = ({ em, x, y, raio = 260, cor, dur = 0.55, espessura = 10 }) => {
  const { t } = useAnim();
  const { cores } = useTema();
  if (t < em || t > em + dur) return null;
  const p = entre(t, [em, em + dur], [0, 1]);
  const r = raio * p;
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${espessura * (1 - p) + 1}px solid ${cor ?? cores.heroi}`, opacity: 1 - p }} />;
};

/** Estrela de quatro pontas (o brilho de desenho animado). */
export const Estrela: React.FC<{ tamanho?: number; cor?: string; style?: React.CSSProperties }> = ({ tamanho = 40, cor, style }) => {
  const { cores } = useTema();
  return (
    <svg width={tamanho} height={tamanho} viewBox="-10 -10 20 20" style={{ overflow: "visible", ...style }}>
      <path d="M 0 -10 Q 1.6 -1.6 10 0 Q 1.6 1.6 0 10 Q -1.6 1.6 -10 0 Q -1.6 -1.6 0 -10 Z" fill={cor ?? cores.ouro} />
    </svg>
  );
};

/** Coroa (o vencedor). */
export const Coroa: React.FC<{ tamanho?: number; cor?: string; style?: React.CSSProperties }> = ({ tamanho = 90, cor, style }) => {
  const { cores } = useTema();
  return (
    <svg width={tamanho} height={tamanho * 0.75} viewBox="0 0 40 30" style={{ overflow: "visible", ...style }}>
      <path d="M 3 26 L 1 8 L 11 16 L 20 2 L 29 16 L 39 8 L 37 26 Z" fill={cor ?? cores.ouro} stroke="#2a1a14" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={20} cy={2} r={2.6} fill={cor ?? cores.ouro} stroke="#2a1a14" strokeWidth={1.6} />
    </svg>
  );
};

/** Brilho macio atrás de algo (só um por quadro: é o herói). */
export const Brilho: React.FC<{ em: number; x: number; y: number; raio?: number; cor?: string }> = ({ em, x, y, raio = 220, cor }) => {
  const { t, fps } = useAnim();
  const { cores } = useTema();
  const p = mola(t, em, fps, "suave");
  if (p <= 0.001) return null;
  const r = raio * (0.6 + 0.4 * p) * (1 + seno(t, 2.2, 0.04));
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: `radial-gradient(circle, ${cor ?? cores.brilho}, transparent 66%)`, opacity: p }} />;
};

/**
 * Nuvem de briga (desenho animado): bolhas que fervem, estrelas e raios pulando pra fora.
 * Entra com mola no `em`, ferve até o `ate` e estoura.
 */
export const NuvemDeBriga: React.FC<{ em: number; ate: number; x: number; y: number; tamanho?: number }> = ({ em, ate, x, y, tamanho = 420 }) => {
  const { t, fps } = useAnim();
  const { cores, visual } = useTema();
  if (t < em || t > ate + 0.3) return null;
  const entra = mola(t, em, fps, "pula");
  const estoura = entre(t, [ate, ate + 0.28], [0, 1], CURVA.sai);
  const escala = entra * (1 + estoura * 0.35);
  const bolhas = Array.from({ length: 10 }, (_, i) => {
    const ang = (i / 9) * Math.PI * 2;
    const centro = i === 9;
    const dist = centro ? 0 : tamanho * 0.3 + seno(t, 0.32 + acaso(i, 8) * 0.2, tamanho * 0.035, i);
    const r = (centro ? tamanho * 0.36 : tamanho * (0.17 + acaso(i, 9) * 0.07)) * (1 + seno(t, 0.27 + acaso(i, 10) * 0.15, 0.08, i * 2));
    return { cx: Math.cos(ang) * dist, cy: Math.sin(ang) * dist * 0.72, r };
  });
  const tinta = visual.contorno;
  // o que pula pra fora da nuvem: raios de Claudinho (braços), estrelas e "riscos" de velocidade
  const pulos = Array.from({ length: 7 }, (_, i) => {
    const ciclo = 0.42;
    const k = ((t - em) / ciclo + acaso(i, 12) * 3) % 3;
    if (k > 1) return null;
    const ang = acaso(Math.floor((t - em) / ciclo) * 7 + i, 13) * Math.PI * 2;
    const d = tamanho * (0.42 + 0.18 * k);
    const px = Math.cos(ang) * d;
    const py = Math.sin(ang) * d * 0.75;
    if (i % 3 === 0) return <Estrela key={i} tamanho={34 + 20 * (1 - k)} style={{ position: "absolute", left: px - 25, top: py - 25, opacity: 1 - k }} />;
    return <div key={i} style={{ position: "absolute", left: px, top: py, width: 58, height: 15, marginLeft: -29, marginTop: -7.5, borderRadius: 9, background: cores.claudinho, transform: `rotate(${(ang * 180) / Math.PI}deg)`, opacity: 1 - k * 0.6 }} />;
  });
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${escala}) rotate(${seno(t, 0.5, 3)}deg)`, opacity: 1 - estoura }}>
      {pulos}
      <svg width={tamanho * 2} height={tamanho * 2} viewBox={`${-tamanho} ${-tamanho} ${tamanho * 2} ${tamanho * 2}`} style={{ position: "absolute", left: -tamanho, top: -tamanho, overflow: "visible" }}>
        {bolhas.map((b, i) => <circle key={`c${i}`} cx={b.cx} cy={b.cy} r={b.r + 7} fill={tinta} />)}
        {bolhas.map((b, i) => <circle key={`b${i}`} cx={b.cx} cy={b.cy} r={b.r} fill={cores.card} />)}
        {bolhas.slice(0, 6).map((b, i) => <circle key={`s${i}`} cx={b.cx - b.r * 0.3} cy={b.cy - b.r * 0.35} r={b.r * 0.22} fill={cores.fundo} />)}
      </svg>
    </div>
  );
};
