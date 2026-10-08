// Motores "claude" e "openrouter": Claude Code sem janela (modo -p) na oficina.
//   claude      no plano Claude do criador (Pro ou Max): sem chave de API no ambiente, a CLI usa a
//               assinatura logada no PC e não gasta API paga
//   openrouter  o mesmo Claude Code, apontado pra OpenRouter com a chave do criador (paga por uso;
//               não precisa de assinatura do Claude). Documentado pela OpenRouter:
//               https://openrouter.ai/docs/cookbook/coding-agents/claude-code-integration
//
// Isolado de propósito: ignora as permissões globais do Claude Code do PC, os conectores MCP e o
// histórico; só lê e escreve dentro da oficina (e nunca .env, a sessão da estação ou os logins
// das CLIs) e só roda os scripts do kit. Onde fica o executável: CLAUDE_BIN, senão ~/.local/bin
// (instalador nativo), senão o PATH.

import { spawn } from "node:child_process";
import { ambienteDaIA } from "./ambiente.mjs";
import { FERRAMENTAS, comoRodar } from "./ferramentas.mjs";

export const CLAUDE = FERRAMENTAS.claude;
export const OPENROUTER_BASE = "https://openrouter.ai/api";

// Caminhos relativos à oficina (a pasta onde o Claude roda): "./**" = só ela
const PERMITIDAS = [
  "Read(./**)",
  "Edit(./**)",
  "Write(./**)",
  "Glob",
  "Grep",
  "TodoWrite",
  "Bash(node kit/montar.mjs)",
  "Bash(node kit/montar.mjs:*)",
  "Bash(node kit/print.mjs:*)",
  "Bash(node kit/logo.mjs:*)",
  "Bash(node kit/hf.mjs lint)",
  "Bash(node kit/hf.mjs lint:*)",
  "Bash(node kit/hf.mjs snapshot:*)",
  "Bash(node kit/hf.mjs inspect:*)",
  "Bash(node kit/motion.mjs:*)",
];
// Só estas ferramentas existem pra IA (o resto do Claude Code nem aparece: agendador, sub-agentes, web…)
const FERRAMENTAS_DA_IA = "Bash,Read,Edit,Write,Glob,Grep,TodoWrite";
// No Windows o Claude Code também tem PowerShell: desligado, pra valer só as regras do Bash acima.
// E nada de ler segredo, mesmo que alguma regra acima deixasse (negar sempre vence)
const PROIBIDAS = [
  "PowerShell",
  "WebFetch",
  "WebSearch",
  "Agent",
  "Task",
  "NotebookEdit",
  "Read(//**/.env*)",
  "Edit(//**/.env*)",
  "Read(~/.sistema-do-criador/**)",
  "Read(~/.claude/**)",
  "Read(~/.codex/**)",
  "Read(~/.ssh/**)",
  "Read(~/.aws/**)",
  "Read(~/.config/**)",
];

function descrever(b) {
  const i = b.input ?? {};
  const nome = (f) => String(f ?? "").split(/[\\/]/).slice(-2).join("/");
  if (b.name === "Bash") return `rodou ${String(i.command ?? "").slice(0, 140)}`;
  if (b.name === "Write") return `escreveu ${nome(i.file_path)}`;
  if (b.name === "Edit") return `ajustou ${nome(i.file_path)}`;
  if (b.name === "Read") return `olhou ${nome(i.file_path)}`;
  return b.name;
}

/**
 * O ambiente do Claude Code. Sem `openrouter`: só o login do plano (nenhuma chave de API).
 * Com `openrouter: { chave, modelo, rapido }`: a OpenRouter como provedor, pelas variáveis que ela
 * documenta (a de API da Anthropic vai vazia, senão ele tenta a Anthropic direto).
 */
export function ambienteClaude({ openrouter } = {}) {
  if (!openrouter) return ambienteDaIA({ manter: ["CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_GIT_BASH_PATH"] });
  const { chave, modelo, rapido = "anthropic/claude-haiku-4.5" } = openrouter;
  return ambienteDaIA({
    manter: ["CLAUDE_CODE_GIT_BASH_PATH"],
    extra: {
      ANTHROPIC_BASE_URL: process.env.EDITOR_OPENROUTER_URL || OPENROUTER_BASE, // outro endereço só pra teste
      ANTHROPIC_AUTH_TOKEN: chave,
      ANTHROPIC_API_KEY: "",
      ANTHROPIC_MODEL: modelo,
      ANTHROPIC_DEFAULT_OPUS_MODEL: modelo,
      ANTHROPIC_DEFAULT_SONNET_MODEL: modelo,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: rapido,
      CLAUDE_CODE_SUBAGENT_MODEL: modelo,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    },
  });
}

/**
 * Roda o Claude na oficina com o pedido. Resolve com o resumo que ele escreveu pro criador e o uso
 * (turnos, tempo, tokens; no plano, o custo é só a referência do que seria na API, não é cobrado).
 * `openrouter: { chave }` troca o provedor (motor "openrouter"; `modelo` vira o da OpenRouter).
 */
export function rodarClaude(pasta, prompt, { modelo = process.env.EDITOR_MODELO || "opus", esforco = process.env.EDITOR_ESFORCO || "high", minutos = 50, aoPasso = () => {}, openrouter = null } = {}) {
  return new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--model", modelo, "--effort", esforco, "--tools", FERRAMENTAS_DA_IA, "--setting-sources", "project,local", "--strict-mcp-config", "--no-session-persistence", "--disallowedTools", ...PROIBIDAS, "--allowedTools", ...PERMITIDAS];
    const [cmd, ...antes] = comoRodar(CLAUDE);
    const p = spawn(cmd, [...antes, ...args], { cwd: pasta, env: ambienteClaude({ openrouter: openrouter && { ...openrouter, modelo } }), windowsHide: true });
    let resto = "";
    let final = null;
    let erro = "";
    const passos = [];
    p.stdout.on("data", (d) => {
      resto += d;
      let i;
      while ((i = resto.indexOf("\n")) >= 0) {
        const linha = resto.slice(0, i).trim();
        resto = resto.slice(i + 1);
        if (!linha) continue;
        let ev;
        try {
          ev = JSON.parse(linha);
        } catch {
          continue;
        }
        if (ev.type === "assistant")
          for (const b of ev.message?.content ?? [])
            if (b.type === "tool_use") {
              const passo = descrever(b);
              passos.push(passo);
              aoPasso(passo);
            }
        if (ev.type === "result") final = ev;
      }
    });
    p.stderr.on("data", (d) => {
      erro += d;
      if (erro.length > 100_000) erro = erro.slice(-50_000);
    });
    p.stdin.on("error", () => {});
    p.stdin.end(prompt);
    const relogio = setTimeout(() => {
      p.kill();
      reject(new Error(`o Claude passou de ${minutos} min`));
    }, minutos * 60_000);
    p.on("error", (e) => {
      clearTimeout(relogio);
      reject(e);
    });
    p.on("close", (codigo) => {
      clearTimeout(relogio);
      if (!final) return reject(new Error(`o Claude saiu sem resultado (código ${codigo}): ${erro.slice(-800)}`));
      if (final.is_error || final.subtype !== "success") return reject(new Error(`o Claude não terminou (${final.subtype}): ${String(final.result ?? erro).slice(0, 600)}`));
      resolve({
        resumo: String(final.result ?? "").trim(),
        passos,
        uso: {
          motor: openrouter ? "openrouter" : "claude",
          modelo,
          turnos: final.num_turns,
          duracao_s: Math.round((final.duration_ms ?? 0) / 1000),
          tokens: final.usage ?? null,
          // No plano não é cobrado (é só a referência de quanto seria na API). Na OpenRouter quem
          // mede o gasto de verdade é a estação (saldo da chave antes e depois)
          ...(openrouter ? {} : { equivalente_api_usd: typeof final.total_cost_usd === "number" ? final.total_cost_usd : null }),
        },
      });
    });
  });
}
