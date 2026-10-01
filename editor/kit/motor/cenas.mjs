// Registro dos tipos de cena e os contêineres em que elas entram.
//
// Zonas (onde a cena aparece e o que ela faz com o vídeo do criador):
//   faixa        na faixa de cima (~40%); o rosto fica embaixo (tela dividida)
//   faixa-baixo  o contrário: o motion embaixo, o rosto numa janela em cima
//   cheia        tela cheia 9:16; o rosto some (ou vira uma janelinha, com "pip")
//   sobre        por cima do vídeo do criador, sem mexer no enquadramento
//   palco        a cena mexe no próprio vídeo (janela em 3D, camadas, profundidade)
//   fundo        troca o fundo atrás do criador (precisa do recorte da pessoa)

import { W, H, clamp, esc, r3 } from "./util.mjs";
import { JANELAS_PADRAO } from "./camera.mjs";

/** A faixa de baixo (o rosto numa janela em cima): começa depois da janela e da legenda. */
export function faixaBaixo(M) {
  const j = M.ESTILO.layout?.dividida_baixo ?? JANELAS_PADRAO.dividida_baixo;
  const topo = Math.round(j.y + j.h + 18 + (M.LEG?.altura_bloco ?? 175) + 8);
  return { topo, altura: 1570 - topo };
}

export const TIPOS = {};
/** def: { zona(c, M) → nome da zona, preparar?(M, c), montar(M, c, id, camera), limite?: [campo, máximo] } */
export function registrar(tipo, def) {
  TIPOS[tipo] = def;
}

// cards que vão na faixa de cima por padrão e aceitam "area": "tela-cheia" | "sobre" e "faixa": "baixo"
export function zonaDeCard(c) {
  if (c.area === "tela-cheia") return "cheia";
  if (c.area === "sobre") return "sobre";
  return c.faixa === "baixo" ? "faixa-baixo" : "faixa";
}

export function prepararCenas(M) {
  const { plano, D, avisar, ESTILO } = M;
  let cenas = (plano.cenas ?? [])
    .map((c, i) => ({ ...c, i, de: r3(clamp(Number(c.de), 0, D)), ate: r3(clamp(Number(c.ate), 0, D)) }))
    .filter((c) => {
      if (!TIPOS[c.tipo]) return avisar(`cena ${c.i}: tipo desconhecido "${c.tipo}"`), false;
      if (!(c.ate - c.de >= 0.3)) return avisar(`cena ${c.i} (${c.tipo}) com duração inválida (${c.de}→${c.ate}), ignorada`), false;
      return true;
    })
    .sort((a, b) => a.de - b.de);
  for (const c of cenas) {
    const def = TIPOS[c.tipo];
    c.zona = def.zona(c, M);
    // tela cheia: o estilo pode pedir o rosto numa janelinha ("pip_padrao"); a cena manda com "pip"
    if (c.zona === "cheia" && def.pip !== false) {
      const pip = c.pip ?? ESTILO.layout?.pip_padrao ?? null;
      if (pip && pip !== "nao") c._pip = pip === true ? "direita" : pip;
    }
    if (c.legenda === false) c._semLegenda = true;
    def.preparar?.(M, c);
  }
  // cenas da mesma área não se sobrepõem: a anterior termina quando a próxima começa
  const grupos = [cenas.filter((c) => c.zona === "faixa" || c.zona === "faixa-baixo"), cenas.filter((c) => c.zona === "cheia"), cenas.filter((c) => c.zona === "palco"), cenas.filter((c) => c.zona === "fundo")];
  for (const grupo of grupos)
    for (let k = 1; k < grupo.length; k++)
      if (grupo[k - 1].ate > grupo[k].de) {
        avisar(`cenas ${grupo[k - 1].i} e ${grupo[k].i} se sobrepõem: a ${grupo[k - 1].i} termina em ${grupo[k].de}`);
        grupo[k - 1].ate = grupo[k].de;
      }
  cenas = cenas.filter((c) => c.ate - c.de >= 0.3);
  M.cenas = cenas; // as cenas já preparadas, pra uma consultar a outra (cabeçalho junto de fotos…)
  return cenas;
}

export const cheia = (c) => c.zona === "cheia";

/** Contêiner de um card: faixa de cima, faixa de baixo, tela cheia (fundo do estilo) ou por cima do vídeo. */
export function abrir(M, c, id, extra = "") {
  const mais = extra ? ` ${extra}` : "";
  if (c.zona === "cheia") {
    M.add(`tl.from("#${id}-bg", { opacity: 0, duration: 0.2, ease: "none" }, ${c.de});`);
    M.add(`tl.from("#${id}-z", { scale: 0.92, duration: 0.35, ease: "power3.out" }, ${c.de});`);
    // com a janelinha, o card fica no espaço acima dela: quanto mais baixa e menor a janela, maior o card
    const j = c._pip ? (M.ESTILO.layout?.pip?.[c._pip] ?? JANELAS_PADRAO.pip[c._pip] ?? JANELAS_PADRAO.pip.direita) : null;
    const livre = j ? clamp(j.y - 180, 500, 1240) : 0;
    const vars = j ? ` style="--pip-pb:${H - 150 - livre}px;--pip-zoom:${r3(clamp(1.12 + ((livre - 770) / 470) * 0.2, 1, 1.32))}"` : "";
    return `<div id="${id}" class="clip cena-cheia${c._pip ? " com-pip" : ""}" ${M.attrs(c)}${vars}><div class="cheia-fundo void" id="${id}-bg"></div><div class="cheia-centro"><div class="cheia-zoom${mais}" id="${id}-z">`;
  }
  if (c.zona === "sobre") return `<div id="${id}" class="clip cena-sobre pos-${esc(c.posicao ?? "baixo")}" ${M.attrs(c)}><div class="sobre-centro${mais}">`;
  if (c.zona === "faixa-baixo") {
    const f = faixaBaixo(M);
    return `<div id="${id}" class="clip cena-topo baixo" ${M.attrs(c)} style="top:${f.topo}px;height:${f.altura}px"><div class="topo-centro${mais}">`;
  }
  return `<div id="${id}" class="clip cena-topo" ${M.attrs(c)}><div class="topo-centro${mais}">`;
}
export const fechar = (c) => (c.zona === "cheia" ? "</div></div></div>" : "</div></div>");

export const entrada = (M, sel, t, ease = "power3.out") => M.add(`tl.from(${JSON.stringify(sel)}, { y: -50, opacity: 0, duration: 0.34, ease: "${ease}" }, ${r3(t)});`);

export function logoImg(M, arq, onde, classe = "logo-img") {
  if (!arq || !M.arquivoOk(arq, onde)) return "";
  return `<img class="${classe}" src="${esc(arq)}" alt="" />`;
}

/** Logo (arquivo) ou ícone (nome do Lucide) numa caixinha. */
export function selo(M, o, onde, tamanho = "mini") {
  if (o?.logo) return `<div class="logo-caixa ${tamanho}${o.fundo === "escuro" ? " escuro" : ""}">${logoImg(M, o.logo, onde)}</div>`;
  if (o?.icone) return `<div class="icone-caixa ${tamanho}">${M.icone(o.icone)}</div>`;
  return "";
}

/** Monta todas as cenas, na ordem do tempo. */
export function montarCenas(M, cenas, camera) {
  for (const c of cenas) {
    const def = TIPOS[c.tipo];
    const lim = def.limite?.[c.zona] ?? def.limite?.todas;
    if (lim && (c[lim[0]]?.length ?? 0) > lim[1]) M.avisar(`cena ${c.i} (${c.tipo}): ${c[lim[0]].length} ${lim[0]}, o máximo que cabe é ${lim[1]}`);
    def.montar(M, c, `c${c.i}`, camera);
  }
}

export { W, H };
