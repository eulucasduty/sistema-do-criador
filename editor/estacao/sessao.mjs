// Como a estação entra no sistema: COMO O DONO (o mesmo e-mail e senha do painel), sem chave
// secreta no PC. Tudo que ela faz no banco e no storage passa pela RLS, como se fosse você no painel.
//
// Na primeira vez ela pergunta no terminal o endereço do sistema, o e-mail e a senha. A senha não
// fica guardada: fica só a sessão (o token que se renova sozinho) em ~/.sistema-do-criador/sessao.json,
// com permissão só pro seu usuário do PC. Pra entrar com outra conta: npm run estacao -- --sair
//
// Modo avançado: com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY no .env.local, usa a chave
// secreta (passa por cima da RLS) e não pergunta nada.

import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";

export const PASTA_SESSAO = path.join(os.homedir(), ".sistema-do-criador");
export const ARQUIVO_SESSAO = path.join(PASTA_SESSAO, "sessao.json");

// ── o arquivo da sessão ────────────────────────────────────────────
export function lerSessao() {
  try {
    return JSON.parse(fs.readFileSync(ARQUIVO_SESSAO, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Só o seu usuário lê. No Windows, sem herdar permissão da pasta: assim nem o sandbox do Codex
 * (que roda com um usuário próprio) consegue abrir o arquivo.
 */
function trancar(arquivo) {
  if (process.platform === "win32") {
    const quem = process.env.USERDOMAIN && process.env.USERNAME ? `${process.env.USERDOMAIN}\\${process.env.USERNAME}` : os.userInfo().username;
    spawnSync("icacls", [arquivo, "/inheritance:r", "/grant:r", `${quem}:F`], { windowsHide: true, timeout: 30_000 });
  } else {
    try {
      fs.chmodSync(arquivo, 0o600);
    } catch {}
  }
}

function gravarSessao(dados) {
  fs.mkdirSync(PASTA_SESSAO, { recursive: true, mode: 0o700 });
  const tmp = `${ARQUIVO_SESSAO}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(dados, null, 2), { mode: 0o600 });
  trancar(tmp);
  fs.renameSync(tmp, ARQUIVO_SESSAO);
  trancar(ARQUIVO_SESSAO);
}

export function esquecerSessao() {
  fs.rmSync(ARQUIVO_SESSAO, { force: true });
  fs.rmSync(`${ARQUIVO_SESSAO}.tmp`, { force: true });
}

// O supabase-js guarda a sessão aqui dentro (campo "auth") e renova sozinho
const armazem = {
  getItem: (k) => lerSessao()?.auth?.[k] ?? null,
  setItem: (k, v) => {
    const d = lerSessao() ?? {};
    gravarSessao({ ...d, auth: { ...(d.auth ?? {}), [k]: v } });
  },
  removeItem: (k) => {
    const d = lerSessao();
    if (!d?.auth || !(k in d.auth)) return;
    delete d.auth[k];
    gravarSessao(d);
  },
};

function clienteDoDono({ supabaseUrl, publishableKey }) {
  return createClient(supabaseUrl, publishableKey, { auth: { storage: armazem, storageKey: "sessao", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
}

// ── perguntas no terminal ──────────────────────────────────────────
async function perguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(texto)).trim();
  } finally {
    rl.close();
  }
}

/** Pergunta sem mostrar o que a pessoa digita (a senha aparece como ****). */
function perguntarSegredo(texto) {
  const entrada = process.stdin;
  if (!entrada.isTTY) return perguntar(texto);
  return new Promise((resolve) => {
    process.stdout.write(texto);
    let valor = "";
    const fim = () => {
      entrada.off("data", tecla);
      entrada.setRawMode(false);
      entrada.pause();
      process.stdout.write("\n");
      resolve(valor);
    };
    const tecla = (pedaco) => {
      for (const c of String(pedaco)) {
        if (c === "\r" || c === "\n") return fim();
        if (c === "\u0003") {
          process.stdout.write("\n");
          process.exit(130);
        }
        if (c === "\u007f" || c === "\b") {
          if (valor) {
            valor = valor.slice(0, -1);
            process.stdout.write("\b \b");
          }
        } else if (c >= " ") {
          valor += c;
          process.stdout.write("*");
        }
      }
    };
    entrada.setRawMode(true);
    entrada.setEncoding("utf8");
    entrada.resume();
    entrada.on("data", tecla);
  });
}

/** "meu-sistema.vercel.app/login" → "https://meu-sistema.vercel.app" */
export function limparEndereco(texto) {
  let t = String(texto ?? "").trim();
  if (!t) return null;
  if (!/^https?:\/\//i.test(t)) t = `${/^(localhost|127\.0\.0\.1)(:\d+)?/i.test(t) ? "http" : "https"}://${t}`;
  try {
    const u = new URL(t);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/** O sistema responde em /api/estacao com os 2 valores públicos do Supabase (os mesmos do navegador). */
export async function buscarConexao(endereco) {
  const r = await fetch(`${endereco}/api/estacao`, { headers: { accept: "application/json" }, redirect: "follow", signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`o endereço respondeu ${r.status}`);
  const j = await r.json().catch(() => null);
  if (!j?.supabaseUrl || !j?.publishableKey) throw new Error("esse endereço não parece o Sistema do Criador (ou ele ainda não tem o Supabase configurado)");
  return { supabaseUrl: String(j.supabaseUrl), publishableKey: String(j.publishableKey) };
}

/** A conta logada é da equipe? (a RLS só mostra a linha da própria pessoa) */
async function conferirEquipe(db, usuarioId) {
  const { data, error } = await db.from("equipe").select("papel").eq("usuario_id", usuarioId).maybeSingle();
  if (error) throw new Error(`não consegui conferir o acesso: ${error.message}`);
  if (!data) throw new Error("esse login não tem acesso ao sistema (use o e-mail do dono, o mesmo do painel)");
  return data.papel;
}

/** Primeira vez: pergunta endereço, e-mail e senha e entra. */
async function primeiraVez({ aviso }) {
  const antes = lerSessao();
  aviso("");
  aviso("Primeira vez neste PC: a estação vai entrar no seu sistema com o SEU login (o mesmo do painel).");
  aviso("A senha não fica guardada: fica só a sessão, num arquivo que só o seu usuário do PC abre.");
  aviso("");
  let conexao = null;
  let endereco = null;
  for (let tentativa = 1; !conexao; tentativa++) {
    const padrao = antes?.endereco ? ` [${antes.endereco}]` : "";
    endereco = limparEndereco((await perguntar(`Endereço do seu sistema (ex.: https://meu-sistema.vercel.app)${padrao}: `)) || antes?.endereco);
    if (!endereco) {
      aviso("  Digite o endereço que você abre no navegador pra ver o painel.");
      continue;
    }
    try {
      conexao = await buscarConexao(endereco);
    } catch (e) {
      aviso(`  Não achei o sistema em ${endereco}: ${e.message}. Confira o endereço (é o mesmo do painel).`);
      if (tentativa >= 5) throw new Error("não consegui achar o sistema: confira o endereço e abra a estação de novo");
    }
  }
  gravarSessao({ endereco, ...conexao, email: antes?.email ?? null, auth: {} });
  const db = clienteDoDono(conexao);
  let ultimo = antes?.email ?? "";
  for (let tentativa = 1; ; tentativa++) {
    const email = (await perguntar(`E-mail (o do login do painel)${ultimo ? ` [${ultimo}]` : ""}: `)) || ultimo;
    ultimo = email;
    const senha = await perguntarSegredo("Senha: ");
    const { data, error } = await db.auth.signInWithPassword({ email, password: senha });
    if (error || !data?.user) {
      aviso(`  Não deu pra entrar (${/invalid/i.test(error?.message ?? "") ? "e-mail ou senha errados" : error?.message ?? "sem resposta"}). Tente de novo.`);
      if (tentativa >= 5) throw new Error("não consegui entrar: confira o e-mail e a senha no painel e abra a estação de novo");
      continue;
    }
    try {
      await conferirEquipe(db, data.user.id);
    } catch (e) {
      await db.auth.signOut({ scope: "local" }).catch(() => {});
      esquecerSessao();
      throw e;
    }
    gravarSessao({ ...(lerSessao() ?? {}), email });
    aviso(`  Pronto: a estação entrou como ${email}.`);
    return { db, modo: "dono", quem: email, endereco };
  }
}

/**
 * Conecta a estação ao sistema. Devolve { db, modo: "chave" | "dono", quem, endereco }.
 * `interativo`: pode perguntar no terminal (sem isso, e sem sessão, dá erro explicando o que fazer).
 */
export async function conectar({ interativo = Boolean(process.stdin.isTTY), aviso = console.log } = {}) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (url && chave) return { db: createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } }), modo: "chave", quem: "chave secreta do .env.local", endereco: null };

  const salvo = lerSessao();
  if (salvo?.supabaseUrl && salvo?.publishableKey && salvo.auth && Object.keys(salvo.auth).length) {
    const db = clienteDoDono(salvo);
    const { data, error } = await db.auth.getUser();
    if (data?.user) {
      await conferirEquipe(db, data.user.id);
      return { db, modo: "dono", quem: salvo.email ?? data.user.email ?? "dono", endereco: salvo.endereco ?? null };
    }
    // Sem internet: a sessão continua valendo, só tenta de novo depois
    if (error && (error.name === "AuthRetryableFetchError" || /fetch|network|ENOTFOUND|ECONN|timeout/i.test(error.message))) throw Object.assign(new Error(`sem conexão com o sistema (${error.message})`), { tentarDeNovo: true });
    aviso("A sessão salva venceu ou foi desfeita: vamos entrar de novo.");
  }
  if (!interativo) throw new Error('a estação ainda não entrou no sistema: abra pelo atalho "Estação de edição" (ou npm run estacao) e digite o endereço, o e-mail e a senha');
  return primeiraVez({ aviso });
}
