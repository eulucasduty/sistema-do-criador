// O contexto de uma montagem: tudo que os módulos compartilham (dados da oficina, estilo,
// linha do tempo, sons, ícones, medidas de fonte e os pedaços de HTML).

import fs from "node:fs";
import path from "node:path";
import { W, H, alocador, clamp, corDe, dimensoes, esc, ler, primeiraLetra, r3 } from "./util.mjs";
import { FONTES } from "./fontes.mjs";

// volume de cada função em cima do arquivo nivelado (o mixador abaixa tudo se os efeitos estourarem)
const VOL_FUNCAO = { obturador: 0.75, ding: 0.42, teclado: 0.42, tecla: 0.38, whoosh: 0.5, riser: 0.42, pop: 0.38, click: 0.46, impacto: 0.6, notificacao: 0.47 };
const APELIDOS = { typing: "teclado", keyboard: "teclado", swoosh: "whoosh", sparkle: "brilho", impact: "impacto", notification: "notificacao", shutter: "obturador", chime: "ding", ping: "ding-curto", "impacto-2": "impacto-longo" };

/** Junta dois objetos de configuração: o segundo vale por cima, campo a campo (listas são trocadas inteiras). */
function fundir(a, b) {
  if (!a || typeof a !== "object" || Array.isArray(a) || !b || typeof b !== "object" || Array.isArray(b)) return b === undefined ? a : b;
  const r = { ...a };
  for (const [k, v] of Object.entries(b)) r[k] = k in a ? fundir(a[k], v) : v;
  return r;
}

export function criarContexto(KIT) {
  const video = ler("dados/video.json", null);
  if (!video) throw new Error("dados/video.json não existe (a estação cria)");
  const plano = ler("plano.json", null);
  if (!plano) throw new Error("plano.json não existe");
  const pedido = ler("dados/pedido.json", {}) ?? {};
  const perfil = ler("dados/perfil.json", {}) ?? {};
  const D = r3(video.duracao);

  const problemas = [];
  const avisar = (m) => problemas.push(m);

  // ── estilo de edição (sem pedido, o que tiver "padrao": true no estilo.json) ──
  const pastaEstilos = path.join(KIT, "estilos");
  const todos = fs.readdirSync(pastaEstilos).filter((d) => !d.startsWith("_") && fs.existsSync(path.join(pastaEstilos, d, "estilo.json"))).sort();
  const ESTILO_PADRAO = todos.find((d) => ler(path.join(pastaEstilos, d, "estilo.json"), {}).padrao === true) ?? todos[0];
  let estiloId = String(plano.estilo ?? pedido.opcoes?.estilo ?? ESTILO_PADRAO);
  if (!fs.existsSync(path.join(KIT, "estilos", estiloId, "estilo.json"))) {
    avisar(`estilo de edição desconhecido: ${estiloId} (usando ${ESTILO_PADRAO})`);
    estiloId = ESTILO_PADRAO;
  }
  // o estilo pode herdar de uma família (estilos/_bases/<base>.json): o que ele escreve vale por cima
  let ESTILO = ler(path.join(KIT, "estilos", estiloId, "estilo.json"), {});
  if (ESTILO.base) {
    const base = ler(path.join(KIT, "estilos", "_bases", `${ESTILO.base}.json`), null);
    if (!base) avisar(`o estilo ${estiloId} pede a base "${ESTILO.base}", que não existe em estilos/_bases`);
    else ESTILO = fundir(base, ESTILO);
  }

  // ── caixa do texto: o tema decide em CSS (--cab-caixa no cabeçalho, --let-caixa no letreiro);
  //    o montador lê de lá pra medir o texto do jeito que ele vai aparecer ──
  const lerTexto = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
  const temaCss = `${ESTILO.tema_base ? lerTexto(path.join(KIT, "estilos", "_bases", `${ESTILO.tema_base}.css`)) : ""}\n${lerTexto(path.join(KIT, "estilos", estiloId, "tema.css"))}`;
  function naCaixa(texto, variavel, padrao = "uppercase") {
    const achados = [...temaCss.matchAll(new RegExp(`--${variavel}:\\s*([a-z]+)`, "g"))];
    const caixa = achados.length ? achados[achados.length - 1][1] : padrao;
    return caixa === "uppercase" ? String(texto).toUpperCase() : caixa === "lowercase" ? String(texto).toLowerCase() : String(texto);
  }

  // ── linha do tempo (JS gerado) ──
  const tl = [];
  const add = (linha) => tl.push("      " + linha);

  // ── materiais que o criador subiu ──
  const materiais = Object.fromEntries(ler("dados/materiais.json", []).map((m) => [m.id, m]));
  function arquivoOk(arq, onde) {
    if (!arq) return false;
    if (!fs.existsSync(arq)) {
      avisar(`${onde}: arquivo não existe (${arq})`);
      return false;
    }
    return true;
  }
  /** Imagem ou vídeo de uma cena: { material: "m1" } ou { arquivo: "prints/x.png" } → {tipo, arquivo, w, h, duracao} */
  function midia(ref, onde) {
    if (!ref) return null;
    let m;
    if (ref.material) {
      m = materiais[ref.material];
      if (!m) return avisar(`${onde}: material "${ref.material}" não existe (veja dados/materiais.json)`), null;
      if (!m.arquivo) return avisar(`${onde}: o material ${ref.material} não tem arquivo (${m.erro ?? "falhou na preparação"})`), null;
    } else if (ref.arquivo) {
      m = { tipo: /\.(mp4|mov|webm|m4v)$/i.test(ref.arquivo) ? "video" : "imagem", arquivo: ref.arquivo };
    } else return null;
    if (!arquivoOk(m.arquivo, onde)) return null;
    const dim = m.largura && m.altura ? { w: m.largura, h: m.altura } : dimensoes(m.arquivo);
    if (!dim) return avisar(`${onde}: não consegui ler o tamanho de ${m.arquivo}`), null;
    return { tipo: m.tipo === "video" ? "video" : "imagem", arquivo: m.arquivo, w: dim.w, h: dim.h, duracao: m.duracao };
  }

  // ── perfil do criador: o @ e a foto do CTA, da resposta nos comentários e do chat ──
  const arroba = String(perfil.usuario ?? "").replace(/^@+/, "").trim();
  const temFoto = fs.existsSync("assets/perfil.jpg");
  function avatarPerfil(classe = "") {
    const mais = classe ? ` ${classe}` : "";
    if (temFoto) return `<img class="av${mais}" src="assets/perfil.jpg" alt="" />`;
    const quem = perfil.nome || arroba || "?";
    return `<span class="av letra${mais}" style="background:${corDe(quem)}">${esc(primeiraLetra(quem))}</span>`;
  }

  // ── sons: a biblioteca do criador (dados/sons.json, a estação baixa do painel) ou, sem ela, o
  //    catálogo do kit (assets/sons/sons.json). Todo arquivo vem nivelado (pico -3 dB). Cada som
  //    tem nome próprio; o nome da FUNÇÃO (obturador, ding, teclado…) toca o principal dela. ──
  const catalogoKit = ler("assets/sons/sons.json", []);
  const biblioteca = ler("dados/sons.json", null);
  const SONS = {};
  const porFuncao = {};
  for (const s of [...catalogoKit, ...(biblioteca ?? [])]) {
    SONS[s.nome] = [s.arquivo, Number(s.duracao) || 1, (VOL_FUNCAO[s.funcao] ?? 0.4) * (Number(s.volume) || 1), s.funcao ?? null];
    if (s.funcao) (porFuncao[s.funcao] ??= []).push(s);
  }
  for (const [funcao, lista] of Object.entries(porFuncao)) {
    const escolhido = (biblioteca ?? []).find((s) => s.funcao === funcao && s.principal) ?? lista.find((s) => s.principal) ?? lista[0];
    SONS[funcao] = SONS[escolhido.nome];
  }
  /** Nome que não existe ("ding-curto" numa biblioteca sem ele) cai no principal da função. */
  function resolverSom(nome) {
    nome = APELIDOS[nome] ?? nome;
    if (SONS[nome]) return nome;
    const funcao = String(nome ?? "").split("-")[0];
    return VOL_FUNCAO[funcao] !== undefined && SONS[funcao] ? funcao : null;
  }
  const cfgSons = ESTILO.sons ?? {};
  const volumeEstilo = Number(cfgSons.volume ?? 1);
  const sons = [];
  function som(pedidoSom, t, volume) {
    const nome = resolverSom(pedidoSom);
    if (!nome) return avisar(`som desconhecido: ${APELIDOS[pedidoSom] ?? pedidoSom}`);
    const s = SONS[nome];
    if (!(t >= 0) || t >= D - 0.05) return;
    sons.push({ nome, arquivo: s[0], t: r3(t), dur: r3(Math.min(s[1], D - t)), volume: r3(clamp((volume ?? 1) * s[2] * volumeEstilo, 0, 1)) });
  }
  /**
   * Som automático de um componente. O estilo pode desligar todos ("automaticos": false) ou
   * deixar só alguns ("automaticos": ["pop", "click"]); a cena desliga os dela com "sons": false.
   */
  function somCena(c, nome, t, vol) {
    if (c?.sons === false) return;
    const auto = cfgSons.automaticos;
    if (auto === false) return;
    if (Array.isArray(auto)) {
      const resolvido = resolverSom(nome);
      const funcao = resolvido ? (SONS[resolvido][3] ?? resolvido) : nome;
      if (!auto.includes(funcao) && !auto.includes(nome)) return;
    }
    som(nome, t, vol);
  }
  const duracaoSom = (nome) => {
    const n = resolverSom(nome);
    return n ? SONS[n][1] : null;
  };

  // ── ícones (Lucide, ISC): kit/icones/icones.json ──
  let ICONES = null;
  const iconesVivos = ESTILO.icones?.desenha === true;
  /** opcoes.id: o ícone ganha id e, nos estilos de ícone animado, pode ser desenhado com desenharIcone. */
  function icone(nome, classe = "ic", opcoes = {}) {
    ICONES ??= ler(path.join(KIT, "icones", "icones.json"), {});
    let dentro = ICONES[String(nome ?? "").trim()];
    if (!dentro) {
      if (nome) avisar(`ícone desconhecido: ${nome} (veja kit/icones/nomes.txt)`);
      dentro = ICONES["circle"] ?? '<circle cx="12" cy="12" r="10"/>';
    }
    const vivo = opcoes.id && (iconesVivos || opcoes.desenha);
    if (vivo) dentro = dentro.replace(/<(path|circle|rect|line|polyline|polygon|ellipse)\b/g, '<$1 pathLength="1"');
    return `<svg class="${classe}${vivo ? " desenha" : ""}"${opcoes.id ? ` id="${opcoes.id}"` : ""} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${opcoes.traco ?? ESTILO.icones?.traco ?? 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${dentro}</svg>`;
  }
  /** O traço do ícone se desenha (só nos estilos com "icones": { "desenha": true }, ou se forçar). */
  function desenharIcone(id, t, dur = 0.55, forcar = false) {
    if (!iconesVivos && !forcar) return;
    add(`tl.fromTo("#${id} > *", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: ${dur}, stagger: 0.08, ease: "power2.inOut" }, ${r3(t)});`);
  }

  // ── medidas de fonte (kit/fontes/metricas.json): largura de um texto, em "em" ──
  const METRICAS = ler(path.join(KIT, "fontes", "metricas.json"), {});
  function larguraEm(texto, papel) {
    const f = FONTES[papel] ?? FONTES.texto;
    const m = METRICAS[f.metrica];
    const padrao = m?.padrao ?? f.media ?? 0.6;
    let total = 0;
    for (const ch of String(texto)) total += m?.glifos?.[ch] ?? (ch === " " ? (m?.glifos?.[" "] ?? 0.28) : padrao);
    return total + Math.max(0, [...String(texto)].length - 1) * (f.espaco ?? 0);
  }
  /** Maior tamanho de fonte (px) em que o texto cabe em `largura`, entre min e max. */
  function ajustarFonte(texto, papel, largura, min, max) {
    const em = larguraEm(texto, papel) || 1;
    return Math.round(clamp(largura / em, min, max));
  }

  // ── o rosto no plano (antes de montar a câmera): pra decidir onde cabe o que vai por cima ──
  const ALT_ROSTO = 0.4;
  function rostoNoPlano(t) {
    const base = { x: 0.5, y: 0.5, altura: ALT_ROSTO, ...(plano.rosto ?? {}) };
    const r = (plano.rostos ?? []).find((x) => t >= Number(x.de) && t < Number(x.ate));
    return { ...base, ...(r ?? {}) };
  }
  /** Espaço livre por cima do vídeo no instante t (tela cheia, sem zoom): acima da cabeça e abaixo do queixo, em px. */
  function espacoLivre(t) {
    const r = rostoNoPlano(t);
    const topo = Math.round((r.y - 0.525 * r.altura) * H);
    const queixo = Math.round((r.y + 0.625 * r.altura) * H);
    return { topo, queixo, acima: Math.max(0, topo - 120), abaixo: Math.max(0, 1560 - queixo - 30) };
  }

  const faixaCena = alocador(10);
  const faixaSom = alocador(80);
  const attrs = (c) => `data-start="${c.de}" data-duration="${r3(c.ate - c.de)}" data-track-index="${faixaCena(c.de, c.ate)}"`;

  return {
    KIT, W, H, D, video, plano, pedido, perfil, arroba,
    ESTILO, estiloId,
    problemas, avisar,
    tl, add,
    materiais, arquivoOk, midia, avatarPerfil,
    sons, som, somCena, resolverSom, duracaoSom,
    icone, desenharIcone, larguraEm, ajustarFonte, naCaixa, rostoNoPlano, espacoLivre,
    faixaCena, faixaSom, attrs,
    // pedaços de HTML, na ordem em que entram no documento
    html: { fundo: [], palco: [], atras: [], recortes: [], vidro: [], bordas: [], cenas: [], sobre: [], legendas: [], fixos: [] },
    // trechos do vídeo que precisam do recorte da pessoa (a estação gera antes do render)
    recortes: [],
    // trechos em que o topo/base do vídeo escurece pra dar leitura a um texto: [de, ate, "topo"|"base"]
    escurecer: [],
    // trechos em que o fundo atrás da legenda é claro (cenário xadrez ou de cor clara): [de, ate]
    fundosClaros: [],
  };
}
