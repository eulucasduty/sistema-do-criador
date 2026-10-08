// A cena: a raiz de todo motion. Monta as camadas (fundo vivo → conteúdo → correção de cor →
// grão → linhas de tela → vinheta) e faz a saída no fim, mais rápida que as entradas.
// O fundo e a textura vêm da identidade visual do tema (tema.visual).
// Motion transparente (por cima do vídeo do criador): sem fundo, sem cor, sem grão, sem vinheta.
import React from "react";
import { AbsoluteFill } from "remotion";
import { entre, seno, useAnim } from "./anim";
import { CURVA, useTema } from "./tema";

const alfa = (rgba: string, a: number) => rgba.replace(/[\d.]+\)$/, `${a})`);

/** O fundo da cena, conforme o tema: papel, meio-tom (gibi), terminal, massinha ou limpo. Sempre vivo. */
export const Papel: React.FC<{ pontos?: boolean }> = ({ pontos = true }) => {
  const { t, largura, altura } = useAnim();
  const { cores, claro, visual } = useTema();
  const d1 = seno(t, 7, 60);
  const d2 = seno(t, 9, 50, 1.3);
  const grande = Math.max(largura, altura);
  const luz = (cor: string, x: number, y: number, tam: number, blur = 60) => <div style={{ position: "absolute", width: grande * tam, height: grande * tam, borderRadius: "50%", left: x, top: y, filter: `blur(${blur}px)`, background: `radial-gradient(circle, ${cor}, transparent 62%)` }} />;

  if (visual.fundo === "noite") {
    // noite: azul noite, luz azul no canto, a onda de pontos embaixo e as faixas do X à direita
    const linhas = 13;
    const colunas = 30;
    const base = altura * 0.66;
    let pts = "";
    for (let r = 0; r < linhas; r++)
      for (let c = 0; c < colunas; c++) {
        const p = r / (linhas - 1);
        const x = -40 + (c / (colunas - 1)) * (largura + 80) * (0.8 + p * 0.4) - p * largura * 0.2;
        const y = base + Math.pow(p, 1.4) * altura * 0.36 + Math.sin(c * 0.38 + r * 0.5 + t * 1.5) * (14 + 26 * p);
        const raio = 1.1 + p * 2.4;
        pts += `M${x.toFixed(1)} ${(y - raio).toFixed(1)}a${raio.toFixed(2)} ${raio.toFixed(2)} 0 1 0 0.01 0z`;
      }
    const anda = seno(t, 8, 24);
    return (
      <AbsoluteFill style={{ background: cores.fundo, overflow: "hidden" }}>
        {luz(alfa(cores.brilho, 0.34), -grande * 0.35 + d1, -grande * 0.38, 1, 90)}
        <svg width={largura} height={altura} style={{ position: "absolute", left: 0, top: 0 }}>
          <path d={pts} fill="#3b6ff0" opacity={0.42} />
        </svg>
        {/* o X da capa, só na borda direita: os dois braços da esquerda de um X que cruza fora da tela.
            O de cima é a faixa clara; o de baixo tem a faixa azul. Desliza devagar. */}
        <svg width={largura} height={altura} style={{ position: "absolute", left: 0, top: 0 }}>
          <defs>
            <linearGradient id="px-claro" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity={0.05} />
              <stop offset="1" stopColor="#E5E7EB" stopOpacity={0.24} />
            </linearGradient>
          </defs>
          {(() => {
            const cx = largura * 1.04 + anda * 0.6;
            const cy = altura * 0.5;
            // braços curtos e em pé: o X fica no terço da direita, longe do conteúdo
            const L = largura * 0.52;
            const a = (52 * Math.PI) / 180;
            const braco = (sinal: number, larg: number) => {
              const ex = cx - Math.cos(a) * L;
              const ey = cy + sinal * Math.sin(a) * L;
              const nx = Math.sin(a) * larg * 0.5;
              const ny = Math.cos(a) * larg * 0.5 * sinal;
              return `M${cx - nx},${cy + ny} L${ex - nx},${ey + ny} L${ex + nx},${ey - ny} L${cx + nx},${cy - ny} Z`;
            };
            return (
              <>
                <path d={braco(-1, largura * 0.2)} fill="url(#px-claro)" />
                <path d={braco(1, largura * 0.2)} fill="url(#px-claro)" opacity={0.7} />
                <path d={braco(1, largura * 0.06)} fill={cores.heroi} opacity={0.9} />
              </>
            );
          })()}
        </svg>
      </AbsoluteFill>
    );
  }
  if (visual.fundo === "meio-tom")
    return (
      <AbsoluteFill style={{ background: cores.fundo, overflow: "hidden" }}>
        {luz(cores.fundo2, -grande * 0.3 + d1, -grande * 0.35, 0.95, 40)}
        {/* retícula de gibi: pontos que crescem pra um canto, andando devagar */}
        <AbsoluteFill style={{ backgroundImage: `radial-gradient(circle, ${alfa(cores.brilho, 0.42)} 3.2px, transparent 3.6px)`, backgroundSize: "22px 22px", backgroundPosition: `${t * 6}px ${t * 9}px`, WebkitMaskImage: "linear-gradient(160deg, transparent 30%, #000 100%)", maskImage: "linear-gradient(160deg, transparent 30%, #000 100%)" }} />
        {/* raios de fundo de capa de gibi, girando bem devagar */}
        <AbsoluteFill style={{ background: `repeating-conic-gradient(from ${t * 4}deg at 50% 46%, ${alfa("rgba(255,255,255,1)", 0.28)} 0deg 7deg, transparent 7deg 18deg)`, WebkitMaskImage: "radial-gradient(circle at 50% 46%, #000 0, transparent 70%)", maskImage: "radial-gradient(circle at 50% 46%, #000 0, transparent 70%)" }} />
      </AbsoluteFill>
    );
  if (visual.fundo === "terminal")
    return (
      <AbsoluteFill style={{ background: cores.fundo, overflow: "hidden" }}>
        {luz(cores.fundo2, -grande * 0.2 + d1, -grande * 0.3, 0.9, 80)}
        {luz(alfa(cores.brilho, 0.12), largura - grande * 0.5 - d2, altura - grande * 0.45, 0.7, 90)}
        {/* grade de terminal, deslizando pra cima */}
        <AbsoluteFill style={{ backgroundImage: `linear-gradient(${alfa("rgba(255,255,255,1)", 0.035)} 1px, transparent 1px), linear-gradient(90deg, ${alfa("rgba(255,255,255,1)", 0.035)} 1px, transparent 1px)`, backgroundSize: "48px 48px", backgroundPosition: `0px ${-t * 14}px` }} />
      </AbsoluteFill>
    );
  if (visual.fundo === "massinha")
    return (
      <AbsoluteFill style={{ background: `linear-gradient(165deg, ${cores.fundo} 0%, ${cores.fundo2} 100%)`, overflow: "hidden" }}>
        {luz("rgba(255,255,255,0.9)", -grande * 0.25 + d1, -grande * 0.3, 0.8, 50)}
        {luz(alfa(cores.brilho, 0.22), largura - grande * 0.45 - d2, altura * 0.55, 0.6, 70)}
        {/* bolhas de massinha flutuando atrás */}
        {[0, 1, 2, 3].map((k) => (
          <div key={k} style={{ position: "absolute", left: [0.08, 0.78, 0.15, 0.7][k] * largura + seno(t, 5 + k, 18, k), top: [0.12, 0.2, 0.72, 0.8][k] * altura + seno(t, 6 + k, 22, k * 2), width: [130, 90, 70, 150][k], height: [130, 90, 70, 150][k], borderRadius: "50%", background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9), ${k % 2 ? cores.fundo2 : alfa(cores.brilho, 0.5)} 70%)`, opacity: 0.55, filter: "blur(1px)" }} />
        ))}
      </AbsoluteFill>
    );
  if (visual.fundo === "limpo")
    return (
      <AbsoluteFill style={{ background: cores.fundo, overflow: "hidden" }}>
        {/* pautas de revista bem finas, descendo devagar */}
        <AbsoluteFill style={{ backgroundImage: `linear-gradient(${alfa("rgba(20,20,20,1)", 0.05)} 1px, transparent 1px)`, backgroundSize: "100% 64px", backgroundPosition: `0px ${t * 8}px` }} />
        <div style={{ position: "absolute", left: 56, top: 0, bottom: 0, width: 1.5, background: alfa("rgba(217,119,87,1)", 0.35) }} />
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background: cores.fundo, overflow: "hidden" }}>
      {luz(claro ? "rgba(255,255,255,0.95)" : cores.fundo2, -grande * 0.25 + d1, -grande * 0.32, 0.9)}
      {luz(alfa(cores.brilho, 0.16), largura - grande * 0.5 - d2, altura - grande * 0.45, 0.75, 70)}
      {pontos && <AbsoluteFill style={{ backgroundImage: `radial-gradient(circle, ${claro ? "rgba(26,26,26,0.07)" : "rgba(255,255,255,0.06)"} 1.6px, transparent 1.8px)`, backgroundSize: "36px 36px", backgroundPosition: `${t * 10}px ${t * 16}px` }} />}
    </AbsoluteFill>
  );
};

/** Correção de cor: junta tudo num visual só (fica por cima do conteúdo). */
export const Grade: React.FC = () => {
  const { cores, claro, visual } = useTema();
  if (visual.correcao <= 0) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: cores.heroi, mixBlendMode: "soft-light", opacity: visual.correcao }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${claro ? 0.04 : 0.12}), transparent 26%, transparent 74%, rgba(0,0,0,${claro ? 0.07 : 0.2}))` }} />
    </AbsoluteFill>
  );
};

const RUIDO = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;

/** Grão de filme, sem arquivo (ferve a cada quadro). */
export const Grao: React.FC = () => {
  const { frame } = useAnim();
  const { claro, visual } = useTema();
  if (visual.grao <= 0) return null;
  return <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: RUIDO, backgroundSize: "220px", backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`, opacity: visual.grao, mixBlendMode: claro ? "multiply" : "overlay" }} />;
};

/** Linhas de tela (terminal): finas, com uma faixa de brilho descendo devagar. */
export const LinhasDeTela: React.FC = () => {
  const { t, altura } = useAnim();
  const { visual } = useTema();
  if (!visual.linhas) return null;
  const y = ((t * 260) % (altura + 400)) - 200;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.22) 0px, rgba(0,0,0,0.22) 1px, transparent 1px, transparent 4px)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: y, height: 200, background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.035), transparent)" }} />
    </AbsoluteFill>
  );
};

/** Vinheta: a camada de cima de tudo. */
export const Vinheta: React.FC = () => {
  const { visual } = useTema();
  if (visual.vinheta <= 0) return null;
  return <AbsoluteFill style={{ pointerEvents: "none", background: `radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,${visual.vinheta}) 100%)` }} />;
};

/**
 * A raiz de todo motion.
 *   transparente: vai por cima do vídeo do criador (sem fundo, sem cor, sem grão, sem vinheta)
 *   saida: "zoom" (atravessa a tela), "sobe" (sobe e some), "nenhuma"
 */
export const Cena: React.FC<{ children: React.ReactNode; transparente?: boolean; saida?: "zoom" | "sobe" | "nenhuma"; tempoSaida?: number; pontos?: boolean }> = ({ children, transparente = false, saida = "sobe", tempoSaida = 0.32, pontos = true }) => {
  const { t, dur } = useAnim();
  const a = dur - tempoSaida;
  const k = saida === "nenhuma" ? 0 : entre(t, [a, dur - 0.02], [0, 1], CURVA.sai);
  const transform = saida === "zoom" ? `scale(${1 + 0.18 * k})` : `translateY(${-70 * k}px) scale(${1 - 0.06 * k})`;
  const conteudo = <AbsoluteFill style={{ opacity: 1 - k, transform, filter: k > 0.01 ? `blur(${6 * k}px)` : undefined }}>{children}</AbsoluteFill>;
  if (transparente) return <AbsoluteFill>{conteudo}</AbsoluteFill>;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* o papel fica: no fim o editor dissolve o motion direto no vídeo (sem passar pelo preto) */}
      <Papel pontos={pontos} />
      {conteudo}
      <Grade />
      <Grao />
      <LinhasDeTela />
      <Vinheta />
    </AbsoluteFill>
  );
};
