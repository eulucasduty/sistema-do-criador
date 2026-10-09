// "A Anthropic tá dando um ano de Claude de graça pra quem tem startup ou SaaS." (na faixa de cima)
// Um mundo só que vai se montando com a fala: a logo → o card do plano → "12 meses" → o preço rola
// até zero → o carimbo "pra startup" → "ou SaaS". Cada coisa entra na palavra dela.
// Batidas (tempo do motion): Anthropic 0,1 · dando 0,7 · um ano 1,2 · de Claude 1,6 · de graça 2,1 ·
// startup 3,1 · SaaS 3,8
import React from "react";
import { AbsoluteFill, Camera, Cena, Carimbo, Foco, IconeApp, Img, Rolo, Sublinha, Vidro, mola, staticFile, useAnim, useTema } from "@motion";

export const config = { duracao: 4.6, area: "faixa" };
export const sons = [
  { em: 0.1, som: "pop" },
  { em: 0.7, som: "whoosh" },
  { em: 1.2, som: "pop" },
  { em: 2.6, som: "ding" },
  { em: 3.1, som: "impacto" },
  { em: 3.8, som: "pop" },
];

export default function Motion() {
  const { t, fps } = useAnim();
  const { cores, fontes } = useTema();
  const gratis = t >= 2.55;
  return (
    <Cena saida="sobe">
      <Camera passos={[{ em: 0, zoom: 1.12, y: 30 }, { em: 0.8, zoom: 1 }, { em: 3.1, zoom: 1.05, y: -10 }]} deriva={8} tremores={[{ em: 3.12, dur: 0.28, forca: 10 }]}>
        {/* a logo, que vai pro fundo quando o card chega */}
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 70 }}>
          <Foco em={0.1} recua={0.7} de="perto">
            <IconeApp tamanho={250}>
              <Img src={staticFile("logos/claude.svg")} style={{ width: "62%", height: "62%" }} />
            </IconeApp>
          </Foco>
        </AbsoluteFill>
        {/* o card do plano */}
        <div style={{ position: "absolute", left: 120, top: 225, width: 840 }}>
          <Foco em={0.7} distancia={90}>
            <Vidro largura={840} pad="36px 44px" inclina={4}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <Img src={staticFile("logos/claude.svg")} style={{ width: 52, height: 52 }} />
                <Sublinha em={1.6} espessura={5}>
                  <span style={{ fontFamily: fontes.titulo, fontWeight: 750, fontSize: 58, letterSpacing: "-0.03em" }}>Claude Team</span>
                </Sublinha>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 34 }}>
                <div style={{ fontFamily: fontes.mono, fontSize: 22, letterSpacing: "0.14em", textTransform: "uppercase", color: cores.dim, lineHeight: 1.5 }}>
                  você paga
                  <div style={{ fontFamily: fontes.texto, fontSize: 28, letterSpacing: 0, textTransform: "none", color: cores.tinta }}>pelo ano inteiro</div>
                </div>
                <Rolo valor="0" em={1.75} dur={0.85} voltas={3} prefixo="US$" tamanho={150} cor={gratis ? cores.ok : cores.tinta} />
              </div>
            </Vidro>
          </Foco>
        </div>
        {/* "12 meses" no canto do card */}
        <div style={{ position: "absolute", left: 770, top: 199, transform: `scale(${mola(t, 1.2, fps, "pula")})` }}>
          <span style={{ display: "inline-block", padding: "10px 22px", borderRadius: 999, background: cores.card, border: `2px solid ${cores.heroi}`, color: cores.heroi, fontFamily: fontes.texto, fontWeight: 700, fontSize: 26, boxShadow: `0 10px 24px ${cores.sombra}` }}>12 meses</span>
        </div>
        {/* o carimbo e o "ou SaaS" */}
        <div style={{ position: "absolute", left: 130, top: 548 }}>
          <Carimbo texto="pra startup" em={3.1} tamanho={66} giro={-6} />
        </div>
        <div style={{ position: "absolute", left: 640, top: 566 }}>
          <Foco em={3.8} de="esquerda" mola="pula" distancia={40}>
            <span style={{ display: "inline-block", padding: "12px 28px", borderRadius: 999, background: "#121212", color: "#ffffff", fontFamily: fontes.texto, fontWeight: 700, fontSize: 36, boxShadow: `0 14px 30px ${cores.sombra}` }}>
              <span style={{ fontWeight: 500, opacity: 0.7, fontSize: 28 }}>ou </span>SaaS
            </span>
          </Foco>
        </div>
      </Camera>
    </Cena>
  );
}
