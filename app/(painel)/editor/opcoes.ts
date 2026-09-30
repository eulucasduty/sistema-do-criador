// Os nomes que aparecem na tela pras opções do editor (o valor é o que a estação entende).

export const ESTILOS_LEGENDA = [
  { valor: "bangers", nome: "Bangers (impacto)", detalhe: "letra grossa, caixa alta, contorno" },
  { valor: "labs", nome: "Limpa (caixa)", detalhe: "letra limpa, a palavra acende numa caixa" },
] as const;

export const LOOKS_VIDEO = [
  { valor: "natural", nome: "Natural", detalhe: "como a câmera gravou" },
  { valor: "quente", nome: "Quente", detalhe: "contraste suave, tom um pouco mais quente" },
  { valor: "duty", nome: "Contraste forte", detalhe: "mais escuro, mais contraste, rosto quente" },
] as const;

export type EstiloLegenda = (typeof ESTILOS_LEGENDA)[number]["valor"];
export type LookVideo = (typeof LOOKS_VIDEO)[number]["valor"];

export const nomeDoEstilo = (v: unknown) => ESTILOS_LEGENDA.find((e) => e.valor === v)?.nome ?? null;
export const nomeDoLook = (v: unknown) => LOOKS_VIDEO.find((l) => l.valor === v)?.nome ?? null;
