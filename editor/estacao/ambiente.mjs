// O ambiente (variáveis) que o motor de IA recebe: sem nenhum segredo do sistema.
// A IA lê vídeo, transcrição, prints e páginas de terceiros; se algum texto ali tentar fazer ela
// "procurar senhas", não tem chave nenhuma pra achar nas variáveis dela.

import fs from "node:fs";
import path from "node:path";
import { FERRAMENTAS, RAIZ_SISTEMA, hyperframesLocal } from "./ferramentas.mjs";

// Nome com cara de segredo, e as chaves de IA/nuvem conhecidas (inclusive a de API da Anthropic
// e da OpenAI: com elas a CLI cobraria por uso em vez de usar o plano)
const PARECE_SEGREDO = /(KEY|SECRET|TOKEN|PASSWORD|PASSWD|SENHA|CREDENTIAL|COOKIE|SESSION)/i;
const SEMPRE_FORA = /^(ANTHROPIC_|OPENAI_|CODEX_API|OPENROUTER_|SUPABASE_|NEXT_PUBLIC_SUPABASE_|AWS_|AZURE_|GOOGLE_API|GEMINI_|GH_|GITHUB_|CLAUDECODE$|CLAUDE_CODE_ENTRYPOINT$)/i;

/** As variáveis do .env.local do sistema (todas ficam fora do motor). */
function doSistema() {
  const nomes = new Set();
  try {
    for (const l of fs.readFileSync(path.join(RAIZ_SISTEMA, ".env.local"), "utf8").split(/\r?\n/)) {
      const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      if (m) nomes.add(m[1]);
    }
  } catch {}
  return nomes;
}

/**
 * Cópia limpa do ambiente pro motor. `manter`: nomes que o motor precisa mesmo (ex.: o token
 * longo do Claude Code no plano). `extra`: o que o motor recebe por cima (ex.: a chave da
 * OpenRouter como token do provedor, só no motor "openrouter").
 */
export function ambienteDaIA({ manter = [], extra = {} } = {}) {
  const fora = doSistema();
  const env = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (manter.includes(k)) env[k] = v;
    else if (!fora.has(k) && !SEMPRE_FORA.test(k) && !PARECE_SEGREDO.test(k)) env[k] = v;
  }
  // Caminhos dos programas (não são segredo): os scripts do kit usam os mesmos da estação
  if (FERRAMENTAS.ffmpeg) env.FFMPEG_BIN = FERRAMENTAS.ffmpeg;
  if (FERRAMENTAS.chrome) env.CHROME_BIN = FERRAMENTAS.chrome;
  const hf = hyperframesLocal();
  if (hf) env.HF_CLI = hf;
  env.HYPERFRAMES_NO_UPDATE_CHECK = "1";
  env.HYPERFRAMES_NO_AUTO_INSTALL = "1";
  return { ...env, ...extra };
}
