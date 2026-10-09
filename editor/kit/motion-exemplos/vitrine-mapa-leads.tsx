// "Você fala pro Claude: scrape dentistas em São Paulo. O scraper roda, busca, baixa uma planilha e
// tira as duplicadas sozinho." (tela cheia)
// Um mundo só: o terminal recebe o pedido, a mira trava na cidade, os pinos estouram em onda com o
// contador junto, a planilha sai e as duplicadas somem (o número cai de 308 pra 267).
// Batidas (tempo do motion): pedido 0,35 → 1,6 · mira 1,0 · roda 2,2 · pinos 2,2 → 3,9 ·
// planilha 3,9 · duplicadas 4,6
import React from "react";
import { AbsoluteFill, Anotacao, Camera, Cena, Foco, Mapa, Mira, Pinos, TerminalClaude, Vidro, entre, pinosAte, useAnim, useTema, CURVA } from "@motion";

export const config = { duracao: 6, area: "tela-cheia" };
export const sons = [
  { em: 0.0, som: "whoosh" },
  { em: 0.35, som: "teclado", volume: 0.4 },
  { em: 1.0, som: "click" },
  { em: 2.2, som: "riser", volume: 0.35 },
  { em: 3.9, som: "ding" },
  { em: 4.6, som: "pop" },
];

const MAPA = { x: 90, y: 620, w: 900, h: 720 };
const PINOS = { n: 70, em: 2.2, dur: 1.7 };
const DUP = 4.6;

export default function Motion() {
  const { t } = useAnim();
  const { cores, fontes } = useTema();
  // o contador anda junto com os pinos e depois cai com as duplicadas
  const achados = Math.round(308 * pinosAte(t, PINOS.n, PINOS.em, PINOS.dur) / PINOS.n);
  const total = t < DUP ? achados : Math.round(entre(t, [DUP + 0.1, DUP + 0.7], [308, 267], CURVA.entra));
  return (
    <Cena saida="zoom">
      <Camera passos={[{ em: 0, zoom: 1.18, y: 330 }, { em: 1.7, zoom: 1.18, y: 330 }, { em: 2.3, zoom: 1, y: 0 }, { em: 4.5, zoom: 1 }, { em: 5.1, zoom: 1.15, x: -190, y: -300 }]} deriva={8} tremores={[{ em: 3.9, dur: 0.25, forca: 8 }]}>
        {/* o mapa numa janela de vidro */}
        <div style={{ position: "absolute", left: MAPA.x, top: MAPA.y }}>
          <Foco em={0} distancia={80}>
            <Vidro largura={MAPA.w} pad={0} style={{ height: MAPA.h, overflow: "hidden", position: "relative" }}>
              <Mapa largura={MAPA.w} altura={MAPA.h} />
              <div style={{ position: "absolute", left: 22, top: 18, fontFamily: fontes.mono, fontSize: 18, letterSpacing: "0.12em", color: cores.dim, textTransform: "uppercase" }}>São Paulo · LAT -23.55 LON -46.63</div>
              <Pinos n={PINOS.n} em={PINOS.em} dur={PINOS.dur} x={40} y={70} w={MAPA.w - 80} h={MAPA.h - 140} some={DUP} duplicados={0.13} tamanho={26} />
            </Vidro>
          </Foco>
        </div>
        <Mira em={1.0} x={MAPA.x + MAPA.w / 2 - 90} y={MAPA.y + MAPA.h / 2 - 90} w={180} h={180} some={2.3} texto={"ALVO\nSão Paulo, SP"} />
        {/* o terminal do Claude Code recebendo o pedido */}
        <div style={{ position: "absolute", left: 90, top: 190 }}>
          <Foco em={0.15} distancia={60}>
            <TerminalClaude em={0.35} pedido="/scrape dentistas em São Paulo, SP" pensando={0.5} passo={0.9} largura={900} pasta="~/leads" linhas={[{ texto: "Bash(docker compose up -d)", tipo: "ferramenta" }, { texto: "job 8f3a rodando · localhost:8080", tipo: "resultado" }, { texto: "leads.csv · 308 linhas", tipo: "ok" }]} />
          </Foco>
        </div>
        {/* o contador de alvos, no canto do mapa */}
        <div style={{ position: "absolute", left: MAPA.x + MAPA.w - 380, top: MAPA.y + MAPA.h - 170 }}>
          <Foco em={2.15} de="direita" distancia={40}>
            <Vidro largura={350} pad="20px 28px">
              <div style={{ fontFamily: fontes.mono, fontSize: 18, letterSpacing: "0.14em", color: cores.dim }}>ALVOS NO MAPA</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ fontFamily: fontes.numero, fontWeight: 800, fontSize: 84, letterSpacing: "-0.04em", fontVariantNumeric: "tabular-nums", color: t >= DUP + 0.7 ? cores.ok : cores.tinta }}>{total}</span>
                <span style={{ fontFamily: fontes.texto, fontSize: 26, color: cores.dim }}>leads</span>
              </div>
            </Vidro>
          </Foco>
        </div>
        <Anotacao texto="41 duplicadas removidas" em={DUP} tipo="ok" tamanho={26} style={{ left: MAPA.x + 40, top: MAPA.y + MAPA.h - 90 }} />
      </Camera>
    </Cena>
  );
}
