// Legenda: blocos curtos de palavras no ritmo da fala. Cada estilo de edição define a legenda dele
// em estilo.json ("legenda"): quantas palavras por bloco, em quantas linhas, caixa alta ou não, o que
// ganha destaque (a palavra, a linha ou o bloco inteiro), como a palavra falada acende, como o bloco
// entra e onde fica. A cara (fonte, tamanho, contorno) é do tema.css, na classe .leg-<tipo>.

import { clamp, dentro, esc, ler, r3 } from "./util.mjs";

const PADRAO = { max_chars: 16, max_palavras: 3, linhas: 1, caixa: "normal", acende: "cor", enfase: "palavra", entrada: "pop", posicao: "auto", acento: "#ffc93c", tinta: "#111111", clara: "#ffffff", quebra_virgula: true };
const APELIDO = { labs: "limpa" };
export const limpar = (t) => String(t ?? "").replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}%]+$/gu, "");

// palavras que pedem cor sozinhas (quando o estilo liga "cores_auto")
const DINHEIRO = /^(r\$|us\$|\$)?\d[\d.,]*(%|k|x|mil)?$|^(r\$|reais|real|milhão|milhões|bilhão|bilhões|dinheiro|grátis|gratuito|gratuita|lucro|faturamento|venda|vendas)$/i;
const NEGACAO = /^(nunca|jamais|erro|erros|errado|errada|pior|péssimo|péssima|proibido|pare|perde|perder|perdendo|golpe|mentira)$/i;

/** Escolhe o tipo de legenda (o do plano, o do pedido ou o padrão do estilo) e junta a configuração. */
export function configurarLegenda(M) {
  const base = M.ESTILO.legenda ?? {};
  const tipos = { ...(base.tipos ?? { padrao: {} }) };
  tipos.nenhuma ??= { desligada: true }; // qualquer estilo aceita "sem legenda"
  const pedido = [M.plano.legenda?.estilo, M.pedido.opcoes?.legenda].map((t) => APELIDO[t] ?? t).find((t) => t && tipos[t]);
  const tipo = pedido ?? (tipos[base.padrao] ? base.padrao : Object.keys(tipos)[0]);
  const comum = { ...base };
  delete comum.tipos;
  delete comum.padrao;
  M.LEG = { ...PADRAO, ...comum, ...tipos[tipo], tipo };
  const L = M.LEG;
  // altura reservada pro bloco (a câmera usa pra pôr a legenda em cima da cabeça sem cobrir o rosto)
  if (L.altura_bloco === undefined && L.tamanho) L.altura_bloco = Math.round(Math.max(1, L.linhas) * L.tamanho * (L.entrelinha ?? 1.15) + (L.caixas ? L.tamanho * 0.3 : 0) + 24);
  return L;
}

/**
 * A transcrição palavra a palavra, já com as correções do plano (legenda.edicoes e correcoes).
 * O índice (i) é a posição na lista de dados/palavras.json: é por ele que o letreiro e as listas
 * sincronizam com a fala.
 */
export function carregarPalavras(M) {
  const { plano } = M;
  const palavras = ler("dados/palavras.json", []).map((w, i) => ({ i, texto: String(w.text ?? w.texto ?? "").trim(), a: Number(w.start ?? w.a), b: Number(w.end ?? w.b) }));
  for (const e of plano.legenda?.edicoes ?? []) if (palavras[e.i]) palavras[e.i].texto = String(e.texto ?? "");
  for (const c of plano.legenda?.correcoes ?? [])
    for (const w of palavras) if (limpar(w.texto).toLowerCase() === String(c.de).toLowerCase()) w.texto = w.texto.replace(limpar(w.texto), c.para);
  M.palavras = palavras;
  /** O instante em que a palavra de índice i começa a ser falada (ou o tempo dado, se vier em segundos). */
  M.tempoDe = (ref, padrao) => {
    if (ref && typeof ref === "object") {
      if (Number.isFinite(Number(ref.t))) return Number(ref.t);
      if (Number.isFinite(Number(ref.i)) && palavras[Number(ref.i)]) return palavras[Number(ref.i)].a;
    }
    return padrao;
  };
  return palavras;
}

/**
 * Contorno de caixas conectadas, uma por linha, cada uma da largura do texto dela (o texto nativo
 * do TikTok): cantos de fora e de dentro arredondados. `larguras` em px; devolve o "d" de um <path>.
 */
export function caminhoCaixas(larguras, { lh, padX, padY, raio, centro = 500 }) {
  const h = larguras.map((w) => w / 2 + padX);
  // degrau menor que dois raios não cabe: as duas linhas ficam da largura da maior
  for (let volta = 0; volta < 4; volta++) for (let i = 0; i < h.length - 1; i++) if (Math.abs(h[i] - h[i + 1]) < 2 * raio) h[i] = h[i + 1] = Math.max(h[i], h[i + 1]);
  const n = h.length;
  const y = (i) => (i === 0 ? 0 : i === n ? n * lh + 2 * padY : padY + i * lh);
  let pts = [];
  for (let i = 0; i < n; i++) pts.push([centro + h[i], y(i)], [centro + h[i], y(i + 1)]);
  for (let i = n - 1; i >= 0; i--) pts.push([centro - h[i], y(i + 1)], [centro - h[i], y(i)]);
  pts = pts.filter((p, k) => {
    const q = pts[(k + 1) % pts.length];
    return Math.abs(p[0] - q[0]) > 0.01 || Math.abs(p[1] - q[1]) > 0.01;
  });
  const f = (v) => r3(v);
  const cantos = pts.map((B, k) => {
    const A = pts[(k - 1 + pts.length) % pts.length];
    const C = pts[(k + 1) % pts.length];
    const dA = Math.hypot(A[0] - B[0], A[1] - B[1]);
    const dC = Math.hypot(C[0] - B[0], C[1] - B[1]);
    const giro = (B[0] - A[0]) * (C[1] - B[1]) - (B[1] - A[1]) * (C[0] - B[0]);
    if (Math.abs(giro) < 1e-6) return { reto: true, p1: B, p2: B };
    const rr = Math.min(raio, dA / 2, dC / 2);
    return { rr, sentido: giro > 0 ? 1 : 0, p1: [B[0] + ((A[0] - B[0]) * rr) / dA, B[1] + ((A[1] - B[1]) * rr) / dA], p2: [B[0] + ((C[0] - B[0]) * rr) / dC, B[1] + ((C[1] - B[1]) * rr) / dC] };
  });
  let d = `M${f(cantos[0].p1[0])} ${f(cantos[0].p1[1])}`;
  cantos.forEach((c, k) => {
    if (k > 0) d += ` L${f(c.p1[0])} ${f(c.p1[1])}`;
    if (!c.reto) d += ` A${f(c.rr)} ${f(c.rr)} 0 0 ${c.sentido} ${f(c.p2[0])} ${f(c.p2[1])}`;
  });
  return { d: `${d} Z`, altura: r3(n * lh + 2 * padY) };
}

/** Quebra as palavras de um bloco em linhas (cada uma com até max_chars e porLinha palavras). */
function emLinhas(palavras, L, nL, porLinha, ehDest) {
  const texto = (ws) => ws.map((w) => w.texto).join(" ");
  if (nL <= 1) return [palavras];
  // a palavra de destaque cai pra uma linha só dela (a de baixo)
  if (L.dest_sozinha) {
    const d = palavras.findIndex(ehDest);
    if (d > 0) return [palavras.slice(0, d), palavras.slice(d)];
  }
  // duas linhas equilibradas quando o bloco tem palavra pra isso
  if (nL === 2 && palavras.length >= (L.equilibra_de ?? 3)) {
    let melhor = null;
    for (let s = 1; s < palavras.length; s++) {
      const a = palavras.slice(0, s);
      const b = palavras.slice(s);
      if (a.length > porLinha || b.length > porLinha || texto(a).length > L.max_chars || texto(b).length > L.max_chars) continue;
      const custo = Math.abs(texto(a).length - texto(b).length);
      if (!melhor || custo < melhor.custo) melhor = { custo, linhas: [a, b] };
    }
    if (melhor) return melhor.linhas;
  }
  const linhas = [[]];
  for (const w of palavras) {
    const atual = linhas[linhas.length - 1];
    if (atual.length && (atual.length >= porLinha || texto([...atual, w]).length > L.max_chars)) linhas.push([w]);
    else atual.push(w);
  }
  return linhas;
}

export function montarLegendas(M, camera, emendas, cenas) {
  const { plano, D, add } = M;
  const L = M.LEG;
  if (L.desligada) return { grupos: 0 };
  const validas = M.palavras.filter((w) => w.texto && Number.isFinite(w.a) && w.a < D);

  // destaques: "palavra" ou { palavra, cor } (cor = nome das cores do estilo ou #hex)
  const corNomeada = (c) => (!c ? null : String(c).startsWith("#") ? c : (L.cores?.[c] ?? null));
  const destaques = new Map();
  for (const d of plano.legenda?.destaques ?? []) {
    const o = typeof d === "string" ? { palavra: d } : d;
    for (const parte of String(o.palavra ?? "").split(/\s+/)) if (limpar(parte)) destaques.set(limpar(parte).toLowerCase(), corNomeada(o.cor));
  }
  const emojis = new Map((plano.legenda?.emojis ?? []).map((e) => [Number(e.i), String(e.emoji ?? "")]));
  const corAuto = (w) => {
    const A = L.cores_auto;
    if (!A) return null;
    const p = limpar(w.texto);
    if (A.dinheiro && DINHEIRO.test(p)) return corNomeada(A.dinheiro) ?? A.dinheiro;
    if (A.negacao && NEGACAO.test(p)) return corNomeada(A.negacao) ?? A.negacao;
    return null;
  };

  // ── blocos ──
  const nL = Math.max(1, Number(L.linhas) || 1);
  const porLinha = L.max_palavras_linha ?? (nL > 1 ? 4 : L.max_palavras);
  const porBloco = nL > 1 ? (L.max_palavras_bloco ?? nL * porLinha) : L.max_palavras;
  const cabe = (ws) => {
    if (ws.length > porBloco) return false;
    if (nL <= 1) return ws.map((x) => x.texto).join(" ").length <= L.max_chars || ws.length === 1;
    // enche as linhas na ordem: se precisar de mais linhas do que o bloco tem, não cabe
    let linhas = 1;
    let atual = [];
    for (const w of ws) {
      if (atual.length && (atual.length >= porLinha || [...atual, w].map((x) => x.texto).join(" ").length > L.max_chars)) {
        linhas++;
        atual = [w];
      } else atual.push(w);
    }
    return linhas <= nL;
  };
  const grupos = [];
  let atual = [];
  const fimDeFrase = L.quebra_virgula ? /[.,!?;:]$/ : /[.!?;:]$/;
  // bloco que ficaria menos que isso na tela não fecha na pontuação ("Tem." / "Ah," viravam um flash)
  const vidaMinima = L.vida_minima ?? 0.3;
  validas.forEach((w, k) => {
    const prox = validas[k + 1];
    if (atual.length && !cabe([...atual, w])) {
      grupos.push(atual);
      atual = [];
    }
    atual.push(w);
    const pausa = prox ? prox.a - w.b > (L.pausa ?? 0.35) : true;
    // não atravessa emenda (a emenda tem que cair depois desta palavra: palavra de tempo zero logo
    // depois do corte pertence à tomada nova)
    const quebra = emendas.some((c) => prox && c.t > w.a && c.t > w.b - 0.05 && c.t <= prox.a + 0.05);
    const flash = prox && prox.a - atual[0].a < vidaMinima;
    if (atual.length >= porBloco || pausa || quebra || (fimDeFrase.test(w.texto) && !flash)) {
      grupos.push(atual);
      atual = [];
    }
  });
  if (atual.length) grupos.push(atual);

  // ── cores e modo de acender ──
  const caixa = L.acende === "caixa";
  const semFundo = `backgroundColor: "rgba(0,0,0,0)"`;
  function cores(base) {
    return {
      base,
      on: (cor) => (caixa ? `backgroundColor: "${L.acento}", color: "${L.tinta}"` : `color: "${cor ?? L.acento}"`),
      off: (dest, cor, daLinha) => {
        const c = daLinha ?? (dest ? (cor ?? (base === L.clara ? L.acento : base)) : base);
        return caixa ? `${semFundo}, color: "${c}"` : `color: "${c}"`;
      },
    };
  }
  const NORMAL = cores(L.clara);
  const NO_CLARO = L.sobre_fundo_claro ? cores(L.sobre_fundo_claro) : null;
  const txt = (w) => (L.caixa === "alta" ? w.texto.toUpperCase() : L.caixa === "baixa" ? w.texto.toLowerCase() : w.texto);
  const larguraDe = (ws) => (L.fonte && L.tamanho ? M.larguraEm(ws.map(txt).join(" "), L.fonte) * L.tamanho : null);

  const ocultar = [...cenas.filter((c) => c._semLegenda).map((c) => [c.de, c.ate]), ...(plano.legenda?.ocultar ?? []).map(([a, b]) => [Number(a), Number(b)])];
  let mostrados = 0;
  grupos.forEach((g, gi) => {
    const a = r3(g[0].a);
    if (dentro(ocultar, a + 0.02)) return;
    const prox = grupos[gi + 1];
    // o próximo grupo sempre corta este (senão duas legendas se sobrepõem quando a fala é rápida)
    let b = r3(Math.min(prox ? prox[0].a : D, Math.max(a + 0.3, g[g.length - 1].b + (L.segura ?? 0.5))));
    const fimOculto = ocultar.find(([x]) => x > a && x < b);
    if (fimOculto) b = r3(fimOculto[0]);
    if (b - a < 0.06) return; // palavra que a transcrição deu com tempo zero: pula
    // a entrada nunca dura mais que o bloco: senão ela termina depois do "some" e o bloco volta a
    // aparecer (e fica na tela por baixo das legendas seguintes)
    const dEnt = (d) => r3(Math.min(d, Math.max(0.03, b - a - 0.02)));
    const noClaro = NO_CLARO && (dentro(camera.cheiasComLegenda, a + 0.02) || dentro(M.fundosClaros, a + 0.02));
    const C = noClaro ? NO_CLARO : NORMAL;
    const info = new Map(
      g.map((w) => {
        const chave = limpar(w.texto).toLowerCase();
        const dest = destaques.has(chave);
        return [w, { dest, cor: dest ? destaques.get(chave) : null, auto: corAuto(w) }];
      }),
    );

    // ── linhas e ênfase (a linha ou o bloco inteiro pintado, como nos cortes do Hormozi e do MrBeast) ──
    const linhas = emLinhas(g, L, nL, porLinha, (w) => info.get(w).dest);
    const corLinha = linhas.map(() => null);
    if (L.enfase === "linha" || L.enfase === "bloco") {
      const corDe = (ws) => {
        const d = ws.find((w) => info.get(w).dest);
        if (d) return info.get(d).cor ?? info.get(d).auto ?? L.acento;
        const au = ws.find((w) => info.get(w).auto);
        return au ? info.get(au).auto : null;
      };
      let alvo = linhas.findIndex((ws) => corDe(ws));
      if (alvo < 0 && L.enfase_auto && linhas.length > 1) {
        // sem destaque do plano: pinta a linha da palavra mais comprida
        const maior = linhas.map((ws) => Math.max(...ws.map((w) => limpar(w.texto).length)));
        alvo = maior.indexOf(Math.max(...maior));
      }
      if (alvo >= 0) {
        const c = noClaro && L.acento_claro ? L.acento_claro : (corDe(linhas[alvo]) ?? L.acento);
        if (L.enfase === "bloco") corLinha.fill(c);
        else corLinha[alvo] = c;
      }
    }
    const spans = (ws, li) =>
      ws
        .map((w) => {
          const { dest, cor } = info.get(w);
          const wi = g.indexOf(w);
          const marca = L.acende === "marcador" && dest ? `<i class="mk" id="g${gi}w${wi}m"></i>` : "";
          const estilo = L.enfase === "palavra" && cor ? ` style="color:${cor}"` : "";
          // a linha de ênfase pode ir em caixa alta mesmo com o resto em caixa normal
          const texto = corLinha[li] && L.enfase_caixa === "alta" ? w.texto.toUpperCase() : txt(w);
          return `<span id="g${gi}w${wi}" class="p${dest ? " dest" : ""}"${estilo}>${marca}<span class="pt">${esc(texto)}</span></span>`;
        })
        .join(" ");
    let corpo;
    let estiloGrupo = "";
    if (nL > 1 || L.caixas) {
      const maior = L.enfase_escala && L.enfase_escala !== 1;
      corpo = linhas
        .map((ws, li) => {
          const enf = corLinha[li];
          // a linha de ênfase cresce, se ainda couber na tela
          const lw = larguraDe(ws);
          const limite = L.largura_max ?? 980;
          let escala = enf && maior && L.enfase === "linha" && (lw === null ? ws.map(txt).join(" ").length <= 10 : lw * L.enfase_escala <= limite) ? L.enfase_escala : 1;
          // linha mais larga que a tela (palavra comprida em fonte grande): encolhe só ela
          if (lw !== null && lw * escala > limite) escala = Math.floor((limite / lw) * 100) / 100;
          const estilo = [enf ? `color:${enf}` : "", escala !== 1 ? `font-size:${escala}em` : ""].filter(Boolean).join(";");
          return `<span class="ln${enf ? " enf" : ""}"${estilo ? ` style="${estilo}"` : ""}>${spans(ws, li)}</span>`;
        })
        .join("");
      if (!L.caixas) corpo = `<span class="bl">${corpo}</span>`;
      if (L.caixas && L.fonte && L.tamanho) {
        const cx = L.caixas;
        const t = L.tamanho;
        const lh = t * (cx.entrelinha ?? 1.208);
        const { d, altura } = caminhoCaixas(linhas.map((ws) => larguraDe(ws)), { lh, padX: t * (cx.pad_x ?? 0.437), padY: t * (cx.pad_y ?? 0.1335), raio: t * (cx.raio ?? 0.23) });
        corpo = `<svg class="cx-fundo" width="1000" height="${altura}" viewBox="0 0 1000 ${altura}"><path d="${d}" fill="${cx.cor ?? "#000000"}" /></svg><span class="cx-linhas" style="padding:${r3(t * (cx.pad_y ?? 0.1335))}px 0;line-height:${r3(lh)}px">${corpo}</span>`;
        estiloGrupo = ` style="height:${altura}px"`;
      }
    } else {
      const enf = corLinha[0];
      const lw = larguraDe(g);
      const limite = L.largura_max ?? 980;
      const estilo = [enf ? `color:${enf}` : "", lw !== null && lw > limite ? `font-size:${Math.floor((limite / lw) * 100) / 100}em` : ""].filter(Boolean).join(";");
      corpo = `<span class="gi${enf ? " enf" : ""}"${estilo ? ` style="${estilo}"` : ""}>${spans(g, 0)}</span>`;
    }
    const emoji = g.map((w) => emojis.get(w.i)).find(Boolean);
    const emojiHtml = emoji ? `<span class="leg-emoji" id="g${gi}e">${esc(emoji)}</span>` : "";
    const classes = ["grupo", noClaro ? "no-claro" : "", L.acende === "revela" || L.acende === "acumula" ? "revela" : "", L.acende === "preenche" ? "preenche" : "", nL > 1 ? "linhas" : "", L.caixas ? "cx" : "", L.ancora === "auto" ? "pe" : "", L.alinhar === "esquerda" ? "esq" : ""].filter(Boolean).join(" ");
    if (L.alinhar === "esquerda") estiloGrupo = ` style="left:${L.x ?? 148}px;width:${1080 - (L.x ?? 148) - 40}px"`;
    M.html.legendas.push(`          <div id="g${gi}" class="${classes}"${estiloGrupo}>${L.emoji_pos === "baixo" ? "" : emojiHtml}${corpo}${L.emoji_pos === "baixo" ? emojiHtml : ""}</div>`);
    mostrados++;

    // inclinação do bloco (um lado de cada vez)
    if (L.girar) {
      const [mn, mx] = Array.isArray(L.girar) ? L.girar : [L.girar, L.girar];
      const graus = r3((mn + (((gi * 37) % 100) / 100) * (mx - mn)) * (mostrados % 2 ? -1 : 1));
      add(`tl.set("#g${gi}", { rotation: ${graus} }, 0);`);
    }

    // entrada do bloco
    if (L.entrada === "sobe") add(`tl.fromTo("#g${gi}", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: ${dEnt(0.16)}, ease: "power2.out", immediateRender: false }, ${a});`);
    else if (L.entrada === "fade") add(`tl.fromTo("#g${gi}", { opacity: 0 }, { opacity: 1, duration: ${dEnt(0.14)}, ease: "none", immediateRender: false }, ${a});`);
    else if (L.entrada === "borra") add(`tl.fromTo("#g${gi}", { opacity: 0, filter: "blur(12px)" }, { opacity: 1, filter: "blur(0px)", duration: ${dEnt(0.22)}, ease: "power2.out", immediateRender: false }, ${a});`);
    else {
      add(`tl.set("#g${gi}", { opacity: 1 }, ${a});`);
      if (L.entrada === "mola") add(`tl.from("#g${gi}", { scale: 0.8, y: 14, duration: 0.2, ease: "back.out(3.2)" }, ${a});`);
      else if (L.entrada === "zoom") add(`tl.from("#g${gi}", { scale: 1.3, duration: 0.14, ease: "power3.out" }, ${a});`);
      else if (L.entrada !== "seco") add(`tl.from("#g${gi}", { scale: 0.8, duration: 0.12, ease: "back.out(2.4)" }, ${a});`);
    }
    if (emoji) add(`tl.from("#g${gi}e", { scale: 0, rotation: -18, duration: 0.24, ease: "back.out(3)" }, ${r3(a + 0.03)});`);

    // a palavra falada
    g.forEach((w, wi) => {
      const { dest, cor } = info.get(w);
      const daLinha = corLinha[linhas.findIndex((ws) => ws.includes(w))];
      const wa = r3(clamp(w.a, a, b));
      const wb = r3(clamp(g[wi + 1] ? g[wi + 1].a : b, wa, b));
      const sel = `"#g${gi}w${wi}"`;
      if (L.acende === "cor" || caixa) {
        add(`tl.set(${sel}, { ${C.on(cor)} }, ${wa});`);
        add(`tl.fromTo(${sel}, { scale: 1.18 }, { scale: 1, duration: 0.14, ease: "power2.out", immediateRender: false }, ${wa});`);
        if (wb > wa) add(`tl.set(${sel}, { ${C.off(dest, cor, daLinha)} }, ${wb});`);
      } else if (L.acende === "escala") {
        add(`tl.fromTo(${sel}, { scale: 1 }, { scale: ${L.escala ?? 1.14}, duration: 0.1, ease: "power2.out", immediateRender: false }, ${wa});`);
        if (wb > wa) add(`tl.to(${sel}, { scale: 1, duration: 0.12, ease: "power2.inOut" }, ${wb});`);
      } else if (L.acende === "revela") {
        add(`tl.fromTo(${sel}, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.14, ease: "power2.out", immediateRender: false }, ${wa});`);
      } else if (L.acende === "acumula") {
        // as palavras vão se somando na linha, cada uma estoura de uma vez
        add(`tl.set(${sel}, { opacity: 1 }, ${wa});`);
      } else if (L.acende === "peso") {
        // a palavra falada engrossa (de leve pra pesada) e volta
        add(`tl.set(${sel}, { fontWeight: ${L.peso_forte ?? 800} }, ${wa});`);
        if (wb > wa) add(`tl.set(${sel}, { fontWeight: ${L.peso_leve ?? 300} }, ${wb});`);
      } else if (L.acende === "preenche") {
        // karaokê: a palavra fica apagada até ser falada e continua acesa
        add(`tl.set(${sel}, { color: "${daLinha ?? (dest ? (cor ?? L.acento) : C.base)}", opacity: 1 }, ${wa});`);
      } else if (L.acende === "marcador" && dest) {
        // marca-texto: a tinta passa atrás da palavra na hora em que ela é falada, e fica
        add(`tl.fromTo("#g${gi}w${wi}m", { scaleX: 0 }, { scaleX: 1, duration: 0.22, ease: "power2.out" }, ${wa});`);
        add(`tl.set(${sel}, { color: "${L.tinta}" }, ${r3(wa + 0.08)});`);
      }
    });
    add(`tl.set("#g${gi}", { opacity: 0 }, ${b});`);
  });
  return { grupos: mostrados };
}
