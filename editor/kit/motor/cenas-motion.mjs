// ── motion: um vídeo animado de verdade (feito no estúdio de motion, em Remotion) ──
// O editor escreve motions/<id>.tsx (kit/MOTION.md), renderiza com `node kit/motion.mjs render <id>`
// e põe a cena no plano:
//   { "de": 3.44, "ate": 7.15, "tipo": "motion", "motion": "arena" }
// O tamanho e o lugar vêm do que foi renderizado (motions/<id>.json → area):
//   tela-cheia  cobre a tela (aceita "pip" pra ele ficar numa janelinha; a legenda fica embaixo)
//   faixa       a faixa de cima da tela dividida (ele embaixo)
//   sobre       transparente, por cima do vídeo dele
import fs from "node:fs";
import { esc } from "./util.mjs";
import { registrar } from "./cenas.mjs";

function infoDo(c) {
  try {
    return JSON.parse(fs.readFileSync(`motions/${String(c.motion ?? "").trim()}.json`, "utf8"));
  } catch {
    return null;
  }
}

registrar("motion", {
  zona: (c) => {
    const area = infoDo(c)?.area ?? c.area ?? "tela-cheia";
    return area === "faixa" ? "faixa" : area === "sobre" ? "sobre" : "cheia";
  },
  preparar(M, c) {
    const info = infoDo(c);
    if (!info) return M.avisar(`cena ${c.i} (motion): motions/${c.motion}.json não existe; rode node kit/motion.mjs render ${c.motion}`);
    c._info = info;
    const dur = c.ate - c.de;
    if (Math.abs(dur - info.duracao) > 0.15) M.avisar(`cena ${c.i} (motion ${c.motion}): a cena tem ${dur.toFixed(2)} s e o motion tem ${info.duracao} s; acerte o "ate" (ou a duracao do motion e renderize de novo)`);
  },
  montar(M, c, id) {
    const info = c._info;
    if (!info || !M.arquivoOk(info.arquivo, `cena ${c.i} (motion ${c.motion})`)) return;
    const onde = c.zona === "cheia" ? "cheia" : c.zona === "faixa" ? "faixa" : "sobre";
    // <video> não pode ficar dentro de elemento com tempo: a caixa é só o lugar (e a opacidade)
    M.html.cenas.push(`      <div class="motion-caixa ${onde}" id="${id}-mc" style="opacity:0"><video id="${id}-v" class="clip" ${M.attrs(c)} data-media-start="0" src="${esc(info.arquivo)}" muted playsinline></video></div>`);
    M.add(`tl.fromTo("#${id}-mc", { opacity: 0 }, { opacity: 1, duration: 0.06, ease: "none" }, ${c.de});`);
    // no fim, o motion se dissolve no vídeo dele (o motion já tirou o conteúdo da frente)
    M.add(`tl.to("#${id}-mc", { opacity: 0, duration: 0.2, ease: "power1.in" }, ${Math.max(c.de + 0.1, Math.round((c.ate - 0.2) * 1000) / 1000)});`);
    if (onde === "cheia" && c.som !== false) M.somCena(c, c.som ?? "whoosh", Math.max(0, c.de - 0.06), 0.7);
  },
});
