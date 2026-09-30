// Gera os efeitos sonoros do kit (editor/kit/sons) por síntese no ffmpeg: nenhum arquivo de
// terceiros, tudo reproduzível. Refaz os mp3 e o catálogo editor/kit/sons/sons.json.
//   npm run sons:gerar
//
// Cada som é uma expressão do aevalsrc (senos, ruído e envelopes) + filtros do ffmpeg, depois
// nivelado igual à biblioteca do painel (sem silêncio no começo, pico em -3 dB, mp3 192k).
// Os 5 de PRONTOS (também sintetizados) já vêm no kit e só entram no catálogo.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FERRAMENTAS, nivelarSom, rodar, sondar } from "../editor/estacao/preparar.mjs";

const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "editor", "kit", "sons");
const R = 44100;

// ── blocos das expressões (t = tempo em segundos) ──────────────────
const n = (v) => (typeof v === "number" ? Number(v.toFixed(5)).toString() : String(v));
const ruido = (i = 0) => `(2*random(${i})-1)`;
const decai = (t0, k) => `gte(t,${n(t0)})*exp(-max(t-${n(t0)},0)*${n(k)})`; // max(): antes de t0 o exp estouraria (inf*0 = NaN)
const ataque = (t0, k = 900) => `(1-exp(-max(t-${n(t0)},0)*${k}))`;
const seno = (f, t0 = 0) => `sin(2*PI*${n(f)}*(t-${n(t0)}))`;
const quadrada = (f) => `(2*gte(sin(2*PI*${n(f)}*t),0)-1)`;
const janela = (a, b, sobe = 200, desce = 60) => `between(t,${n(a)},${n(b)})*min(1,(t-${n(a)})*${sobe})*min(1,(${n(b)}-t)*${desce})`;
const soma = (partes) => `(${partes.join("+")})`;
// sino: fundamental + parciais, cada um decaindo no seu ritmo
const nota = (t0, f, a = 1, k = 6) => `${n(a)}*${ataque(t0)}*(${seno(f, t0)}*${decai(t0, k)}+0.25*${seno(f * 2, t0)}*${decai(t0, k * 1.6)}+0.08*${seno(f * 3, t0)}*${decai(t0, k * 2.4)})`;
// hash determinístico (0–1) de um número: o "aleatório" do glitch sem mudar a cada geração
const hash = (x) => `(sin((${x})*12.9898)*43758.5453-floor(sin((${x})*12.9898)*43758.5453))`;

// ── teclado: 12 teclas em ritmo de digitação (clique + corpo + soltura) ──
const TECLAS = [0, 0.085, 0.19, 0.265, 0.36, 0.445, 0.53, 0.635, 0.71, 0.8, 0.905, 0.975];
const FORCAS = [1, 0.8, 0.9, 0.7, 1, 0.85, 0.75, 0.95, 0.8, 0.9, 0.7, 0.85];
const teclado =
  `${ruido(0)}*${soma(TECLAS.flatMap((t, i) => [`${FORCAS[i]}*${decai(t, 550)}`, `${n(FORCAS[i] * 0.35)}*${decai(t + 0.045, 900)}`]))}` +
  `+${soma(TECLAS.map((t, i) => `${n(FORCAS[i] * 0.3)}*${seno(250 + (i % 3) * 45, t)}*${decai(t, 90)}`))}`;

// ── riser: dois chirps subindo (oitava) + ruído, crescendo até o fim (a revelação) ──
const T_RISER = 2.6;
const chirp = (f0, f1, T) => `sin(2*PI*(${n(f0)}*t+${n((f1 - f0) / (2 * T))}*t*t))`;
const riser =
  `pow(t/${T_RISER},2)*min(1,(${T_RISER}-t)*40)*(0.6*${chirp(180, 1400, T_RISER)}+0.3*${chirp(360, 2800, T_RISER)}+0.45*${ruido(0)})` +
  `*(0.8+0.2*sin(2*PI*(3*t+2.5*t*t)))`;

// ── click: estalo curto de mouse (aperta + solta) ──
const click = `0.7*${ruido(0)}*exp(-t*1100)+0.6*${seno(2200)}*exp(-t*300)+0.3*${seno(1200)}*exp(-t*180)+0.4*${ruido(1)}*${decai(0.022, 1400)}`;

// ── impacto: grave que cai de 120 Hz pra 45 Hz + harmônico (pra aparecer no celular) + batida ──
const fase = "(45*t+8.333*(1-exp(-9*t)))";
const impacto = `${ataque(0, 600)}*(sin(2*PI*${fase})*exp(-t*2.4)+0.35*sin(4*PI*${fase})*exp(-t*4))+0.5*${ruido(0)}*exp(-t*25)`;

// ── notificação: duas notas de sino subindo (mi → lá) ──
const notificacao = `${nota(0, 1318.51, 0.9, 6)}+${nota(0.13, 1760, 1, 5)}`;

// ── extras sem função ──
const brilho = `${soma([2093, 2637, 3136, 3951, 4699, 5274].map((f, i) => nota(i * 0.05, f, 1 - i * 0.1, 5 + i)))}+0.08*${ruido(0)}*exp(-t*3)`;
const passo = "floor(t*28)";
const glitch = `min(1,(0.6-t)*30)*gte(${hash(`${passo}*1.7+3`)},0.3)*(0.6*${quadrada(`(200+1600*${hash(passo)})`)}+0.4*${ruido(0)})`;
const erro = `${janela(0, 0.2)}*${quadrada(196)}+${janela(0.24, 0.52)}*${quadrada(147)}`;

// nome (e arquivo <nome>.mp3), função, descrição, duração da síntese (s), expressão, filtros
const GERADOS = [
  { nome: "teclado-kit", funcao: "teclado", descricao: "digitação: o “comenta X” do CTA e o terminal", d: 1.1, expr: teclado, filtros: "highpass=f=150,lowpass=f=9000,equalizer=f=3500:t=q:w=1.2:g=3" },
  { nome: "riser-kit", funcao: "riser", descricao: "riser curto (~2,3 s) que sobe até a revelação (use \"ate\" = o instante da revelação)", d: T_RISER, expr: riser, filtros: "highpass=f=120,lowpass=f=10000,aecho=0.8:0.5:45|90:0.25|0.15" },
  { nome: "click-kit", funcao: "click", descricao: "clique curto quando a caixa dourada destaca algo no print", d: 0.09, expr: click, filtros: "highpass=f=400" },
  { nome: "impacto-kit", funcao: "impacto", descricao: "grave de impacto quando entra a palavra em tela cheia", d: 1.8, expr: impacto, filtros: "lowpass=f=3500,aecho=0.8:0.6:60|120:0.3|0.2" },
  { nome: "notificacao-kit", funcao: "notificacao", descricao: "notificação de celular chegando (duas notas de sino)", d: 1.0, expr: notificacao, filtros: "highpass=f=300" },
  { nome: "brilho", funcao: null, descricao: "brilho: algo aparece do nada ou fica pronto", d: 1.4, expr: brilho, filtros: "highpass=f=1200,aecho=0.8:0.7:70|140:0.35|0.2" },
  { nome: "glitch", funcao: null, descricao: "glitch digital curto (erro, bug, algo quebrando)", d: 0.6, expr: glitch, filtros: "acrusher=bits=6:samples=6:mix=0.7,lowpass=f=8000" },
  { nome: "erro", funcao: null, descricao: "buzzer de erro: “não é assim”, o jeito errado", d: 0.55, expr: erro, filtros: "lowpass=f=2200" },
];

// sintetizados que já vêm no kit (não são refeitos aqui, só catalogados)
const PRONTOS = [
  { nome: "obturador-seco", funcao: "obturador", origem: "kit", descricao: "clique curto de câmera: entra em toda emenda de tomada, junto com a onda de calor" },
  { nome: "ding-claro", funcao: "ding", origem: "kit", descricao: "ding de dica ou momento de valor (a revelação, o número, o resultado)" },
  { nome: "tick-curto", funcao: "tecla", origem: "kit", descricao: "tick curtinho: os ticks do contador subindo" },
  { nome: "whoosh-rapido", funcao: "whoosh", origem: "kit", descricao: "whoosh de transição, rápido (de vez em quando, não em toda cena)" },
  { nome: "pop-curto", funcao: "pop", origem: "kit", descricao: "pop na entrada de card, item, comentário e mensagem" },
];
const ORDEM = ["obturador", "ding", "teclado", "tecla", "whoosh", "riser", "pop", "click", "impacto", "notificacao"];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sons-kit-"));
const catalogo = [];
try {
  for (const s of GERADOS) {
    const wav = path.join(tmp, `${s.nome}.wav`);
    const fade = Math.min(0.04, s.d * 0.2); // fim sem estalo
    const grafo = `aevalsrc=exprs='${s.expr}':s=${R}:d=${s.d},${s.filtros},afade=t=out:st=${n(s.d - fade)}:d=${n(fade)}`;
    await rodar(FERRAMENTAS.ffmpeg, ["-y", "-v", "error", "-f", "lavfi", "-i", grafo, "-ac", "1", "-c:a", "pcm_s16le", wav], { timeoutMs: 120_000 });
    const { duracao } = await nivelarSom(wav, path.join(PASTA, `${s.nome}.mp3`));
    catalogo.push({ nome: s.nome, arquivo: `${s.nome}.mp3`, funcao: s.funcao, principal: false, origem: "kit", descricao: s.descricao, duracao });
    console.log(`✓ ${s.nome}.mp3 (${duracao}s)`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
for (const s of PRONTOS) {
  const arquivo = path.join(PASTA, `${s.nome}.mp3`);
  if (!fs.existsSync(arquivo)) {
    console.log(`– ${s.nome}.mp3 não está no kit (fica fora do catálogo)`);
    continue;
  }
  const { duracao } = await sondar(arquivo);
  catalogo.push({ nome: s.nome, arquivo: `${s.nome}.mp3`, funcao: s.funcao, principal: false, origem: s.origem, descricao: s.descricao, duracao: Math.round(duracao * 1000) / 1000 });
}

// um principal por função (o primeiro dela); ordem: funções do padrão, depois os extras
for (const f of ORDEM) {
  const daFuncao = catalogo.filter((s) => s.funcao === f);
  if (!daFuncao.length) console.log(`⚠ a função ${f} ficou sem som no kit`);
  else daFuncao[0].principal = true;
}
const pos = (s) => (s.funcao ? ORDEM.indexOf(s.funcao) : ORDEM.length);
catalogo.sort((a, b) => pos(a) - pos(b) || Number(b.principal) - Number(a.principal) || a.nome.localeCompare(b.nome));
fs.writeFileSync(path.join(PASTA, "sons.json"), `${JSON.stringify(catalogo, null, 2)}\n`);

// sobra de arquivo que não está no catálogo (ex.: som de terceiros de uma versão antiga)
const noCatalogo = new Set(catalogo.map((s) => s.arquivo));
const sobras = fs.readdirSync(PASTA).filter((f) => f.endsWith(".mp3") && !noCatalogo.has(f));
console.log(`\nsons.json: ${catalogo.length} sons (${catalogo.filter((s) => s.principal).length} principais)`);
if (sobras.length) console.log(`⚠ arquivos fora do catálogo em editor/kit/sons: ${sobras.join(", ")}`);
