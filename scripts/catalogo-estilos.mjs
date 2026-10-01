// Catálogo dos estilos de edição pro painel: lê editor/kit/estilos e escreve lib/editor-estilos.json
// (nome, grupo, descrição, se recorta a pessoa do fundo, os tipos de legenda e as cores do tema).
// Rode depois de mexer num estilo:  npm run editor:catalogo

import fs from "node:fs";
import path from "node:path";

const KIT = process.env.EDITOR_KIT ? path.resolve(process.env.EDITOR_KIT) : path.resolve("editor", "kit");
const SAIDA = path.resolve("lib", "editor-estilos.json");
const ler = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const texto = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "");
/** Junta a família (estilos/_bases) com o estilo: o que ele escreve vale por cima, campo a campo. */
function fundir(a, b) {
  if (!a || typeof a !== "object" || Array.isArray(a) || !b || typeof b !== "object" || Array.isArray(b)) return b === undefined ? a : b;
  const r = { ...a };
  for (const [k, v] of Object.entries(b)) r[k] = k in a ? fundir(a[k], v) : v;
  return r;
}

// O nome de cada tipo de legenda no painel ("estilo/tipo" vale por cima de "tipo")
const ROTULOS = {
  destaque: "Destaque (a linha-chave maior)",
  frase: "Frase numa caixa escura",
  simples: "Simples (pequena, branca)",
  "explicativo-3d/caixa": "Caixinha preta",
  impacto: "Impacto (2 linhas em caixa alta)",
  torta: "Impacto inclinada",
  gibi: "Gibi com contorno",
  clipe: "Branca pequena",
  "caixa-amarela": "Caixa amarela",
  podcast: "Caixa alta com a linha dourada",
  baixa: "Caixa baixa, 1 a 2 palavras",
  amarela: "Amarela com contorno",
  caps: "Caixa alta condensada",
  "nativo/caixa": "Caixa preta do app",
  branca: "Caixa branca do app",
  contorno: "Contorno, sem caixa",
  apertada: "Pequena e apertada",
  "leve-forte": "Fina que engrossa na fala",
  serifa: "Serifa âmbar, uma linha",
  pilula: "Pílula que preenche na fala",
  "documental/caixa": "Caixa preta",
  solta: "Sem caixa, com sombra",
  titulo: "Revela palavra por palavra",
  acumula: "Soma palavra por palavra",
  "marca-texto": "Marca-texto nas palavras-chave",
  editorial: "Editorial (destaque em itálico)",
  subtitulo: "Legenda de filme (2 linhas)",
  mono: "Mono pequena",
  tecnica: "Técnica, discreta",
  bangers: "Gibi (a palavra acende em dourado)",
  limpa: "Limpa (caixinha na palavra falada)",
  padrao: "Padrão (caixinha na palavra falada)",
  nenhuma: "Sem legenda",
};

const pasta = path.join(KIT, "estilos");
const estilos = [];
for (const id of fs.readdirSync(pasta).filter((d) => !d.startsWith("_") && fs.existsSync(path.join(pasta, d, "estilo.json"))).sort()) {
  let e = ler(path.join(pasta, id, "estilo.json"));
  if (e.base) e = fundir(ler(path.join(pasta, "_bases", `${e.base}.json`)), e);
  for (const f of ["tema.css", "ESTILO.md"]) if (!fs.existsSync(path.join(pasta, id, f))) throw new Error(`o estilo ${id} não tem ${f}`);
  const tipos = Object.keys(e.legenda?.tipos ?? {});
  const padrao = e.legenda?.padrao === "nenhuma" || tipos.includes(e.legenda?.padrao) ? e.legenda.padrao : (tipos[0] ?? "nenhuma");
  const ids = [padrao, ...tipos.filter((t) => t !== padrao), ...(padrao === "nenhuma" || tipos.includes("nenhuma") ? [] : ["nenhuma"])];
  // as cores do tema (a última definição vale): fundo, destaque e a segunda cor
  const css = `${e.tema_base ? texto(path.join(pasta, "_bases", `${e.tema_base}.css`)) : ""}\n${texto(path.join(pasta, id, "tema.css"))}`;
  const cor = (v) => [...css.matchAll(new RegExp(`--${v}:\\s*(#[0-9a-fA-F]{3,8})\\b`, "g"))].pop()?.[1] ?? null;
  estilos.push({
    id,
    nome: e.nome ?? id,
    grupo: e.grupo ?? "base",
    ordem: Number(e.ordem ?? 99),
    descricao: e.descricao ?? "",
    recorte: e.usa_recorte === true,
    padrao: e.padrao === true,
    legenda: padrao,
    legendas: ids.map((t) => ({ id: t, nome: ROTULOS[`${id}/${t}`] ?? ROTULOS[t] ?? t })),
    cores: [cor("void"), cor("acento"), cor("acento2") ?? cor("texto")].filter(Boolean),
  });
}
estilos.sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
if (estilos.filter((e) => e.padrao).length !== 1) throw new Error('um (e só um) estilo precisa de "padrao": true no estilo.json');

fs.writeFileSync(SAIDA, JSON.stringify(estilos, null, 2) + "\n");
console.log(`${estilos.length} estilos → ${path.relative(process.cwd(), SAIDA)}\n`);
for (const e of estilos) console.log(`${e.grupo.padEnd(13)} ${e.id.padEnd(20)} ${e.recorte ? "recorte " : "        "}legendas: ${e.legendas.map((l) => l.id).join(", ")}${e.padrao ? "  ← padrão" : ""}`);
