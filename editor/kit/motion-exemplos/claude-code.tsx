// "você pede, o Claude Code faz" — o Codinho digita, o terminal recebe o pedido, pensa, solta as
// ferramentas e, quando o sistema sobe, os Claudinhos comemoram. Funciona em qualquer identidade
// (o desenho do personagem e do card vem do tema do estilo).
// Batidas: digita 0,5 → 1,6 · pensa 1,75 → 2,65 · linhas 2,65 / 2,97 / 3,29 / 3,61 · festa 3,65
import React from "react";
import { AbsoluteFill, Camera, Cena, Claudinho, Codinho, Entrada, Faiscas, Rotulo, TerminalClaude, Titulo, mola, seno, useAnim } from "@motion";

export const config = { duracao: 6, area: "tela-cheia" };

const PEDIDO = "cria um ManyChat pro meu Instagram";
const FIM_DIGITA = 0.5 + PEDIDO.length * 0.032 + 0.15;
const FIM_PENSA = FIM_DIGITA + 0.9;
const FESTA = FIM_PENSA + 3 * 0.32 + 0.05;

export default function Motion() {
  const { t, fps } = useAnim();
  const humor = t < FIM_DIGITA ? "digitando" : t < FIM_PENSA ? "pensando" : t < FESTA ? "normal" : "feliz";
  return (
    <Cena saida="sobe">
      <Camera passos={[{ em: 0, zoom: 1 }, { em: 6, zoom: 1.06, y: -20 }]} deriva={8} tremores={[{ em: FESTA, dur: 0.3, forca: 10 }]}>
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 190, gap: 18 }}>
          <Rotulo texto="Claude Code" em={0.1} />
          <Titulo texto="Você pede, ele faz" destaque={["faz"]} em={0.2} tamanho={92} />
        </AbsoluteFill>
        <div style={{ position: "absolute", left: 90, top: 480 }}>
          <Entrada em={0.35} mola="suave" distancia={70}>
            <TerminalClaude
              em={0.5}
              pedido={PEDIDO}
              pensando={0.9}
              passo={0.32}
              largura={900}
              linhas={[
                { texto: "Write(automacao.ts)", tipo: "ferramenta" },
                { texto: "Criado com 128 linhas", tipo: "resultado" },
                { texto: "Bash(npm run deploy)", tipo: "ferramenta" },
                { texto: "Sistema no ar", tipo: "ok" },
              ]}
            />
          </Entrada>
        </div>
        <div style={{ position: "absolute", left: 60, top: 1010, transform: `scale(${mola(t, 0.3, fps, "pula")})`, transformOrigin: "50% 100%" }}>
          <Codinho tamanho={310} humor={humor} acena={t >= FESTA} />
        </div>
        {[0, 1, 2].map((k) => {
          const s = mola(t, FESTA + k * 0.09, fps, "pula");
          if (s <= 0.01) return null;
          const pulo = Math.abs(seno(t - FESTA, 0.55, 46, k)) * s;
          return (
            <div key={k} style={{ position: "absolute", left: 420 + k * 195, top: 1110 - pulo, transform: `scale(${s})` }}>
              <Claudinho tamanho={180} humor="feliz" fase={k} />
            </div>
          );
        })}
        <Faiscas em={FESTA} x={720} y={1190} n={16} raio={260} />
      </Camera>
    </Cena>
  );
}
