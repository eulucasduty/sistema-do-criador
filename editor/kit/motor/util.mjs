// Utilidades do montador: leitura de arquivos, medidas e texto.

import fs from "node:fs";

export const W = 1080;
export const H = 1920;

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const r3 = (n) => Math.round(n * 1000) / 1000;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const js = (v) => JSON.stringify(v);

export function ler(p, padrao) {
  if (!fs.existsSync(p)) return padrao;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`${p} não é um JSON válido: ${e.message}`);
  }
}

/** Largura e altura de PNG, JPEG, WebP e SVG, lendo só o cabeçalho. */
export function dimensoes(arquivo) {
  try {
    const b = fs.readFileSync(arquivo);
    if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) {
          i++;
          continue;
        }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const t = b.toString("ascii", 12, 16);
      if (t === "VP8X") return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
      if (t === "VP8L") {
        const v = b.readUInt32LE(21);
        return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) };
      }
      if (t === "VP8 ") return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    }
    const txt = b.toString("utf8", 0, Math.min(b.length, 5000));
    if (/<svg/i.test(txt)) {
      const w = txt.match(/<svg[^>]*\swidth="([\d.]+)(px)?"/i);
      const h = txt.match(/<svg[^>]*\sheight="([\d.]+)(px)?"/i);
      if (w && h) return { w: +w[1], h: +h[1] };
      const vb = txt.match(/viewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
      if (vb) return { w: +vb[1], h: +vb[2] };
    }
  } catch {}
  return null;
}

/** Faixas (data-track-index): clipes da mesma faixa não podem se sobrepor. */
export function alocador(base) {
  const fins = [];
  return (a, b) => {
    for (let i = 0; i < fins.length; i++)
      if (fins[i] <= a + 1e-3) {
        fins[i] = b;
        return base + i;
      }
    fins.push(b);
    return base + fins.length - 1;
  };
}

/** Cor estável a partir de um texto (avatar de quem comenta). */
export function corDe(txt) {
  const cores = ["#e1306c", "#833ab4", "#fd1d1d", "#f77737", "#405de6", "#5851db", "#c13584", "#fcaf45", "#25d366", "#128c7e"];
  let h = 0;
  for (const ch of String(txt)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return cores[h % cores.length];
}

/** Junta intervalos [a, b] que se tocam (folga em segundos). */
export function unir(intervalos, folga = 0) {
  const r = [];
  for (const [a, b] of [...intervalos].sort((x, y) => x[0] - y[0])) {
    const u = r[r.length - 1];
    if (u && a - u[1] <= folga) u[1] = Math.max(u[1], b);
    else r.push([a, b]);
  }
  return r;
}

export const dentro = (lista, t) => lista.find(([a, b]) => t >= a && t < b);

/** Mostra o retângulo r (0–1 na imagem) inteiro e centralizado numa caixa cw×ch. */
export function encaixe(r, iw, ih, cw, ch) {
  const rw = clamp(r.w ?? 1, 0.02, 1) * iw;
  const rh = clamp(r.h ?? 1, 0.02, 1) * ih;
  const s = Math.min(cw / rw, ch / rh);
  let x = cw / 2 - s * ((r.x ?? 0) * iw + rw / 2);
  let y = ch / 2 - s * ((r.y ?? 0) * ih + rh / 2);
  x = iw * s >= cw ? clamp(x, cw - iw * s, 0) : (cw - iw * s) / 2;
  y = ih * s >= ch ? clamp(y, ch - ih * s, 0) : (ch - ih * s) / 2;
  return { s: r3(s), x: r3(x), y: r3(y) };
}

/** Cobre a caixa cw×ch com a imagem iw×ih (como object-fit: cover), centralizada. */
export function cobrir(iw, ih, cw, ch) {
  const s = Math.max(cw / iw, ch / ih);
  return { s: r3(s), x: r3((cw - iw * s) / 2), y: r3((ch - ih * s) / 2) };
}

export const primeiraLetra = (txt) => [...String(txt ?? "")].find((ch) => /[\p{L}\p{N}]/u.test(ch))?.toUpperCase() ?? "?";
export const curto = (txt, max) => (String(txt ?? "").length > max ? `${String(txt).slice(0, max - 1).trimEnd()}…` : String(txt ?? ""));
/** Texto com *trecho em destaque* → HTML com <em> (título, manchete, citação). */
export const marcar = (s) => esc(s).replace(/\*([^*]+)\*/g, "<em>$1</em>");
/** O mesmo texto sem os asteriscos (pra medir a largura). */
export const semMarca = (s) => String(s ?? "").replace(/\*/g, "");
/** "A | B" ou ["A", "B"] → ["A", "B"] */
export const linhasDe = (v) => (Array.isArray(v) ? v.map(String) : String(v ?? "").split("|").map((s) => s.trim())).filter(Boolean);
