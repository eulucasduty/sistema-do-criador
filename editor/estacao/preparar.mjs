// Preparação da oficina de uma edição, no PC do criador (a estação).
// Vídeo bruto → look de cor + SDR + 30 fps + voz nivelada, emendas das tomadas,
// transcrição palavra a palavra, folhas de quadros pra IA "ver" o vídeo, materiais, perfil e o
// kit do estilo de edição escolhido.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FERRAMENTAS, GSAP_LOCAL, fonteDrawtext } from "./ferramentas.mjs";

export { FERRAMENTAS };
const AQUI = path.dirname(fileURLToPath(import.meta.url));
export const KIT = path.join(AQUI, "..", "kit");

// Looks de cor (perfil.cor no painel ou opcoes.cor no pedido). Entram depois do HDR → SDR.
//  - natural: só a conversão do HDR do iPhone e uma nitidez leve (fica como a câmera gravou)
//  - quente: contraste suave (curva em S leve) e meios-tons um tico mais quentes, com a
//    luminosidade preservada. Sutil de propósito: a pele não pode puxar pro laranja (medido
//    em amostras de pele clara, média e escura: o tom muda no máximo 2°, cinza fica neutro)
//  - contraste: curvas calibradas a partir de uma edição real no CapCut (brilho -10, iluminação -5,
//    nitidez, "Aprimorar"), medidas contra o mesmo bruto do iPhone depois do HDR → SDR
//    (47 quadros casados, casamento de histograma por canal): mais escuro, mais contraste,
//    rosto mais quente. Depois, a nitidez.
const CURVAS_CONTRASTE =
  "curves=r='0/0 0.063/0.004 0.125/0.039 0.188/0.079 0.251/0.105 0.376/0.15 0.502/0.214 0.627/0.308 0.753/0.535 0.878/0.725 1/1'" +
  ":g='0/0 0.063/0 0.125/0.024 0.188/0.051 0.251/0.073 0.376/0.151 0.502/0.317 0.627/0.486 0.753/0.683 0.878/0.823 1/1'" +
  ":b='0/0 0.063/0 0.125/0.018 0.188/0.043 0.251/0.075 0.376/0.186 0.502/0.342 0.627/0.511 0.753/0.679 0.878/0.835 1/1'";
const CURVAS_QUENTE =
  "curves=master='0/0 0.06/0.05 0.25/0.24 0.5/0.5 0.75/0.76 0.94/0.945 1/1'," +
  "colorbalance=rm=0.014:bm=-0.016:rh=0.006:bh=-0.01:pl=1";
export const LOOKS = {
  natural: "unsharp=5:5:0.5:5:5:0",
  quente: `${CURVAS_QUENTE},unsharp=5:5:0.6:5:5:0`,
  contraste: `${CURVAS_CONTRASTE},unsharp=5:5:0.8:5:5:0`,
};
// Nomes antigos (pedidos e perfis de antes da troca) continuam valendo na leitura
const ANTIGOS = { duty: "contraste", labs: "limpa" };
const atual = (n) => {
  const s = String(n ?? "").trim().toLowerCase();
  return ANTIGOS[s] ?? s;
};
/** Filtro de cor do look (natural, quente, contraste). Nome desconhecido ou vazio → natural. */
export function corDoLook(nome) {
  return LOOKS[atual(nome)] ?? LOOKS.natural;
}
/** O primeiro nome de look válido da lista (o do pedido, depois o do perfil); senão natural. */
export const lookValido = (...nomes) => nomes.map(atual).find((n) => LOOKS[n]) ?? "natural";
/**
 * O primeiro tipo de legenda pedido (o do pedido, depois o do perfil) com nome válido; senão null
 * (vale a legenda padrão do estilo de edição). Se o estilo não tiver esse tipo, o montador também
 * cai na padrão dele.
 */
export const legendaValida = (...nomes) => nomes.map(atual).find((n) => /^[a-z0-9-]{1,40}$/.test(n)) ?? null;
// iPhone grava em HDR (HLG): sem isso o vídeo fica lavado
// HDR do iPhone → vídeo comum, na conversão neutra (BT.2408): o branco de referência do HDR (203 nits)
// vira o branco do vídeo e só as luzes fortes são comprimidas, então pele e parede ficam com o brilho
// que a pessoa gravou (a antiga, hable com 100 nits, escurecia o rosto ~12%).
const TOM_HDR = "zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=mobius:param=0.6:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p";
const FONTE = fonteDrawtext(); // "fontfile='…':" ou "" (aí o ffmpeg usa a fonte padrão)
const r2 = (n) => Math.round(n * 100) / 100;

export function rodar(cmd, args, { cwd, timeoutMs = 30 * 60_000, env, binario = false, entrada } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: env ?? process.env, windowsHide: true });
    const partes = [];
    let tamanho = 0;
    let erro = "";
    p.stdout.on("data", (d) => {
      partes.push(d);
      tamanho += d.length;
    });
    p.stderr.on("data", (d) => {
      erro += d;
      if (erro.length > 400_000) erro = erro.slice(-200_000);
    });
    if (entrada !== undefined) p.stdin.end(entrada);
    const relogio = setTimeout(() => {
      p.kill();
      reject(new Error(`${path.basename(cmd)} passou de ${Math.round(timeoutMs / 60_000)} min`));
    }, timeoutMs);
    p.on("error", (e) => {
      clearTimeout(relogio);
      reject(e);
    });
    p.on("close", (codigo) => {
      clearTimeout(relogio);
      const saida = Buffer.concat(partes, tamanho);
      if (codigo === 0) resolve({ saida: binario ? saida : saida.toString("utf8"), erro });
      else reject(Object.assign(new Error(`${path.basename(cmd)} saiu com código ${codigo}: ${erro.slice(-1500)}`), { saida: saida.toString("utf8"), erro }));
    });
  });
}

export async function sondar(arquivo) {
  const { saida } = await rodar(FERRAMENTAS.ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", arquivo]);
  const j = JSON.parse(saida);
  const v = (j.streams ?? []).find((s) => s.codec_type === "video");
  const a = (j.streams ?? []).find((s) => s.codec_type === "audio");
  const rot = Number(v?.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? v?.tags?.rotate ?? 0);
  let largura = v?.width;
  let altura = v?.height;
  if (Math.abs(rot) % 180 === 90) [largura, altura] = [altura, largura];
  return { duracao: Number(j.format?.duration ?? v?.duration ?? 0), largura, altura, codec: v?.codec_name, transfer: v?.color_transfer, temAudio: !!a, formato: j.format?.format_name ?? "" };
}

/** O bruto → assets/video.mp4 no padrão do kit (1080×1920, 30 fps, SDR, look de cor, voz em -14 LUFS). */
export async function tratarVideo(entrada, saida, { cor = LOOKS.natural } = {}) {
  const info = await sondar(entrada);
  if (!info.largura) throw new Error("o arquivo do vídeo principal não tem imagem");
  const hdr = ["arib-std-b67", "smpte2084"].includes(info.transfer);
  const vf = ["fps=30", hdr ? TOM_HDR : null, "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos", "crop=1080:1920", cor || null, "format=yuv420p"].filter(Boolean).join(",");
  const args = ["-y", "-v", "error", "-i", entrada, "-map", "0:v:0", "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart"];
  if (info.temAudio) args.push("-map", "0:a:0", "-af", "highpass=f=70,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000", "-c:a", "aac", "-b:a", "192k");
  else args.push("-an");
  args.push(saida);
  await rodar(FERRAMENTAS.ffmpeg, args, { timeoutMs: 60 * 60_000 });
  const tratado = await sondar(saida);
  return { ...tratado, hdr, original: info };
}

/**
 * Emendas das tomadas: o vídeo do criador costuma ser uma junção de vários takes. Na emenda, o
 * fundo (parte de cima do quadro) muda de uma vez só, num quadro, com os vizinhos parados: a
 * câmera mexeu ou a exposição do celular recomeçou. Com câmera parada, uma troca de luz do
 * ambiente (LED, janela) dá o mesmo sinal, então sai uma lista de CANDIDATAS: as fortes (a imagem inteira mudou) são certas, as
 * fracas o Claude confirma olhando `dados/emendas.jpg` (antes | depois).
 */
export async function detectarCortes(video, fps = 30) {
  const w = 96;
  const h = 48;
  const { saida } = await rodar(FERRAMENTAS.ffmpeg, ["-v", "error", "-i", video, "-vf", `crop=iw:ih*0.3:0:0,scale=${w}:${h},format=gray`, "-f", "rawvideo", "-"], { binario: true, timeoutMs: 20 * 60_000 });
  const n = Math.floor(saida.length / (w * h));
  const px = w * h;
  const normal = [];
  for (let i = 0; i < n; i++) {
    const f = new Float64Array(px);
    let m = 0;
    for (let k = 0; k < px; k++) m += f[k] = saida[i * px + k];
    m /= px;
    let v = 0;
    for (let k = 0; k < px; k++) v += (f[k] -= m) ** 2;
    v = Math.sqrt(v) || 1;
    for (let k = 0; k < px; k++) f[k] /= v;
    normal.push(f);
  }
  const abs = new Float64Array(n); // mudança de brilho
  const est = new Float64Array(n); // mudança de estrutura (1 - correlação), ignora brilho
  for (let i = 1; i < n; i++) {
    let s = 0;
    let c = 0;
    for (let k = 0; k < px; k++) {
      s += Math.abs(saida[i * px + k] - saida[(i - 1) * px + k]);
      c += normal[i][k] * normal[i - 1][k];
    }
    abs[i] = s / px;
    est[i] = (1 - c) * 100;
  }
  const candidatas = [];
  for (let i = 2; i < n - 1; i++) {
    const viz = Math.max(abs[i - 1], abs[i + 1]);
    const forte = (est[i] > 20 && Math.max(est[i - 1], est[i + 1]) < est[i] * 0.3) || (abs[i] > 12 && viz < abs[i] * 0.3);
    if (forte || (abs[i] > 5 && viz < 3)) candidatas.push({ t: r2(i / fps), forca: forte ? "forte" : "fraca" });
  }
  const unicas = [];
  for (const c of candidatas) {
    const u = unicas[unicas.length - 1];
    if (u && c.t - u.t <= 0.25) {
      if (c.forca === "forte") u.forca = "forte";
    } else unicas.push(c);
  }
  return unicas;
}

/**
 * Cada emenda candidata: o quadro antes e o depois, recortados no rosto, lado a lado
 * (4 candidatas por imagem: dados/emendas-1.jpg, -2…). Devolve os nomes das folhas.
 */
export async function folhaDeEmendas(video, pastaDados, candidatas, fps = 30) {
  const folhas = [];
  for (let k = 0; k < candidatas.length; k += 4) {
    const grupo = candidatas.slice(k, k + 4);
    const idx = grupo.flatMap((c) => [Math.round(c.t * fps) - 2, Math.round(c.t * fps) + 1]);
    const expr = idx.map((i) => `eq(n\\,${i})`).join("+");
    const nome = `emendas-${folhas.length + 1}.jpg`;
    const vf = `select='${expr}',crop=iw*0.8:ih*0.6:iw*0.1:ih*0.18,scale=300:-2,drawtext=${FONTE}text='%{pts\\:hms}':x=6:y=6:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4,tile=4x${Math.ceil(grupo.length / 2)}:padding=8:margin=6:color=0x333333`;
    await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", video, "-vf", vf, "-fps_mode", "vfr", "-frames:v", "1", "-q:v", "3", path.join(pastaDados, nome)]);
    folhas.push(nome);
  }
  return folhas;
}

/** Transcrição local (whisper.cpp), palavra a palavra. Não gasta API. */
export async function transcrever(video, pasta) {
  const wav = path.join(pasta, "voz16k.wav");
  await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
  const modelo = FERRAMENTAS.modelos.find((m) => fs.existsSync(m));
  if (!modelo) throw new Error("modelo do whisper não encontrado (baixe o ggml-large-v3-turbo-q5_0.bin ou aponte WHISPER_MODEL no .env.local)");
  const base = path.join(pasta, "whisper");
  const threads = String(Math.max(4, Math.min(12, os.cpus().length - 2)));
  await rodar(FERRAMENTAS.whisper, ["-m", modelo, "-f", wav, "-l", "pt", "-ml", "1", "-sow", "-oj", "-of", base, "-t", threads, "-np"], { timeoutMs: 30 * 60_000 });
  const j = JSON.parse(fs.readFileSync(`${base}.json`, "utf8"));
  const palavras = [];
  for (const s of j.transcription ?? []) {
    const bruto = String(s.text ?? "");
    const texto = bruto.trim();
    if (!texto || /^\[.*\]$|^\(.*\)$/.test(texto)) continue;
    const a = s.offsets.from / 1000;
    const b = s.offsets.to / 1000;
    const ult = palavras[palavras.length - 1];
    // pedaço sem espaço na frente continua a palavra anterior ("Many" + "Chat", "mês" + ",")
    if (ult && !bruto.startsWith(" ")) {
      ult.text += texto;
      ult.end = b;
      continue;
    }
    palavras.push({ text: texto, start: a, end: b });
  }
  fs.rmSync(wav, { force: true });
  return { palavras, modelo: path.basename(modelo) };
}

/** Transcrição legível: uma linha por frase curta, com o tempo e o índice da 1ª palavra. */
export function transcricaoTexto(palavras, cortes = []) {
  const linhas = [];
  let atual = [];
  const fecha = () => {
    if (!atual.length) return;
    linhas.push(`[${atual[0].w.start.toFixed(2)}–${atual[atual.length - 1].w.end.toFixed(2)}] (#${atual[0].i}) ${atual.map((x) => x.w.text).join(" ")}`);
    atual = [];
  };
  palavras.forEach((w, i) => {
    const corte = cortes.find((c) => atual.length && c > atual[atual.length - 1].w.end - 0.05 && c <= w.start + 0.05);
    if (corte !== undefined) {
      fecha();
      linhas.push(`--- emenda em ${corte.toFixed(2)} ---`);
    }
    atual.push({ w, i });
    const prox = palavras[i + 1];
    if (/[.!?]$/.test(w.text) || (prox && prox.start - w.end > 0.6) || atual.length >= 14) fecha();
  });
  fecha();
  return linhas.join("\n");
}

/** Folha de quadros do vídeo inteiro (a cada ~1,5 s) com o tempo em cada quadro. */
export async function folhaDeQuadros(video, saida, duracao, { colunas = 8, maximo = 40, largura = 200 } = {}) {
  const passo = Math.max(0.75, duracao / maximo);
  const n = Math.max(1, Math.ceil(duracao / passo));
  const linhas = Math.ceil(n / colunas);
  const vf = `fps=1/${passo.toFixed(3)},scale=${largura}:-2,drawtext=${FONTE}text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4,tile=${colunas}x${linhas}:padding=4:color=black`;
  await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", video, "-vf", vf, "-frames:v", "1", "-q:v", "3", saida]);
}

/** Um quadro do meio de cada tomada, com grade de 10% (pro Claude medir onde está o rosto). */
export async function folhaDeTomadas(video, saida, duracao, cortes) {
  const limites = [0, ...cortes, duracao];
  const tomadas = [];
  for (let k = 0; k < limites.length - 1; k++) tomadas.push({ de: limites[k], ate: limites[k + 1], meio: (limites[k] + limites[k + 1]) / 2 });
  const expr = tomadas.map((t) => `eq(n\\,${Math.round(t.meio * 30)})`).join("+");
  const colunas = Math.min(6, tomadas.length);
  const linhas = Math.ceil(tomadas.length / colunas);
  const vf = `select='${expr}',scale=270:480,drawgrid=w=27:h=48:t=1:c=white@0.28,drawtext=${FONTE}text='%{pts\\:hms}':x=6:y=6:fontsize=18:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=4,tile=${colunas}x${linhas}:padding=6:color=black`;
  await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", video, "-vf", vf, "-fps_mode", "vfr", "-frames:v", "1", "-q:v", "3", saida]);
  return tomadas.map((t) => ({ de: r2(t.de), ate: r2(t.ate) }));
}

/** Material que o criador subiu (print ou gravação de tela) → formato que o render aceita. */
export async function prepararMaterial({ id, entrada, tipo, descricao }, pasta) {
  const info = await sondar(entrada);
  const ehImagem = tipo === "imagem" || (!info.duracao && info.largura) || /image2|png_pipe|jpeg_pipe|webp_pipe|gif|heif|avif/.test(info.formato);
  if (ehImagem) {
    const arquivo = `materiais/${id}.png`;
    await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", entrada, "-frames:v", "1", "-vf", "scale='min(iw,2200)':-2", path.join(pasta, arquivo)]);
    const i = await sondar(path.join(pasta, arquivo));
    return { id, tipo: "imagem", arquivo, descricao, largura: i.largura, altura: i.altura };
  }
  const arquivo = `materiais/${id}.mp4`;
  const hdr = ["arib-std-b67", "smpte2084"].includes(info.transfer);
  const escala = info.largura >= info.altura ? "scale='min(iw,1920)':-2" : "scale=-2:'min(ih,1920)'";
  const vf = ["fps=30", hdr ? TOM_HDR : null, escala, "format=yuv420p"].filter(Boolean).join(",");
  await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", entrada, "-map", "0:v:0", "-vf", vf, "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-movflags", "+faststart", path.join(pasta, arquivo)], { timeoutMs: 40 * 60_000 });
  const v = await sondar(path.join(pasta, arquivo));
  const folha = `dados/folha-${id}.jpg`;
  await folhaDeQuadros(path.join(pasta, arquivo), path.join(pasta, folha), v.duracao, { colunas: 6, maximo: 18, largura: v.largura >= v.altura ? 320 : 180 });
  return { id, tipo: "video", arquivo, descricao, largura: v.largura, altura: v.altura, duracao: r2(v.duracao), folha };
}

/**
 * Efeito sonoro → mp3 nivelado: tira o silêncio do começo (o som cai no tempo certo) e leva o
 * pico pra -3 dB, pra que todo som da biblioteca tenha o mesmo volume de base.
 */
export async function nivelarSom(entrada, saida) {
  const { erro } = await rodar(FERRAMENTAS.ffmpeg, ["-hide_banner", "-i", entrada, "-af", "silenceremove=start_periods=1:start_threshold=-50dB,volumedetect", "-f", "null", "-"]);
  const pico = Number(erro.match(/max_volume: (-?[\d.]+) dB/)?.[1] ?? -3);
  const ganho = Math.max(-20, Math.min(24, -3 - pico));
  await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", entrada, "-vn", "-af", `silenceremove=start_periods=1:start_threshold=-50dB,volume=${ganho.toFixed(1)}dB`, "-ar", "44100", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "192k", saida]);
  const info = await sondar(saida);
  if (!(info.duracao > 0)) throw new Error("o arquivo não tem áudio");
  return { duracao: Math.round(info.duracao * 1000) / 1000 };
}

function copiar(de, para) {
  fs.mkdirSync(path.dirname(para), { recursive: true });
  fs.cpSync(de, para, { recursive: true });
}

const lerJson = (arquivo, padrao) => {
  try {
    return JSON.parse(fs.readFileSync(arquivo, "utf8"));
  } catch {
    return padrao;
  }
};
/** Os estilos de edição do kit (as pastas de kit/estilos, menos as famílias em _bases). */
export const estilosDoKit = () => fs.readdirSync(path.join(KIT, "estilos")).filter((d) => !d.startsWith("_") && fs.existsSync(path.join(KIT, "estilos", d, "estilo.json"))).sort();
/** O estilo padrão: o que tem "padrao": true no estilo.json (senão, o primeiro). */
export const estiloPadrao = () => estilosDoKit().find((d) => lerJson(path.join(KIT, "estilos", d, "estilo.json"), {}).padrao === true) ?? estilosDoKit()[0];
/** O primeiro estilo de edição da lista (o do pedido, depois o do perfil) que existe no kit; senão, o padrão. */
export const estiloValido = (...ids) => ids.find((id) => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id) && fs.existsSync(path.join(KIT, "estilos", id, "estilo.json"))) ?? estiloPadrao();
/** Oficina feita com o kit antigo (antes dos estilos de edição): os ajustes dela continuam nele. */
export const kitAntigo = (pasta) => fs.existsSync(path.join(pasta, "kit", "montar.mjs")) && !fs.existsSync(path.join(pasta, "kit", "motor"));

/**
 * Cria a oficina com o kit: o montador (motor, css, ícones), o estilo desta edição (com a família
 * dele), os três manuais (EDITOR, ESTILO, COMPONENTES), sons, fontes, texturas e o GSAP local.
 * Devolve o id do estilo.
 */
export function prepararPasta(pasta, estilo) {
  const id = estiloValido(estilo);
  for (const p of ["assets", "dados", "materiais", "logos", "prints", "cenas", "recortes", "motions"]) fs.mkdirSync(path.join(pasta, p), { recursive: true });
  fs.rmSync(path.join(pasta, "kit"), { recursive: true, force: true });
  for (const f of ["montar.mjs", "motor", "css", "icones", "print.mjs", "logo.mjs", "hf.mjs", "motion.mjs", "motion-exemplos", "EDITOR.md", "COMPONENTES.md", "MOTION.md"]) copiar(path.join(KIT, f), path.join(pasta, "kit", f));
  // só o estilo escolhido vai pra oficina (e a família de que ele herda): é o que o montador lê
  if (fs.existsSync(path.join(KIT, "estilos", "_bases"))) copiar(path.join(KIT, "estilos", "_bases"), path.join(pasta, "kit", "estilos", "_bases"));
  for (const f of ["estilo.json", "tema.css"]) copiar(path.join(KIT, "estilos", id, f), path.join(pasta, "kit", "estilos", id, f));
  copiar(path.join(KIT, "fontes", "metricas.json"), path.join(pasta, "kit", "fontes", "metricas.json"));
  // o manual do estilo desta edição: é ele que a IA lê (e é o DESIGN.md que o HyperFrames procura)
  copiar(path.join(KIT, "estilos", id, "ESTILO.md"), path.join(pasta, "kit", "ESTILO.md"));
  copiar(path.join(KIT, "estilos", id, "ESTILO.md"), path.join(pasta, "DESIGN.md"));
  copiar(path.join(KIT, "sons"), path.join(pasta, "assets", "sons"));
  for (const f of fs.readdirSync(path.join(KIT, "fontes"))) if (/\.woff2?$/.test(f)) copiar(path.join(KIT, "fontes", f), path.join(pasta, "assets", "fontes", f));
  copiar(path.join(KIT, "texturas"), path.join(pasta, "assets", "texturas"));
  if (fs.existsSync(GSAP_LOCAL)) copiar(GSAP_LOCAL, path.join(pasta, "assets", "gsap.min.js"));
  const nome = path.basename(pasta);
  fs.writeFileSync(path.join(pasta, "hyperframes.json"), JSON.stringify({ $schema: "https://hyperframes.heygen.com/schema/hyperframes.json", registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry", paths: { blocks: "compositions", components: "compositions/components", assets: "assets" }, media: { autoProxy: true } }, null, 2));
  fs.writeFileSync(path.join(pasta, "meta.json"), JSON.stringify({ id: nome, name: nome, createdAt: new Date().toISOString() }, null, 2));
  return id;
}

/** Seis quadros pequenos do vídeo (assets/miniaturas/m0…m5.jpg): a tira de linha do tempo dos estilos de tutorial. */
export async function miniaturas(video, pasta, duracao) {
  const destino = path.join(pasta, "assets", "miniaturas");
  fs.mkdirSync(destino, { recursive: true });
  for (let k = 0; k < 6; k++) {
    const t = Math.max(0, Math.min(duracao - 0.2, ((k + 0.5) / 6) * duracao));
    await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-ss", t.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=200:-2", "-q:v", "5", path.join(destino, `m${k}.jpg`)]);
  }
}

/**
 * O perfil do criador (criador.configuracao, chave "perfil") limpo: qualquer campo pode faltar.
 * { nome, usuario (sem @), nicho, publico, tom, regras, foto_url, cor (look), estilo (de edição), legenda (tipo) }
 */
export function perfilLimpo(p) {
  const txt = (v, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  return {
    nome: txt(p?.nome, 80),
    usuario: txt(p?.usuario, 60)?.replace(/^@+/, "").trim() || null,
    nicho: txt(p?.nicho),
    publico: txt(p?.publico),
    tom: txt(p?.tom, 800),
    regras: txt(p?.regras, 1500),
    foto_url: txt(p?.foto_url, 3000),
    cor: lookValido(p?.cor),
    estilo: txt(p?.estilo, 40),
    legenda: legendaValida(p?.legenda),
  };
}

/**
 * Perfil na oficina: dados/perfil.json (o montador põe o @ e a foto no CTA, nos comentários e no
 * chat) e a foto em assets/perfil.jpg (320×320). Sem foto (ou se o link venceu), o montador usa a
 * inicial num círculo. `foto_url` pode ser um link ou um arquivo do PC.
 */
export async function gravarPerfil(pasta, perfil, { aviso = () => {} } = {}) {
  const p = perfilLimpo(perfil);
  const foto = path.join(pasta, "assets", "perfil.jpg");
  const bruto = path.join(pasta, "assets", "perfil-bruto");
  fs.mkdirSync(path.join(pasta, "dados"), { recursive: true });
  fs.rmSync(foto, { force: true });
  if (p.foto_url) {
    try {
      let entrada = p.foto_url;
      if (/^https?:\/\//i.test(entrada)) {
        const r = await fetch(entrada, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(30_000) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        fs.writeFileSync(bruto, Buffer.from(await r.arrayBuffer()));
        entrada = bruto;
      } else if (!fs.existsSync(entrada)) throw new Error("arquivo não existe");
      await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-i", entrada, "-frames:v", "1", "-vf", "scale=320:320:force_original_aspect_ratio=increase,crop=320:320", "-q:v", "3", foto], { timeoutMs: 60_000 });
    } catch (e) {
      aviso(`não deu pra usar a foto do perfil (${String(e.message).split("\n")[0].slice(0, 120)}): o CTA sai com a inicial`);
    } finally {
      fs.rmSync(bruto, { force: true });
    }
  }
  const temFoto = fs.existsSync(foto);
  const dados = { nome: p.nome, usuario: p.usuario, nicho: p.nicho, publico: p.publico, tom: p.tom, regras: p.regras, foto: temFoto ? "assets/perfil.jpg" : null };
  fs.writeFileSync(path.join(pasta, "dados", "perfil.json"), JSON.stringify(dados, null, 2));
  return { ...p, foto: dados.foto };
}

/**
 * Oficina completa a partir do bruto e dos materiais.
 * materiais: [{ id, tipo: "imagem"|"video"|"link", entrada (arquivo local), url, descricao }]
 */
export async function prepararOficina({ pasta, bruto, materiais = [], pedido, aviso = () => {} }) {
  const estilo = prepararPasta(pasta, pedido?.opcoes?.estilo);
  pedido = { ...pedido, opcoes: { ...(pedido?.opcoes ?? {}), estilo } };
  const dados = (f) => path.join(pasta, "dados", f);

  const look = lookValido(pedido?.opcoes?.cor);
  aviso(`tratando o vídeo (look ${look}, HDR → SDR, 30 fps, volume da voz)`);
  const video = await tratarVideo(bruto, path.join(pasta, "assets", "video.mp4"), { cor: corDoLook(look) });
  fs.writeFileSync(dados("video.json"), JSON.stringify({ duracao: video.duracao, largura: video.largura, altura: video.altura, temAudio: video.temAudio, hdr: video.hdr }, null, 2));
  await miniaturas(path.join(pasta, "assets", "video.mp4"), pasta, video.duracao);

  aviso("achando as emendas das tomadas");
  const candidatas = await detectarCortes(path.join(pasta, "assets", "video.mp4"));
  const cortes = candidatas.map((c) => c.t);
  fs.writeFileSync(dados("cortes.json"), JSON.stringify(cortes));
  fs.writeFileSync(dados("emendas.json"), JSON.stringify(candidatas));
  await folhaDeEmendas(path.join(pasta, "assets", "video.mp4"), path.join(pasta, "dados"), candidatas);
  aviso(`${candidatas.length} emendas candidatas (${candidatas.filter((c) => c.forca === "forte").length} certas)`);

  let palavras = [];
  if (video.temAudio) {
    aviso("transcrevendo (whisper local)");
    const t = await transcrever(path.join(pasta, "assets", "video.mp4"), path.join(pasta, "dados"));
    palavras = t.palavras;
    aviso(`transcrição: ${palavras.length} palavras (${t.modelo})`);
  }
  fs.writeFileSync(dados("palavras.json"), JSON.stringify(palavras, null, 1));
  fs.writeFileSync(dados("transcricao.txt"), transcricaoTexto(palavras, cortes));

  aviso("tirando as folhas de quadros");
  await folhaDeQuadros(path.join(pasta, "assets", "video.mp4"), dados("folha.jpg"), video.duracao);
  const tomadas = await folhaDeTomadas(path.join(pasta, "assets", "video.mp4"), dados("tomadas.jpg"), video.duracao, cortes);
  fs.writeFileSync(dados("tomadas.json"), JSON.stringify(tomadas));

  // O print.mjs só abre os links do pedido: o pedido vai pra oficina antes (e de novo no fim, completo)
  fs.writeFileSync(dados("pedido.json"), JSON.stringify({ ...pedido, materiais: materiais.map((m) => ({ id: m.id, tipo: m.tipo, descricao: m.descricao, url: m.url })) }, null, 2));
  const prontos = [];
  for (const m of materiais) {
    try {
      if (m.tipo === "link") {
        aviso(`print do link ${m.url}`);
        const saida = path.join(pasta, "materiais", `${m.id}.png`);
        await rodar(process.execPath, [path.join(pasta, "kit", "print.mjs"), m.url, saida, "--escuro"], { cwd: pasta, timeoutMs: 90_000, env: { ...process.env, ...(FERRAMENTAS.chrome ? { CHROME_BIN: FERRAMENTAS.chrome } : {}) } });
        const i = await sondar(saida);
        prontos.push({ id: m.id, tipo: "imagem", arquivo: `materiais/${m.id}.png`, descricao: m.descricao, url: m.url, largura: i.largura, altura: i.altura });
      } else {
        aviso(`preparando o material ${m.id}`);
        prontos.push(await prepararMaterial({ id: m.id, entrada: m.entrada, tipo: m.tipo, descricao: m.descricao }, pasta));
      }
    } catch (e) {
      const motivo = (e.erro || e.message || "").trim().split("\n").pop().slice(0, 240);
      aviso(`material ${m.id} não deu: ${motivo}`);
      prontos.push({ id: m.id, tipo: m.tipo, descricao: m.descricao, url: m.url, erro: motivo });
    }
  }
  fs.writeFileSync(dados("materiais.json"), JSON.stringify(prontos, null, 2));
  fs.writeFileSync(dados("pedido.json"), JSON.stringify({ ...pedido, materiais: prontos.map((m) => ({ id: m.id, tipo: m.tipo, descricao: m.descricao, url: m.url, erro: m.erro })) }, null, 2));
  return { video, cortes, palavras, materiais: prontos, tomadas };
}
