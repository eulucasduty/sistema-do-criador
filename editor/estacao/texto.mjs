// Texto puro pela IA da estação, sem ferramenta nenhuma: os roteiros pra teleprompter
// (editor/estacao/roteiros.mjs). Mesmo motor que edita os vídeos (escolhido no painel), num
// pedido curto: o system prompt + o pedido entram, o texto da resposta sai.
//   claude      Claude Code (claude -p) no plano do criador: sem custo
//   openrouter  o mesmo Claude Code apontado pra OpenRouter, com a chave do painel: paga por uso
//   codex       Codex (codex exec) logado no ChatGPT do criador: sem custo
//
// Isolado igual à edição: roda numa pasta temporária vazia, sem as configurações do PC, sem MCP,
// sem histórico, sem nenhuma ferramenta (Claude) ou com o sandbox só de leitura e sem internet
// (Codex), e com o ambiente sem segredo (ambiente.mjs). A pasta some no fim.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ambienteDaIA } from "./ambiente.mjs";
import { CLAUDE, ambienteClaude } from "./claude.mjs";
import { sandboxDoWindows } from "./codex.mjs";
import { FERRAMENTAS, comoRodar } from "./ferramentas.mjs";

/** O plano (Claude ou ChatGPT) bateu no limite de uso: volta sozinho depois de umas horas. */
const LIMITE = /usage limit|hit your .{0,24}limit|limit reached|out of extra usage|rate.?limit|exceeded.*quota/i;
const falha = (msg) => Object.assign(new Error(msg), { limite: LIMITE.test(msg) });

// Recursos do Codex que não servem pra escrever texto (os mesmos que a edição desliga)
const DESLIGADOS = ["apps", "browser_use", "computer_use", "image_generation", "in_app_browser", "multi_agent", "plugins"];

const pastaVazia = () => fs.mkdtempSync(path.join(os.tmpdir(), "roteiro-"));
const apagar = (pasta) => fs.rmSync(pasta, { recursive: true, force: true });

/**
 * Claude Code sem janela e sem ferramenta. `openrouter: { chave }` troca o provedor (o `modelo`
 * vira o da OpenRouter). Resolve com { texto, uso: { modelo, duracao_s, custo_usd } }; no plano,
 * `custo_usd` é só a referência de quanto seria na API (não é cobrado).
 * @param {{ sistema: string, prompt: string, modelo: string, esforco?: string, minutos?: number, openrouter?: { chave: string } | null }} o
 */
export function claudeTexto({ sistema, prompt, modelo, esforco = "medium", minutos = 10, openrouter = null }) {
  return new Promise((resolve, reject) => {
    const pasta = pastaVazia();
    const arquivo = path.join(pasta, "sistema.md");
    fs.writeFileSync(arquivo, sistema);
    const args = ["-p", "--output-format", "json", "--model", modelo, "--effort", esforco, "--tools", "", "--system-prompt-file", arquivo, "--setting-sources", "project,local", "--strict-mcp-config", "--no-session-persistence"];
    const [cmd, ...antes] = comoRodar(CLAUDE);
    let p;
    try {
      p = spawn(cmd, [...antes, ...args], { cwd: pasta, env: ambienteClaude({ openrouter: openrouter && { ...openrouter, modelo } }), windowsHide: true });
    } catch (e) {
      apagar(pasta);
      return reject(e);
    }
    let saida = "";
    let erro = "";
    p.stdout.on("data", (d) => (saida += d));
    p.stderr.on("data", (d) => (erro = (erro + d).slice(-20_000)));
    p.stdin.on("error", () => {});
    p.stdin.end(prompt);
    const relogio = setTimeout(() => p.kill(), minutos * 60_000);
    p.on("error", (e) => {
      clearTimeout(relogio);
      apagar(pasta);
      reject(e);
    });
    p.on("close", (codigo) => {
      clearTimeout(relogio);
      apagar(pasta);
      let final = null;
      for (const tentativa of [saida.trim(), saida.trim().split("\n").pop() ?? ""]) {
        try {
          final = JSON.parse(tentativa);
          break;
        } catch {}
      }
      if (!final) return reject(falha(`o Claude saiu sem resultado (código ${codigo}): ${(erro || saida).slice(-600)}`));
      if (final.is_error || final.subtype !== "success") return reject(falha(`o Claude não terminou (${final.subtype}): ${String(final.result ?? erro).slice(0, 600)}`));
      resolve({
        texto: String(final.result ?? "").trim(),
        uso: { modelo, duracao_s: Math.round((final.duration_ms ?? 0) / 1000), custo_usd: typeof final.total_cost_usd === "number" ? final.total_cost_usd : 0 },
      });
    });
  });
}

/**
 * Codex sem janela, logado no ChatGPT: sandbox só de leitura, sem internet, sem a configuração do
 * usuário. O system prompt vai junto do pedido (o codex exec recebe um texto só).
 * @param {{ sistema: string, prompt: string, modelo?: string | null, esforco?: string, minutos?: number }} o
 */
export function codexTexto({ sistema, prompt, modelo = null, esforco = "medium", minutos = 10 }) {
  if (!FERRAMENTAS.codex) return Promise.reject(new Error("o Codex não está instalado neste PC (npm install -g @openai/codex)"));
  return new Promise((resolve, reject) => {
    const pasta = pastaVazia();
    const config = [
      'web_search="disabled"',
      `model_reasoning_effort="${esforco}"`,
      "project_root_markers=[]",
      ...(process.platform === "win32" ? [`windows.sandbox="${sandboxDoWindows()}"`] : []),
    ];
    const args = ["exec", "--json", "--color", "never", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "-C", pasta, "-s", "read-only", ...config.flatMap((c) => ["-c", c]), ...DESLIGADOS.flatMap((f) => ["--disable", f]), ...(modelo ? ["-m", modelo] : []), "-"];
    const [cmd, ...antes] = comoRodar(FERRAMENTAS.codex);
    const inicio = Date.now();
    let p;
    try {
      p = spawn(cmd, [...antes, ...args], { cwd: pasta, env: ambienteDaIA(), windowsHide: true });
    } catch (e) {
      apagar(pasta);
      return reject(e);
    }
    let resto = "";
    let texto = "";
    let problema = null;
    let erro = "";
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
        if (ev.type === "item.completed" && ev.item?.type === "agent_message") texto = String(ev.item.text ?? "").trim() || texto;
        else if (ev.type === "turn.failed") problema = ev.error?.message ?? "o turno falhou";
        else if (ev.type === "error") problema = ev.message ?? problema;
      }
    });
    p.stderr.on("data", (d) => (erro = (erro + d).slice(-20_000)));
    p.stdin.on("error", () => {});
    p.stdin.end(`${sistema}\n\n---\n\nResponda só com o texto pedido, sem usar ferramenta nenhuma e sem criar arquivo.\n\n${prompt}`);
    const relogio = setTimeout(() => p.kill(), minutos * 60_000);
    p.on("error", (e) => {
      clearTimeout(relogio);
      apagar(pasta);
      reject(e);
    });
    p.on("close", (codigo) => {
      clearTimeout(relogio);
      apagar(pasta);
      if (codigo !== 0 || problema || !texto) {
        const msg = String(problema ?? erro.slice(-600)).trim();
        if (/log ?in|unauthori[sz]ed|401/i.test(msg)) return reject(falha(`o Codex não está logado no ChatGPT (no terminal: codex login): ${msg.slice(0, 300)}`));
        return reject(falha(`o ChatGPT não terminou (código ${codigo}): ${msg.slice(0, 600)}`));
      }
      resolve({ texto, uso: { modelo: modelo ?? "padrão do ChatGPT", duracao_s: Math.round((Date.now() - inicio) / 1000), custo_usd: 0 } });
    });
  });
}
