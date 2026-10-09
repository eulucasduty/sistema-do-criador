// Texto e interface: entrada padrão, título palavra por palavra, rótulo, card, número contando e
// balão de fala. Tudo com o tema do estilo.
import React from "react";
import { entre, mola, seno, useAnim } from "./anim";
import { CURVA, sombraCard, useTema } from "./tema";

/** A entrada de sempre: aparece, sobe e cresce juntos (nunca só um fade). */
export const Entrada: React.FC<{ em: number; de?: "baixo" | "cima" | "esquerda" | "direita" | "zoom"; mola?: "rapida" | "suave" | "pula"; distancia?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ em, de = "baixo", mola: tipo = "suave", distancia = 50, children, style }) => {
  const { t, fps } = useAnim();
  const p = mola(t, em, fps, tipo);
  const d = (1 - p) * distancia;
  const mov = de === "baixo" ? `translateY(${d}px)` : de === "cima" ? `translateY(${-d}px)` : de === "esquerda" ? `translateX(${-d}px)` : de === "direita" ? `translateX(${d}px)` : "";
  const esc = de === "zoom" ? 0.4 + 0.6 * p : 0.94 + 0.06 * p;
  return <div style={{ opacity: Math.min(1, p * 1.4), transform: `${mov} scale(${esc})`, ...style }}>{children}</div>;
};

/** Título que entra palavra por palavra. `destaque`: palavras na cor de destaque (uma por título). */
export const Titulo: React.FC<{ texto: string; em: number; tamanho?: number; destaque?: string[]; cor?: string; alinhar?: "center" | "left"; passo?: number; largura?: number; style?: React.CSSProperties }> = ({ texto, em, tamanho = 96, destaque = [], cor, alinhar = "center", passo = 0.09, largura = 940, style }) => {
  const { t, fps } = useAnim();
  const { cores, fontes } = useTema();
  tamanho = tamanho * (fontes.escala ?? 1);
  const marcadas = destaque.map((d) => d.toLowerCase());
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: alinhar === "center" ? "center" : "flex-start", columnGap: tamanho * 0.24, rowGap: 0, maxWidth: largura, fontFamily: fontes.titulo, fontStyle: fontes.tituloEstilo, fontWeight: fontes.tituloPeso, letterSpacing: fontes.tituloPeso ? "-0.03em" : undefined, fontSize: tamanho, lineHeight: 1.02, color: cor ?? cores.tinta, ...style }}>
      {texto.split(" ").map((p, i) => {
        const k = mola(t, em + i * passo, fps, "rapida");
        const limpa = p.replace(/[.,!?:;]/g, "").toLowerCase();
        return (
          <span key={i} style={{ display: "inline-block", opacity: Math.min(1, k * 1.5), transform: `translateY(${(1 - k) * tamanho * 0.45}px)`, color: marcadas.includes(limpa) ? cores.heroi : undefined }}>
            {p}
          </span>
        );
      })}
    </div>
  );
};

/** Rótulo em pílula escura, letra mono espaçada. */
export const Rotulo: React.FC<{ texto: string; em: number; style?: React.CSSProperties }> = ({ texto, em, style }) => {
  const { cores, fontes, claro, visual } = useTema();
  const base: React.CSSProperties = { display: "inline-block", fontFamily: fontes.mono, fontSize: 26, letterSpacing: "0.16em", textTransform: "uppercase", padding: "10px 22px", borderRadius: 999 };
  // cada identidade tem o rótulo dela
  const cara: React.CSSProperties =
    visual.fundo === "meio-tom"
      ? { background: cores.ouro, color: cores.tinta, border: `3px solid ${visual.contorno}`, boxShadow: `4px 4px 0 ${visual.contorno}`, borderRadius: 10, fontFamily: fontes.titulo, letterSpacing: "0.06em", fontSize: 30 }
      : visual.fundo === "noite"
        ? { background: `linear-gradient(${cores.heroi}, ${cores.heroi}) left bottom / 56px 3px no-repeat`, color: cores.heroi, borderRadius: 0, padding: "4px 0 16px", fontFamily: fontes.texto, fontWeight: 600, letterSpacing: "0.2em" }
      : visual.fundo === "terminal"
        ? { background: "transparent", color: cores.heroi, border: `2px solid ${cores.heroi}`, borderRadius: 6 }
        : visual.fundo === "massinha"
          ? { background: `linear-gradient(180deg, ${cores.heroi}, #e8522a)`, color: "#ffffff", boxShadow: `0 10px 24px ${cores.sombra}, inset 0 3px 0 rgba(255,255,255,0.35)`, letterSpacing: "0.08em" }
          : visual.fundo === "limpo"
            ? { background: "transparent", color: cores.tinta, borderRadius: 0, padding: "4px 2px", borderBottom: `2px solid ${cores.heroi}` }
            : { background: claro ? cores.tinta : cores.card, color: claro ? cores.fundo : cores.tinta, border: claro ? "none" : `2px solid ${cores.borda}` };
  return (
    <Entrada em={em} de="baixo" mola="rapida" distancia={24} style={style}>
      <span style={{ ...base, ...cara }}>{visual.fundo === "terminal" ? `› ${texto}` : texto}</span>
    </Entrada>
  );
};

/** Card branco de canto arredondado com sombra macia. */
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; destaque?: boolean }> = ({ children, style, destaque }) => {
  const tema = useTema();
  const { cores, visual, fontes } = tema;
  const espessura = destaque ? Math.max(3, visual.cardBorda + 1) : visual.cardBorda;
  const corBorda = destaque ? cores.heroi : visual.sombraDura ? visual.contorno : cores.borda;
  return <div style={{ background: cores.card, border: espessura ? `${espessura}px solid ${corBorda}` : "none", borderRadius: visual.cardRaio, boxShadow: sombraCard(tema, destaque), boxSizing: "border-box", color: cores.tinta, fontFamily: fontes.texto, ...style }}>{children}</div>;
};

/** Número contando (com algarismos de largura fixa, pra não tremer). */
export const Numero: React.FC<{ de?: number; para: number; em: number; dur?: number; prefixo?: string; sufixo?: string; casas?: number; tamanho?: number; cor?: string; style?: React.CSSProperties }> = ({ de = 0, para, em, dur = 1.2, prefixo = "", sufixo = "", casas = 0, tamanho = 140, cor, style }) => {
  const { t } = useAnim();
  const { cores } = useTema();
  const v = entre(t, [em, em + dur], [de, para], CURVA.entra);
  const pronto = t >= em + dur;
  const pulo = pronto ? 1 + 0.12 * Math.max(0, 1 - (t - em - dur) / 0.25) : 1;
  const { fontes } = useTema();
  return <span style={{ fontFamily: fontes.numero, fontWeight: 800, fontSize: tamanho, fontVariantNumeric: "tabular-nums", color: cor ?? cores.tinta, display: "inline-block", transform: `scale(${pulo})`, ...style }}>{prefixo}{v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}{sufixo}</span>;
};

/** Balão de fala com rabinho (de baixo à esquerda). */
export const Balao: React.FC<{ texto: string; em: number; cor?: string; tamanho?: number; style?: React.CSSProperties }> = ({ texto, em, cor, tamanho = 38, style }) => {
  const { t } = useAnim();
  const { cores, fontes, visual } = useTema();
  const contorno = visual.contorno;
  const fundo = cor ?? cores.card;
  return (
    <Entrada em={em} de="zoom" mola="pula" style={style}>
      <div style={{ position: "relative", display: "inline-block", padding: "14px 26px", borderRadius: 26, background: fundo, border: `3px solid ${contorno}`, fontFamily: fontes.impacto, fontSize: tamanho, letterSpacing: "0.03em", color: cor ? "#ffffff" : cores.tinta, transform: `rotate(${seno(t, 1.6, 2)}deg)` }}>
        {texto}
        <div style={{ position: "absolute", left: 26, bottom: -16, width: 26, height: 26, background: fundo, borderRight: `3px solid ${contorno}`, borderBottom: `3px solid ${contorno}`, transform: "rotate(45deg)" }} />
      </div>
    </Entrada>
  );
};
