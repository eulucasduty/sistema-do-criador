// Motor "codex": o Codex CLI da OpenAI sem janela (codex exec), logado no ChatGPT do criador
// (Plus ou Pro): usa o plano, sem cobrança por vídeo. Docs: https://developers.openai.com/codex
//
// Isolado de propósito:
//  - sandbox workspace-write: só escreve na oficina (e na pasta temporária do sistema);
//  - comandos SEM internet (padrão do sandbox): um texto malicioso num vídeo ou print não consegue
//    mandar nada pra fora. Por isso a logo oficial é buscada pela estação, numa segunda rodada;
//  - sem a configuração do usuário (--ignore-user-config: nada de MCP, plugins nem perfis dele),
//    sem busca na web, sem navegador, sem sub-agentes, sem histórico salvo;
//  - ambiente sem segredo nenhum (ambiente.mjs).
// Ler arquivo fora da oficina o sandbox ainda deixa (Windows e Mac): por isso nada de segredo mora
// em variável, e sem internet não tem pra onde mandar.
//
// Os manuais (kit/EDITOR.md e kit/ESTILO.md) vão também como AGENTS.md na oficina, com as notas
// deste ambiente; o catálogo das cenas (kit/COMPONENTES.md) ele lê de lá.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ambienteDaIA } from "./ambiente.mjs";
import { FERRAMENTAS, comoRodar } from "./ferramentas.mjs";

const WIN = process.platform === "win32";
const CODEX_HOME = process.env.CODEX_HOME || path.join(os.homedir(), ".codex");

/**
 * Windows: o sandbox "elevated" (usuários próprios do Codex + firewall) é o que bloqueia a
 * internet de verdade e deixa o Chrome dos snapshots abrir. Ele precisa de uma preparação com
 * administrador, uma vez (o instalador faz). Sem ela, o "unelevated" (mais fraco, e sem snapshot).
 */
export const sandboxDoWindows = () => (fs.existsSync(path.join(CODEX_HOME, ".sandbox", "setup_marker.json")) ? "elevated" : "unelevated");
// Recursos do Codex que não servem pra editar vídeo (e abririam porta pra internet ou pro PC)
const DESLIGADOS = ["apps", "browser_use", "computer_use", "image_generation", "in_app_browser", "multi_agent", "plugins"];

const NOTAS = `# Oficina de edição (instruções do Codex)

Notas deste ambiente, que valem por cima do manual abaixo:

- Os comandos rodam num sandbox **sem internet**. \`kit/logo.mjs\` não funciona aqui. Precisa de
  logo oficial? Logo depois de decupar, escreva \`dados/buscar.json\` assim:
  \`{"logos": [{"marca": "Notion", "site": "notion.so"}]}\` (até 8, só o nome e o domínio) e termine
  a rodada respondendo só **BUSCAR**. A estação busca e te chama de novo com o resultado. Se não
  precisar de logo, siga direto. Os prints dos links do criador já estão em \`materiais/\`.
- Pra **olhar uma imagem** (folha de quadros, emendas, tomadas, materiais, logos, snapshots) use a
  ferramenta \`view_image\` com o caminho do arquivo. Não leia imagem como texto. Logo em .svg não
  abre no view_image: confira ela no snapshot.
- Pra ler texto use comandos de leitura; pra criar e editar arquivos, apply_patch. Tudo dentro
  desta pasta.
- Os comandos do kit são \`node kit/montar.mjs\`, \`node kit/hf.mjs lint\` e
  \`node kit/hf.mjs snapshot --at "1.2,3.4"\` (a lista do --at sempre entre aspas).
- O catálogo das cenas do plano está em \`kit/COMPONENTES.md\`: leia antes de escrever o plano.
- Não instale nada, não use a internet e não mexa em \`assets/\` nem em \`kit/\`.

---

`;

/**
 * AGENTS.md da oficina: as notas do Codex + o manual inteiro + o manual do estilo desta edição (o
 * Codex lê sozinho ao começar). Fica abaixo do limite de 32 KB do AGENTS.md; por isso o catálogo
 * das cenas (kit/COMPONENTES.md) vai por leitura.
 */
export function escreverAgentsMd(pasta) {
  const manual = fs.readFileSync(path.join(pasta, "kit", "EDITOR.md"), "utf8");
  const arquivoEstilo = path.join(pasta, "kit", "ESTILO.md");
  const estilo = fs.existsSync(arquivoEstilo) ? `\n\n---\n\n${fs.readFileSync(arquivoEstilo, "utf8")}` : "";
  fs.writeFileSync(path.join(pasta, "AGENTS.md"), NOTAS + manual + estilo);
}

/** "powershell.exe -Command 'node kit/montar.mjs'" → "node kit/montar.mjs" (o log fica legível). */
function comandoLimpo(c) {
  let s = String(c ?? "")
    .replace(/^\s*"?[^"\s]*?(powershell|pwsh)(\.exe)?"?\s+(-NoProfile\s+)?-Command\s+/i, "")
    .replace(/^\s*"?[^"\s]*?(bash|zsh|sh)"?\s+-l?c\s+/i, "")
    .trim();
  if (/^(["']).*\1$/.test(s) && !s.slice(1, -1).includes(s[0])) s = s.slice(1, -1);
  return s.replace(/\s+/g, " ").trim();
}

function descrever(item) {
  const nome = (f) => String(f ?? "").split(/[\\/]/).slice(-2).join("/");
  if (item.type === "command_execution") return `rodou ${comandoLimpo(item.command).slice(0, 140)}`;
  if (item.type === "file_change") {
    const mudancas = item.changes ?? [];
    const novo = mudancas.every((m) => m.kind === "add");
    return `${novo ? "escreveu" : "ajustou"} ${mudancas.map((m) => nome(m.path)).join(", ").slice(0, 140)}`;
  }
  return null;
}

/** Erro do Codex em português simples (o original vai junto). */
function explicar(msg) {
  const m = String(msg ?? "").trim();
  if (/usage limit|rate limit|hit your/i.test(m)) return `o seu plano do ChatGPT bateu no limite de uso do Codex (espere o horário que ele diz ou troque quem edita no painel): ${m.slice(0, 300)}`;
  if (/log ?in|auth|unauthori[sz]ed|401|token/i.test(m)) return `o Codex não está logado no ChatGPT (no terminal: codex login): ${m.slice(0, 300)}`;
  return m.slice(0, 600);
}

/**
 * Roda o Codex na oficina. Mesmo contrato do rodarClaude: resolve com { resumo, passos, uso, sessao }.
 * `retomar`: id da sessão pra continuar a conversa (a segunda rodada, depois das logos).
 */
export function rodarCodex(pasta, prompt, { modelo = null, esforco = process.env.EDITOR_ESFORCO || "high", minutos = 50, aoPasso = () => {}, retomar = null } = {}) {
  if (!FERRAMENTAS.codex) return Promise.reject(new Error("o Codex não está instalado neste PC (npm install -g @openai/codex)"));
  if (!retomar) escreverAgentsMd(pasta);
  const config = [
    'web_search="disabled"',
    `model_reasoning_effort="${esforco}"`,
    "sandbox_workspace_write.network_access=false",
    "tools.view_image=true",
    "project_root_markers=[]", // só o AGENTS.md da oficina (não o do sistema)
    ...(WIN ? [`windows.sandbox="${sandboxDoWindows()}"`] : []),
  ];
  const opcoes = ["--json", "--color", "never", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "-C", pasta, "-s", "workspace-write", ...config.flatMap((c) => ["-c", c]), ...DESLIGADOS.flatMap((f) => ["--disable", f]), ...(modelo ? ["-m", modelo] : [])];
  const args = ["exec", ...opcoes, ...(retomar ? ["resume", retomar, "-"] : ["-"])];
  // PowerShell (Windows) com política de script liberada só pros comandos do Codex
  const env = ambienteDaIA({ extra: WIN ? { PSExecutionPolicyPreference: "Bypass" } : {} });
  return new Promise((resolve, reject) => {
    const [cmd, ...antes] = comoRodar(FERRAMENTAS.codex);
    const inicio = Date.now();
    const p = spawn(cmd, [...antes, ...args], { cwd: pasta, env, windowsHide: true });
    let resto = "";
    let resumo = "";
    let uso = null;
    let falha = null;
    let sessao = retomar;
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
        if (ev.type === "thread.started") sessao = ev.thread_id ?? sessao;
        else if (ev.type === "item.started" && ev.item?.type === "command_execution") {
          const passo = descrever(ev.item);
          passos.push(passo);
          aoPasso(passo);
        } else if (ev.type === "item.completed") {
          if (ev.item?.type === "agent_message") resumo = String(ev.item.text ?? "").trim() || resumo;
          else if (ev.item?.type === "file_change") {
            const passo = descrever(ev.item);
            if (passo) {
              passos.push(passo);
              aoPasso(passo);
            }
          }
        } else if (ev.type === "turn.completed") uso = ev.usage ?? uso;
        else if (ev.type === "turn.failed") falha = ev.error?.message ?? "o turno falhou";
        else if (ev.type === "error") falha = ev.message ?? falha;
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
      reject(new Error(`o ChatGPT passou de ${minutos} min`));
    }, minutos * 60_000);
    p.on("error", (e) => {
      clearTimeout(relogio);
      reject(e);
    });
    p.on("close", (codigo) => {
      clearTimeout(relogio);
      if (codigo !== 0 || falha || !resumo) return reject(new Error(`o ChatGPT não terminou (código ${codigo}): ${explicar(falha ?? erro.slice(-800))}`));
      resolve({
        resumo,
        passos,
        sessao,
        uso: {
          motor: "codex",
          modelo: modelo ?? "padrão do ChatGPT",
          turnos: passos.length,
          duracao_s: Math.round((Date.now() - inicio) / 1000),
          tokens: uso,
        },
      });
    });
  });
}
