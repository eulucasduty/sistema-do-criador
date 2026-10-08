// As fontes do kit (licença aberta), servidas do public/fontes do estúdio.
import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

const FONTES: [string, string, string, string][] = [
  ["Serifa", "serifa-italica.woff", "400", "italic"],
  ["SerifaReta", "serifa-reta.woff", "400", "normal"],
  ["Jakarta", "jakarta-500.woff", "500", "normal"],
  ["Jakarta", "jakarta-800.woff", "800", "normal"],
  ["Mono", "mono.woff", "500", "normal"],
  ["Bangers", "bangers.woff", "400", "normal"],
  ["Archivo", "archivo.woff2", "100 900", "normal"],
  ["Unbounded", "unbounded.woff2", "200 900", "normal"],
  ["InterTight", "inter-tight.woff2", "100 900", "normal"],
  ["Inter", "inter.woff2", "100 900", "normal"],
  ["Poppins", "poppins-800.woff2", "800", "normal"],
  ["Anton", "anton.woff", "400", "normal"],
];

let carregadas: Promise<unknown> | null = null;
export const carregarFontes = () => (carregadas ??= Promise.all(FONTES.map(([family, arquivo, weight, style]) => loadFont({ family, url: staticFile(`fontes/${arquivo}`), weight, style }))));
