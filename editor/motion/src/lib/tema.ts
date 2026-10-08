// O tema de cada estilo de edição: cores, fontes, curvas, molas e a identidade visual (que fundo,
// como o personagem é desenhado, como é o card). Um motion nunca escreve cor, curva ou mola na mão:
// pega daqui (useTema), pra sair com a cara do estilo da edição.
import { createContext, useContext } from "react";
import { Easing } from "remotion";

export type Visual = {
  /** o fundo da cena: papel creme, retícula de gibi, tela de terminal, massinha (gradiente macio) ou papel limpo */
  fundo: "papel" | "meio-tom" | "terminal" | "massinha" | "limpo" | "noite";
  /** como os personagens são desenhados */
  personagem: "chapado" | "adesivo" | "pixel" | "massinha" | "traco";
  /** a tinta do contorno (adesivo, traço, balão, nuvem) */
  contorno: string;
  /** card: raio, espessura da borda e se a sombra é dura (gibi) ou macia */
  cardRaio: number;
  cardBorda: number;
  sombraDura: boolean;
  /** textura por cima: grão, vinheta, linhas de tela (terminal) e força da correção de cor */
  grao: number;
  vinheta: number;
  linhas: boolean;
  correcao: number;
};

export type Tema = {
  claro: boolean;
  cores: {
    fundo: string; // papel / fundo da cena
    fundo2: string; // segunda cor do fundo (luz que anda)
    card: string;
    borda: string;
    tinta: string; // texto
    dim: string; // texto apagado, rótulos
    heroi: string; // A cor de destaque: no máximo uma coisa por quadro
    ok: string;
    erro: string;
    ouro: string; // coroa, troféu
    sombra: string;
    brilho: string; // brilho em volta do herói
    claudinho: string; // o personagem
  };
  /** escala: o quanto o título cresce ou encolhe (fonte larga como a Unbounded precisa de menos) */
  fontes: { titulo: string; tituloEstilo: "italic" | "normal"; texto: string; mono: string; impacto: string; numero: string; escala: number };
  visual: Visual;
};

const CHAPADO: Visual = { fundo: "papel", personagem: "chapado", contorno: "#2a1a14", cardRaio: 28, cardBorda: 2, sombraDura: false, grao: 0.05, vinheta: 0.13, linhas: false, correcao: 0.08 };

export const TEMAS: Record<string, Tema> = {
  // classico: papel creme, laranja queimado, serifada itálica (o mesmo do kit/estilos/classico)
  classico: {
    claro: true,
    cores: { fundo: "#f4f1ea", fundo2: "#efe6d6", card: "#ffffff", borda: "#e6e0d4", tinta: "#1a1a1a", dim: "#7a7368", heroi: "#d97757", ok: "#1fa35c", erro: "#e5533d", ouro: "#f0b44c", sombra: "rgba(70, 50, 30, 0.18)", brilho: "rgba(217, 119, 87, 0.5)", claudinho: "#d97757" },
    fontes: { titulo: "Serifa", tituloEstilo: "italic", texto: "Jakarta", mono: "Mono", impacto: "Bangers", numero: "Jakarta", escala: 1 },
    visual: CHAPADO,
  },
  // gibi: HQ. Papel amarelado com retícula, contorno preto grosso, sombra dura, Claudinho adesivo
  "classico-gibi": {
    claro: true,
    cores: { fundo: "#fbf1d8", fundo2: "#ffe39a", card: "#ffffff", borda: "#1a1a1a", tinta: "#1a1a1a", dim: "#6b5f4c", heroi: "#ff6b35", ok: "#2bb673", erro: "#e63946", ouro: "#ffcf33", sombra: "#1a1a1a", brilho: "rgba(255, 107, 53, 0.45)", claudinho: "#ff7a45" },
    fontes: { titulo: "Bangers", tituloEstilo: "normal", texto: "Jakarta", mono: "Mono", impacto: "Bangers", numero: "Bangers", escala: 1.05 },
    visual: { fundo: "meio-tom", personagem: "adesivo", contorno: "#1a1a1a", cardRaio: 22, cardBorda: 5, sombraDura: true, grao: 0.04, vinheta: 0.08, linhas: false, correcao: 0.04 },
  },
  // terminal: o Claude Code. Fundo quase preto, linhas de tela, mono, laranja e verde, Claudinho em pixel
  "classico-terminal": {
    claro: false,
    cores: { fundo: "#0f0e0d", fundo2: "#221b15", card: "#181614", borda: "#34302a", tinta: "#f1ece4", dim: "#8f877b", heroi: "#d97757", ok: "#7bd88f", erro: "#ff6b6b", ouro: "#f4c95d", sombra: "rgba(0, 0, 0, 0.6)", brilho: "rgba(217, 119, 87, 0.45)", claudinho: "#d97757" },
    fontes: { titulo: "Mono", tituloEstilo: "normal", texto: "Jakarta", mono: "Mono", impacto: "Mono", numero: "Mono", escala: 0.8 },
    visual: { fundo: "terminal", personagem: "pixel", contorno: "#0f0e0d", cardRaio: 14, cardBorda: 2, sombraDura: false, grao: 0.06, vinheta: 0.35, linhas: true, correcao: 0.1 },
  },
  // massinha: brinquedo 3D. Pêssego e lilás, tudo redondo e gordinho, Claudinho de massinha
  "classico-massinha": {
    claro: true,
    cores: { fundo: "#ffe8dc", fundo2: "#e4dcff", card: "#ffffff", borda: "#f3d9cc", tinta: "#2b1d3a", dim: "#8a7b94", heroi: "#ff6a3d", ok: "#2fbf71", erro: "#ff4f6d", ouro: "#ffc533", sombra: "rgba(120, 60, 90, 0.22)", brilho: "rgba(255, 106, 61, 0.45)", claudinho: "#ff7e4f" },
    fontes: { titulo: "Unbounded", tituloEstilo: "normal", texto: "Jakarta", mono: "Mono", impacto: "Unbounded", numero: "Unbounded", escala: 0.72 },
    visual: { fundo: "massinha", personagem: "massinha", contorno: "#2b1d3a", cardRaio: 44, cardBorda: 0, sombraDura: false, grao: 0.03, vinheta: 0.06, linhas: false, correcao: 0.05 },
  },
  // editorial: revista. Papel branco, traço fino, serifada grande, Claudinho em line-art
  "classico-editorial": {
    claro: true,
    cores: { fundo: "#fbfaf7", fundo2: "#f1eee8", card: "#ffffff", borda: "#141414", tinta: "#141414", dim: "#77736c", heroi: "#d97757", ok: "#1f8a4c", erro: "#c8452f", ouro: "#d9a441", sombra: "rgba(0, 0, 0, 0)", brilho: "rgba(217, 119, 87, 0.28)", claudinho: "#d97757" },
    fontes: { titulo: "Serifa", tituloEstilo: "italic", texto: "InterTight", mono: "Mono", impacto: "Serifa", numero: "InterTight", escala: 1 },
    visual: { fundo: "limpo", personagem: "traco", contorno: "#141414", cardRaio: 0, cardBorda: 1.5, sombraDura: false, grao: 0.035, vinheta: 0, linhas: false, correcao: 0 },
  },
  // escuro: o padrão dos estilos de fundo escuro
  escuro: {
    claro: false,
    cores: { fundo: "#0b0b10", fundo2: "#1a1424", card: "#16161e", borda: "#2a2a35", tinta: "#f4f4f5", dim: "#a1a1aa", heroi: "#ffc93c", ok: "#7dff3d", erro: "#ff4d5e", ouro: "#ffc93c", sombra: "rgba(0, 0, 0, 0.55)", brilho: "rgba(255, 201, 60, 0.45)", claudinho: "#d97757" },
    fontes: { titulo: "Archivo", tituloEstilo: "normal", texto: "Jakarta", mono: "Mono", impacto: "Bangers", numero: "Jakarta", escala: 0.9 },
    visual: { ...CHAPADO, contorno: "#0b0b10", vinheta: 0.3, correcao: 0.16 },
  },
};

export const temaDoEstilo = (estilo?: string): Tema => TEMAS[estilo ?? ""] ?? TEMAS.classico;

export const TemaCtx = createContext<Tema>(TEMAS.classico);
export const useTema = () => useContext(TemaCtx);

/** A sombra do card do tema: dura (gibi: deslocada, sem desfoque) ou macia. */
export const sombraCard = (tema: Tema, destaque = false) =>
  tema.visual.sombraDura
    ? `${destaque ? 9 : 7}px ${destaque ? 9 : 7}px 0 ${tema.visual.contorno}`
    : `0 4px 0 ${tema.claro ? tema.cores.borda : "rgba(0,0,0,0.3)"}, 0 26px 60px ${tema.cores.sombra}${destaque ? `, 0 0 50px ${tema.cores.brilho}` : ""}`;

// As curvas. Movimento linear é proibido (só em coisa mecânica: ponteiro, barra de progresso).
export const CURVA = {
  entra: Easing.bezier(0.16, 1, 0.3, 1), // easeOutExpo: entradas
  move: Easing.bezier(0.83, 0, 0.17, 1), // easeInOutQuint: câmera, deslocamentos
  suave: Easing.bezier(0.45, 0, 0.55, 1), // sine in-out: respiração, deriva
  sai: Easing.bezier(0.7, 0, 0.84, 0), // saídas (mais rápidas que as entradas)
};

// As molas
export const MOLA = {
  rapida: { damping: 14, stiffness: 160, mass: 0.6 }, // palavras, pops de interface
  suave: { damping: 20, stiffness: 90, mass: 1 }, // blocos grandes
  pula: { damping: 11, stiffness: 170, mass: 0.7 }, // personagem, logo, acento brincalhão
};
