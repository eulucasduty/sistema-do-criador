// Emendas: o bruto é uma junção de várias tomadas (dados/cortes.json). Cada troca de tomada ganha a
// transição do estilo (corte seco, onda de calor com clique de câmera, queima de filme…); o plano pode
// trocar a de algumas (cortes.trocar), pôr extras (cortes.extras) ou ignorar candidatas falsas.

import { ler, r3 } from "./util.mjs";

const ESTILOS = new Set(["onda", "flash", "zoom", "glitch", "seco", "queima", "desfoque", "barras", "preto"]);

export function montarEmendas(M) {
  const { plano, ESTILO, D, add, som, avisar } = M;
  const cfg = plano.cortes ?? {};
  const CORTE = { estilo: ESTILO.cortes?.estilo ?? "onda", som: ESTILO.cortes?.som === undefined ? "obturador" : ESTILO.cortes.som };
  const trocas = cfg.trocar ?? [];
  const brutos = [
    ...ler("dados/cortes.json", []).map((t) => ({ t: Number(t), estilo: cfg.estilo_padrao ?? CORTE.estilo, som: CORTE.som })),
    ...(cfg.extras ?? []).map((c) => ({ t: Number(c.t), estilo: c.estilo ?? CORTE.estilo, som: c.som === undefined ? CORTE.som : c.som })),
  ]
    .map((c) => {
      const tr = trocas.find((x) => Math.abs(Number(x.t) - c.t) < 0.12);
      return tr ? { ...c, estilo: tr.estilo ?? c.estilo, som: tr.som === undefined ? c.som : tr.som } : c;
    })
    .filter((c) => c.t > 0.2 && c.t < D - 0.3 && c.estilo !== "nenhum" && !(cfg.ignorar ?? []).some((x) => Math.abs(Number(x) - c.t) < 0.12))
    .sort((a, b) => a.t - b.t);
  const emendas = [];
  for (const c of brutos) if (!emendas.length || c.t - emendas[emendas.length - 1].t >= 0.55) emendas.push(c);

  const usa = new Set();
  for (const c of emendas) {
    const t = r3(c.t);
    const t0 = r3(t - 0.16);
    if (!ESTILOS.has(c.estilo)) {
      avisar(`estilo de corte desconhecido: ${c.estilo} (use ${[...ESTILOS].join(", ")})`);
      continue;
    }
    usa.add(c.estilo);
    if (c.estilo === "onda") {
      add(`tl.set("@FX", { filter: "url(#calor)" }, ${t0});`);
      add(`tl.fromTo("#calor-map", { attr: { scale: 0 } }, { attr: { scale: 80 }, duration: 0.16, ease: "power2.in", immediateRender: false }, ${t0});`);
      add(`tl.to("#calor-map", { attr: { scale: 0 }, duration: 0.34, ease: "power2.out" }, ${t});`);
      add(`tl.fromTo("#calor-turb", { attr: { baseFrequency: "0.002 0.014" } }, { attr: { baseFrequency: "0.01 0.045" }, duration: 0.5, ease: "none", immediateRender: false }, ${t0});`);
      add(`tl.fromTo("@FX", { scale: 1 }, { scale: 1.04, duration: 0.16, ease: "power2.in", immediateRender: false }, ${t0});`);
      add(`tl.to("@FX", { scale: 1, duration: 0.34, ease: "power2.out" }, ${t});`);
      add(`tl.set("@FX", { filter: "none" }, ${r3(t + 0.36)});`);
    } else if (c.estilo === "flash") {
      add(`tl.fromTo("#flash", { opacity: 0 }, { opacity: 0.75, duration: 0.04, ease: "none", immediateRender: false }, ${t});`);
      add(`tl.to("#flash", { opacity: 0, duration: 0.24, ease: "power2.out" }, ${r3(t + 0.04)});`);
    } else if (c.estilo === "zoom") {
      add(`tl.fromTo("@FX", { scale: 1.16 }, { scale: 1, duration: 0.32, ease: "power3.out", immediateRender: false }, ${t});`);
    } else if (c.estilo === "glitch") {
      add(`tl.to("@FX", { keyframes: [{ x: -28, duration: 0.03 }, { x: 20, duration: 0.03 }, { x: -12, duration: 0.03 }, { x: 6, duration: 0.03 }, { x: 0, duration: 0.05 }], ease: "none" }, ${t});`);
    } else if (c.estilo === "queima") {
      // queima de filme: um clarão quente atravessa o quadro
      add(`tl.fromTo("#queima", { opacity: 0, xPercent: -30 }, { opacity: 0.95, xPercent: 0, duration: 0.14, ease: "power2.in", immediateRender: false }, ${t0});`);
      add(`tl.to("#queima", { opacity: 0, xPercent: 30, duration: 0.42, ease: "power2.out" }, ${r3(t0 + 0.14)});`);
    } else if (c.estilo === "desfoque") {
      add(`tl.fromTo("@FX", { filter: "blur(0px)", scale: 1 }, { filter: "blur(16px)", scale: 1.05, duration: 0.14, ease: "power2.in", immediateRender: false }, ${t0});`);
      add(`tl.to("@FX", { filter: "blur(0px)", scale: 1, duration: 0.3, ease: "power2.out" }, ${r3(t0 + 0.14)});`);
      add(`tl.set("@FX", { filter: "none" }, ${r3(t0 + 0.46)});`);
    } else if (c.estilo === "barras") {
      // faixas de glitch varrendo o quadro
      for (let k = 0; k < 5; k++) {
        const tk = r3(t0 + k * 0.03);
        add(`tl.fromTo("#barra-corte-${k}", { opacity: 0, xPercent: ${k % 2 ? 60 : -60} }, { opacity: 0.85, xPercent: 0, duration: 0.1, ease: "power2.out", immediateRender: false }, ${tk});`);
        add(`tl.to("#barra-corte-${k}", { opacity: 0, xPercent: ${k % 2 ? -40 : 40}, duration: 0.2, ease: "power2.in" }, ${r3(tk + 0.12)});`);
      }
    } else if (c.estilo === "preto") {
      add(`tl.fromTo("#apaga", { opacity: 0 }, { opacity: 1, duration: 0.1, ease: "none", immediateRender: false }, ${r3(t - 0.1)});`);
      add(`tl.to("#apaga", { opacity: 0, duration: 0.24, ease: "power2.out" }, ${t});`);
    }
    if (c.som) som(c.som, t - 0.03);
  }
  if (usa.has("queima")) M.html.fixos.push(`      <div id="queima"></div>`);
  if (usa.has("barras")) M.html.fixos.push(`      <div id="barras-corte">${[0, 1, 2, 3, 4].map((k) => `<i id="barra-corte-${k}" style="top:${[9, 20, 28, 37, 46][k] * 19.2}px"></i>`).join("")}</div>`);
  if (usa.has("preto")) M.html.fixos.push(`      <div id="apaga"></div>`);
  return emendas;
}
