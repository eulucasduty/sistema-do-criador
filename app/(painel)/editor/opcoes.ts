// Os nomes que aparecem na tela pras opções do editor (o valor é o que a estação entende).

// O estilo de edição e a legenda de cada um vêm do catálogo do kit (lib/editor.ts).

export const LOOKS_VIDEO = [
  { valor: "natural", nome: "Natural", detalhe: "como a câmera gravou" },
  { valor: "quente", nome: "Quente", detalhe: "contraste suave, tom um pouco mais quente" },
  { valor: "contraste", nome: "Contraste forte", detalhe: "mais escuro, mais contraste, rosto quente" },
] as const;

export type LookVideo = (typeof LOOKS_VIDEO)[number]["valor"];

// Nomes antigos (pedidos e perfis de antes da troca) continuam valendo na leitura
const ANTIGOS: Record<string, string> = { labs: "limpa", duty: "contraste" };
const atual = (v: unknown) => ANTIGOS[String(v ?? "")] ?? String(v ?? "");

export const lookValido = (v: unknown): LookVideo | null => LOOKS_VIDEO.find((l) => l.valor === atual(v))?.valor ?? null;
export const nomeDoLook = (v: unknown) => LOOKS_VIDEO.find((l) => l.valor === atual(v))?.nome ?? null;
