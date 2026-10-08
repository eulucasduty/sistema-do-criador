// Montador do editor de vídeo: plano.json (decidido pela IA) → index.html (HyperFrames).
//
// Roda dentro da pasta da edição (a "oficina"), que a estação monta assim:
//   assets/video.mp4        o vídeo bruto já tratado (cor, SDR, 30 fps, voz nivelada)
//   assets/sons, fontes     biblioteca do kit · assets/perfil.jpg foto do perfil (pode não existir)
//   materiais/…             prints e gravações de tela que o criador subiu (com descrição)
//   logos/…, prints/…       logos oficiais e prints de sites que o editor buscou
//   recortes/…              a pessoa recortada do fundo, nos trechos que precisam (a estação gera)
//   dados/video.json        {duracao, largura, altura}
//   dados/palavras.json     transcrição palavra a palavra [{text, start, end}]
//   dados/cortes.json       emendas das tomadas no bruto [segundos]
//   dados/materiais.json    [{id, tipo, arquivo, descricao, largura, altura, duracao}]
//   dados/perfil.json       {nome, usuario, nicho} do criador (CTA, comentários, chat)
//   dados/pedido.json       título, roteiro e opções (opcoes.estilo, opcoes.legenda)
//   plano.json              o plano da edição (formato em kit/COMPONENTES.md)
//
// O padrão de edição mora aqui, não no plano: emendas marcadas, legenda com a palavra falada em
// destaque, tela dividida, janelas, sons. O plano só diz o quê e quando.
//
// O ESTILO DE EDIÇÃO (dados/pedido.json → opcoes.estilo) troca a cara e o comportamento:
// kit/estilos/<estilo>/tema.css (cores e fontes, colado depois do estilo.css) e estilo.json
// (legenda, emenda padrão, layout das janelas, tratamento de filme, sons).
//
// Uso: node kit/montar.mjs   (na pasta da oficina) → escreve index.html e mostra a linha do tempo

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { W, H, esc, r3 } from "./motor/util.mjs";
import { cssFonte } from "./motor/fontes.mjs";
import { criarContexto } from "./motor/contexto.mjs";
import { carregarPalavras, configurarLegenda, montarLegendas } from "./motor/legenda.mjs";
import { montarCenas, prepararCenas } from "./motor/cenas.mjs";
import "./motor/cenas-base.mjs";
import "./motor/cenas-extra.mjs";
import "./motor/cenas-extra2.mjs";
import "./motor/cenas-extra3.mjs";
import "./motor/cenas-3d.mjs";
import "./motor/cenas-motion.mjs";
import { montarCamera } from "./motor/camera.mjs";
import { montarEmendas } from "./motor/emendas.mjs";
import { montarFixos } from "./motor/fixos.mjs";
import { montarVida } from "./motor/vida.mjs";

const KIT = path.dirname(fileURLToPath(import.meta.url));
const M = criarContexto(KIT);
const { D, plano, ESTILO, estiloId, avisar } = M;

configurarLegenda(M);
carregarPalavras(M);

// a manchete do plano (fica o vídeo todo, ou o trecho que ele disser) entra como uma cena
if (plano.manchete) plano.cenas = [...(plano.cenas ?? []), { tipo: "manchete", de: 0, ate: D, ...(typeof plano.manchete === "string" ? { texto: plano.manchete } : plano.manchete) }];
// o que o estilo deixa na tela o vídeo inteiro (selo "ao vivo", visor de câmera, moldura…), se o
// plano não trouxer uma cena do mesmo tipo
for (const fixa of ESTILO.cenas_fixas ?? []) if (!(plano.cenas ?? []).some((c) => c.tipo === fixa.tipo)) plano.cenas = [...(plano.cenas ?? []), { de: 0, ate: D, ...fixa }];

const cenas = prepararCenas(M);
const emendas = montarEmendas(M);
const camera = montarCamera(M, cenas, emendas);
const legenda = montarLegendas(M, camera, emendas, cenas);
const linha0 = M.tl.length;
montarCenas(M, cenas, camera);
// movimento "de vídeo" (só nos estilos com "movimento": "video"): câmera em cada card, saída
// animada e o fundo deslizando
montarVida(M, cenas, camera);
// estilos "em 12 quadros" (documentário): os motions andam aos pulinhos, como animação feita à mão.
// Vale pras cenas; a câmera, a legenda e o que anda em linha reta (barra, letreiro correndo) seguem lisos.
if (ESTILO.quadros) {
  const fps = Number(ESTILO.quadros);
  for (let k = linha0; k < M.tl.length; k++)
    M.tl[k] = M.tl[k].replace(/duration: ([\d.]+), ease: "(?!steps|none)[^"]+"/g, (tudo, d) => (Number(d) < 0.12 ? tudo : `duration: ${d}, ease: "steps(${Math.max(2, Math.round(Number(d) * fps))})"`));
}

// cabeçalho junto de uma cena da faixa de cima ou de tela cheia: os dois ocupam o alto da tela
for (const c of cenas.filter((x) => x.tipo === "cabecalho")) {
  // (as fotos sabem se encaixar embaixo do cabeçalho; o resto, não)
  const outra = cenas.find((o) => o.tipo !== "fotos" && (o.zona === "faixa" || (o.zona === "cheia" && !["palavra", "lettering"].includes(o.tipo))) && o.de < c.ate - 0.2 && o.ate > c.de + 0.2);
  if (outra) avisar(`cena ${c.i} (cabecalho) está junto da cena ${outra.i} (${outra.tipo}, ${outra.zona === "faixa" ? "faixa de cima" : "tela cheia"}): os dois disputam o alto da tela; tire o cabeçalho desse trecho ou ponha a outra cena por cima do vídeo ("area": "sobre")`);
}

for (const c of cenas.filter((x) => x.tipo === "cta"))
  if (cenas.some((o) => o.zona === "faixa" && o.de < c.ate && o.ate > c.de)) avisar(`cena ${c.i} (cta) está junto de uma cena da faixa de cima: o comentário do CTA fica por cima dela`);

// ── padrão 2x1 (só nos estilos que seguem): a cada 2 motions na faixa de cima, 1 em tela cheia ──
const sequencia = [];
let seguidas = 0;
for (const c of cenas) {
  if (c.zona === "faixa" || c.zona === "faixa-baixo") {
    sequencia.push(`faixa(${c.i})`);
    if (++seguidas === 3 && ESTILO.padrao_2x1 === true) avisar(`padrão 2x1: a cena ${c.i} é a 3ª seguida na faixa de cima; ponha uma das 3 em tela cheia ("area": "tela-cheia")`);
  } else if (c.zona === "cheia" && c.tipo !== "palavra") {
    sequencia.push(`CHEIA(${c.i})`);
    seguidas = 0;
  }
}

// ── sons do plano (ding em dica, riser antes de corte/suspense, whoosh de vez em quando…) ──
for (const s of plano.sons ?? []) {
  // "ate" = o som TERMINA nesse instante (riser que acaba na revelação); "t" = começa nele
  const dur = s.ate !== undefined ? M.duracaoSom(s.som) : null;
  if (dur) M.som(s.som, Number(s.ate) - dur, s.volume);
  else M.som(s.som, Number(s.t), s.volume);
}

montarFixos(M, cenas, camera);

// ── recorte da pessoa: os trechos que precisam (texto atrás, troca de fundo, profundidade).
//    Quem gera os arquivos é a estação, depois do plano pronto e antes do render. ──
if (ESTILO.recorte === "inteiro") M.recortes.push({ de: 0, ate: D, motivo: "o estilo troca o fundo do vídeo inteiro" });
let faixaRecorte = 3;
const pedidos = [];
for (const r of [...M.recortes].sort((a, b) => a.de - b.de)) {
  const de = r3(Math.max(0, r.de - 0.12));
  const ate = r3(Math.min(D, r.ate + 0.12));
  const u = pedidos[pedidos.length - 1];
  if (u && de <= u.ate + 0.4) {
    u.ate = Math.max(u.ate, ate);
    u.motivos.push(r.motivo);
  } else pedidos.push({ de, ate, motivos: [r.motivo] });
}
let pendentes = 0;
pedidos.forEach((p, k) => {
  p.arquivo = `recortes/r-${Math.round(p.de * 1000)}-${Math.round(p.ate * 1000)}.webm`;
  p.pronto = fs.existsSync(p.arquivo);
  if (!p.pronto) return void pendentes++;
  M.html.recortes.push(`<video id="rv${k}" class="clip recorte-v" data-start="${p.de}" data-duration="${r3(p.ate - p.de)}" data-track-index="${faixaRecorte++}" src="${esc(p.arquivo)}" muted playsinline></video>`);
});
fs.writeFileSync("dados/recortes.json", JSON.stringify(pedidos, null, 2));

// ── HTML final ─────────────────────────────────────────────────────
const { sons } = M;
sons.sort((a, b) => a.t - b.t);
const audioHtml = sons.map((s, k) => `      <audio id="sfx${k}" data-start="${s.t}" data-duration="${s.dur}" data-track-index="${M.faixaSom(s.t, s.t + s.dur)}" src="assets/sons/${s.arquivo}" data-volume="${s.volume}"></audio>`).join("\n");
// o CSS do kit (kit/css/*.css, em ordem); por cima, o tema da família do estilo (estilos/_bases),
// o tema do estilo e, por fim, a fonte e o tamanho da legenda que o estilo.json definiu
const pastaCss = path.join(KIT, "css");
const arquivosCss = [
  ...fs.readdirSync(pastaCss).filter((f) => f.endsWith(".css")).sort().map((f) => path.join(pastaCss, f)),
  ...[].concat(ESTILO.tema_base ?? []).map((b) => path.join(KIT, "estilos", "_bases", `${b}.css`)),
  path.join(KIT, "estilos", estiloId, "tema.css"),
].filter((f) => fs.existsSync(f));
const cssLegenda = M.LEG.fonte && M.LEG.tamanho ? `      .grupo { ${cssFonte(M.LEG.fonte)} font-size: ${M.LEG.tamanho}px; line-height: ${M.LEG.entrelinha ?? 1.15}; }\n` : "";
const css = arquivosCss.map((f) => fs.readFileSync(f, "utf8")).join("\n") + "\n" + cssLegenda;
// GSAP: a cópia que a estação pôs na oficina (funciona sem internet); sem ela, a da CDN
const GSAP = fs.existsSync("assets/gsap.min.js") ? "assets/gsap.min.js" : "https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js";
const fundoVideo = ESTILO.layout?.fundo_video ? `<div id="fundo-video"><video id="vb" class="clip" data-start="0" data-duration="${D}" data-track-index="9" src="assets/video.mp4" muted playsinline></video></div>` : "";
// os seletores da câmera valem pro vídeo e pro recorte da pessoa (que fica por cima do texto de trás)
const tl = M.tl.join("\n").replaceAll("@INNER", "#v-inner, #r-inner").replaceAll("@ROT", "#v-rot, #r-rot").replaceAll("@FX", "#v-fx, #r-fx");
const bloco = (linhas) => (linhas.length ? linhas.join("\n") + "\n" : "");
const html = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${W}, height=${H}" />
    <title>${esc(plano.titulo ?? "Edição")}</title>
    <script src="${GSAP}"></script>
    <style>
${css}
    </style>
  </head>
  <body class="leg-${M.LEG.tipo} est-${estiloId}${camera.temPainel ? "" : " sem-painel"}${M.vivo ? " mv" : ""}">
    <div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${D}">
      <svg class="filtros" width="0" height="0" aria-hidden="true"><filter id="calor" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence id="calor-turb" type="turbulence" baseFrequency="0.002 0.014" numOctaves="2" seed="7" result="ruido" /><feDisplacementMap id="calor-map" in="SourceGraphic" in2="ruido" scale="0" xChannelSelector="R" yChannelSelector="G" /></filter></svg>
      <div id="fundo" class="void">${fundoVideo}${M.html.fundo.join("")}</div>
      <div id="cena3d"><div id="palco">
        <div id="v-wrap"><div id="v-fx"><div id="v-rot"><div id="v-inner"><video id="v" class="clip" data-start="0" data-duration="${D}" data-track-index="0" src="assets/video.mp4" muted playsinline></video></div></div></div></div>
${bloco(M.html.atras)}        <div id="r-wrap"><div id="r-fx"><div id="r-rot"><div id="r-inner">${M.html.recortes.join("")}</div></div></div></div>
${bloco(M.html.vidro)}${bloco(M.html.bordas)}      </div></div>
${M.video.temAudio === false ? "" : `      <audio id="a-voz" data-start="0" data-duration="${D}" data-track-index="1" src="assets/video.mp4" data-volume="1"></audio>\n`}      <div id="painel"><div id="painel-in"></div></div>
${bloco(M.html.sobre)}
${M.html.cenas.join("\n")}

      <div id="flash"></div>
      <div id="legendas" class="clip" data-start="0" data-duration="${D}" data-track-index="2">
        <div id="leg-pos">
${M.html.legendas.join("\n")}
        </div>
      </div>
${bloco(M.html.fixos)}
${audioHtml}
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
${tl}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
fs.writeFileSync("index.html", html);

// ── resumo pro editor conferir ─────────────────────────────────────
const fmtT = (t) => t.toFixed(2).padStart(6);
console.log(`index.html pronto · estilo ${estiloId} · ${D}s · legenda ${M.LEG.tipo} (${legenda.grupos} grupos) · ${emendas.length} emendas · ${cenas.length} cenas · ${sons.length} sons`);
console.log("\ncâmera:");
for (const tr of camera.trechos) console.log(`  ${fmtT(tr.a)} → ${fmtT(tr.b)}  ${tr.modo.padEnd(14)} escala ${tr.camA.scale}${tr.jan ? ` · janela ${tr.jan.w}×${tr.jan.h}` : ""}${tr.rot ? ` · inclina ${tr.rot}°` : ""} · legenda y=${tr.legY}`);
console.log("\ncenas:");
for (const c of cenas) console.log(`  ${fmtT(c.de)} → ${fmtT(c.ate)}  ${c.tipo}${c.material ? ` (${c.material})` : ""} [${c.zona}${c._pip ? " + pip" : ""}]${c.rotulo ? ` · ${c.rotulo}` : c.titulo ? ` · ${[].concat(c.titulo).join(" ")}` : c.texto ? ` · ${[].concat(c.texto).join(" ")}` : ""}`);
console.log(`\nmotions${ESTILO.padrao_2x1 === true ? " (2x1)" : ""}: ${sequencia.join(" ") || "nenhum"}`);
console.log(`emendas: ${emendas.map((c) => `${c.t.toFixed(2)} ${c.estilo}`).join(" · ") || "nenhuma"}`);
const contagem = {};
for (const s of sons) contagem[s.nome] = (contagem[s.nome] ?? 0) + 1;
console.log(`sons: ${Object.entries(contagem).map(([k, v]) => `${k}×${v}`).join(" · ") || "nenhum"}`);
if (pedidos.length) console.log(`recortes da pessoa: ${pedidos.map((p) => `${p.de.toFixed(2)}→${p.ate.toFixed(2)}${p.pronto ? "" : " (pendente)"}`).join(" · ")}${pendentes ? `\n  ${pendentes} pendente(s): a estação gera antes do render. No snapshot, o que fica "atrás" de você ainda aparece na frente.` : ""}`);
if (M.problemas.length) {
  console.log(`\n⚠ ${M.problemas.length} problema(s):`);
  for (const p of M.problemas) console.log(`  - ${p}`);
  process.exitCode = 2;
}
