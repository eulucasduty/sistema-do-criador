// "eles mesmos se julgam, você não faz nada e você só espera o melhor resultado entre as 100."
// (32,92 → 37,95 do vídeo), na faixa de cima. Tempos do motion: julgam 1,26 · nada 2,20 ·
// espera 2,81 · melhor 3,13 · resultado 3,43 · entre 3,87 · 100 4,20
import React from "react";
import { AbsoluteFill, Brilho, Camera, Card, Cena, Claudinho, Entrada, Faiscas, Rotulo, Titulo, entre, mola, seno, useAnim, useTema, CURVA } from "@motion";

export const config = { duracao: 5.03, area: "faixa" };

const NOTAS = [6, 4, 10, 7, 5];
const XS = [140, 340, 540, 740, 940];
const JULGAM = 1.26;
const DESTACA = 2.25;
const MELHOR = 3.13;
const MELHOR_I = 2;

const Jurado: React.FC<{ k: number }> = ({ k }) => {
  const { t, fps } = useAnim();
  const { cores, fontes } = useTema();
  const nasce = mola(t, 0.22 + k * 0.07, fps, "pula");
  const vira = entre(t, [JULGAM + k * 0.16, JULGAM + k * 0.16 + 0.3], [90, 0], CURVA.entra);
  const mostrou = vira < 45;
  const melhor = k === MELHOR_I;
  const apaga = melhor ? 1 : entre(t, [DESTACA, DESTACA + 0.3], [1, 0.42], CURVA.suave);
  const cresce = melhor ? 1 + 0.16 * mola(t, DESTACA, fps, "pula") : 1;
  const humor = melhor && mostrou ? "feliz" : mostrou ? "normal" : "pensando";
  const pula = melhor && t > DESTACA ? Math.abs(seno(t, 0.7, 10)) : 0;
  return (
    <div style={{ position: "absolute", left: XS[k] - 80, top: 0, width: 160, height: 760, opacity: Math.min(1, nasce * 1.5) * apaga, transform: `scale(${nasce})`, transformOrigin: `80px 330px` }}>
      <div style={{ position: "absolute", left: 20, top: 270 - pula }}>
        <Claudinho tamanho={120} humor={humor} fase={k * 0.8} olhar={[(2 - k) * 0.4, 0.3]} />
      </div>
      <div style={{ position: "absolute", left: 18, top: 405, transform: `perspective(600px) rotateX(${vira}deg) scale(${cresce})`, transformOrigin: "50% 0%" }}>
        <Card destaque={melhor && t > DESTACA} style={{ width: 124, height: 104, display: "grid", placeItems: "center", fontFamily: fontes.titulo, fontStyle: "normal", fontSize: 68, color: melhor && t > DESTACA ? cores.heroi : cores.tinta }}>{mostrou ? NOTAS[k] : ""}</Card>
      </div>
    </div>
  );
};

export default function Motion() {
  const { t } = useAnim();
  const { cores, fontes } = useTema();
  return (
    <Cena saida="sobe">
      <Camera passos={[{ em: 0, zoom: 1 }, { em: MELHOR, zoom: 1 }, { em: 3.7, zoom: 1.22, y: -20 }]} deriva={6}>
        <Brilho em={DESTACA} x={540} y={440} raio={190} />
        {NOTAS.map((_, k) => <Jurado key={k} k={k} />)}
        <Faiscas em={DESTACA + 0.05} x={540} y={455} n={12} raio={150} tamanho={0.8} />
      </Camera>
      <AbsoluteFill style={{ alignItems: "center", paddingTop: 108 }}>
        <Titulo texto="Eles mesmos se julgam" destaque={["julgam"]} em={0.1} tamanho={72} />
      </AbsoluteFill>
      {t >= 3.3 && (
        <div style={{ position: "absolute", left: 0, right: 0, top: 568, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <Rotulo texto="o melhor resultado" em={3.35} />
          <Entrada em={3.9} mola="pula" distancia={30}>
            <span style={{ fontFamily: fontes.titulo, fontStyle: fontes.tituloEstilo, fontSize: 66, color: cores.tinta }}>
              <span style={{ color: cores.heroi }}>1</span> entre {t >= 4.2 ? "100" : "…"}
            </span>
          </Entrada>
        </div>
      )}
    </Cena>
  );
}
