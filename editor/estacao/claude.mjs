// O cérebro da edição: Claude Code sem janela (modo -p), rodando no plano Claude do criador.
// Sem chave de API no ambiente, a CLI usa a assinatura logada no PC: não gasta API paga.
//
// Isolado de propósito: só lê e escreve na oficina e só roda os scripts do kit
// (ignora as permissões globais do Claude Code do PC, os conectores MCP e o histórico).
// Onde fica o executável: CLAUDE_BIN, senão ~/.local/bin (instalador nativo), senão o PATH.

import { spawn } from "node:child_process";
import fs from "node:fs";
import { FERRAMENTAS } from "./ferramentas.mjs";

export const CLAUDE = FERRAMENTAS.claude;

const PERMITIDAS = [
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "TodoWrite",
  "Bash(node kit/montar.mjs)",
  "Bash(node kit/montar.mjs:*)",
  "Bash(node kit/print.mjs:*)",
  "Bash(node kit/logo.mjs:*)",
  "Bash(npx --yes hyperframes@0.8.92 lint:*)",
  "Bash(npx --yes hyperframes@0.8.92 snapshot:*)",
  "Bash(npx --yes hyperframes@0.8.92 inspect:*)",
];
const PROIBIDAS = ["PowerShell", "WebFetch", "WebSearch", "Agent", "Task", "NotebookEdit"];

/** Tira do ambiente a chave de API (faria cobrar por uso) e os segredos do sistema (.env.local). */
function ambienteLimpo() {
  const env = { ...process.env };
  const doSistema = new Set();
  try {
    for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m) doSistema.add(m[1]);
    }
  } catch {}
  for (const k of Object.keys(env)) if (doSistema.has(k) || /^ANTHROPIC_/.test(k) || k === "CLAUDECODE" || k === "CLAUDE_CODE_ENTRYPOINT") delete env[k];
  // Caminhos dos programas (não são segredo): os scripts do kit (logo, print) usam os mesmos da estação
  if (FERRAMENTAS.ffmpeg) env.FFMPEG_BIN = FERRAMENTAS.ffmpeg;
  if (FERRAMENTAS.chrome) env.CHROME_BIN = FERRAMENTAS.chrome;
  return env;
}

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
 * Roda o Claude na oficina com o pedido. Resolve com o resumo que ele escreveu pro criador e o uso
 * (turnos, tempo, tokens; o custo é só a referência do que seria na API, não é cobrado).
 */
export function rodarClaude(pasta, prompt, { modelo = process.env.EDITOR_MODELO || "opus", esforco = process.env.EDITOR_ESFORCO || "high", minutos = 50, aoPasso = () => {} } = {}) {
  return new Promise((resolve, reject) => {
    // No Windows o Claude Code também tem PowerShell: desligado, pra valer só as regras do Bash acima
    const args = ["-p", "--output-format", "stream-json", "--verbose", "--model", modelo, "--effort", esforco, "--setting-sources", "project,local", "--strict-mcp-config", "--no-session-persistence", "--disallowedTools", ...PROIBIDAS, "--allowedTools", ...PERMITIDAS];
    const p = spawn(CLAUDE, args, { cwd: pasta, env: ambienteLimpo(), windowsHide: true });
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
        uso: { modelo, turnos: final.num_turns, duracao_s: Math.round((final.duration_ms ?? 0) / 1000), tokens: final.usage ?? null, equivalente_api_usd: final.total_cost_usd ?? null },
      });
    });
  });
}
