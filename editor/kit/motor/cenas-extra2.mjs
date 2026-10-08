// Mais componentes: anotação à mão (seta, círculo, sublinhado), emoji, carimbo, tarja de nome,
// manchete, faixa de notícias, citação, visor de câmera, janela de código, ficha e gráfico de barras.

import { W, H, clamp, esc, linhasDe, marcar, r3, semMarca } from "./util.mjs";
import { cssFonte } from "./fontes.mjs";
import { abrir, fechar, registrar, selo, zonaDeCard } from "./cenas.mjs";
import { cor, papel } from "./cenas-extra.mjs";
import { caminhoCaixas } from "./legenda.mjs";

// ── anotação à mão por cima do vídeo ─────────────────────────────────────────
// forma: "seta" (de → para), "circulo" | "sublinhado" | "x" | "colchetes" (em volta de `em`).
// Coordenadas de 0 a 1 da tela. "texto" escreve um rótulo à mão perto do começo.
registrar("anotacao", {
  zona: () => "sobre",
  montar(M, c, id) {
    const px = (p) => ({ x: clamp(Number(p?.x ?? 0.5), 0, 1) * W, y: clamp(Number(p?.y ?? 0.5), 0, 1) * H });
    const forma = c.forma ?? "seta";
    const traco = Number(c.traco ?? M.ESTILO.anotacao?.traco ?? 9);
    let caminhos = [];
    let rotuloPos = null;
    if (forma === "seta") {
      const a = px(c.de_ponto ?? { x: 0.25, y: 0.3 });
      const b = px(c.para ?? { x: 0.6, y: 0.45 });
      // curva: o ponto de controle sai pro lado, pra seta fazer barriga
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const comp = Math.hypot(dx, dy) || 1;
      const curva = Number(c.curva ?? 0.22);
      const cx = mx - (dy / comp) * comp * curva;
      const cy = my + (dx / comp) * comp * curva;
      caminhos.push(`M${r3(a.x)} ${r3(a.y)} Q${r3(cx)} ${r3(cy)} ${r3(b.x)} ${r3(b.y)}`);
      // ponta: duas perninhas a partir do fim, alinhadas com a chegada da curva
      const ang = Math.atan2(b.y - cy, b.x - cx);
      const ponta = clamp(comp * 0.16, 34, 70);
      for (const s of [-1, 1]) caminhos.push(`M${r3(b.x)} ${r3(b.y)} L${r3(b.x - ponta * Math.cos(ang + s * 0.5))} ${r3(b.y - ponta * Math.sin(ang + s * 0.5))}`);
      rotuloPos = { x: a.x, y: a.y - 26 };
    } else {
      let e = c.em ?? { x: 0.3, y: 0.4, w: 0.4, h: 0.1 };
      if (e === "rosto") {
        // a caixa do rosto (do cabelo ao queixo), com uma folga
        const r = M.rostoNoPlano(c.de + 0.05);
        const larg = r.altura * 1.5;
        e = { x: r.x - larg / 2, y: r.y - 0.56 * r.altura, w: larg, h: r.altura * 1.22 };
      }
      const x = e.x * W;
      const y = e.y * H;
      const w = e.w * W;
      const h = e.h * H;
      if (forma === "circulo") {
        // elipse "de mão": começa um pouco antes e passa do ponto de fechar
        const rx = w / 2 + 18;
        const ry = h / 2 + 18;
        const ex = x + w / 2;
        const ey = y + h / 2;
        caminhos.push(`M${r3(ex - rx * 0.9)} ${r3(ey - ry * 0.45)} C${r3(ex - rx * 0.4)} ${r3(ey - ry * 1.25)} ${r3(ex + rx * 1.15)} ${r3(ey - ry * 1.1)} ${r3(ex + rx)} ${r3(ey)} C${r3(ex + rx * 0.9)} ${r3(ey + ry * 1.2)} ${r3(ex - rx * 1.1)} ${r3(ey + ry * 1.15)} ${r3(ex - rx)} ${r3(ey + ry * 0.1)} C${r3(ex - rx * 0.95)} ${r3(ey - ry * 0.8)} ${r3(ex - rx * 0.2)} ${r3(ey - ry * 1.15)} ${r3(ex + rx * 0.3)} ${r3(ey - ry * 1.05)}`);
      } else if (forma === "sublinhado") {
        const yy = y + h + 10;
        caminhos.push(`M${r3(x - 6)} ${r3(yy)} Q${r3(x + w * 0.3)} ${r3(yy - 12)} ${r3(x + w * 0.55)} ${r3(yy + 2)} T${r3(x + w + 8)} ${r3(yy - 6)}`);
        if (c.duplo) caminhos.push(`M${r3(x + w * 0.1)} ${r3(yy + 22)} Q${r3(x + w * 0.5)} ${r3(yy + 12)} ${r3(x + w * 0.9)} ${r3(yy + 24)}`);
      } else if (forma === "x") {
        caminhos.push(`M${r3(x)} ${r3(y)} L${r3(x + w)} ${r3(y + h)}`, `M${r3(x + w)} ${r3(y)} L${r3(x)} ${r3(y + h)}`);
      } else {
        // colchetes: os quatro cantos
        const q = Math.min(w, h) * 0.28;
        caminhos.push(`M${r3(x)} ${r3(y + q)} L${r3(x)} ${r3(y)} L${r3(x + q)} ${r3(y)}`, `M${r3(x + w - q)} ${r3(y)} L${r3(x + w)} ${r3(y)} L${r3(x + w)} ${r3(y + q)}`, `M${r3(x + w)} ${r3(y + h - q)} L${r3(x + w)} ${r3(y + h)} L${r3(x + w - q)} ${r3(y + h)}`, `M${r3(x + q)} ${r3(y + h)} L${r3(x)} ${r3(y + h)} L${r3(x)} ${r3(y + h - q)}`);
      }
      rotuloPos = { x: x + w / 2, y: y - 30 };
    }
    const trilhas = caminhos.map((d, k) => `<path id="${id}-a${k}" d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" />`).join("");
    const rot = c.texto ? `<div class="anot-rot" style="left:${r3(clamp((c.texto_em?.x ?? rotuloPos.x / W) * W, 60, W - 60))}px;top:${r3((c.texto_em?.y ?? rotuloPos.y / H) * H)}px"><div class="anot-texto" id="${id}-tx" style="color:${cor(c.cor, "acento")}">${esc(c.texto)}</div></div>` : "";
    M.html.cenas.push(`      <div id="${id}" class="clip anotacao" ${M.attrs(c)}><svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none" stroke="${cor(c.cor, "acento")}" stroke-width="${traco}" stroke-linecap="round" stroke-linejoin="round">${trilhas}</svg>${rot}</div>`);
    const dur = forma === "circulo" ? 0.45 : 0.3;
    caminhos.forEach((_, k) => M.add(`tl.to("#${id}-a${k}", { attr: { "stroke-dashoffset": 0 }, duration: ${k === 0 ? dur : 0.14}, ease: "power2.out" }, ${r3(c.de + 0.05 + (k === 0 ? 0 : dur + (k - 1) * 0.08))});`));
    if (c.texto) M.add(`tl.from("#${id}-tx", { scale: 0.6, opacity: 0, rotation: -6, duration: 0.26, ease: "back.out(2)" }, ${r3(c.de + 0.1)});`);
    M.somCena(c, c.som ?? "whoosh", c.de + 0.05, 0.4);
  },
});

// ── emoji solto por cima do vídeo ────────────────────────────────────────────
registrar("emoji", {
  zona: () => "sobre",
  montar(M, c, id) {
    const x = clamp(Number(c.x ?? 0.5), 0, 1) * W;
    const y = clamp(Number(c.y ?? 0.4), 0, 1) * H;
    const tam = Number(c.tamanho ?? 170);
    M.html.cenas.push(`      <div id="${id}" class="clip emoji-solto" ${M.attrs(c)} style="left:${r3(x - tam / 2)}px;top:${r3(y - tam / 2)}px;width:${tam}px;height:${tam}px;font-size:${Math.round(tam * 0.82)}px"><span id="${id}-e">${esc(c.emoji ?? "🔥")}</span></div>`);
    M.add(`tl.from("#${id}-e", { scale: 0, rotation: -25, duration: 0.3, ease: "back.out(2.6)" }, ${c.de});`);
    if (c.ate - c.de > 0.9) M.add(`tl.to("#${id}-e", { rotation: 8, duration: 0.3, ease: "power1.inOut", yoyo: true, repeat: ${Math.max(1, Math.floor((c.ate - c.de - 0.5) / 0.3) | 1)} }, ${r3(c.de + 0.3)});`);
    M.somCena(c, "pop", c.de, 0.7);
  },
});

// ── carimbo: 1 a 3 palavras num retângulo colorido, torto ────────────────────
registrar("carimbo", {
  zona: () => "sobre",
  montar(M, c, id) {
    const x = clamp(Number(c.x ?? 0.5), 0, 1) * W;
    const y = clamp(Number(c.y ?? 0.28), 0, 1) * H;
    const fonte = c.fonte ?? papel(M, "carimbo", "preta");
    const tam = M.ajustarFonte(c.texto, fonte, 820, 44, Number(c.tamanho ?? 110));
    const giro = Number(c.inclinar ?? (c.i % 2 ? 5 : -5));
    M.html.cenas.push(`      <div id="${id}" class="clip carimbo-linha" ${M.attrs(c)} style="top:${r3(y - tam * 0.8)}px;left:${r3(x - 540)}px"><div class="carimbo" id="${id}-c" style="${cssFonte(fonte)}font-size:${tam}px;background:${cor(c.cor, "acento")};color:${cor(c.tinta, "tinta")}">${esc(c.texto)}</div></div>`);
    M.add(`tl.fromTo("#${id}-c", { scale: 1.7, rotation: ${giro * 2.4}, opacity: 0 }, { scale: 1, rotation: ${giro}, opacity: 1, duration: 0.2, ease: "power3.in" }, ${c.de});`);
    M.somCena(c, c.som ?? "impacto", c.de + 0.18, 0.7);
  },
});

// ── tarja de nome (terço inferior) ───────────────────────────────────────────
registrar("tarja", {
  zona: () => "sobre",
  preparar(M, c) {
    const altura = c.cargo ? 112 : 66;
    c._y = Number.isFinite(Number(c.y)) ? Number(c.y) : (M.ESTILO.tarja?.y ?? 1300);
    // com o vídeo em tela cheia, a tarja não cobre o rosto: desce pra baixo do queixo ou sobe pra cima da cabeça
    if (!Number.isFinite(Number(c.y)) && !M.ESTILO.layout?.base) {
      const e = M.espacoLivre(c.de + 0.05);
      if (c._y < e.queixo + 10 && c._y + altura > e.topo - 10) c._y = e.abaixo >= altura + 30 ? e.queixo + 30 : Math.max(150 + (M.ESTILO.margem_topo ?? 0), e.topo - altura - 70);
    }
    c._banda = [c._y - 6, c._y + altura + 6];
  },
  montar(M, c, id) {
    const nome = c.nome ?? M.perfil.nome ?? "";
    const y = c._y;
    const lado = c.lado ?? M.ESTILO.tarja?.lado ?? "esquerda";
    M.html.cenas.push(`      <div id="${id}" class="clip tarja ${esc(lado)}" ${M.attrs(c)} style="top:${y}px"><i class="tarja-barra" id="${id}-b"></i><div class="tarja-txt"><div class="tarja-nome" id="${id}-n">${esc(nome)}</div>${c.cargo ? `<div class="tarja-cargo" id="${id}-g">${esc(c.cargo)}</div>` : ""}</div></div>`);
    if ((M.ESTILO.tarja?.entrada ?? "desliza") === "fade") {
      // só opacidade, devagar (documentário)
      M.add(`tl.from("#${id}-n", { opacity: 0, duration: 0.7, ease: "none" }, ${r3(c.de + 0.05)});`);
      if (c.cargo) M.add(`tl.from("#${id}-g", { opacity: 0, duration: 0.7, ease: "none" }, ${r3(c.de + 0.25)});`);
    } else {
      const dx = lado === "direita" ? 30 : -30;
      M.add(`tl.fromTo("#${id}-b", { scaleY: 0 }, { scaleY: 1, duration: 0.22, ease: "power2.out" }, ${c.de});`);
      M.add(`tl.from("#${id}-n", { x: ${dx}, opacity: 0, duration: 0.3, ease: "power2.out" }, ${r3(c.de + 0.12)});`);
      if (c.cargo) M.add(`tl.from("#${id}-g", { x: ${dx}, opacity: 0, duration: 0.3, ease: "power2.out" }, ${r3(c.de + 0.2)});`);
    }
    if (c.ate - c.de > 1.2 && c.ate < M.D - 0.1) M.add(`tl.to("#${id}", { opacity: 0, duration: 0.3, ease: "none" }, ${r3(c.ate - 0.3)});`);
    M.somCena(c, "click", c.de, 0.5);
  },
});

// ── manchete: o título do vídeo no alto (o desenho é do tema do estilo) ──────
// { texto: "linha 1 | linha 2 com *trecho em destaque*", emoji, sub, selo: "URGENTE",
//   usuario + comentario: o balão de "responder ao comentário" (TikTok) }
registrar("manchete", {
  zona: () => "sobre",
  preparar(M, c) {
    const cfg = M.ESTILO.manchete ?? {};
    c._y = Number.isFinite(Number(c.y)) ? Number(c.y) : (cfg.y ?? 150);
    const n = linhasDe(c.texto).length;
    const altura = (c.usuario ? 210 : 0) + n * (c.tamanho ?? cfg.tamanho ?? 64) * 1.25 + (c.sub ? 50 : 0) + (c.selo ? 60 : 0) + 50;
    // com o vídeo em tela cheia, a manchete não pode cobrir o rosto: se cair em cima dele,
    // desce pra baixo do queixo (se couber) ou sobe pro alto
    if (!Number.isFinite(Number(c.y)) && !M.ESTILO.layout?.base && cfg.cobre_rosto !== true) {
      const e = M.espacoLivre(c.de + 0.05);
      if (c._y < e.queixo + 10 && c._y + altura > e.topo - 10) c._y = e.abaixo >= altura ? e.queixo + 30 : (cfg.y_alto ?? 150);
    }
    c._banda = [c._y - 10, c._y + altura - 30];
  },
  montar(M, c, id) {
    const linhas = linhasDe(c.texto);
    const cfg = M.ESTILO.manchete ?? {};
    const fonte = c.fonte ?? cfg.fonte ?? papel(M, "manchete", "texto");
    const fontes = cfg.fontes ?? []; // uma fonte por linha (linha 1 leve, linha 2 pesada…)
    const fonteDe = (k) => (c.fonte ? fonte : (fontes[Math.min(k, fontes.length - 1)] ?? fonte));
    const tam = linhas.length ? Math.min(...linhas.map((l, k) => M.ajustarFonte(semMarca(l), fonteDe(k), cfg.largura ?? 940, 34, c.tamanho ?? cfg.tamanho ?? 64))) : 0;
    const escalas = cfg.escalas ?? [];
    const ls = linhas.map((l, k) => `<span class="man-l l${Math.min(k, 1)}" style="${cssFonte(fonteDe(k))}${escalas[k] ? `font-size:${escalas[k]}em;` : ""}">${marcar(l)}</span>`).join("");
    // o balão do TikTok: avatar, "Responder ao comentário de fulano" e o comentário em negrito
    const balao = c.usuario ? `<div class="man-balao" id="${id}-b"><span class="av letra" style="background:${cor(c.avatar_cor, "acento")}">${esc(String(c.usuario).replace(/^@/, "").slice(0, 1).toUpperCase())}</span><div><small>Responder ao comentário de ${esc(c.usuario)}</small><b>${esc(c.comentario ?? "")}</b></div></div>` : "";
    let texto = "";
    if (linhas.length && cfg.caixas) {
      // caixas conectadas (texto nativo do TikTok), uma por linha
      const cx = cfg.caixas;
      const lh = tam * (cx.entrelinha ?? 1.208);
      const { d, altura } = caminhoCaixas(linhas.map((l, k) => M.larguraEm(semMarca(l), fonteDe(k)) * tam), { lh, padX: tam * (cx.pad_x ?? 0.437), padY: tam * (cx.pad_y ?? 0.1335), raio: tam * (cx.raio ?? 0.23) });
      texto = `<div class="man-caixas" style="width:1000px;height:${altura}px"><svg class="cx-fundo" width="1000" height="${altura}" viewBox="0 0 1000 ${altura}"><path d="${d}" fill="${cor(c.cor ?? cx.cor, "acento")}" /></svg><div class="man-txt" style="font-size:${tam}px;line-height:${r3(lh)}px;padding:${r3(tam * (cx.pad_y ?? 0.1335))}px 0;color:${cor(c.tinta ?? cx.texto, "branco")}">${ls}</div></div>`;
    } else if (linhas.length) texto = `<div class="man-txt" style="font-size:${tam}px">${c.emoji ? `<span class="man-emoji">${esc(c.emoji)}</span>` : ""}${ls}</div>`;
    M.html.cenas.push(`      <div id="${id}" class="clip manchete${c.usuario ? " resposta" : ""}" ${M.attrs(c)} style="top:${c._y}px"><div class="man-in" id="${id}-in">${c.selo ? `<span class="man-selo"><i></i>${esc(c.selo)}</span>` : ""}${balao}${texto}${c.sub ? `<div class="man-sub">${esc(c.sub)}</div>` : ""}</div></div>`);
    const entrada = cfg.entrada ?? "desce";
    if (entrada === "seco") M.add(`tl.from("#${id}-in", { opacity: 0, duration: 0.05, ease: "none" }, ${c.de});`);
    else if (entrada === "fade") M.add(`tl.from("#${id}-in", { opacity: 0, duration: 0.4, ease: "none" }, ${r3(c.de + 0.02)});`);
    else if (entrada === "esquerda") M.add(`tl.from("#${id}-in", { x: -80, opacity: 0, duration: 0.4, ease: "power2.out" }, ${r3(c.de + 0.02)});`);
    else M.add(`tl.from("#${id}-in", { y: -40, opacity: 0, duration: 0.3, ease: "power3.out" }, ${r3(c.de + 0.02)});`);
    // some sozinha quando não vai até o fim do vídeo (gancho dos primeiros segundos)
    if (c.ate < M.D - 0.3 && c.ate - c.de > 1) M.add(`tl.to("#${id}-in", { opacity: 0, duration: 0.25, ease: "none" }, ${r3(c.ate - 0.25)});`);
  },
});

// ── faixa de notícias correndo (rodapé de telejornal) ────────────────────────
registrar("faixa-noticias", {
  zona: () => "sobre",
  montar(M, c, id) {
    const itens = (c.itens ?? linhasDe(c.texto)).map(String);
    const fonte = c.fonte ?? papel(M, "faixa", "condensada-media");
    const tam = 44;
    const um = itens.map((t) => `<span>${esc(t)}</span>`).join(`<i class="fn-sep"></i>`) + `<i class="fn-sep"></i>`;
    const larg = Math.ceil(itens.reduce((s, t) => s + M.larguraEm(t.toUpperCase(), fonte) * tam + 70, 0));
    const vezes = Math.ceil((W * 2) / Math.max(200, larg)) + 1;
    const y = Number.isFinite(Number(c.y)) ? Number(c.y) : (M.ESTILO.faixa?.y ?? 1500);
    M.html.cenas.push(`      <div id="${id}" class="clip faixa-noticias" ${M.attrs(c)} style="top:${y}px">${c.selo ? `<span class="fn-selo">${esc(c.selo)}</span>` : ""}<div class="fn-pista"><div class="fn-texto" id="${id}-t" style="${cssFonte(fonte)}font-size:${tam}px;width:${larg * vezes}px">${`<span class="fn-um" style="width:${larg}px">${um}</span>`.repeat(vezes)}</div></div></div>`);
    // 150 px por segundo, como nos telejornais
    const dur = r3(c.ate - c.de);
    M.add(`tl.fromTo("#${id}-t", { x: 0 }, { x: ${-Math.round((c.velocidade ?? 150) * dur)}, duration: ${dur}, ease: "none", immediateRender: false }, ${c.de});`);
    M.add(`tl.from("#${id}", { y: 80, duration: 0.3, ease: "power2.out" }, ${c.de});`);
  },
});

// ── citação em tela cheia ────────────────────────────────────────────────────
registrar("citacao", {
  pip: false,
  zona: () => "cheia",
  preparar(M, c) {
    if (c.legenda !== true) c._semLegenda = true;
  },
  montar(M, c, id) {
    const fonte = c.fonte ?? papel(M, "citacao", "serifa");
    const texto = String(c.texto ?? "");
    // quebra em linhas de até ~22 letras e ajusta o tamanho pra caber
    const palavras = texto.split(/\s+/);
    const alvo = clamp(Math.ceil(texto.length / 5), 14, 24);
    const linhas = [];
    let atual = "";
    for (const p of palavras) {
      if (atual && (atual + " " + p).length > alvo) {
        linhas.push(atual);
        atual = p;
      } else atual = atual ? `${atual} ${p}` : p;
    }
    if (atual) linhas.push(atual);
    const tam = Math.min(...linhas.map((l) => M.ajustarFonte(l, fonte, 900, 48, c.tamanho ?? 118)));
    const ls = linhas.map((l, k) => `<div class="cit-l" id="${id}-l${k}">${esc(l)}</div>`).join("");
    M.html.cenas.push(`      <div id="${id}" class="clip tela-cheia citacao" ${M.attrs(c)}><div class="tela-cheia-in void" id="${id}-in"><div class="cit-aspas" id="${id}-a">“</div><div class="cit-texto" style="${cssFonte(fonte)}font-size:${tam}px">${ls}</div>${c.autor ? `<div class="cit-autor" id="${id}-au">${esc(c.autor)}</div>` : ""}</div></div>`);
    M.add(`tl.from("#${id}-in", { opacity: 0, duration: 0.25, ease: "none" }, ${c.de});`);
    M.add(`tl.from("#${id}-a", { opacity: 0, y: 20, duration: 0.4, ease: "power2.out" }, ${r3(c.de + 0.1)});`);
    const passo = clamp((c.ate - c.de - 1) / Math.max(1, linhas.length), 0.12, 0.5);
    linhas.forEach((_, k) => M.add(`tl.from("#${id}-l${k}", { opacity: 0, y: 18, duration: 0.5, ease: "power2.out" }, ${r3(c.de + 0.25 + k * passo)});`));
    if (c.autor) M.add(`tl.from("#${id}-au", { opacity: 0, duration: 0.5, ease: "none" }, ${r3(c.de + 0.4 + linhas.length * passo)});`);
    if (c.som) M.somCena(c, c.som, c.de, 0.8);
  },
});

// ── visor de câmera (REC) por cima do vídeo: o "antes", cru, sem edição ──────
registrar("visor", {
  zona: () => "sobre",
  preparar(M, c) {
    if (c.legenda !== true) c._semLegenda = true; // o trecho "cru" não tem legenda (a edição ainda não começou)
  },
  montar(M, c, id) {
    const dur = r3(c.ate - c.de);
    M.html.cenas.push(`      <div id="${id}" class="clip visor" ${M.attrs(c)}><i class="vs-canto a"></i><i class="vs-canto b"></i><i class="vs-canto c"></i><i class="vs-canto d"></i><span class="vs-rec"><b id="${id}-p"></b>REC</span><span class="vs-tempo" id="${id}-t">00:00:00:00</span>${c.rotulo === false ? "" : `<span class="vs-rotulo">${esc(c.rotulo ?? "BRUTO · SEM EDIÇÃO")}</span>`}</div>`);
    // relógio do visor (hh:mm:ss:quadros) e o pontinho do REC piscando
    M.add(`(() => { const o = { v: 0 }; const el = document.getElementById("${id}-t"); const d2 = (n) => String(n).padStart(2, "0"); tl.to(o, { v: ${dur}, duration: ${dur}, ease: "none", onUpdate: () => { const s = Math.floor(o.v); el.textContent = "00:" + d2(Math.floor(s / 60)) + ":" + d2(s % 60) + ":" + d2(Math.floor((o.v - s) * 30)); } }, ${c.de}); })();`);
    M.add(`tl.fromTo("#${id}-p", { opacity: 1 }, { opacity: 0.15, duration: 0.5, ease: "steps(1)", yoyo: true, repeat: ${Math.max(1, Math.floor(dur / 0.5))}, immediateRender: false }, ${c.de});`);
    // o vídeo "cru": menos cor e menos contraste enquanto o visor está na tela
    if (c.cru !== false && !M.corIntocada) {
      M.add(`tl.set("#v, .recorte-v", { filter: "saturate(0.5) contrast(0.84) brightness(1.08)" }, ${c.de});`);
      M.add(`tl.set("#v, .recorte-v", { clearProps: "filter" }, ${c.ate});`);
    }
  },
});

// ── janela de código ─────────────────────────────────────────────────────────
const PALAVRAS_CHAVE = /\b(const|let|var|function|return|import|from|export|default|async|await|if|else|for|while|class|new|def|print|in|of|true|false|null|None|True|False|type|interface|public|private|static|void|try|catch|throw)\b/g;
function colorir(linha) {
  // comentário inteiro
  if (/^\s*(\/\/|#)/.test(linha)) return `<span class="cd-com">${esc(linha)}</span>`;
  let saida = "";
  // separa texto entre aspas do resto, pra não pintar palavra-chave dentro de string
  for (const parte of linha.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/)) {
    if (/^["'`]/.test(parte)) saida += `<span class="cd-str">${esc(parte)}</span>`;
    else
      saida += esc(parte)
        .replace(PALAVRAS_CHAVE, '<span class="cd-chave">$1</span>')
        .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="cd-num">$1</span>')
        .replace(/\b([A-Za-z_][\w]*)(?=\()/g, '<span class="cd-fn">$1</span>');
  }
  return saida;
}
registrar("codigo", {
  zona: zonaDeCard,
  limite: { faixa: ["linhas", 9], "faixa-baixo": ["linhas", 6], cheia: ["linhas", 16] },
  montar(M, c, id) {
    const linhas = (c.linhas ?? String(c.codigo ?? "").split("\n")).map(String);
    const destacar = new Set((c.destacar ?? []).map(Number));
    const ls = linhas.map((l, k) => `<div class="cd-linha${destacar.has(k + 1) ? " destaque" : ""}" id="${id}-t${k}"><i>${k + 1}</i><span>${colorir(l) || "&nbsp;"}</span></div>`).join("");
    // a letra enche a janela: maior quando o trecho é curto e de poucas linhas
    const maior = Math.max(...linhas.map((l) => l.length), 12);
    const [larg, alt] = c.zona === "cheia" ? [610, 700] : c.zona === "faixa-baixo" ? [820, 360] : [820, 430];
    const tam = Math.round(clamp(Math.min(larg / (maior * 0.6), alt / (linhas.length * 1.5)), 20, 46));
    M.html.cenas.push(
      `      ${abrir(M, c, id)}<div class="card codigo" id="${id}-in"><div class="janela-barra"><i style="background:#ff5e57"></i><i style="background:#ffbc30"></i><i style="background:#29c93f"></i>${c.titulo ? `<span class="rotulo">${esc(c.titulo)}</span>` : ""}</div><div class="cd-corpo" style="font-size:${tam}px">${ls}</div></div>${fechar(c)}`,
    );
    M.add(`tl.from("#${id}-in", { y: 60, opacity: 0, duration: 0.34, ease: "power3.out" }, ${r3(c.de + 0.04)});`);
    // os blocos reaparecem em ordem, como um "desfazer" (não digita letra por letra)
    const passo = clamp((c.ate - c.de - 0.8) / Math.max(1, linhas.length), 0.05, 0.3);
    linhas.forEach((_, k) => M.add(`tl.from("#${id}-t${k}", { opacity: 0, x: -14, duration: 0.14, ease: "power2.out" }, ${r3(c.de + 0.35 + k * passo)});`));
    M.somCena(c, "teclado", c.de + 0.35, 0.7);
  },
});

// ── ficha: até 4 linhas de rótulo e valor (especificações, resumo) e nota ────
registrar("ficha", {
  zona: zonaDeCard,
  limite: { faixa: ["itens", 4], "faixa-baixo": ["itens", 3], cheia: ["itens", 7] },
  montar(M, c, id) {
    const itens = c.itens ?? [];
    const ls = itens.map((it, k) => `<div class="ficha-linha" id="${id}-i${k}"><span>${esc(it.rotulo ?? "")}</span><b>${esc(it.valor ?? "")}</b></div>`).join("");
    const nota = c.nota !== undefined ? `<div class="ficha-nota" id="${id}-nt"><span>${esc(c.nota_rotulo ?? "Nota")}</span><div class="xp"><div id="${id}-xp"></div></div><b>${esc(String(c.nota))}</b></div>` : "";
    M.html.cenas.push(`      ${abrir(M, c, id)}<div class="card ficha" id="${id}-in">${c.titulo ? `<div class="ficha-titulo">${selo(M, c, `cena ${c.i}`)}<span>${esc(c.titulo)}</span></div>` : ""}${ls}${nota}</div>${fechar(c)}`);
    M.add(`tl.from("#${id}-in", { y: -40, opacity: 0, duration: 0.34, ease: "power3.out" }, ${r3(c.de + 0.04)});`);
    const passo = clamp((c.ate - c.de - 0.8) / Math.max(1, itens.length + 1), 0.15, 0.5);
    itens.forEach((it, k) => {
      const t = r3(clamp(M.tempoDe(it, c.de + 0.35 + k * passo), c.de, c.ate - 0.1));
      M.add(`tl.from("#${id}-i${k}", { opacity: 0, x: -24, duration: 0.24, ease: "power2.out" }, ${t});`);
      M.somCena(c, "click", t, 0.6);
    });
    if (c.nota !== undefined) {
      const t = r3(c.de + 0.4 + itens.length * passo);
      M.add(`tl.from("#${id}-nt", { opacity: 0, duration: 0.2, ease: "none" }, ${t});`);
      M.add(`tl.fromTo("#${id}-xp", { scaleX: 0 }, { scaleX: ${clamp(Number(c.nota) / Number(c.nota_max ?? 10), 0, 1)}, duration: 0.6, ease: "power2.out" }, ${t});`);
    }
  },
});

// ── gráfico de barras ────────────────────────────────────────────────────────
registrar("grafico", {
  zona: zonaDeCard,
  limite: { faixa: ["barras", 4], "faixa-baixo": ["barras", 3], cheia: ["barras", 7] },
  montar(M, c, id) {
    const barras = c.barras ?? [];
    const max = Number(c.maximo ?? Math.max(...barras.map((b) => Number(b.valor) || 0), 1));
    const fmt = (v) => `${c.prefixo ?? ""}${Number(v).toLocaleString("pt-BR")}${c.sufixo ?? ""}`;
    const ls = barras
      .map((b, k) => `<div class="gr-linha" id="${id}-l${k}"><span class="gr-rotulo">${esc(b.rotulo ?? "")}</span><div class="gr-trilho"><div class="gr-barra${b.destaque ? " destaque" : ""}" id="${id}-b${k}" style="width:${r3(clamp((Number(b.valor) || 0) / max, 0.02, 1) * 100)}%${b.cor ? `;background:${cor(b.cor)}` : ""}"></div></div><b class="gr-valor" id="${id}-v${k}">${esc(b.texto ?? fmt(b.valor))}</b></div>`)
      .join("");
    M.html.cenas.push(`      ${abrir(M, c, id)}<div class="card grafico" id="${id}-in">${c.rotulo ? `<div class="rotulo">${esc(c.rotulo)}</div>` : ""}${c.titulo ? `<div class="gr-titulo">${esc(c.titulo)}</div>` : ""}${ls}${c.fonte ? `<div class="gr-fonte">${esc(c.fonte)}</div>` : ""}</div>${fechar(c)}`);
    M.add(`tl.from("#${id}-in", { y: -40, opacity: 0, duration: 0.34, ease: "power3.out" }, ${r3(c.de + 0.04)});`);
    const passo = clamp((c.ate - c.de - 1) / Math.max(1, barras.length), 0.12, 0.5);
    barras.forEach((b, k) => {
      const t = r3(clamp(M.tempoDe(b, c.de + 0.35 + k * passo), c.de, c.ate - 0.2));
      M.add(`tl.from("#${id}-l${k}", { opacity: 0, duration: 0.15, ease: "none" }, ${t});`);
      M.add(`tl.fromTo("#${id}-b${k}", { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: "power3.out" }, ${t});`);
      M.add(`tl.from("#${id}-v${k}", { opacity: 0, x: -10, duration: 0.2, ease: "power2.out" }, ${r3(t + 0.4)});`);
      M.somCena(c, "tecla", t, 0.6);
    });
  },
});
