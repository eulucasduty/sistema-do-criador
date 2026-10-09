// A vitrine: as peças dos motions que vão se montando com a fala. Cada coisa que
// ele cita aparece na hora em que é falada, entra com foco (vem desfocada e assenta), vai pro fundo
// quando a próxima chega e nunca fica parada. Tudo com o tema do estilo (claro ou <Cena noite>).
//   Foco · Vidro · Etiqueta · IconeApp · Rolo · Embaralha · Anotacao · Carimbo · Cursor · Janela ·
//   Barra · Checklist · Mira · Sublinha · Mapa · Pinos
import React from "react";
import { acaso, degrau, entre, mola, passos, seno, useAnim } from "./anim";
import { CURVA, sombraCard, useTema } from "./tema";

const alfa = (cor: string, a: number) => {
  if (cor.startsWith("rgba")) return cor.replace(/[\d.]+\)$/, `${a})`);
  const h = cor.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/**
 * A entrada da vitrine: vem desfocada, menor e um pouco de baixo, e assenta com mola (o "focus pull").
 *   recua: o instante em que vai pro fundo (outra coisa entrou na frente): encolhe, desfoca e apaga
 *   volta: o instante em que volta pra frente depois de recuar
 *   sai: o instante em que some (rápido: desfoca, sobe e apaga)
 */
export const Foco: React.FC<{ em: number; recua?: number; volta?: number; sai?: number; de?: "baixo" | "cima" | "esquerda" | "direita" | "perto" | "longe"; distancia?: number; desfoque?: number; mola?: "rapida" | "suave" | "pula"; children: React.ReactNode; style?: React.CSSProperties }> = ({ em, recua, volta, sai, de = "baixo", distancia = 46, desfoque = 18, mola: tipo = "suave", children, style }) => {
  const { t, fps } = useAnim();
  const p = mola(t, em, fps, tipo);
  if (t < em - 0.001) return <div style={{ ...style, opacity: 0, visibility: "hidden" }}>{children}</div>;
  let r = recua !== undefined ? entre(t, [recua, recua + 0.45], [0, 1], CURVA.move) : 0;
  if (volta !== undefined) r *= 1 - entre(t, [volta, volta + 0.45], [0, 1], CURVA.move);
  const s = sai !== undefined ? entre(t, [sai, sai + 0.26], [0, 1], CURVA.sai) : 0;
  const d = (1 - p) * distancia;
  const dx = de === "esquerda" ? -d : de === "direita" ? d : 0;
  const dy = (de === "baixo" ? d : de === "cima" ? -d : 0) - 34 * r - 50 * s;
  const esc = (de === "perto" ? 1.35 - 0.35 * p : de === "longe" ? 0.6 + 0.4 * p : 0.9 + 0.1 * p) * (1 - 0.12 * r) * (1 + 0.05 * s);
  const blur = (1 - Math.min(1, p)) * desfoque + 6 * r + 16 * s;
  const op = Math.min(1, p * 1.6) * (1 - 0.5 * r) * (1 - s);
  return <div style={{ ...style, opacity: op, transform: `${style?.transform ?? ""} translate(${dx}px, ${dy}px) scale(${esc})`, filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined, visibility: op <= 0.002 ? "hidden" : undefined }}>{children}</div>;
};

/**
 * Card de vidro: branco (ou o card da noite), canto grande e a sombra longa da vitrine. Com `inclina`
 * (graus) ele fica num leve 3D que respira; `destaque` acende a borda na cor de destaque.
 */
export const Vidro: React.FC<{ children: React.ReactNode; largura?: number | string; inclina?: number; destaque?: boolean; pad?: number | string; style?: React.CSSProperties }> = ({ children, largura, inclina = 0, destaque, pad = 32, style }) => {
  const tema = useTema();
  const { t } = useAnim();
  const { cores, visual, fontes, claro } = tema;
  const caixa: React.CSSProperties = {
    width: largura,
    padding: pad,
    boxSizing: "border-box",
    borderRadius: visual.cardRaio,
    background: claro ? cores.card : `linear-gradient(180deg, ${alfa("#ffffff", 0.06)}, ${alfa("#ffffff", 0.02)}), ${cores.card}`,
    border: claro ? `1px solid ${cores.borda}` : `1px solid ${cores.borda}`,
    boxShadow: sombraCard(tema, destaque),
    color: cores.tinta,
    fontFamily: fontes.texto,
    ...style,
  };
  if (!inclina) return <div style={caixa}>{children}</div>;
  const rx = inclina * 0.6 + seno(t, 7, inclina * 0.25);
  const ry = -inclina + seno(t, 9, inclina * 0.35, 1);
  return (
    <div style={{ perspective: 1600 }}>
      <div style={{ ...caixa, transform: `rotateX(${rx}deg) rotateY(${ry}deg)`, transformStyle: "preserve-3d" }}>{children}</div>
    </div>
  );
};

/** A pílula de capítulo: "● 01 / 05 · TASTE SKILL". `numero` = [atual, total]. */
export const Etiqueta: React.FC<{ texto: string; numero?: [number, number]; em: number; style?: React.CSSProperties }> = ({ texto, numero, em, style }) => {
  const { t } = useAnim();
  const tema = useTema();
  const { cores, fontes } = tema;
  const pisca = 0.55 + 0.45 * Math.abs(Math.sin(t * 3));
  const dd = (n: number) => String(n).padStart(2, "0");
  return (
    <Foco em={em} distancia={20} desfoque={10} mola="rapida" style={style}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "12px 24px", borderRadius: 999, background: cores.card, border: `1px solid ${cores.borda}`, boxShadow: `0 10px 26px ${cores.sombra}`, fontFamily: fontes.mono, fontSize: 24, letterSpacing: "0.14em", textTransform: "uppercase", color: cores.tinta, whiteSpace: "nowrap" }}>
        <span style={{ width: 11, height: 11, borderRadius: "50%", background: cores.heroi, opacity: pisca, boxShadow: `0 0 12px ${cores.brilho}` }} />
        {numero && (
          <span style={{ fontWeight: 600 }}>
            {dd(numero[0])} <span style={{ color: cores.dim }}>/ {dd(numero[1])}</span>
          </span>
        )}
        {numero && <span style={{ color: cores.dim }}>·</span>}
        <span>{texto}</span>
      </div>
    </Foco>
  );
};

/**
 * Ícone de aplicativo (o quadrado arredondado com sombra de objeto): logo, ícone ou texto dentro.
 * `fundo`: "card" (branco/noite), "escuro" (preto) ou uma cor. Flutua devagar.
 */
export const IconeApp: React.FC<{ tamanho?: number; fundo?: "card" | "escuro" | string; children: React.ReactNode; fase?: number; style?: React.CSSProperties }> = ({ tamanho = 300, fundo = "card", children, fase = 0, style }) => {
  const { t } = useAnim();
  const { cores, claro } = useTema();
  const bg = fundo === "card" ? (claro ? "linear-gradient(160deg, #ffffff 0%, #f1efeb 100%)" : `linear-gradient(160deg, #26262a 0%, ${cores.card} 100%)`) : fundo === "escuro" ? "linear-gradient(160deg, #2a2a2e 0%, #0e0e10 100%)" : fundo;
  const y = seno(t, 3.2, 7, fase);
  const giro = seno(t, 4.6, 1.6, fase + 1);
  return (
    <div style={{ position: "relative", width: tamanho, height: tamanho, transform: `translateY(${y}px) rotate(${giro}deg)`, ...style }}>
      {/* sombra de contato no "chão" */}
      <div style={{ position: "absolute", left: tamanho * 0.12, right: tamanho * 0.12, bottom: -tamanho * 0.1 - y * 0.6, height: tamanho * 0.14, borderRadius: "50%", background: claro ? "rgba(40,30,20,0.22)" : "rgba(0,0,0,0.6)", filter: `blur(${tamanho * 0.07}px)` }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: tamanho * 0.235, background: bg, boxShadow: `inset 0 ${tamanho * 0.012}px 0 rgba(255,255,255,${fundo === "card" && claro ? 1 : 0.14}), inset 0 -${tamanho * 0.02}px ${tamanho * 0.04}px rgba(0,0,0,${claro ? 0.06 : 0.3}), 0 ${tamanho * 0.08}px ${tamanho * 0.2}px ${cores.sombra}`, display: "grid", placeItems: "center", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
};

/**
 * Contador de caça-níquel: cada algarismo gira (com borrão de velocidade) e para no valor, da
 * esquerda pra direita. `valor` já formatado do jeito que aparece ("119", "1.000", "45", "0").
 * Antes do `em` o lugar do número é um esqueleto pulsando (`esconde={false}` mostra zeros).
 */
export const Rolo: React.FC<{ valor: string | number; em: number; dur?: number; voltas?: number; prefixo?: string; sufixo?: string; tamanho?: number; cor?: string; corSufixo?: string; peso?: number; esconde?: boolean; style?: React.CSSProperties }> = ({ valor, em, dur = 1.1, voltas = 2, prefixo = "", sufixo = "", tamanho = 160, cor, corSufixo, peso = 800, esconde = true, style }) => {
  const { t, fps } = useAnim();
  const { cores, fontes } = useTema();
  const txt = typeof valor === "number" ? valor.toLocaleString("pt-BR") : valor;
  const digitos = txt.split("").filter((c) => /\d/.test(c)).length;
  let k = -1;
  const pronto = em + dur + 0.08 * digitos;
  const pulo = t >= pronto ? 1 + 0.07 * Math.max(0, 1 - (t - pronto) / 0.22) : 1;
  // antes de rolar, o lugar do número fica guardado por um "esqueleto" que pulsa (o valor é surpresa)
  if (esconde && t < em - 0.05)
    return (
      <span style={{ display: "inline-flex", alignItems: "baseline", fontFamily: fontes.numero, fontWeight: peso, fontSize: tamanho, lineHeight: 1, letterSpacing: "-0.04em", color: cor ?? cores.tinta, ...style }}>
        {prefixo && <span style={{ fontSize: "0.42em", marginRight: "0.18em", letterSpacing: "-0.01em" }}>{prefixo}</span>}
        <span style={{ display: "inline-block", width: `${0.62 * Math.max(1, txt.length)}em`, height: "0.86em", borderRadius: "0.12em", background: alfa(cores.tinta, 0.07 + 0.04 * Math.abs(Math.sin(t * 4))) }} />
      </span>
    );
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", fontFamily: fontes.numero, fontWeight: peso, fontSize: tamanho, lineHeight: 1, letterSpacing: "-0.04em", color: cor ?? cores.tinta, fontVariantNumeric: "tabular-nums", transform: `scale(${pulo})`, transformOrigin: "0 70%", ...style }}>
      {prefixo && <span style={{ fontSize: "0.42em", marginRight: "0.18em", letterSpacing: "-0.01em" }}>{prefixo}</span>}
      {txt.split("").map((c, i) => {
        if (!/\d/.test(c)) return <span key={i}>{c}</span>;
        k++;
        const alvo = Number(c);
        const a = em + k * 0.08;
        // os algarismos da direita giram mais (como num caça-níquel) e todos param no valor certo
        const fim = Math.round(voltas + (digitos - k) * 0.5) * 10 + alvo;
        const pos = entre(t, [a, a + dur], [0, fim], CURVA.entra);
        const ant = entre(t - 1 / fps, [a, a + dur], [0, fim], CURVA.entra);
        const vel = Math.abs(pos - ant);
        const frac = pos % 10;
        return (
          <span key={i} style={{ display: "inline-block", height: "1em", overflow: "hidden", position: "relative", verticalAlign: "bottom" }}>
            <span style={{ display: "block", transform: `translateY(${-frac}em)`, filter: vel > 0.05 ? `blur(${Math.min(9, vel * 9).toFixed(1)}px)` : undefined }}>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n, j) => (
                <span key={j} style={{ display: "block", height: "1em", lineHeight: "1em" }}>{n}</span>
              ))}
            </span>
          </span>
        );
      })}
      {sufixo && <span style={{ fontSize: "0.62em", marginLeft: "0.14em", color: corSufixo ?? cor ?? cores.tinta, opacity: entre(t, [pronto - 0.2, pronto + 0.1], [0, 1]) }}>{sufixo}</span>}
    </span>
  );
};

const SIMBOLOS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&$@";
/** Texto que se decodifica: letras embaralhadas na cor de destaque que vão travando no texto certo. */
export const Embaralha: React.FC<{ texto: string; em: number; dur?: number; cor?: string; corSorteio?: string; style?: React.CSSProperties }> = ({ texto, em, dur = 0.9, cor, corSorteio, style }) => {
  const { t } = useAnim();
  const { cores, fontes } = useTema();
  if (t < em) return null;
  const n = texto.length;
  return (
    <span style={{ whiteSpace: "pre-wrap", ...style }}>
      {texto.split("").map((c, i) => {
        const aparece = em + (dur * 0.55 * i) / Math.max(1, n);
        const trava = em + (dur * i) / Math.max(1, n) + 0.22;
        if (t < aparece) return null;
        if (t >= trava || c === " ") return <span key={i} style={{ color: cor }}>{c}</span>;
        const s = SIMBOLOS[Math.floor(acaso(i * 31 + degrau(t, 0.05), 7) * SIMBOLOS.length)];
        return <span key={i} style={{ color: corSorteio ?? cores.heroi, fontFamily: fontes.mono }}>{s}</span>;
      })}
    </span>
  );
};

/** Anotação de revisão: pílula com bolinha ("● gradiente roxo"), com número opcional. Estoura no `em`. */
export const Anotacao: React.FC<{ texto: string; em: number; tipo?: "erro" | "ok" | "heroi"; numero?: number; tamanho?: number; style?: React.CSSProperties }> = ({ texto, em, tipo = "erro", numero, tamanho = 24, style }) => {
  const { t, fps } = useAnim();
  const { cores, fontes } = useTema();
  const cor = tipo === "ok" ? cores.ok : tipo === "heroi" ? cores.heroi : cores.erro;
  const p = mola(t, em, fps, "pula");
  if (p <= 0.01) return null;
  return (
    <div style={{ position: "absolute", display: "inline-flex", alignItems: "center", gap: 10, transform: `scale(${0.5 + 0.5 * p}) rotate(${(1 - p) * -8}deg)`, opacity: Math.min(1, p * 2), transformOrigin: "0 50%", whiteSpace: "nowrap", ...style }}>
      {numero !== undefined && <span style={{ width: tamanho * 1.5, height: tamanho * 1.5, borderRadius: "50%", background: cor, color: "#fff", display: "grid", placeItems: "center", fontFamily: fontes.texto, fontWeight: 800, fontSize: tamanho * 0.9, boxShadow: `0 6px 16px ${alfa(cor, 0.4)}` }}>{numero}</span>}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: `${tamanho * 0.32}px ${tamanho * 0.7}px`, borderRadius: 999, background: "#ffffff", border: `2px solid ${alfa(cor, 0.75)}`, color: cor, fontFamily: fontes.texto, fontWeight: 700, fontSize: tamanho, boxShadow: `0 10px 24px rgba(0,0,0,0.22), 0 0 0 4px ${alfa(cor, 0.12)}` }}>
        <span style={{ width: tamanho * 0.4, height: tamanho * 0.4, borderRadius: "50%", background: cor }} />
        {texto}
      </span>
    </div>
  );
};

/** Carimbo: bate de cima (grande → assenta, com tremidinha), torto, em caixa alta. */
export const Carimbo: React.FC<{ texto: string; em: number; cor?: string; tamanho?: number; giro?: number; style?: React.CSSProperties }> = ({ texto, em, cor, tamanho = 84, giro = -7, style }) => {
  const { t } = useAnim();
  const { cores, fontes } = useTema();
  if (t < em) return null;
  const c = cor ?? cores.erro;
  const p = entre(t, [em, em + 0.17], [0, 1], CURVA.entra);
  const treme = t < em + 0.38 && t > em + 0.15 ? seno(t, 0.05, 4 * (1 - (t - em - 0.15) / 0.23)) : 0;
  return (
    <div style={{ display: "inline-block", transform: `rotate(${giro + treme * 0.4}deg) scale(${2.3 - 1.3 * p}) translateX(${treme}px)`, opacity: Math.min(1, p * 2), ...style }}>
      <div style={{ padding: `${tamanho * 0.12}px ${tamanho * 0.32}px ${tamanho * 0.16}px`, border: `${tamanho * 0.09}px solid ${c}`, borderRadius: tamanho * 0.14, color: c, background: "rgba(255,255,255,0.9)", fontFamily: fontes.impacto, fontWeight: 900, fontSize: tamanho, letterSpacing: "-0.01em", lineHeight: 1, textTransform: "uppercase", whiteSpace: "nowrap", boxShadow: `0 ${16 * p}px ${40 * p}px ${alfa(c, 0.25)}` }}>{texto}</div>
    </div>
  );
};

/**
 * Cursor do mouse: anda pelos pontos (`caminho`, em px do motion) e clica (`cliques`: instantes).
 * Ponha por cima de tudo, dentro da Camera.
 */
export const Cursor: React.FC<{ caminho: { em: number; x: number; y: number }[]; cliques?: number[]; aparece?: number; some?: number; tamanho?: number }> = ({ caminho, cliques = [], aparece, some, tamanho = 54 }) => {
  const { t } = useAnim();
  const { cores } = useTema();
  if (!caminho.length) return null;
  const ini = aparece ?? caminho[0].em - 0.2;
  if (t < ini || (some !== undefined && t > some + 0.2)) return null;
  const x = passos(t, caminho.map((p) => ({ em: p.em, v: p.x })));
  const y = passos(t, caminho.map((p) => ({ em: p.em, v: p.y })));
  const op = entre(t, [ini, ini + 0.15], [0, 1]) * (some !== undefined ? 1 - entre(t, [some, some + 0.2], [0, 1]) : 1);
  const clique = cliques.find((c) => t >= c && t < c + 0.45);
  const aperta = clique !== undefined ? 1 - 0.18 * Math.sin(Math.min(1, (t - clique) / 0.18) * Math.PI) : 1;
  const onda = clique !== undefined ? (t - clique) / 0.45 : 0;
  return (
    <>
      {clique !== undefined && <div style={{ position: "absolute", left: x - 50 * onda, top: y - 50 * onda, width: 100 * onda, height: 100 * onda, borderRadius: "50%", border: `3px solid ${alfa(cores.heroi, 1 - onda)}`, background: alfa(cores.heroi, 0.15 * (1 - onda)) }} />}
      <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" style={{ position: "absolute", left: x - tamanho * 0.18, top: y - tamanho * 0.1, opacity: op, transform: `scale(${aperta})`, transformOrigin: "20% 10%", filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.3))", overflow: "visible" }}>
        <path d="M4 2 L4 19 L8.6 14.8 L11.6 21.6 L14.6 20.3 L11.7 13.6 L18 13.6 Z" fill="#ffffff" stroke="#111111" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** Janela de navegador (as 3 bolinhas e a barra de endereço) com o que for dentro. */
export const Janela: React.FC<{ url?: string; largura: number; altura: number; children: React.ReactNode; inclina?: number; destaque?: boolean; style?: React.CSSProperties }> = ({ url, largura, altura, children, inclina, destaque, style }) => {
  const { cores, fontes, claro } = useTema();
  return (
    <Vidro largura={largura} pad={0} inclina={inclina} destaque={destaque} style={{ overflow: "hidden", ...style }}>
      <div style={{ height: 54, display: "flex", alignItems: "center", gap: 10, padding: "0 22px", borderBottom: `1px solid ${cores.borda}`, background: claro ? "#f6f5f2" : "rgba(255,255,255,0.03)" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />)}
        {url && <span style={{ margin: "0 auto", transform: "translateX(-30px)", padding: "6px 22px", borderRadius: 10, background: claro ? "#ffffff" : "rgba(255,255,255,0.06)", border: `1px solid ${cores.borda}`, fontFamily: fontes.mono, fontSize: 19, color: cores.dim }}>{url}</span>}
      </div>
      <div style={{ position: "relative", height: altura - 54, overflow: "hidden" }}>{children}</div>
    </Vidro>
  );
};

/** Barra de progresso com rótulo e porcentagem (instalando, enviando…). Fica verde quando chega. */
export const Barra: React.FC<{ em: number; dur?: number; ate?: number; rotulo?: string; largura?: number; style?: React.CSSProperties }> = ({ em, dur = 1.6, ate = 100, rotulo, largura = 760, style }) => {
  const { t } = useAnim();
  const { cores, fontes, claro } = useTema();
  const v = entre(t, [em, em + dur], [0, ate], CURVA.move);
  const cheio = v >= 99.5;
  return (
    <div style={{ width: largura, display: "flex", alignItems: "center", gap: 18, fontFamily: fontes.mono, fontSize: 22, color: cores.dim, ...style }}>
      {rotulo && <span style={{ whiteSpace: "nowrap" }}>{rotulo}</span>}
      <div style={{ flex: 1, height: 12, borderRadius: 99, background: claro ? "#ebe8e2" : "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ width: `${v}%`, height: "100%", borderRadius: 99, background: cheio ? cores.ok : `linear-gradient(90deg, ${alfa(cores.heroi, 0.7)}, ${cores.heroi})`, boxShadow: `0 0 14px ${cheio ? alfa(cores.ok, 0.5) : cores.brilho}` }} />
      </div>
      <span style={{ width: 64, textAlign: "right", color: cheio ? cores.ok : cores.tinta, fontWeight: 600 }}>{Math.round(v)}%</span>
    </div>
  );
};

/** Lista que vai ticando: cada item entra no `em` dele e ganha o check (o item da vez fica aceso). */
export const Checklist: React.FC<{ itens: { texto: string; em: number; detalhe?: string }[]; tamanho?: number; caixa?: boolean; style?: React.CSSProperties }> = ({ itens, tamanho = 40, caixa = true, style }) => {
  const { t, fps } = useAnim();
  const { cores, fontes, claro } = useTema();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: tamanho * 0.5, ...style }}>
      {itens.map((it, i) => {
        const p = mola(t, it.em, fps, "rapida");
        const ok = mola(t, it.em + 0.12, fps, "pula");
        const prox = itens[i + 1]?.em ?? Infinity;
        const daVez = t >= it.em && t < prox;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: tamanho * 0.5, opacity: 0.25 + 0.75 * Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * 24}px)` }}>
            {caixa && (
              <span style={{ width: tamanho * 1.05, height: tamanho * 1.05, flex: "none", borderRadius: tamanho * 0.26, border: ok > 0.05 ? "none" : `2.5px solid ${cores.borda}`, background: ok > 0.05 ? cores.ok : claro ? "#ffffff" : "transparent", display: "grid", placeItems: "center", transform: `scale(${0.8 + 0.2 * Math.max(p, ok)})`, boxShadow: ok > 0.05 ? `0 6px 16px ${alfa(cores.ok, 0.35)}` : undefined }}>
                <svg width={tamanho * 0.7} height={tamanho * 0.7} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 30, strokeDashoffset: 30 * (1 - Math.min(1, ok)) }}>
                  <path d="M4 12.5 L9.5 18 L20 6.5" />
                </svg>
              </span>
            )}
            <span style={{ fontFamily: fontes.texto, fontWeight: daVez ? 700 : 600, fontSize: tamanho, color: daVez || !caixa ? cores.tinta : alfa(cores.tinta, 0.72), letterSpacing: "-0.02em" }}>{it.texto}</span>
            {it.detalhe && <span style={{ marginLeft: "auto", fontFamily: fontes.mono, fontSize: tamanho * 0.55, color: cores.dim }}>{it.detalhe}</span>}
          </div>
        );
      })}
    </div>
  );
};

/** Mira de HUD: os quatro cantos chegam de longe e travam no alvo (x, y, largura, altura em px). */
export const Mira: React.FC<{ em: number; x: number; y: number; w: number; h: number; cor?: string; texto?: string; some?: number }> = ({ em, x, y, w, h, cor, texto, some }) => {
  const { t } = useAnim();
  const { cores, fontes } = useTema();
  if (t < em) return null;
  const c = cor ?? cores.heroi;
  const p = entre(t, [em, em + 0.5], [0, 1], CURVA.entra);
  const s = some !== undefined ? entre(t, [some, some + 0.2], [0, 1], CURVA.sai) : 0;
  const abre = 1.9 - 0.9 * p;
  const W = w * abre;
  const H = h * abre;
  const L = Math.min(w, h) * 0.24;
  const canto = (cx: number, cy: number, sx: number, sy: number, k: number) => <div key={k} style={{ position: "absolute", left: cx - (sx < 0 ? L : 0), top: cy - (sy < 0 ? L : 0), width: L, height: L, borderLeft: sx > 0 ? `3px solid ${c}` : undefined, borderRight: sx < 0 ? `3px solid ${c}` : undefined, borderTop: sy > 0 ? `3px solid ${c}` : undefined, borderBottom: sy < 0 ? `3px solid ${c}` : undefined }} />;
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity: Math.min(1, p * 2) * (1 - s) * (0.85 + 0.15 * Math.abs(Math.sin(t * 6))) }}>
      {canto(cx - W / 2, cy - H / 2, 1, 1, 0)}
      {canto(cx + W / 2, cy - H / 2, -1, 1, 1)}
      {canto(cx - W / 2, cy + H / 2, 1, -1, 2)}
      {canto(cx + W / 2, cy + H / 2, -1, -1, 3)}
      {texto && p > 0.6 && <div style={{ position: "absolute", left: cx + W / 2 + 14, top: cy - H / 2, fontFamily: fontes.mono, fontSize: 18, lineHeight: 1.35, color: c, whiteSpace: "pre", opacity: entre(t, [em + 0.3, em + 0.5], [0, 1]) }}>{texto}</div>}
    </div>
  );
};

/** Sublinha que se desenha embaixo do que estiver dentro (o traço da palavra que importa). */
export const Sublinha: React.FC<{ em: number; cor?: string; espessura?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ em, cor, espessura = 6, children, style }) => {
  const { t } = useAnim();
  const { cores } = useTema();
  const p = entre(t, [em, em + 0.32], [0, 1], CURVA.entra);
  return (
    <span style={{ position: "relative", display: "inline-block", ...style }}>
      {children}
      <span style={{ position: "absolute", left: 0, right: 0, bottom: -espessura * 0.6, height: espessura, borderRadius: espessura, background: cor ?? cores.heroi, transform: `scaleX(${p})`, transformOrigin: "0 50%" }} />
    </span>
  );
};

/**
 * Mapa de cidade desenhado (quarteirões, ruas, avenidas, um rio e praças), claro ou de noite, que
 * anda devagar. Pra "o Google Maps inteiro", "a cidade", "cada loja". Use `Pinos` por cima.
 */
export const Mapa: React.FC<{ largura: number; altura: number; semente?: number; rio?: boolean; style?: React.CSSProperties }> = ({ largura, altura, semente = 3, rio = true, style }) => {
  const { t } = useAnim();
  const { claro, cores } = useTema();
  const Q = 92; // quarteirão + rua
  const cols = Math.ceil(largura / Q) + 2;
  const rows = Math.ceil(altura / Q) + 2;
  const cor = claro ? { chao: "#ece9e3", quadra: "#dedad2", quadra2: "#e4e0d8", praca: "#cfe2c6", rua: "#f8f6f2", av: "#f2d9a6", rio: "#bcd6e6" } : { chao: "#0f1013", quadra: "#1a1c21", quadra2: "#16181c", praca: "#17261b", rua: "#23262c", av: "#a8743a", rio: "#13222f" };
  const quadras = [];
  for (let r = -1; r < rows; r++)
    for (let c = -1; c < cols; c++) {
      const k = r * 97 + c;
      const praca = acaso(k, semente) > 0.93;
      const x = c * Q + 9;
      const y = r * Q + 9;
      // quarteirão às vezes dividido em dois lotes
      if (!praca && acaso(k, semente + 1) > 0.6) {
        quadras.push(<rect key={`${k}a`} x={x} y={y} width={(Q - 18) * 0.48} height={Q - 18} rx={4} fill={cor.quadra} />);
        quadras.push(<rect key={`${k}b`} x={x + (Q - 18) * 0.52} y={y} width={(Q - 18) * 0.48} height={Q - 18} rx={4} fill={cor.quadra2} />);
      } else quadras.push(<rect key={k} x={x} y={y} width={Q - 18} height={Q - 18} rx={4} fill={praca ? cor.praca : cor.quadra} />);
    }
  const avY = Math.round(rows * 0.42) * Q - 4;
  const avX = Math.round(cols * 0.36) * Q - 4;
  const dx = seno(t, 11, 14);
  const dy = -t * 6;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: largura, height: altura, overflow: "hidden", background: cor.chao, ...style }}>
      <svg width={largura + Q * 2} height={altura + Q * 2} style={{ position: "absolute", left: -Q + dx, top: -Q / 2 + (dy % Q), transform: "rotate(-8deg) scale(1.15)", transformOrigin: "50% 50%" }}>
        <rect width="100%" height="100%" fill={cor.rua} />
        {quadras}
        <rect x={0} y={avY} width={(cols + 2) * Q} height={14} fill={cor.av} opacity={claro ? 1 : 0.8} />
        <rect x={avX} y={0} width={14} height={(rows + 2) * Q} fill={cor.av} opacity={claro ? 1 : 0.8} />
        <rect x={0} y={avY - Q * 3} width={(cols + 2) * Q} height={8} fill={cor.av} opacity={0.6} transform={`rotate(14 ${largura / 2} ${avY})`} />
        {rio && <path d={`M -50 ${altura * 0.78} C ${largura * 0.3} ${altura * 0.68}, ${largura * 0.55} ${altura * 0.95}, ${largura + 200} ${altura * 0.82}`} stroke={cor.rio} strokeWidth={46} fill="none" />}
      </svg>
      {!claro && <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 40%, transparent 40%, ${alfa(cores.fundo, 0.7)} 100%)` }} />}
    </div>
  );
};

/**
 * Pinos aparecendo no mapa numa onda (do centro pra fora): `n` pinos entre `em` e `em + dur`, na
 * área (x, y, w, h). Cada um estoura com um anel. `some`: os pinos marcados como "duplicados" (a
 * fração `duplicados`) somem nesse instante.
 */
export const Pinos: React.FC<{ n: number; em: number; dur?: number; x?: number; y?: number; w: number; h: number; semente?: number; cor?: string; tamanho?: number; some?: number; duplicados?: number }> = ({ n, em, dur = 1.6, x = 0, y = 0, w, h, semente = 5, cor, tamanho = 24, some, duplicados = 0 }) => {
  const { t, fps } = useAnim();
  const { cores } = useTema();
  const c = cor ?? cores.erro;
  const pts = Array.from({ length: n }, (_, i) => ({ i, px: x + acaso(i, semente) * w, py: y + acaso(i, semente + 9) * h }));
  const cx = x + w / 2;
  const cy = y + h / 2;
  const maxD = Math.hypot(w / 2, h / 2);
  return (
    <>
      {pts.map(({ i, px, py }) => {
        const nasce = em + (Math.hypot(px - cx, py - cy) / maxD) * dur * 0.85 + acaso(i, semente + 3) * dur * 0.15;
        const p = mola(t, nasce, fps, "pula");
        if (p <= 0.01) return null;
        const dup = some !== undefined && acaso(i, semente + 7) < duplicados;
        const sai = dup ? entre(t, [some!, some! + 0.25], [0, 1], CURVA.sai) : 0;
        if (sai >= 1) return null;
        const anel = t - nasce;
        return (
          <div key={i} style={{ position: "absolute", left: px, top: py, transform: `translate(-50%, -50%) scale(${p * (1 - sai)})` }}>
            {anel < 0.6 && <div style={{ position: "absolute", left: tamanho / 2 - tamanho * 1.6 * (anel / 0.6), top: tamanho / 2 - tamanho * 1.6 * (anel / 0.6), width: tamanho * 3.2 * (anel / 0.6), height: tamanho * 3.2 * (anel / 0.6), borderRadius: "50%", border: `2px solid ${alfa(c, 1 - anel / 0.6)}` }} />}
            <div style={{ width: tamanho, height: tamanho, borderRadius: "50%", background: dup && t >= some! ? cores.dim : c, border: "3px solid #ffffff", boxShadow: `0 3px 8px ${alfa(c, 0.45)}`, boxSizing: "border-box" }} />
          </div>
        );
      })}
    </>
  );
};

/** Quantos pinos já apareceram até agora (pra sincronizar um contador com os `Pinos`). */
export const pinosAte = (t: number, n: number, em: number, dur = 1.6) => Math.round(n * entre(t, [em, em + dur], [0, 1], CURVA.suave));
