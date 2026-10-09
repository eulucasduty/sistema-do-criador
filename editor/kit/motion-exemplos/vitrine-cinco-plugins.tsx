// "Cinco plugins que você precisa instalar no Claude Code. O primeiro: o Taste Skill." (tela cheia)
// O terminal instala os cinco (barra enchendo, cada um ganha o check na hora) e o contador embaixo
// acompanha; na virada pro primeiro item, tudo sai e entra o "capítulo": etiqueta 01 / 05, o ícone
// e o nome se decodificando.
// Batidas (tempo do motion): instalar 0,2 · itens 0,9 / 1,3 / 1,7 / 2,1 / 2,5 · o primeiro 3,1 ·
// Taste Skill 3,5
import React from "react";
import { AbsoluteFill, Camera, Cena, Checklist, Embaralha, Etiqueta, Foco, Barra, Icone, IconeApp, TerminalClaude, Vidro, entre, useAnim, useTema, CURVA } from "@motion";

export const config = { duracao: 4.8, area: "tela-cheia" };
export const sons = [
  { em: 0.2, som: "teclado", volume: 0.35 },
  { em: 0.9, som: "pop" },
  { em: 1.3, som: "pop" },
  { em: 1.7, som: "pop" },
  { em: 2.1, som: "pop" },
  { em: 2.5, som: "ding" },
  { em: 3.05, som: "whoosh" },
  { em: 3.5, som: "click" },
];

const ITENS = [
  { texto: "taste-skill", em: 0.9 },
  { texto: "web-design-guidelines", em: 1.3 },
  { texto: "awesome-design-md", em: 1.7 },
  { texto: "image-to-code", em: 2.1 },
  { texto: "playwright-cli", em: 2.5 },
];
const VIRA = 3.0;

/** O número do contador troca deslizando de baixo, com borrão (um "tic" por item instalado). */
const Contador: React.FC = () => {
  const { t } = useAnim();
  const { fontes, cores } = useTema();
  const n = Math.max(1, ITENS.filter((i) => t >= i.em).length);
  const desde = ITENS[n - 1]?.em ?? 0;
  const k = entre(t, [desde, desde + 0.22], [0, 1], CURVA.entra);
  return (
    <div style={{ height: 200, overflow: "hidden", textAlign: "center" }}>
      <div style={{ fontFamily: fontes.numero, fontWeight: 800, fontSize: 200, lineHeight: "200px", letterSpacing: "-0.05em", transform: `translateY(${(1 - k) * 90}px)`, filter: k < 0.95 ? `blur(${(1 - k) * 8}px)` : undefined, color: n === 5 ? cores.heroi : cores.tinta }}>{n}</div>
    </div>
  );
};

export default function Motion() {
  const { cores, fontes } = useTema();
  return (
    <Cena saida="sobe">
      <Camera passos={[{ em: 0, zoom: 1.08, y: 120 }, { em: 1.0, zoom: 1, y: 0 }, { em: VIRA, zoom: 1.04 }, { em: 4.8, zoom: 1.1 }]} deriva={8}>
        {/* o terminal instalando */}
        <div style={{ position: "absolute", left: 90, top: 200 }}>
          <Foco em={0} sai={VIRA} distancia={70}>
            <TerminalClaude em={0.15} pedido="/plugin install" pensando={0.25} linhas={[]} largura={900} pasta="~/meu-site" />
            <Vidro largura={900} pad="26px 32px" style={{ marginTop: 18 }}>
              <Barra em={0.6} dur={1.95} rotulo="Instalando" largura={836} />
              <Checklist itens={ITENS} tamanho={34} style={{ marginTop: 26 }} />
            </Vidro>
          </Foco>
        </div>
        {/* o contador de plugins */}
        <div style={{ position: "absolute", left: 340, top: 1000 }}>
          <Foco em={0.85} sai={VIRA + 0.05} distancia={60}>
            <Vidro largura={400} pad="24px 0 26px" inclina={5} style={{ textAlign: "center" }}>
              <Contador />
              <div style={{ fontFamily: fontes.mono, fontSize: 24, letterSpacing: "0.3em", color: cores.dim, marginTop: 4 }}>PLUGINS</div>
            </Vidro>
          </Foco>
        </div>
        {/* o capítulo: o primeiro dos cinco */}
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 430, gap: 40 }}>
          <Etiqueta numero={[1, 5]} texto="Taste Skill" em={VIRA + 0.1} />
          <Foco em={VIRA + 0.2} de="perto" mola="pula">
            <IconeApp tamanho={340} fundo="escuro">
              <Icone nome="palette" tamanho={170} cor="#ffffff" traco={1.8} />
            </IconeApp>
          </Foco>
          <div style={{ fontFamily: fontes.titulo, fontWeight: 800, fontSize: 104, letterSpacing: "-0.04em", color: cores.tinta, height: 120 }}>
            <Embaralha texto="Taste Skill" em={VIRA + 0.5} dur={0.7} />
          </div>
        </AbsoluteFill>
      </Camera>
    </Cena>
  );
}
