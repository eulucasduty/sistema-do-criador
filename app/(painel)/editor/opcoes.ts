// Os nomes que aparecem na tela pras opções do editor (o valor é o que a estação entende).

export const ESTILOS_LEGENDA = [
  { valor: "bangers", nome: "Bangers (impacto)", detalhe: "letra grossa, caixa alta, contorno" },
  { valor: "limpa", nome: "Limpa (caixa)", detalhe: "letra limpa, a palavra acende numa caixa" },
] as const;

export const LOOKS_VIDEO = [
  { valor: "natural", nome: "Natural", detalhe: "como a câmera gravou" },
  { valor: "quente", nome: "Quente", detalhe: "contraste suave, tom um pouco mais quente" },
  { valor: "contraste", nome: "Contraste forte", detalhe: "mais escuro, mais contraste, rosto quente" },
] as const;

export type EstiloLegenda = (typeof ESTILOS_LEGENDA)[number]["valor"];
export type LookVideo = (typeof LOOKS_VIDEO)[number]["valor"];

// Nomes antigos (pedidos e perfis de antes da troca) continuam valendo na leitura
const ANTIGOS: Record<string, string> = { labs: "limpa", duty: "contraste" };
const atual = (v: unknown) => ANTIGOS[String(v ?? "")] ?? String(v ?? "");

export const estiloValido = (v: unknown): EstiloLegenda => ESTILOS_LEGENDA.find((e) => e.valor === atual(v))?.valor ?? "bangers";
export const lookValido = (v: unknown): LookVideo | null => LOOKS_VIDEO.find((l) => l.valor === atual(v))?.valor ?? null;
export const nomeDoEstilo = (v: unknown) => ESTILOS_LEGENDA.find((e) => e.valor === atual(v))?.nome ?? null;
export const nomeDoLook = (v: unknown) => LOOKS_VIDEO.find((l) => l.valor === atual(v))?.nome ?? null;
