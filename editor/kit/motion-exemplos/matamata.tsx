// "um tenta por um caminho, o outro vai por uma lógica totalmente diferente e aí vira um mata-mata,
// eles vão saindo uma pancada, um aponta o erro do outro e vai afunilando até sobrar uma melhor resposta."
// (23,46 → 32,86 do vídeo). Tempos do motion: caminho 1,54 · outro 1,98 · diferente 3,62 ·
// mata-mata 4,65 · pancada 5,89 · aponta 6,39 · erro 6,70 · afunilando 7,39 · melhor 8,44
import React from "react";
import { AbsoluteFill, Balao, Brilho, Camera, Card, Cena, Claudinho, Coroa, Entrada, Faiscas, NuvemDeBriga, Onda, Titulo, acaso, entre, mola, seno, useAnim, useTema, CURVA } from "@motion";

export const config = { duracao: 9.4, area: "tela-cheia" };

// ── parte 1: cada um pensa de um jeito ──────────────────────────────────────
const FIM1 = 4.3;

/** Pontos de um caminho, bem juntinhos (pra desenhar aos poucos e pôr o Claudinho na ponta). */
function amostrar(pontos: [number, number][], n = 120) {
  const segs = pontos.slice(1).map((p, k) => ({ a: pontos[k], b: p, l: Math.hypot(p[0] - pontos[k][0], p[1] - pontos[k][1]) }));
  const total = segs.reduce((s, x) => s + x.l, 0);
  return Array.from({ length: n + 1 }, (_, i) => {
    let d = (i / n) * total;
    for (const s of segs) {
      if (d <= s.l) return [s.a[0] + ((s.b[0] - s.a[0]) * d) / s.l, s.a[1] + ((s.b[1] - s.a[1]) * d) / s.l] as [number, number];
      d -= s.l;
    }
    return pontos[pontos.length - 1];
  });
}
const CAMINHO_A = amostrar([[70, 150], [190, 220], [95, 290], [250, 340], [140, 410], [330, 460], [250, 520]]);
const CAMINHO_B = amostrar(Array.from({ length: 40 }, (_, k) => [225 + Math.sin(k * 0.42) * 140 * (1 - k / 60), 140 + k * 9.7] as [number, number]));

const Rascunho: React.FC<{ pts: [number, number][]; de: number; ate: number; nome: string; legenda: string; emLegenda: number }> = ({ pts, de, ate, nome, legenda, emLegenda }) => {
  const { t } = useAnim();
  const { cores, fontes } = useTema();
  const p = entre(t, [de, ate], [0, 1], CURVA.move);
  const n = Math.max(2, Math.round(p * (pts.length - 1)) + 1);
  const feito = pts.slice(0, n);
  const ponta = feito[feito.length - 1];
  return (
    <Card style={{ position: "absolute", left: 0, top: 0, width: 450, height: 660, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 26, top: 22, display: "flex", alignItems: "center", gap: 12, fontFamily: fontes.mono, fontSize: 24, letterSpacing: "0.14em", color: cores.dim }}>
        <Claudinho tamanho={52} vivo={false} />
        {nome}
      </div>
      <svg width={450} height={660} style={{ position: "absolute", left: 0, top: 0 }}>
        <polyline points={feito.map((q) => q.join(",")).join(" ")} fill="none" stroke={cores.tinta} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 17" />
      </svg>
      {t >= de && (
        <div style={{ position: "absolute", left: ponta[0] - 38, top: ponta[1] - 38 }}>
          <Claudinho tamanho={76} humor={p >= 1 ? "feliz" : "pensando"} olhar={[0.6, 0.5]} />
        </div>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 22, textAlign: "center", fontFamily: fontes.titulo, fontStyle: fontes.tituloEstilo, fontSize: 46, color: cores.tinta, opacity: entre(t, [emLegenda, emLegenda + 0.3], [0, 1]) }}>{legenda}</div>
    </Card>
  );
};

const Parte1: React.FC = () => {
  const { t, fps } = useAnim();
  if (t > FIM1 + 0.35) return null;
  const sai = entre(t, [FIM1, FIM1 + 0.32], [0, 1], CURVA.sai);
  const a = mola(t, 0.25, fps, "suave");
  const b = mola(t, 0.4, fps, "suave");
  return (
    <AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 230, display: "flex", justifyContent: "center", opacity: 1 - sai, transform: `translateY(${-80 * sai}px)` }}>
        <Titulo texto="Cada um por um caminho" destaque={["caminho"]} em={0.15} tamanho={84} />
      </div>
      <div style={{ position: "absolute", left: 70, top: 470, opacity: Math.min(1, a * 1.5), transform: `translateX(${(1 - a) * -260 - 900 * sai}px) rotate(${-3 + 3 * a - 14 * sai + seno(t, 3.1, 0.6)}deg)` }}>
        <Rascunho pts={CAMINHO_A} de={0.84} ate={2.25} nome="CLAUDE 01" legenda="um caminho" emLegenda={1.6} />
      </div>
      <div style={{ position: "absolute", left: 560, top: 470, opacity: Math.min(1, b * 1.5), transform: `translateX(${(1 - b) * 260 + 900 * sai}px) rotate(${3 - 3 * b + 14 * sai + seno(t, 3.4, 0.6, 1)}deg)` }}>
        <Rascunho pts={CAMINHO_B} de={1.98} ate={3.7} nome="CLAUDE 02" legenda="outra lógica" emLegenda={2.75} />
      </div>
    </AbsoluteFill>
  );
};

// ── parte 2: o mata-mata ─────────────────────────────────────────────────────
const INICIO2 = 4.4;
const Y = { r1: 1250, r2: 1000, r3: 750, campeao: 500 };
const X1 = Array.from({ length: 8 }, (_, k) => 120 + k * 120);
const X2 = [180, 420, 660, 900];
const X3 = [300, 780];
const T = { briga1: 5.3, pancada: 5.89, sobe1: 5.95, aponta: 6.39, erro: 6.7, cai2: 6.95, sobe2: 7.0, final: 7.42, estoura: 8.05, melhor: 8.44 };
// quem ganha cada luta (índices dos 8)
const VENCE1 = [1, 2, 5, 6];
const VENCE2 = [1, 5];
const CAMPEAO = 1;

/** Onde está o Claudinho k (0..7) no instante t, o tamanho, o humor e se já caiu. */
function lutador(k: number, t: number, fps: number) {
  const par = Math.floor(k / 2);
  const parceiro = k % 2 ? k - 1 : k + 1;
  let x = X1[k];
  let y = Y.r1;
  let tam = 100;
  let humor: any = "bravo";
  let cai = Infinity;
  let estica: any;
  // rodada 1: avançam um pro outro e somem na nuvenzinha
  const avanco = entre(t, [T.briga1, T.briga1 + 0.15], [0, 1], CURVA.entra);
  x += (X1[parceiro] - X1[k]) * 0.18 * avanco;
  if (!VENCE1.includes(k)) cai = T.pancada;
  else {
    const s = entre(t, [T.sobe1, T.sobe1 + 0.35], [0, 1], CURVA.entra);
    x = x + (X2[par] - x) * s;
    y = Y.r1 + (Y.r2 - Y.r1) * s - Math.sin(s * Math.PI) * 90;
    tam = 100 + 10 * s;
    if (t > T.sobe1 && t < T.aponta) humor = "feliz";
    // rodada 2: o da esquerda aponta o erro do outro
    const idx2 = VENCE1.indexOf(k);
    const esquerda = idx2 % 2 === 0;
    if (t >= T.aponta && t < T.cai2) estica = esquerda ? { angulo: 0, quanto: 46 * entre(t, [T.aponta, T.aponta + 0.12], [0, 1]) } : undefined;
    if (!VENCE2.includes(k)) {
      if (t >= T.erro) humor = "surpreso";
      cai = T.cai2;
    } else {
      const s2 = entre(t, [T.sobe2, T.sobe2 + 0.35], [0, 1], CURVA.entra);
      const alvo = X3[VENCE2.indexOf(k)];
      x = x + (alvo - x) * s2;
      y = y + (Y.r3 - y) * s2 - Math.sin(s2 * Math.PI) * 90;
      tam = 110 + 10 * s2;
      if (t > T.sobe2 && t < T.final) humor = "feliz";
      // final: os dois correm pro meio e brigam na nuvem grande
      const corre = entre(t, [T.final, T.final + 0.18], [0, 1], CURVA.entra);
      x = x + (540 - x) * corre * 0.85;
      if (t >= T.final) humor = "bravo";
      if (k !== CAMPEAO) cai = T.estoura;
      else if (t >= T.estoura) {
        const s3 = mola(t, T.estoura, fps, "pula");
        x = 540;
        y = Y.r3 + (Y.campeao - Y.r3) * s3;
        tam = 120 + 90 * s3;
        humor = "feliz";
      }
    }
  }
  // quem cai: nocaute, vai pra baixo girando e some
  const queda = entre(t, [cai, cai + 0.5], [0, 1], CURVA.entra);
  if (t >= cai) {
    humor = "nocaute";
    x += (k % 2 ? 1 : -1) * 140 * queda;
    y += 380 * queda * queda - Math.sin(queda * Math.PI) * 60;
  }
  const escondido = (t > T.briga1 + 0.06 && t < T.pancada) || (t > T.final + 0.08 && t < T.estoura);
  return { x, y, tam, humor, queda, giro: queda * (k % 2 ? 300 : -300), escondido, estica };
}

/** As linhas da chave; o caminho de quem ganha acende na cor de destaque. */
const Chave: React.FC = () => {
  const { t } = useAnim();
  const { cores } = useTema();
  const desenha = entre(t, [4.75, 5.3], [0, 1], CURVA.move);
  const ramo = (xa: number, xb: number, yFilho: number, yPai: number, meio: number) => `M ${xa} ${yFilho - 58} V ${yFilho - 112} H ${xb} M ${xb} ${yFilho - 58} V ${yFilho - 112} M ${meio} ${yFilho - 112} V ${yPai + 62}`;
  const ramos = [
    ...[0, 1, 2, 3].map((j) => ramo(X1[2 * j], X1[2 * j + 1], Y.r1, Y.r2, X2[j])),
    ...[0, 1].map((j) => ramo(X2[2 * j], X2[2 * j + 1], Y.r2, Y.r3, X3[j])),
    ramo(X3[0], X3[1], Y.r3, Y.campeao + 50, 540),
  ];
  // o caminho do campeão (1 → 180 → 300 → 540), acendendo em cada subida
  const aceso = [
    { d: `M ${X1[1]} ${Y.r1 - 58} V ${Y.r1 - 112} H ${X2[0]} V ${Y.r2 + 62}`, em: T.sobe1 },
    { d: `M ${X2[0]} ${Y.r2 - 58} V ${Y.r2 - 112} H ${X3[0]} V ${Y.r3 + 62}`, em: T.sobe2 },
    { d: `M ${X3[0]} ${Y.r3 - 58} V ${Y.r3 - 112} H 540 V ${Y.campeao + 112}`, em: T.estoura },
  ];
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0 }}>
      {ramos.map((d, i) => <path key={i} d={d} pathLength={1} fill="none" stroke={cores.borda} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - desenha} />)}
      {aceso.map((a, i) => <path key={`a${i}`} d={a.d} pathLength={1} fill="none" stroke={cores.heroi} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 1" strokeDashoffset={1 - entre(t, [a.em, a.em + 0.35], [0, 1], CURVA.entra)} />)}
    </svg>
  );
};

const Parte2: React.FC = () => {
  const { t, fps } = useAnim();
  const { cores, fontes } = useTema();
  if (t < INICIO2) return null;
  const campeao = lutador(CAMPEAO, t, fps);
  const coroa = mola(t, T.melhor, fps, "pula");
  return (
    <AbsoluteFill>
      <Chave />
      {/* rodada 1: quatro nuvenzinhas; final: a nuvem grande */}
      {[0, 1, 2, 3].map((j) => <NuvemDeBriga key={j} em={T.briga1} ate={T.pancada} x={(X1[2 * j] + X1[2 * j + 1]) / 2} y={Y.r1} tamanho={120} />)}
      <NuvemDeBriga em={T.final + 0.04} ate={T.estoura} x={540} y={Y.r3} tamanho={250} />
      {X1.map((_, k) => {
        const nasce = mola(t, 4.5 + k * 0.045, fps, "pula");
        const l = lutador(k, t, fps);
        if (nasce <= 0.01 || l.queda >= 1 || l.escondido) return null;
        return (
          <div key={k} style={{ position: "absolute", left: l.x - l.tam / 2, top: l.y - l.tam / 2, transform: `scale(${nasce}) rotate(${l.giro}deg)`, opacity: 1 - l.queda }}>
            <Claudinho tamanho={l.tam} humor={l.humor} fase={k * 0.6} olhar={[k % 2 ? -0.8 : 0.8, 0]} estica={l.estica} />
          </div>
        );
      })}
      {/* "ERRO!" em cima de quem perde a rodada 2 */}
      {[2, 6].map((k) => {
        const l = lutador(k, t, fps);
        if (t < T.erro || l.queda >= 1) return null;
        return (
          <div key={k} style={{ position: "absolute", left: l.x - 46, top: l.y - 175, opacity: 1 - l.queda }}>
            <Balao texto="ERRO!" em={T.erro} cor={cores.erro} tamanho={46} />
          </div>
        );
      })}
      <Brilho em={T.melhor} x={540} y={Y.campeao} raio={300} />
      {t >= T.melhor && (
        <div style={{ position: "absolute", left: 540 - 62, top: campeao.y - campeao.tam * 0.5 - 88 - (1 - coroa) * 80, opacity: Math.min(1, coroa * 2.5), transform: `rotate(${seno(t, 1.3, 5)}deg)` }}>
          <Coroa tamanho={124} />
        </div>
      )}
      <Faiscas em={T.estoura} x={540} y={Y.r3} n={18} raio={300} />
      <Onda em={T.estoura} x={540} y={Y.r3} raio={380} />
      {t >= T.melhor + 0.1 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: Y.campeao + 125, display: "flex", justifyContent: "center" }}>
          <Entrada em={T.melhor + 0.1} mola="pula" distancia={40}>
            <Card destaque style={{ padding: "16px 34px", fontFamily: fontes.titulo, fontStyle: fontes.tituloEstilo, fontSize: 58 }}>a melhor resposta</Card>
          </Entrada>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default function Motion() {
  const { t } = useAnim();
  return (
    <Cena saida="sobe">
      <Camera
        passos={[
          { em: 0, zoom: 1, y: 0 },
          { em: INICIO2, zoom: 1, y: 0 },
          { em: 7.3, zoom: 1, y: 0 },
          { em: 7.7, zoom: 1.16, y: 300 },
          { em: 8.2, zoom: 1.16, y: 300 },
          { em: 8.7, zoom: 1.24, y: 400 },
        ]}
        deriva={9}
        tremores={[
          { em: T.pancada, dur: 0.35, forca: 15 },
          { em: T.cai2, dur: 0.25, forca: 9 },
          { em: T.final + 0.05, dur: 0.4, forca: 14 },
          { em: T.estoura, dur: 0.35, forca: 18 },
        ]}
      >
        <Parte1 />
        <Parte2 />
      </Camera>
      {t >= INICIO2 && (
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 210 }}>
          <Titulo texto="Vira um mata-mata" destaque={["mata-mata"]} em={4.5} tamanho={88} />
        </AbsoluteFill>
      )}
    </Cena>
  );
}
