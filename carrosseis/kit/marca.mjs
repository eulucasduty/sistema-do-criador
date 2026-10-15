// A marca do criador em todos os slides: a foto redonda + o @ numa pílula escura (58 px de altura).
// Quem põe é o renderizador, por cima do PNG, fora do alcance do HTML da IA. A estação mede a
// largura antes (medirMarca) e grava em dados/pedido.json → marca, pra IA reservar o espaço.

import fs from "node:fs";
import sharp from "sharp";

export const ALTURA_MARCA = 58;
const LARGURA_MINIMA = 240;
const FOTO = 44;
const FONTE = 21;

const escapar = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Largura do texto na fonte da pílula (desenha e mede o que sobrou depois de aparar). */
async function larguraDoTexto(texto) {
  if (!texto) return 0;
  const svg = `<svg width="1400" height="${ALTURA_MARCA}" xmlns="http://www.w3.org/2000/svg"><text x="4" y="36" fill="white" font-size="${FONTE}" font-family="Arial,Helvetica,sans-serif">${escapar(texto)}</text></svg>`;
  const { info } = await sharp(Buffer.from(svg)).trim().toBuffer({ resolveWithObject: true });
  return info.width;
}

/** { texto, largura, altura } a partir do perfil (usuario sem @, nome). Sem nenhum dos dois: null. */
export async function medirMarca({ usuario, nome } = {}) {
  const texto = usuario ? `@${String(usuario).replace(/^@+/, "").trim()}` : String(nome ?? "").trim();
  if (!texto) return null;
  const largura = Math.min(1000, Math.max(LARGURA_MINIMA, Math.ceil(61 + (await larguraDoTexto(texto)) + 24)));
  return { texto, largura, altura: ALTURA_MARCA };
}

/** O PNG da pílula. `foto`: caminho da foto do perfil (opcional; sem ela, a inicial num círculo). */
export async function desenharMarca(marca, foto) {
  const { texto, largura } = marca;
  const pilula = `<svg width="${largura}" height="${ALTURA_MARCA}" xmlns="http://www.w3.org/2000/svg"><rect width="${largura}" height="${ALTURA_MARCA}" rx="${ALTURA_MARCA / 2}" fill="#111" fill-opacity=".84"/><text x="61" y="36" fill="white" font-size="${FONTE}" font-family="Arial,Helvetica,sans-serif">${escapar(texto)}</text></svg>`;
  const redonda = Buffer.from(`<svg width="${FOTO}" height="${FOTO}"><circle cx="${FOTO / 2}" cy="${FOTO / 2}" r="${FOTO / 2}" fill="white"/></svg>`);
  let circulo;
  if (foto && fs.existsSync(foto)) {
    circulo = await sharp(foto).resize(FOTO, FOTO, { fit: "cover" }).composite([{ input: redonda, blend: "dest-in" }]).png().toBuffer();
  } else {
    const inicial = escapar((texto.replace(/^@/, "")[0] ?? "").toUpperCase());
    circulo = await sharp(
      Buffer.from(`<svg width="${FOTO}" height="${FOTO}" xmlns="http://www.w3.org/2000/svg"><circle cx="22" cy="22" r="22" fill="#f5f4f0"/><text x="22" y="30" text-anchor="middle" fill="#111" font-size="22" font-weight="700" font-family="Arial,Helvetica,sans-serif">${inicial}</text></svg>`),
    )
      .png()
      .toBuffer();
  }
  return sharp(Buffer.from(pilula))
    .composite([{ input: circulo, left: 7, top: 7 }])
    .png()
    .toBuffer();
}
