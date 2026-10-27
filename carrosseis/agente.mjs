import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const CODEX = process.env.CODEX_BIN || path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@openai", "codex", "bin", "codex.js");
const claudeInstalado = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
const CLAUDE = process.env.CLAUDE_BIN || (fs.existsSync(claudeInstalado) ? claudeInstalado : "claude");
const processos = new Set();
function encerrarProcesso(p) {
  if (process.platform !== "win32") { p.kill(); return Promise.resolve(); }
  return new Promise(resolve => {
    const fim = spawn("taskkill", ["/PID", String(p.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    fim.once("error", () => { p.kill(); resolve(); });
    fim.once("close", () => resolve());
  });
}
export async function encerrarAgentesCarrossel() { await Promise.all([...processos].map(encerrarProcesso)); }

/** Retira as chaves da aplicação e de API; as CLIs usam o login da assinatura. */
export function ambienteDoCarrossel(raiz = process.cwd()) {
  const env = { ...process.env };
  const segredo = new Set();
  for (const arquivo of [".env.local", ".env"]) {
    try {
      for (const linha of fs.readFileSync(path.join(raiz, arquivo), "utf8").split(/\r?\n/)) {
        const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
        if (m) segredo.add(m[1]);
      }
    } catch {}
  }
  for (const k of Object.keys(env)) {
    if (segredo.has(k) || /^(ANTHROPIC_|OPENAI_|SUPABASE_|DATABASE_|PORTAINER_|WABA_|IG_|META_)/.test(k) || k === "CLAUDECODE" || k === "CLAUDE_CODE_ENTRYPOINT") delete env[k];
    if (k.startsWith("CODEX_") && !["CODEX_HOME", "CODEX_BIN"].includes(k)) delete env[k];
  }
  return env;
}

/** @param {string} pasta
 * @param {{agente: 'codex'|'claude', total: number, videos?: number[], aoPasso?: (s: string) => void, minutos?: number, correcao?: string, modoVisual?: 'copiar'|'recriar'}} opcoes
 */
export function criarComCLI(pasta, { agente, total, videos = [], aoPasso = () => {}, minutos, correcao = "", modoVisual = "copiar" }) {
  const recriar = modoVisual === "recriar";
  minutos ??= recriar ? 75 : 45;
  const nn = n => String(n).padStart(2, "0");
  const emVideo = videos.length ? `
Os slides ${videos.join(", ")} são VÍDEO no original: veja referencias/NN.png e referencias/NN-quadros.jpg de cada um e siga a seção "Slides em vídeo" do kit/CRIAR.md (parte estática em HTML + o motion recortado com node kit/recortar-video.mjs). ` : "";
  const visual = recriar
    ? `MODO VISUAL "RECRIAR" (siga a seção "Modo recriar" do kit/CRIAR.md): mantenha a identidade visual de cada slide (cores, tipografia, escala, gramática da composição, elementos recorrentes), mas NÃO reaproveite as fotos, renders e ilustrações do original: crie imagens NOVAS com node kit/gerar-imagem.mjs, parecidas no assunto, clima e cores e coerentes com a mensagem. Logos de ferramentas e prints reais de produto podem ser recortados do original. Não decalque o original: a composição pode variar dentro da mesma linguagem visual.`
    : `Copie a composição visual de cada um. Conserve fotos e prints usando recortes reais.`;
  const prompt = `Leia kit/CRIAR.md e dados/pedido.json. Veja individualmente TODOS os ${total} arquivos em referencias/01.png até ${String(total).padStart(2, "0")}. ${visual} Traduza todo o texto editorial para PT-BR, troque somente a headline da capa conforme o pedido. ${fs.existsSync(path.join(pasta, "moldes", "carrossel.html")) ? "Há um molde deste estilo em moldes/carrossel.html: reaproveite o CSS e a estrutura (veja kit/CRIAR.md). " : ""}Escreva carrossel.html e conteudo.json, renderize com node kit/renderizar.mjs e revise pela folha saida/contato.jpg (abra um PNG individual só se algum slide parecer ter problema). Não use template genérico e não invente texto nem slides.${emVideo} ${correcao ? `\nCorrija os arquivos já produzidos: ${correcao}` : ""}`;
  const args = agente === "codex"
    ? [CODEX, "exec", "--ignore-user-config", "--skip-git-repo-check", "--ephemeral", "--json", "--color", "never", "--sandbox", "workspace-write", "-c", 'approval_policy="never"', "-c", 'model_reasoning_effort="high"']
    : ["-p", "--output-format", "stream-json", "--verbose", "--model", process.env.CARROSSEL_CLAUDE_MODELO || "sonnet", "--effort", process.env.CARROSSEL_CLAUDE_ESFORCO || "medium", "--setting-sources", "project,local", "--strict-mcp-config", "--no-session-persistence", "--disallowedTools", "WebFetch", "WebSearch", "Agent", "Task", "PowerShell", "--allowedTools", "Read", "Write", "Edit", "Glob", "Grep", "Bash(node kit/renderizar.mjs)", "Bash(node kit/recortar.mjs:*)", "Bash(node kit/fundo.mjs:*)", "Bash(node kit/recortar-video.mjs:*)", "Bash(node kit/gerar-imagem.mjs:*)"];
  if (agente === "codex") {
    if (process.platform === "win32") args.push("-c", 'windows.sandbox="unelevated"');
    if (process.env.CARROSSEL_CODEX_MODELO) args.push("--model", process.env.CARROSSEL_CODEX_MODELO);
    for (let i = 1; i <= total; i++) args.push("--image", path.join(pasta, "referencias", `${nn(i)}.png`));
    for (const n of videos) args.push("--image", path.join(pasta, "referencias", `${nn(n)}-quadros.jpg`));
    args.push("-");
  }
  return new Promise((resolve, reject) => {
    const p = spawn(agente === "codex" ? process.execPath : CLAUDE, args, { cwd: pasta, env: ambienteDoCarrossel(), windowsHide: true });
    processos.add(p);
    let resto = "", erro = "", terminou = false, resumo = "", modelo = agente === "codex" ? "codex" : `claude-${process.env.CARROSSEL_CLAUDE_MODELO || "sonnet"}`;
    const inicio = Date.now();
    const ler = l => {
      let ev;
      try { ev = JSON.parse(l); } catch { return; }
      if (agente === "codex") {
        if (ev.type === "turn.completed") terminou = true;
        if (ev.type === "error" || ev.type === "turn.failed") erro += ev.message ?? ev.error?.message ?? "falha no Codex";
        if (ev.type === "item.completed") {
          if (ev.item?.type === "agent_message") resumo = ev.item.text;
          if (ev.item?.type === "command_execution") {
            const comando = String(ev.item.command ?? "");
            if (ev.item.exit_code) console.error(`[carrossel] comando não terminou: ${String(ev.item.aggregated_output ?? "").slice(-1200)}`);
            aoPasso(/renderizar/.test(comando) ? "renderizando e conferindo as artes" : /recortar-video/.test(comando) ? "recortando o motion dos slides em vídeo" : /recortar/.test(comando) ? "aproveitando as fotos e prints originais" : /referencias/.test(comando) ? "conferindo os slides de referência" : "ajustando a composição dos slides");
          }
          if (ev.item?.type === "file_change") aoPasso("ajustando os arquivos dos slides");
        }
      } else {
        if (ev.type === "assistant") for (const b of ev.message?.content ?? []) if (b.type === "tool_use") aoPasso(b.name === "Read" ? "conferindo os slides e as artes" : /renderizar/.test(b.input?.command ?? "") ? "renderizando e conferindo as artes" : /gerar-imagem/.test(b.input?.command ?? "") ? "gerando as imagens novas no ChatGPT" : "ajustando a composição dos slides");
        if (ev.type === "result") { terminou = ev.subtype === "success" && !ev.is_error; resumo = ev.result ?? ""; if (!terminou) erro += resumo; }
      }
    };
    p.stdout.on("data", d => { resto += d; let i; while ((i = resto.indexOf("\n")) >= 0) { ler(resto.slice(0, i)); resto = resto.slice(i + 1); } });
    p.stderr.on("data", d => { erro = (erro + d).slice(-4000); });
    p.stdin.on("error", () => {});
    p.stdin.end(prompt);
    const t = setTimeout(() => { void encerrarProcesso(p); reject(new Error(`A criação passou de ${minutos} minutos.`)); }, minutos * 60_000);
    p.on("error", e => { processos.delete(p); clearTimeout(t); reject(e); });
    p.on("close", codigo => {
      clearTimeout(t);
      processos.delete(p);
      if (resto.trim()) ler(resto);
      if (codigo !== 0 || !terminou) {
        const msg = `${agente} não terminou: ${erro.slice(-1200)}`;
        // Limite do plano OU login da CLI fora do ar (ex.: conta trocada no meio da fila, 18/10): o trabalho
        // volta pra fila e a estação espera, em vez de reprovar a fila inteira em segundos.
        return reject(Object.assign(new Error(msg), { limite: /usage limit|rate.?limit|limit reached|quota|hit your .{0,24}limit|subscription access|not logged in|please run .{0,10}login|invalid api key|authentication/i.test(msg) }));
      }
      resolve({ resumo, modelo, duracao_s: Math.round((Date.now() - inicio) / 1000) });
    });
  });
}
