// Os "papéis" de fonte do kit: o nome que o plano e os estilos usam (larga, condensada, serifa…)
// e a fonte de verdade por trás de cada um. As larguras de cada letra ficam em
// kit/fontes/metricas.json (geradas a partir dos arquivos): é com elas que o montador calcula o
// tamanho em que um texto cabe na tela, sem depender do navegador.
//
// Todas as fontes são de licença aberta (SIL OFL), ver kit/CREDITOS.md.

export const FONTES = {
  // texto e interface
  texto: { familia: "Jakarta", peso: 800, arquivo: "jakarta-800.woff", metrica: "jakarta-800", media: 0.6 },
  "texto-medio": { familia: "Jakarta", peso: 500, arquivo: "jakarta-500.woff", metrica: "jakarta-500", media: 0.56 },
  inter: { familia: "Inter", peso: 700, arquivo: "inter.woff2", eixos: { wght: 700 }, metrica: "inter-700", media: 0.58 },
  "inter-leve": { familia: "Inter", peso: 500, arquivo: "inter.woff2", eixos: { wght: 500 }, metrica: "inter-500", media: 0.55 },
  "inter-preta": { familia: "Inter", peso: 900, arquivo: "inter.woff2", eixos: { wght: 900 }, metrica: "inter-900", media: 0.62 },
  "inter-semi": { familia: "Inter", peso: 600, arquivo: "inter.woff2", eixos: { wght: 600 }, metrica: "inter-600", media: 0.57, espaco: -0.015 },
  mono: { familia: "Mono", peso: 500, arquivo: "mono.woff", metrica: "mono-500", media: 0.6 },
  // títulos largos (Unbounded) e a família Archivo em três larguras
  display: { familia: "Unbounded", peso: 800, arquivo: "unbounded.woff2", eixos: { wght: 800 }, metrica: "unbounded-800", media: 0.82 },
  "display-leve": { familia: "Unbounded", peso: 500, arquivo: "unbounded.woff2", eixos: { wght: 500 }, metrica: "unbounded-500", media: 0.78 },
  larga: { familia: "Archivo", peso: 900, largura: 125, arquivo: "archivo.woff2", eixos: { wght: 900, wdth: 125 }, metrica: "archivo-125-900", media: 0.82 },
  "larga-media": { familia: "Archivo", peso: 600, largura: 125, arquivo: "archivo.woff2", eixos: { wght: 600, wdth: 125 }, metrica: "archivo-125-600", media: 0.76 },
  "larga-leve": { familia: "Archivo", peso: 500, largura: 125, arquivo: "archivo.woff2", eixos: { wght: 500, wdth: 125 }, metrica: "archivo-125-500", media: 0.74 },
  preta: { familia: "Archivo", peso: 900, largura: 100, arquivo: "archivo.woff2", eixos: { wght: 900, wdth: 100 }, metrica: "archivo-100-900", media: 0.68 },
  condensada: { familia: "Archivo", peso: 900, largura: 62, arquivo: "archivo.woff2", eixos: { wght: 900, wdth: 62 }, metrica: "archivo-62-900", media: 0.44 },
  "condensada-media": { familia: "Archivo", peso: 700, largura: 62, arquivo: "archivo.woff2", eixos: { wght: 700, wdth: 62 }, metrica: "archivo-62-700", media: 0.4 },
  // de impacto
  montserrat: { familia: "Montserrat", peso: 900, arquivo: "montserrat.woff2", eixos: { wght: 900 }, metrica: "montserrat-900", media: 0.72 },
  "montserrat-media": { familia: "Montserrat", peso: 700, arquivo: "montserrat.woff2", eixos: { wght: 700 }, metrica: "montserrat-700", media: 0.66 },
  "montserrat-leve": { familia: "Montserrat", peso: 300, arquivo: "montserrat.woff2", eixos: { wght: 300 }, metrica: "montserrat-300", media: 0.6 },
  impacto: { familia: "Anton", peso: 400, arquivo: "anton.woff", metrica: "anton", media: 0.46 },
  bangers: { familia: "Bangers", peso: 400, arquivo: "bangers.woff", metrica: "bangers", media: 0.5 },
  lilita: { familia: "Lilita", peso: 400, arquivo: "lilita.woff", metrica: "lilita", media: 0.56 },
  // serifadas e manuscrita
  serifa: { familia: "Serifa", peso: 400, estilo: "italic", arquivo: "serifa-italica.woff", metrica: "serifa-italica", media: 0.44 },
  "serifa-reta": { familia: "SerifaReta", peso: 400, arquivo: "serifa-reta.woff", metrica: "serifa-reta", media: 0.46 },
  editorial: { familia: "Editorial", peso: 700, arquivo: "editorial.woff2", eixos: { wght: 700 }, metrica: "editorial-700", media: 0.56 },
  "editorial-italica": { familia: "Editorial", peso: 500, estilo: "italic", arquivo: "editorial-italica.woff2", eixos: { wght: 500 }, metrica: "editorial-italica-500", media: 0.5 },
  manuscrita: { familia: "Manuscrita", peso: 700, arquivo: "manuscrita.woff2", eixos: { wght: 700 }, metrica: "manuscrita-700", media: 0.42 },
  marcador: { familia: "Marcador", peso: 400, arquivo: "marcador.woff", metrica: "marcador", media: 0.6 },
  maquina: { familia: "Maquina", peso: 400, arquivo: "maquina.woff", metrica: "maquina", media: 0.6 },
  // a fonte do próprio TikTok (peso 539 no texto com caixa, 606 no texto solto)
  tiktok: { familia: "TikTok", peso: 539, arquivo: "tiktok.woff2", eixos: { wght: 539, opsz: 36 }, metrica: "tiktok-539", media: 0.54 },
  "tiktok-forte": { familia: "TikTok", peso: 606, arquivo: "tiktok.woff2", eixos: { wght: 606, opsz: 36 }, metrica: "tiktok-606", media: 0.55 },
  "tiktok-preta": { familia: "TikTok", peso: 800, arquivo: "tiktok.woff2", eixos: { wght: 800, opsz: 36 }, metrica: "tiktok-800", media: 0.58 },
  // a família "DIN" (Barlow): técnica, de cantos retos
  din: { familia: "Din", peso: 500, arquivo: "barlow-500.woff2", metrica: "barlow-500", media: 0.52 },
  "din-forte": { familia: "Din", peso: 700, arquivo: "barlow-700.woff2", metrica: "barlow-700", media: 0.55 },
  "din-preta": { familia: "Din", peso: 900, estilo: "italic", arquivo: "barlow-900i.woff2", metrica: "barlow-900i", media: 0.58 },
  "din-condensada": { familia: "DinCondensada", peso: 700, arquivo: "barlowc-700.woff2", metrica: "barlowc-700", media: 0.42 },
  "din-condensada-italica": { familia: "DinCondensada", peso: 800, estilo: "italic", arquivo: "barlowc-800i.woff2", metrica: "barlowc-800i", media: 0.44 },
  // jornalística (Libre Franklin), arredondada pesada (Poppins) e caixa alta estreita (Bebas Neue)
  franklin: { familia: "Franklin", peso: 500, arquivo: "franklin.woff2", eixos: { wght: 500 }, metrica: "franklin-500", media: 0.54 },
  "franklin-forte": { familia: "Franklin", peso: 800, arquivo: "franklin.woff2", eixos: { wght: 800 }, metrica: "franklin-800", media: 0.6 },
  poppins: { familia: "Poppins", peso: 800, arquivo: "poppins-800.woff2", metrica: "poppins-800", media: 0.66 },
  bebas: { familia: "Bebas", peso: 400, arquivo: "bebas.woff2", metrica: "bebas", media: 0.42 },
  "poppins-media": { familia: "Poppins", peso: 600, arquivo: "poppins-600.woff2", metrica: "poppins-600", media: 0.62 },
  "poppins-leve": { familia: "Poppins", peso: 400, arquivo: "poppins-400.woff2", metrica: "poppins-400", media: 0.6 },
  // serifa clássica (EB Garamond), serifa macia (Fraunces), a sans do Android (Roboto), a sans apertada
  // (Inter Tight, no lugar da Helvetica Neue) e uma letra de assinatura
  garamond: { familia: "Garamond", peso: 500, arquivo: "garamond.woff2", eixos: { wght: 500 }, metrica: "garamond-500", media: 0.46 },
  "garamond-italica": { familia: "Garamond", peso: 500, estilo: "italic", arquivo: "garamond-italica.woff2", eixos: { wght: 500 }, metrica: "garamond-italica-500", media: 0.42 },
  fraunces: { familia: "Fraunces", peso: 600, arquivo: "fraunces.woff2", eixos: { wght: 600 }, metrica: "fraunces-600", media: 0.58 },
  roboto: { familia: "Roboto", peso: 700, arquivo: "roboto-700.woff2", metrica: "roboto-700", media: 0.56 },
  apertada: { familia: "InterTight", peso: 600, arquivo: "inter-tight.woff2", eixos: { wght: 600 }, metrica: "inter-tight-600", media: 0.54, espaco: -0.03 },
  "apertada-forte": { familia: "InterTight", peso: 800, arquivo: "inter-tight.woff2", eixos: { wght: 800 }, metrica: "inter-tight-800", media: 0.57, espaco: -0.03 },
  assinatura: { familia: "Assinatura", peso: 400, arquivo: "assinatura.woff2", metrica: "assinatura", media: 0.34 },
  // Sora (títulos) e IBM Plex Sans (texto)
  sora: { familia: "Sora", peso: 600, arquivo: "sora.woff2", eixos: { wght: 600 }, metrica: "sora-600", media: 0.59, espaco: -0.02 },
  "sora-forte": { familia: "Sora", peso: 700, arquivo: "sora.woff2", eixos: { wght: 700 }, metrica: "sora-700", media: 0.6, espaco: -0.02 },
  "sora-preta": { familia: "Sora", peso: 800, arquivo: "sora.woff2", eixos: { wght: 800 }, metrica: "sora-800", media: 0.61, espaco: -0.02 },
  plex: { familia: "IBMPlex", peso: 500, arquivo: "plex-500.woff2", metrica: "plex-500", media: 0.52 },
  "plex-leve": { familia: "IBMPlex", peso: 400, arquivo: "plex-400.woff2", metrica: "plex-400", media: 0.51 },
  "plex-semi": { familia: "IBMPlex", peso: 600, arquivo: "plex-600.woff2", metrica: "plex-600", media: 0.53 },
  "plex-forte": { familia: "IBMPlex", peso: 700, arquivo: "plex-700.woff2", metrica: "plex-700", media: 0.54 },
};

/** Declarações CSS de um papel de fonte (para pôr num style="…"). */
export function cssFonte(papel) {
  const f = FONTES[papel] ?? FONTES.texto;
  return `font-family:'${f.familia}',sans-serif;font-weight:${f.peso};${f.largura ? `font-stretch:${f.largura}%;` : ""}${f.estilo ? `font-style:${f.estilo};` : ""}${f.espaco ? `letter-spacing:${f.espaco}em;` : ""}`;
}
