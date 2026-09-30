// Quem edita os vídeos: o "motor" de IA da edição. O criador escolhe no painel
// (configuracao "editor" → { motor, modelo }); a estação lê a cada pedido, então trocar não
// precisa reiniciar nada.
//   claude      Claude Code logado no plano do Claude (Pro ou Max): sem custo por vídeo
//   codex       Codex CLI logado no ChatGPT (Plus ou Pro): sem custo por vídeo
//   openrouter  Claude Code pela OpenRouter, com a chave do painel: paga por vídeo
// Os três leem o mesmo manual (kit/EDITOR.md) e devolvem a mesma coisa: { resumo, passos, uso }.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ambienteClaude, rodarClaude } from "./claude.mjs";
import { rodarCodex, sandboxDoWindows } from "./codex.mjs";
import { ambienteDaIA } from "./ambiente.mjs";
import { COMO_INSTALAR, FERRAMENTAS, acharPrograma, comoRodar } from "./ferramentas.mjs";

export const MOTORES = {
  claude: { nome: "o Claude", rotulo: "Claude (plano Pro ou Max)" },
  codex: { nome: "o ChatGPT", rotulo: "ChatGPT (Codex, plano Plus ou Pro)" },
  openrouter: { nome: "o Claude", rotulo: "OpenRouter (paga por vídeo)" },
};
/** Modelo de cada motor quando o painel não diz. Codex: o padrão da conta do ChatGPT. */
export const MODELO_PADRAO = {
  claude: process.env.EDITOR_MODELO || "opus",
  codex: null,
  openrouter: "anthropic/claude-sonnet-5.5", // bom de ferramenta e de imagem, preço médio
};
/** Esforço (quanto pensa): na OpenRouter o pensamento é cobrado, então menos. */
const ESFORCO = { claude: "high", codex: "high", openrouter: "medium" };
/** Os passos da IA no log começam assim (o painel mostra mais apagado). */
export const PASSO_DA_IA = /^(o Claude|o ChatGPT) /;

/** { motor, modelo } válido a partir do que veio do banco (ou de qualquer coisa). */
export function configMotor(v) {
  const motor = Object.hasOwn(MOTORES, v?.motor) ? v.motor : "claude";
  const bruto = typeof v?.modelo === "string" ? v.modelo.trim() : "";
  const modelo = /^[~\w./:[\]-]{1,100}$/.test(bruto) ? bruto : null;
  return { motor, modelo };
}

/** A escolha do painel (configuracao "editor"). Sem nada salvo: Claude. */
export async function lerConfigMotor(db) {
  const { data, error } = await db.from("configuracao").select("valor").eq("chave", "editor").maybeSingle();
  if (error) throw new Error(`não consegui ler quem edita (configuracao "editor"): ${error.message}`);
  return configMotor(data?.valor);
}

/**
 * A chave da OpenRouter: OPENROUTER_API_KEY neste PC (se tiver), senão a que você colou no painel
 * (tabela segredo, chave "ia", que só o dono lê; ou configuracao "ia", onde ficava antes).
 */
export async function lerChaveOpenRouter(db) {
  if (process.env.OPENROUTER_API_KEY?.trim()) return process.env.OPENROUTER_API_KEY.trim();
  if (!db) return null;
  for (const tabela of ["segredo", "configuracao"]) {
    const { data, error } = await db.from(tabela).select("valor").eq("chave", "ia").maybeSingle();
    const chave = error ? null : data?.valor?.openrouter_key;
    if (typeof chave === "string" && chave.trim()) return chave.trim();
  }
  return null;
}

/** A chave da OpenRouter: vale? tem crédito? quanto já gastou (USD)? */
export async function consultarOpenRouter(chave) {
  const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(20_000) });
  if (r.status === 401 || r.status === 403) return { ok: false, erro: "a chave da OpenRouter não vale (confira no painel, Início → passo 2)" };
  if (!r.ok) return { ok: false, erro: `a OpenRouter respondeu ${r.status}` };
  const j = await r.json();
  const d = j?.data ?? j ?? {};
  if (typeof d.limit_remaining === "number" && d.limit_remaining < 0.5) return { ok: false, erro: "a chave da OpenRouter chegou no limite de gasto dela (aumente em openrouter.ai/settings/keys)", usado: d.usage };
  if (d.is_free_tier === true) return { ok: false, erro: "a sua conta da OpenRouter ainda não tem crédito: coloque uns US$ 10 em openrouter.ai/settings/credits", usado: d.usage };
  return { ok: true, usado: typeof d.usage === "number" ? d.usage : null };
}

const rodaOk = (bin, args, env) => {
  const [cmd, ...antes] = comoRodar(bin);
  return spawnSync(cmd, [...antes, ...args], { encoding: "utf8", windowsHide: true, timeout: 60_000, env });
};
const existe = (bin) => Boolean(bin && (path.isAbsolute(bin) ? fs.existsSync(bin) : acharPrograma(bin)));

/** O bash do Git for Windows (o Claude Code usa ele como terminal no Windows). */
function gitBash() {
  const git = acharPrograma("git");
  const lugares = [
    process.env.CLAUDE_CODE_GIT_BASH_PATH,
    git && path.join(path.dirname(path.dirname(git)), "bin", "bash.exe"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Git", "bin", "bash.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs", "Git", "bin", "bash.exe"),
  ];
  return lugares.find((p) => p && fs.existsSync(p)) ?? null;
}

/**
 * Confere se o motor escolhido está pronto neste PC: instalado, logado (e, na OpenRouter, com
 * chave e crédito). Devolve { ok, erro } com o erro em português simples, pro log e pro painel.
 */
export async function conferirMotor({ motor }, { chaveOpenRouter } = {}) {
  if (motor === "codex") {
    if (!existe(FERRAMENTAS.codex)) return { ok: false, erro: `o Codex não está instalado neste PC: ${COMO_INSTALAR.codex}, depois codex login` };
    const r = rodaOk(FERRAMENTAS.codex, ["login", "status"], ambienteDaIA());
    const saida = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    if (r.status !== 0) return { ok: false, erro: "o Codex não está logado: no terminal, rode codex login e entre com a sua conta do ChatGPT" };
    if (/api key/i.test(saida)) return { ok: false, erro: "o Codex está logado com chave de API (cobra por uso), não com o ChatGPT: rode codex logout e depois codex login" };
    if (process.platform === "win32" && sandboxDoWindows() !== "elevated")
      return { ok: true, erro: null, aviso: "o sandbox do Codex está no modo simples: a IA edita, mas não consegue tirar as fotos de conferência. Rode o instalador de novo e aceite o pedido de administrador do Windows" };
    return { ok: true, erro: null };
  }
  if (!existe(FERRAMENTAS.claude) || rodaOk(FERRAMENTAS.claude, ["--version"], ambienteDaIA()).status !== 0) return { ok: false, erro: `o Claude Code não está instalado neste PC: ${COMO_INSTALAR.claude}` };
  // No Windows o Claude Code roda os comandos do kit pelo Git Bash (sem ele, não tem terminal liberado)
  if (process.platform === "win32" && !gitBash()) return { ok: false, erro: "falta o Git for Windows (o Claude usa o terminal dele pra rodar o kit): rode o instalador de novo ou winget install Git.Git" };
  if (motor === "openrouter") {
    if (!chaveOpenRouter) return { ok: false, erro: "falta a chave da OpenRouter: cole no painel (Início → passo 2)" };
    try {
      const c = await consultarOpenRouter(chaveOpenRouter);
      return { ok: c.ok, erro: c.erro ?? null };
    } catch (e) {
      return { ok: false, erro: `não consegui falar com a OpenRouter (${e.message})` };
    }
  }
  // Plano do Claude: logado com a conta da assinatura (não com conta de API, que cobra por uso)
  const r = rodaOk(FERRAMENTAS.claude, ["auth", "status", "--json"], ambienteClaude());
  let st = null;
  try {
    st = JSON.parse(String(r.stdout ?? "").trim());
  } catch {}
  if (!st) return { ok: true, erro: null }; // versão sem "auth status": o erro, se tiver, aparece na edição
  if (!st.loggedIn) return { ok: false, erro: "o Claude Code não está logado: no terminal, rode claude auth login e entre com a conta da sua assinatura" };
  if (/console|api/i.test(String(st.authMethod ?? ""))) return { ok: false, erro: "o Claude Code está logado com conta de API (cobra por uso), não com o plano: rode claude auth logout e depois claude auth login" };
  return { ok: true, erro: null };
}

/**
 * Prepara o motor pra uma edição: confere e devolve { id, nome, modelo, rodar(pasta, prompt, opcoes) }.
 * Lança erro em português quando não dá (o pedido vai pra "erro" com essa mensagem).
 */
export async function prepararMotor(config, { chaveOpenRouter = null } = {}) {
  const { motor, modelo: escolhido } = configMotor(config);
  const conferido = await conferirMotor({ motor }, { chaveOpenRouter });
  if (!conferido.ok) throw Object.assign(new Error(conferido.erro), { motor: true });
  const modelo = escolhido ?? MODELO_PADRAO[motor];
  const esforco = process.env.EDITOR_ESFORCO || ESFORCO[motor];
  const nome = MOTORES[motor].nome;
  if (motor === "codex") return { id: motor, nome, modelo, rodar: (pasta, prompt, o = {}) => rodarCodex(pasta, prompt, { ...o, modelo, esforco }) };
  if (motor === "claude") return { id: motor, nome, modelo, rodar: (pasta, prompt, o = {}) => rodarClaude(pasta, prompt, { ...o, modelo, esforco }) };
  // OpenRouter: o gasto de verdade é o saldo usado da chave antes e depois (aproximado: se o
  // painel usar a mesma chave ao mesmo tempo, entra junto)
  return {
    id: motor,
    nome,
    modelo,
    rodar: async (pasta, prompt, o = {}) => {
      const antes = await consultarOpenRouter(chaveOpenRouter).catch(() => null);
      const r = await rodarClaude(pasta, prompt, { ...o, modelo, esforco, openrouter: { chave: chaveOpenRouter } });
      await new Promise((ok) => setTimeout(ok, 4000)); // a OpenRouter contabiliza com um atraso pequeno
      const depois = await consultarOpenRouter(chaveOpenRouter).catch(() => null);
      if (typeof antes?.usado === "number" && typeof depois?.usado === "number") r.uso.custo_usd = Math.round(Math.max(0, depois.usado - antes.usado) * 10000) / 10000;
      return r;
    },
  };
}
