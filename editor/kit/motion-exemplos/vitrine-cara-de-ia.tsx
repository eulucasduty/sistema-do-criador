// "Sem isso a interface fica com cara de IA: gradiente roxo, texto genérico, ícone em tudo." (tela
// cheia, noite: o contraste com as cenas claras)
// O site genérico entra numa janela, cada defeito ganha a anotação vermelha na hora em que ele fala e
// o carimbo "CARA DE IA" bate por cima, com tremida.
// Batidas (tempo do motion): interface 0 · gradiente 0,9 · texto 1,6 · ícone 2,3 · cara de IA 3,0
import React from "react";
import { Anotacao, Camera, Carimbo, Cena, Cursor, Foco, Icone, Janela, useAnim, useTema } from "@motion";

export const config = { duracao: 4.4, area: "tela-cheia", noite: true };
export const sons = [
  { em: 0.0, som: "whoosh" },
  { em: 0.9, som: "pop" },
  { em: 1.6, som: "pop" },
  { em: 2.3, som: "pop" },
  { em: 2.95, som: "impacto" },
];

const J = { x: 120, y: 330, w: 840, h: 900 };

/** O site com cara de IA (desenhado de propósito: é o exemplo do que não fazer). */
const SiteGenerico: React.FC = () => {
  const { fontes } = useTema();
  return (
    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, #7c3aed 0%, #a855f7 45%, #ec4899 100%)", color: "#ffffff", fontFamily: fontes.texto, padding: "60px 56px", boxSizing: "border-box", textAlign: "center" }}>
      <div style={{ display: "inline-block", padding: "8px 20px", borderRadius: 999, background: "rgba(255,255,255,0.18)", fontSize: 22, fontWeight: 600 }}>Nexus IA 2.0 chegou</div>
      <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.05, marginTop: 34 }}>Transforme seu negócio com IA</div>
      <div style={{ fontSize: 26, opacity: 0.85, marginTop: 22, lineHeight: 1.4 }}>Soluções inovadoras e escaláveis para levar seus resultados ao próximo nível.</div>
      <div style={{ display: "inline-block", marginTop: 36, padding: "20px 44px", borderRadius: 999, background: "linear-gradient(90deg, #f97316, #ec4899)", fontSize: 28, fontWeight: 700 }}>Comece agora grátis</div>
      <div style={{ display: "flex", gap: 18, marginTop: 64 }}>
        {[["zap", "Rápido"], ["shield", "Seguro"], ["brain", "Inteligente"]].map(([ic, nome]) => (
          <div key={nome} style={{ flex: 1, padding: "26px 10px", borderRadius: 20, background: "rgba(255,255,255,0.14)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Icone nome={ic} tamanho={46} cor="#ffffff" />
            <span style={{ fontSize: 26, fontWeight: 700 }}>{nome}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function Motion() {
  return (
    <Cena saida="zoom" noite>
      <Camera passos={[{ em: 0, zoom: 0.94 }, { em: 2.9, zoom: 1.02 }, { em: 3.0, zoom: 1.1 }, { em: 4.4, zoom: 1.14 }]} deriva={9} tremores={[{ em: 3.0, dur: 0.35, forca: 16 }]}>
        <div style={{ position: "absolute", left: J.x, top: J.y }}>
          <Foco em={0} distancia={90} desfoque={24}>
            <Janela url="nexus-ia.app" largura={J.w} altura={J.h} inclina={5}>
              <SiteGenerico />
            </Janela>
          </Foco>
        </div>
        <Anotacao texto="gradiente roxo" numero={1} em={0.9} style={{ left: J.x - 30, top: J.y + 110 }} tamanho={28} />
        <Anotacao texto="texto genérico" numero={2} em={1.6} style={{ left: J.x + 420, top: J.y + 300 }} tamanho={28} />
        <Anotacao texto="ícone em tudo" numero={3} em={2.3} style={{ left: J.x + 330, top: J.y + 690 }} tamanho={28} />
        <Cursor caminho={[{ em: 0.5, x: 900, y: 1350 }, { em: 0.85, x: J.x + 60, y: J.y + 160 }, { em: 1.55, x: J.x + 470, y: J.y + 350 }, { em: 2.25, x: J.x + 380, y: J.y + 740 }]} cliques={[0.88, 1.58, 2.28]} some={2.8} />
        <div style={{ position: "absolute", left: 150, top: 700 }}>
          <Carimbo texto="cara de IA" em={3.0} tamanho={120} giro={-9} />
        </div>
      </Camera>
    </Cena>
  );
}
