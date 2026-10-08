// O Codinho (o Claude Code em pessoa: uma janelinha de terminal com cara, pernas e braços) e o
// TerminalClaude (a tela do Claude Code: o pedido sendo digitado, o "✻ Pensando…" e as linhas de
// ferramenta chegando). Os dois seguem o desenho do tema (adesivo, pixel, massinha, traço, chapado).
import React from "react";
import { degrau, entre, seno, useAnim } from "./anim";
import { CURVA, useTema } from "./tema";

export type HumorCodinho = "normal" | "feliz" | "bravo" | "pensando" | "digitando" | "nocaute" | "surpreso";
const GIRA = ["·", "✢", "✳", "✶", "✻", "✽"];

export const Codinho: React.FC<{
  tamanho?: number;
  humor?: HumorCodinho;
  /** andando: as perninhas alternam */
  andando?: boolean;
  /** acena com o braço */
  acena?: boolean;
  fase?: number;
  style?: React.CSSProperties;
}> = ({ tamanho = 180, humor = "normal", andando = false, acena = false, fase = 0, style }) => {
  const { t } = useAnim();
  const tema = useTema();
  const v = tema.visual;
  const laranja = tema.cores.claudinho;
  const tinta = v.personagem === "traco" ? v.contorno : "#1b1815";
  const tela = v.personagem === "traco" ? tema.cores.card : v.fundo === "noite" ? "#151B26" : "#24201c";
  const olhoCor = v.personagem === "traco" ? v.contorno : laranja;
  const raio = v.personagem === "pixel" ? 2 : v.personagem === "massinha" ? 18 : 11;
  const passo = andando ? degrau(t + fase, 0.16) % 2 : 0;
  const pula = andando ? (passo ? -2.5 : 0) : seno(t, 1.4, 1.2, fase);
  const pisca = humor !== "nocaute" && humor !== "feliz" && (t + fase * 1.3) % 3.1 < 0.1;
  // no fundo escuro o corpo ganha um fio laranja (senão some)
  const traco = v.personagem === "traco" ? 2.6 : v.personagem === "adesivo" ? 5 : tema.claro ? 0 : 2.4;
  const braco = acena ? seno(t, 0.5, 28) : humor === "feliz" ? -30 + seno(t, 0.35, 12) : humor === "bravo" ? 25 : 8;
  const corpo = (dx = 0, dy = 0, cor = tela, borda = traco ? (tema.claro || v.personagem === "adesivo" ? tinta : laranja) : "none") => <rect x={-42 + dx} y={-36 + dy} width={84} height={66} rx={raio} fill={cor} stroke={borda} strokeWidth={traco} />;

  // olhos: blocos laranja (o cursor do terminal) com humor
  const olho = (x: number) => {
    if (humor === "nocaute") return <path key={x} d={`M${x - 5} -12 l10 10 M${x + 5} -12 l-10 10`} stroke={olhoCor} strokeWidth={3.4} strokeLinecap="round" />;
    if (humor === "feliz") return <path key={x} d={`M${x - 6} -4 L${x} -11 L${x + 6} -4`} stroke={olhoCor} strokeWidth={3.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    if (humor === "surpreso") return <rect key={x} x={x - 5.5} y={-15} width={11} height={13} rx={v.personagem === "pixel" ? 0 : 3} fill="none" stroke={olhoCor} strokeWidth={3.2} />;
    const olhaY = humor === "pensando" ? -4 : humor === "digitando" ? 3 : 0;
    const h = pisca ? 2 : humor === "bravo" ? 7 : 11;
    return <rect key={x} x={x - 4.5} y={-13 + olhaY + (11 - h) / 2} width={9} height={h} rx={v.personagem === "pixel" ? 0 : 2} fill={olhoCor} />;
  };
  const sombra = v.personagem === "adesivo" ? corpo(5, 5, v.contorno, "none") : v.personagem === "massinha" ? <ellipse cx={3} cy={48} rx={42} ry={6} fill="rgba(60,20,40,0.25)" /> : null;
  return (
    <svg width={tamanho} height={tamanho} viewBox="-60 -66 120 126" style={{ overflow: "visible", display: "block", ...style }}>
      <g transform={`translate(0 ${pula})`}>
        {sombra}
        {/* perninhas */}
        <rect x={-22} y={28 - (passo ? 4 : 0)} width={9} height={16} rx={3} fill={tinta} />
        <rect x={13} y={28 - (passo ? 0 : 4)} width={9} height={16} rx={3} fill={tinta} />
        {/* braços */}
        <line x1={-42} y1={2} x2={-42 - 15 * Math.cos(((acena ? 8 : braco) * Math.PI) / 180)} y2={2 - 15 * Math.sin(((acena ? 8 : braco) * Math.PI) / 180)} stroke={tinta} strokeWidth={6} strokeLinecap="round" />
        <line x1={42} y1={2} x2={42 + 15 * Math.cos((braco * Math.PI) / 180)} y2={2 - 15 * Math.sin((braco * Math.PI) / 180)} stroke={tinta} strokeWidth={6} strokeLinecap="round" />
        {corpo()}
        {v.personagem === "massinha" && <rect x={-36} y={-31} width={34} height={8} rx={4} fill="rgba(255,255,255,0.18)" />}
        {/* barra da janela: o asterisco laranja e as bolinhas */}
        <line x1={-42 + traco / 2} y1={-24} x2={42 - traco / 2} y2={-24} stroke={v.personagem === "traco" ? tinta : "#3a342d"} strokeWidth={1.6} />
        <text x={-34} y={-27} fontFamily="Mono" fontSize={9} fill={laranja}>✻</text>
        {[24, 31].map((x, i) => <circle key={i} cx={x} cy={-30} r={2.4} fill={v.personagem === "traco" ? "none" : "#4a433a"} stroke={v.personagem === "traco" ? tinta : "none"} strokeWidth={1.2} />)}
        {olho(-12)}
        {olho(12)}
        {humor === "bravo" && <path d="M-19 -18 L-6 -14 M19 -18 L6 -14" stroke={olhoCor} strokeWidth={3} strokeLinecap="round" />}
        {/* boca / linha de comando */}
        {humor === "digitando" ? (
          <>
            <text x={-30} y={20} fontFamily="Mono" fontSize={10} fill={v.personagem === "traco" ? tinta : "#d8d1c6"}>{">"}</text>
            <rect x={-22 + Math.min(40, ((t * 30) % 46))} y={12} width={6} height={9} fill={olhoCor} opacity={degrau(t, 0.25) % 2 ? 1 : 0.3} />
            <rect x={-22} y={15} width={Math.min(40, (t * 30) % 46)} height={3} rx={1.5} fill={v.personagem === "traco" ? tinta : "#d8d1c6"} opacity={0.75} />
          </>
        ) : humor === "nocaute" ? (
          <path d="M-8 14 Q-4 10 0 14 Q4 18 8 14" stroke={olhoCor} strokeWidth={2.6} fill="none" strokeLinecap="round" />
        ) : humor === "feliz" ? (
          <path d="M-10 9 Q0 20 10 9" stroke={olhoCor} strokeWidth={3} fill="none" strokeLinecap="round" />
        ) : humor === "surpreso" ? (
          <circle cx={0} cy={14} r={3.4} fill={olhoCor} />
        ) : (
          <rect x={-7} y={12} width={14} height={3} rx={1.5} fill={olhoCor} />
        )}
      </g>
      {humor === "pensando" && (
        <text x={0} y={-48 + seno(t, 1.2, 2)} textAnchor="middle" fontFamily="Mono" fontSize={22} fill={laranja}>{GIRA[degrau(t, 0.12) % GIRA.length]}</text>
      )}
    </svg>
  );
};

export type LinhaTerminal = { texto: string; tipo?: "ferramenta" | "resultado" | "ok" | "texto" | "erro" };

/** A tela do Claude Code: digita o pedido, pensa e solta as linhas (ferramenta, resultado, ok). */
export const TerminalClaude: React.FC<{
  em?: number;
  pedido: string;
  /** segundos pensando, com o asterisco girando */
  pensando?: number;
  linhas?: LinhaTerminal[];
  /** intervalo entre as linhas (s) */
  passo?: number;
  largura?: number;
  pasta?: string;
  style?: React.CSSProperties;
}> = ({ em = 0, pedido, pensando = 1.2, linhas = [], passo = 0.35, largura = 900, pasta = "~/meu-projeto", style }) => {
  const { t } = useAnim();
  const tema = useTema();
  const v = tema.visual;
  const k = largura / 900;
  const fs = 30 * k;
  const laranja = tema.cores.claudinho;
  const porLetra = 0.032;
  const digitado = Math.max(0, Math.min(pedido.length, Math.floor((t - em) / porLetra)));
  const fimDigita = em + pedido.length * porLetra + 0.15;
  const fimPensa = fimDigita + pensando;
  const pensandoAgora = t >= fimDigita && t < fimPensa;
  // tons do terminal: quentes (o Claude Code de verdade) ou frios (fundo noite)
  const frio = v.fundo === "noite";
  const P = frio
    ? { fundo: "#0F1626", linha: "#24304A", caixa: "#33415C", texto: "#E5E7EB", apagado: "#7C879A", pensa: "#93B4F5", ok: "#3CCF91" }
    : { fundo: "#141210", linha: "#2e2a25", caixa: "#4a433a", texto: "#efe9df", apagado: "#8f877b", pensa: "#d8b39e", ok: "#7bd88f" };
  const corLinha = (tp?: LinhaTerminal["tipo"]) => (tp === "ok" ? P.ok : tp === "erro" ? "#ff6b6b" : tp === "resultado" ? P.apagado : P.texto);
  const borda = v.sombraDura ? `${v.cardBorda}px solid ${v.contorno}` : `2px solid ${frio ? P.linha : "#34302a"}`;
  const sombra = v.sombraDura ? `8px 8px 0 ${v.contorno}` : "0 30px 70px rgba(0,0,0,0.45)";
  return (
    <div style={{ width: largura, background: P.fundo, border: borda, borderRadius: v.cardRaio * k + 8, boxShadow: sombra, fontFamily: "Mono", fontSize: fs, color: P.texto, overflow: "hidden", ...style }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 * k, padding: `${18 * k}px ${26 * k}px`, borderBottom: `1px solid ${P.linha}`, color: P.apagado, fontSize: fs * 0.8 }}>
        <span style={{ color: laranja, fontSize: fs }}>✻</span>
        <span style={{ color: P.texto }}>Claude Code</span>
        <span>{pasta}</span>
      </div>
      <div style={{ padding: `${22 * k}px ${26 * k}px ${26 * k}px`, display: "flex", flexDirection: "column", gap: 12 * k }}>
        <div style={{ border: `2px solid ${P.caixa}`, borderRadius: 12 * k, padding: `${12 * k}px ${16 * k}px`, minHeight: fs * 1.4 }}>
          <span style={{ color: P.apagado }}>{"> "}</span>
          {pedido.slice(0, digitado)}
          {t < fimDigita + 0.2 && <span style={{ display: "inline-block", width: fs * 0.55, height: fs * 1.05, marginLeft: 3, verticalAlign: "-0.18em", background: laranja, opacity: degrau(t, 0.26) % 2 ? 1 : 0.25 }} />}
        </div>
        {pensandoAgora && (
          <div style={{ color: laranja }}>
            {GIRA[degrau(t, 0.1) % GIRA.length]} <span style={{ color: P.pensa }}>Pensando…</span> <span style={{ color: "#6f675c", fontSize: fs * 0.75 }}>({Math.floor(t - fimDigita)}s · esc pra parar)</span>
          </div>
        )}
        {linhas.map((l, i) => {
          const tl = fimPensa + i * passo;
          if (t < tl) return null;
          const p = entre(t, [tl, tl + 0.18], [0, 1], CURVA.entra);
          const marca = l.tipo === "ferramenta" ? <span style={{ color: P.ok }}>⏺ </span> : l.tipo === "resultado" ? <span style={{ color: "#6f675c" }}>{"  ⎿ "}</span> : l.tipo === "ok" ? <span>✓ </span> : l.tipo === "erro" ? <span>✗ </span> : null;
          return (
            <div key={i} style={{ color: corLinha(l.tipo), opacity: p, transform: `translateX(${(1 - p) * -20}px)`, whiteSpace: "pre-wrap", fontSize: l.tipo === "resultado" ? fs * 0.85 : fs }}>
              {marca}
              {l.texto}
            </div>
          );
        })}
      </div>
    </div>
  );
};
