// Uma cópia de carrossel do começo ao fim, no PC: oficina → IA (o motor de "Quem edita") →
// conferência e render. Quem chama é a estação (editor/estacao/carrosseis.mjs, que cuida do banco
// e do storage) ou o teste local (npm run carrossel:testar).
//
// A oficina (carrosseis/oficina/<id>/) guarda os originais, os recortes, o HTML, o conteudo.json e
// a saída: dá pra abrir e conferir depois. Fica fora do git.

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { RAIZ_SISTEMA } from "../editor/estacao/ferramentas.mjs";
import { perfilLimpo } from "../editor/estacao/preparar.mjs";
import { conferirConteudo } from "./kit/contrato.mjs";
import { medirMarca } from "./kit/marca.mjs";
import { renderizar } from "./kit/renderizar.mjs";
import { ehVideo, quadros, sondar } from "./kit/video.mjs";

export const PASTA_CARROSSEIS = path.join(RAIZ_SISTEMA, "carrosseis");
export const RAIZ_OFICINAS = path.join(PASTA_CARROSSEIS, "oficina");
export const MAX_SLIDES = 20;
const nn = (n) => String(n).padStart(2, "0");

// Claude Code: só lê e escreve na oficina e só roda os comandos do kit de carrossel
const PERMITIDAS = [
  "Read(./**)",
  "Edit(./**)",
  "Write(./**)",
  "Glob",
  "Grep",
  "TodoWrite",
  "Bash(node kit/renderizar.mjs)",
  "Bash(node kit/recortar.mjs:*)",
  "Bash(node kit/fundo.mjs:*)",
  "Bash(node kit/recortar-video.mjs:*)",
];

// Codex: notas deste ambiente + o manual, como AGENTS.md da oficina
const NOTAS_CODEX = `# Oficina de carrossel (instruções do Codex)

Notas deste ambiente, que valem por cima do manual abaixo:

- Pra **olhar uma imagem** (referencias/NN.png, referencias/NN-quadros.jpg, saida/NN.png,
  saida/contato.jpg) use a ferramenta \`view_image\` com o caminho do arquivo. Não leia imagem como texto.
- Pra criar e editar arquivos, apply_patch. Tudo dentro desta pasta.
- Os comandos do kit são \`node kit/renderizar.mjs\`, \`node kit/recortar.mjs ...\`, \`node kit/fundo.mjs ...\`
  e \`node kit/recortar-video.mjs ...\`. Os comandos rodam num sandbox sem internet.
- Se o \`node kit/renderizar.mjs\` não conseguir abrir o Chrome aqui, termine os arquivos com cuidado: a
  estação renderiza e confere depois, e te chama de novo se algo falhar.
- Não instale nada, não use a internet e não mexa em \`kit/\`.

---

`;

/** O perfil limpo do criador e a foto dele em assets/perfil.jpg (link ou arquivo do PC). */
async function gravarFoto(pasta, perfil, aviso) {
  const foto = path.join(pasta, "assets", "perfil.jpg");
  fs.rmSync(foto, { force: true });
  if (!perfil.foto_url) return;
  try {
    let buf;
    if (/^https?:\/\//i.test(perfil.foto_url)) {
      const r = await fetch(perfil.foto_url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer());
    } else buf = fs.readFileSync(perfil.foto_url);
    await sharp(buf).rotate().resize(320, 320, { fit: "cover" }).jpeg({ quality: 90 }).toFile(foto);
  } catch (e) {
    aviso(`não deu pra usar a foto do perfil (${String(e.message).split("\n")[0].slice(0, 120)}): a marca sai com a inicial`);
  }
}

/**
 * Monta a oficina. `arquivos`: os slides originais no PC, na ordem (foto ou vídeo).
 * `pedido`: { headline, modo_texto, direcao }. `perfil`: o perfil do criador (configuracao "perfil").
 * Devolve { pasta, total, videos } (videos = números dos slides que são vídeo).
 */
export async function prepararOficina({ pasta, arquivos, pedido = {}, perfil = {}, aviso = () => {} }) {
  if (arquivos.length < 2 || arquivos.length > MAX_SLIDES) throw new Error(`o carrossel precisa de 2 a ${MAX_SLIDES} slides (veio ${arquivos.length})`);
  for (const d of ["referencias", "dados", "assets"]) fs.mkdirSync(path.join(pasta, d), { recursive: true });
  fs.rmSync(path.join(pasta, "kit"), { recursive: true, force: true });
  fs.cpSync(path.join(PASTA_CARROSSEIS, "kit"), path.join(pasta, "kit"), { recursive: true });
  // Fontes: as do painel e o repertório do editor (sem a fonte exata, a IA escolhe a mais próxima)
  for (const [de, para] of [
    [path.join(RAIZ_SISTEMA, "public", "fontes"), "fontes"],
    [path.join(RAIZ_SISTEMA, "editor", "kit", "fontes"), "fontes-editor"],
  ])
    if (fs.existsSync(de)) fs.cpSync(de, path.join(pasta, "assets", para), { recursive: true });
  const p = perfilLimpo(perfil);
  await gravarFoto(pasta, p, aviso);

  const videos = [];
  for (const [i, a] of arquivos.entries()) {
    const n = nn(i + 1);
    if (a.video ?? ehVideo(a.entrada)) {
      // Slide em vídeo: o original, um quadro em tamanho real e uma folha com 6 momentos
      const original = path.join(pasta, "referencias", `${n}.mp4`);
      fs.copyFileSync(a.entrada, original);
      const info = await sondar(original);
      await quadros(original, path.join(pasta, "referencias", `${n}.png`), path.join(pasta, "referencias", `${n}-quadros.jpg`), info.duracao_s);
      videos.push({ n: i + 1, original: `referencias/${n}.mp4`, quadro: `referencias/${n}.png`, quadros: `referencias/${n}-quadros.jpg`, ...info });
    } else await sharp(fs.readFileSync(a.entrada)).rotate().png().toFile(path.join(pasta, "referencias", `${n}.png`));
  }
  const total = arquivos.length;
  fs.writeFileSync(
    path.join(pasta, "dados", "pedido.json"),
    JSON.stringify(
      {
        total,
        idioma: "pt-BR",
        headline: pedido.headline?.trim() || null,
        modo_texto: pedido.modo_texto === "reformular" ? "reformular" : "traduzir",
        direcao: pedido.direcao?.trim() || null,
        criador: { nome: p.nome, usuario: p.usuario ? `@${p.usuario}` : null },
        marca: await medirMarca(p),
        videos,
      },
      null,
      2,
    ),
  );
  const nota = "Leia kit/CRIAR.md. Esta oficina tem todos os slides de referência. Trabalhe só aqui, sem acessar a rede, credenciais ou pastas de fora. Toda a entrega em português do Brasil.\n";
  fs.writeFileSync(path.join(pasta, "CLAUDE.md"), nota);
  return { pasta, total, videos: videos.map((v) => v.n) };
}

/** O pedido pra IA (o manual é o kit/CRIAR.md). */
export function promptCarrossel({ total, videos = [], motor = "claude", correcao = "" }) {
  const ver = motor === "codex" ? "Abra com o view_image" : "Veja";
  const emVideo = videos.length
    ? ` Os slides ${videos.join(", ")} são VÍDEO no original: veja referencias/NN.png e referencias/NN-quadros.jpg de cada um e siga a seção "Slides em vídeo" do kit/CRIAR.md (parte estática em HTML + o motion recortado com node kit/recortar-video.mjs).`
    : "";
  return [
    `${motor === "codex" ? "Siga o manual das suas instruções (AGENTS.md, que é o kit/CRIAR.md)" : "Leia kit/CRIAR.md"} e dados/pedido.json. ${ver} um por um TODOS os ${total} arquivos, de referencias/01.png até referencias/${nn(total)}.png.`,
    "Copie a composição visual de cada um, traduza todo o texto editorial para PT-BR e troque só a headline da capa conforme o pedido. Escreva carrossel.html e conteudo.json, renderize com node kit/renderizar.mjs, abra os PNGs e revise cada slide. Conserve fotos e prints usando recortes reais. Não use template genérico e não invente texto nem slides." + emVideo,
    correcao ? `\nOs arquivos já existem nesta pasta. A conferência da estação achou estes problemas; corrija e renderize de novo:\n${correcao.slice(0, 4000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Erro de limite do plano (Claude ou ChatGPT): a estação tenta de novo mais tarde. */
export const ehLimite = (msg) => /limite de uso|usage limit|rate.?limit|limit reached|quota|hit your .{0,24}limit|out of (extra )?usage/i.test(String(msg ?? ""));

/**
 * A IA faz a arte, a estação confere e renderiza; se a conferência falhar, a IA corrige uma vez.
 * `ia`: o motor preparado (editor/estacao/motor.mjs → prepararMotor). Devolve { conteudo, uso, resumo }.
 */
export async function produzirCarrossel({ pasta, total, videos = [], ia, aoPasso = () => {}, etapa = async () => {}, minutos = 45 }) {
  const opcoes = { aoPasso, minutos, permitidas: PERMITIDAS, agentsMd: NOTAS_CODEX + fs.readFileSync(path.join(pasta, "kit", "CRIAR.md"), "utf8") };
  let r = await ia.rodar(pasta, promptCarrossel({ total, videos, motor: ia.id }), opcoes);
  const conferir = async () => {
    let c;
    try {
      c = conferirConteudo(JSON.parse(fs.readFileSync(path.join(pasta, "conteudo.json"), "utf8")), total, true);
    } catch (e) {
      throw new Error(`conteudo.json: ${e.message}`);
    }
    await etapa("renderizando e conferindo os slides");
    await renderizar(pasta);
    return c;
  };
  let conteudo;
  let uso = r.uso;
  try {
    conteudo = await conferir();
  } catch (e) {
    await etapa("corrigindo o que a conferência achou nos slides");
    r = await ia.rodar(pasta, promptCarrossel({ total, videos, motor: ia.id, correcao: e.message }), opcoes);
    // As duas rodadas somadas (tempo, turnos e, na OpenRouter, o custo)
    const soma = (k) => (typeof uso?.[k] === "number" || typeof r.uso?.[k] === "number" ? Math.round(((uso?.[k] ?? 0) + (r.uso?.[k] ?? 0)) * 10000) / 10000 : undefined);
    uso = { ...r.uso, rodadas: 2, duracao_s: soma("duracao_s"), turnos: soma("turnos"), custo_usd: soma("custo_usd") };
    conteudo = await conferir();
  }
  fs.rmSync(path.join(pasta, ".navegador"), { recursive: true, force: true });
  return { conteudo, uso, resumo: r.resumo };
}
