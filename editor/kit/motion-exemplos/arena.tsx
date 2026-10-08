// "essa skill vai colocar 100 Claudinhos pra brigar até sobrar uma só." (3,44 → 7,15 do vídeo)
// Tempos aqui são do motion (0 = 3,44 s do vídeo): colocar 0,66 · 100 1,02 · brigar 2,13 · uma só 3,19
import React from "react";
import { AbsoluteFill, Camera, Cena, Claudinho, Coroa, Brilho, Faiscas, Onda, NuvemDeBriga, Numero, Rotulo, Entrada, acaso, entre, mola, seno, useAnim, useTema, CURVA } from "@motion";

export const config = { duracao: 3.71, area: "tela-cheia" };

const CEL = 86; // tamanho da casa da grade 10×10
const X0 = 540 - 5 * CEL;
const Y0 = 820 - 5 * CEL;
const VENCEDOR = 44; // linha 4, coluna 4
const posDe = (i: number) => ({ x: X0 + ((i % 10) + 0.5) * CEL, y: Y0 + (Math.floor(i / 10) + 0.5) * CEL });
const V = posDe(VENCEDOR);
const BRIGA = 2.13;
const FIM_BRIGA = 3.12;
const UMA_SO = 3.19;

const Multidao: React.FC = () => {
  const { t, fps } = useAnim();
  return (
    <>
      {Array.from({ length: 100 }, (_, i) => {
        if (i === VENCEDOR) return null;
        const p = posDe(i);
        const anel = Math.max(Math.abs((i % 10) - 4), Math.abs(Math.floor(i / 10) - 4));
        const nasce = 1.0 + anel * 0.045 + acaso(i, 1) * 0.05;
        const s = mola(t, nasce, fps, "pula");
        if (s <= 0.01) return null;
        // na briga cada um é nocauteado num instante e voa pra longe do meio
        const cai = BRIGA + 0.08 + acaso(i, 2) * (FIM_BRIGA - BRIGA - 0.15);
        const voo = entre(t, [cai, cai + 0.55], [0, 1], CURVA.entra);
        const dx = p.x - 540;
        const dy = p.y - 820;
        const d = Math.hypot(dx, dy) || 1;
        const x = p.x + (dx / d) * 520 * voo + seno(t, 0.09, t > BRIGA && t < cai ? 3 : 0, i);
        const y = p.y + (dy / d) * 520 * voo - Math.sin(voo * Math.PI) * 120;
        const humor = t >= cai ? "nocaute" : t >= BRIGA - 0.05 ? "bravo" : t >= 1.4 ? "surpreso" : "normal";
        return (
          <div key={i} style={{ position: "absolute", left: x - 40, top: y - 40, transform: `scale(${s * (1 - 0.5 * voo)}) rotate(${voo * (acaso(i, 3) > 0.5 ? 1 : -1) * 540}deg)`, opacity: 1 - voo }}>
            <Claudinho tamanho={80} humor={humor} fase={i * 0.37} olhar={[dx > 0 ? -0.8 : 0.8, dy > 0 ? -0.6 : 0.6]} />
          </div>
        );
      })}
    </>
  );
};

/** O vencedor: está lá desde o começo, some na nuvem e volta sozinho, grande, de coroa. */
const Vencedor: React.FC = () => {
  const { t, fps } = useAnim();
  const olhar: [number, number] = t < 0.25 ? [-1, 0] : t < 0.55 ? [1, -0.3] : [0, 0];
  const volta = mola(t, FIM_BRIGA, fps, "pula");
  const naNuvem = t > BRIGA + 0.1 && t < FIM_BRIGA;
  const x = entre(t, [FIM_BRIGA, FIM_BRIGA + 0.4], [V.x, 540], CURVA.entra);
  const y = entre(t, [FIM_BRIGA, FIM_BRIGA + 0.4], [V.y, 800], CURVA.entra);
  const tam = t < FIM_BRIGA ? 80 : 80 + 250 * volta;
  const humor = t >= UMA_SO ? "feliz" : t >= 1.2 ? "surpreso" : "normal";
  const coroa = mola(t, UMA_SO + 0.06, fps, "pula");
  return (
    <>
      <Brilho em={UMA_SO} x={540} y={800} raio={380} />
      <div style={{ position: "absolute", left: x - tam / 2, top: y - tam / 2, opacity: naNuvem ? 0 : 1 }}>
        <Claudinho tamanho={tam} humor={humor} olhar={olhar} />
      </div>
      {t >= UMA_SO && (
        <div style={{ position: "absolute", left: 540 - 60, top: 800 - tam * 0.5 - 92 - (1 - coroa) * 90, opacity: Math.min(1, coroa * 2.5), transform: `rotate(${seno(t, 1.2, 5)}deg)` }}>
          <Coroa tamanho={130} />
        </div>
      )}
    </>
  );
};

const Placar: React.FC = () => {
  const { t } = useAnim();
  const { cores, fontes } = useTema();
  if (t < 1.0) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", paddingTop: 150 }}>
      <Rotulo texto="A arena" em={1.0} />
      <Entrada em={1.05} mola="pula" style={{ display: "flex", alignItems: "baseline", gap: 22, marginTop: 18 }}>
        <Numero de={100} para={1} em={BRIGA + 0.05} dur={FIM_BRIGA - BRIGA} tamanho={150} cor={t >= UMA_SO ? cores.heroi : cores.tinta} />
        <span style={{ fontFamily: fontes.titulo, fontStyle: fontes.tituloEstilo, fontSize: 92, color: cores.tinta }}>{t >= UMA_SO ? "sobrou" : "Claudinhos"}</span>
      </Entrada>
    </AbsoluteFill>
  );
};

export default function Motion() {
  return (
    <Cena saida="zoom">
      <Camera
        passos={[
          { em: 0, zoom: 2.4, x: (540 - V.x) * 2.4, y: (960 - V.y) * 2.4 },
          { em: 0.66, zoom: 2.2, x: (540 - V.x) * 2.2, y: (960 - V.y) * 2.2 },
          { em: 1.25, zoom: 1, x: 0, y: 0 },
          { em: FIM_BRIGA, zoom: 1, x: 0, y: 0 },
          { em: 3.6, zoom: 1.12, x: 0, y: 30 },
        ]}
        deriva={8}
        tremores={[
          { em: BRIGA, dur: 0.45, forca: 16 },
          { em: 2.62, dur: 0.25, forca: 10 },
          { em: FIM_BRIGA, dur: 0.3, forca: 18 },
        ]}
      >
        <Multidao />
        <NuvemDeBriga em={BRIGA} ate={FIM_BRIGA} x={540} y={820} tamanho={430} />
        <Vencedor />
        <Onda em={FIM_BRIGA} x={540} y={800} raio={420} />
        <Faiscas em={FIM_BRIGA + 0.02} x={540} y={800} n={18} raio={330} />
      </Camera>
      <Placar />
    </Cena>
  );
}
