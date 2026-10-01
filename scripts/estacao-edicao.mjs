// Estação de edição de vídeo: roda no PC do criador e fica esperando pedidos do painel.
//   Atalho "Estação de edição" (o instalador cria) ou: npm run estacao
//   npm run estacao -- --testar-motor   confere se quem edita (Claude, ChatGPT ou OpenRouter) está pronto
//   npm run estacao -- --preparar       só instala o que falta do kit (HyperFrames, GSAP, Chrome) e sai
//   npm run estacao -- --sair           esquece o login deste PC (na próxima vez pergunta de novo)
//   npm run estacao -- --help
// Instalação: instalar/windows.ps1 e instalar/mac.sh (passo a passo em editor/INSTALAR.md).
//
// Entra no sistema como o dono (editor/estacao/sessao.mjs): na primeira vez pergunta o endereço, o
// e-mail e a senha; depois lembra sozinha. Tudo passa pela RLS, sem chave secreta no PC.
// Pega o pedido mais antigo "na fila", lê o perfil do criador e quem edita (configuracao "perfil"
// e "editor", a cada pedido), baixa o vídeo e os materiais do storage (em partes), faz a edição
// (editor/estacao/fluxo.mjs: oficina → IA → render) e sobe o vídeo pronto pro painel.
// O vídeo final também fica no PC (EDITOR_SAIDA; padrão: Vídeos/Creator System).
// Pra parar: Ctrl+C.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { editar, versaoWeb } from "../editor/estacao/fluxo.mjs";
import { acharPrograma, COMO_INSTALAR, FERRAMENTAS, faltaNoFfmpeg, garantirFerramentas } from "../editor/estacao/ferramentas.mjs";
import { configMotor, conferirMotor, lerChaveOpenRouter, lerConfigMotor, MOTORES, prepararMotor } from "../editor/estacao/motor.mjs";
import { conectar, esquecerSessao, ARQUIVO_SESSAO } from "../editor/estacao/sessao.mjs";
import { sincronizarSons } from "../editor/estacao/sons.mjs";

const AJUDA = `Estação de edição do Creator System

  npm run estacao                     liga a estação (na 1ª vez pede endereço, e-mail e senha)
  npm run estacao -- --testar-motor   confere se quem edita os vídeos está instalado e logado
  npm run estacao -- --preparar       instala o que falta do kit (HyperFrames, GSAP, Chrome) e sai
  npm run estacao -- --sair           esquece o login deste PC
  npm run estacao -- --motor codex    (1ª vez) já salva quem edita: claude, codex ou openrouter

Quem edita: você escolhe no painel (Editor de vídeo → "Quem edita os seus vídeos").
Guia: editor/INSTALAR.md`;

const argv = process.argv.slice(2);
const tem = (f) => argv.includes(f);
const valor = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined);

const BUCKET = "edicao";
const RAIZ = path.resolve("editor", "oficina");
const SAIDA = process.env.EDITOR_SAIDA || path.join(os.homedir(), "Videos", "Creator System");
const MAQUINA = os.hostname();
const ESPERA_MS = 8000;
const EM_ANDAMENTO = ["preparando", "editando", "renderizando", "enviando"];

const hora = () => new Date().toLocaleTimeString("pt-BR");
const agora = () => new Date().toISOString();
let db = null;
let atual = null;

// ── o que a estação precisa no PC (o motor de IA é conferido à parte) ──
function conferirFerramentas() {
  const faltando = [];
  const roda = (bin, args) => spawnSync(bin, args, { windowsHide: true, timeout: 60_000 }).status === 0;
  if (Number(process.versions.node.split(".")[0]) < 22) faltando.push(`${COMO_INSTALAR.node} (este é o ${process.version})`);
  if (!roda(FERRAMENTAS.ffmpeg, ["-version"]) || !roda(FERRAMENTAS.ffprobe, ["-version"])) faltando.push(COMO_INSTALAR.ffmpeg);
  else {
    const falta = faltaNoFfmpeg();
    if (falta.length) faltando.push(`o ffmpeg deste PC (${FERRAMENTAS.ffmpeg}) veio sem ${falta.join(", ")}: instale o ${COMO_INSTALAR.ffmpeg}`);
  }
  if (!acharPrograma(FERRAMENTAS.whisper)) faltando.push(COMO_INSTALAR.whisper);
  if (!FERRAMENTAS.modelos.some((m) => fs.existsSync(m))) faltando.push(COMO_INSTALAR.modelo);
  if (spawnSync("npx --version", { shell: true, windowsHide: true }).status !== 0) faltando.push(COMO_INSTALAR.node);
  return faltando;
}

// ── quem edita (motor de IA): conferido de tempos em tempos e antes de cada pedido ──
const motor = { config: null, ok: null, erro: null, aviso: null, em: 0 };
const chaveDaConfig = (c) => `${c?.motor}|${c?.modelo ?? ""}`;
async function conferirMotorAgora(forcar = false) {
  let config;
  try {
    config = await lerConfigMotor(db);
  } catch (e) {
    return { ...motor, erro: e.message };
  }
  const mudou = chaveDaConfig(config) !== chaveDaConfig(motor.config);
  const velho = Date.now() - motor.em > (motor.ok ? 10 * 60_000 : 60_000);
  if (!forcar && !mudou && !velho) return motor;
  const chaveOpenRouter = config.motor === "openrouter" ? await lerChaveOpenRouter(db) : null;
  const r = await conferirMotor(config, { chaveOpenRouter }).catch((e) => ({ ok: false, erro: e.message }));
  if (mudou || r.ok !== motor.ok || r.erro !== motor.erro) {
    const quem = MOTORES[config.motor]?.rotulo ?? config.motor;
    console.log(`[${hora()}] quem edita: ${quem}${config.modelo ? ` (${config.modelo})` : ""} · ${r.ok ? "pronto" : `NÃO está pronto: ${r.erro}`}${r.aviso ? `\n    atenção: ${r.aviso}` : ""}`);
  }
  Object.assign(motor, { config, ok: r.ok, erro: r.erro ?? null, aviso: r.aviso ?? null, em: Date.now() });
  return motor;
}

// ── perfil do criador (painel → Perfil): @, foto, nicho, público, tom, look e legenda padrão ──
async function lerPerfil() {
  const { data, error } = await db.from("configuracao").select("valor").eq("chave", "perfil").maybeSingle();
  if (error) console.error(`[${hora()}] não consegui ler o perfil (vai sem @ e sem foto): ${error.message}`);
  return data?.valor && typeof data.valor === "object" ? data.valor : {};
}

// ── batida: o painel mostra se a estação está ligada e se quem edita está pronto ──
function valorDaBatida(ligada = true) {
  return {
    visto_em: ligada ? agora() : null,
    maquina: MAQUINA,
    ocupada: ligada && Boolean(atual),
    edicao_id: (ligada && atual?.id) || null,
    motor: motor.config?.motor ?? null,
    modelo: motor.config?.modelo ?? null,
    motor_ok: motor.ok,
    motor_erro: motor.erro,
    motor_aviso: motor.aviso,
    motor_conferido_em: motor.em ? new Date(motor.em).toISOString() : null,
  };
}
async function batida() {
  if (!atual) await conferirMotorAgora();
  await db
    .from("configuracao")
    .upsert({ chave: "estacao_edicao", valor: valorDaBatida() }, { onConflict: "chave" })
    .then(({ error }) => error && console.error(`[${hora()}] batida falhou: ${error.message}`));
}

// ── registro no log do pedido (o painel mostra) ────────────────────
function statusDaEtapa(msg) {
  if (/^(o Claude|o ChatGPT|o lint|buscando)/.test(msg)) return "editando";
  if (/^renderizando/.test(msg)) return "renderizando";
  return undefined;
}
async function registrar(ed, msg, campos = {}) {
  console.log(`[${hora()}] ${msg}`);
  const { data } = await db.from("edicao").select("log, status").eq("id", ed.id).maybeSingle();
  if (data?.status === "cancelada") throw Object.assign(new Error("cancelada pelo painel"), { cancelada: true });
  const log = [...(Array.isArray(data?.log) ? data.log : []), { t: agora(), msg: msg.slice(0, 300) }].slice(-250);
  const status = campos.status ?? statusDaEtapa(msg);
  const { error } = await db.from("edicao").update({ ...campos, ...(status ? { status } : {}), etapa: msg.slice(0, 300), log }).eq("id", ed.id);
  if (error) console.error(`[${hora()}] não consegui registrar no pedido: ${error.message}`);
}

// ── storage ────────────────────────────────────────────────────────
async function baixar(partes, destino) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, Buffer.alloc(0));
  for (const p of partes) {
    const { data, error } = await db.storage.from(BUCKET).download(p);
    if (error) throw new Error(`não consegui baixar ${p}: ${error.message}`);
    fs.appendFileSync(destino, Buffer.from(await data.arrayBuffer()));
  }
}
const extensao = (nome, tipo) => (String(nome ?? "").match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? (String(tipo).includes("video") ? ".mp4" : ".png")).toLowerCase();
const slug = (t) =>
  String(t ?? "edicao")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50)
    .toLowerCase() || "edicao";
const pastaDe = (ed) => path.join(RAIZ, `${String(ed.criado_em).slice(0, 10)}-${String(ed.id).slice(0, 8)}-v${ed.versao}`);

// ── um pedido ──────────────────────────────────────────────────────
async function processar(ed, ia) {
  const pasta = pastaDe(ed);
  const perfil = await lerPerfil();
  let base = null;
  let bruto = null;
  const materiais = [];
  if (ed.versao > 1 && ed.origem_id) {
    const { data: anterior } = await db.from("edicao").select("id, versao, criado_em").eq("id", ed.origem_id).maybeSingle();
    if (anterior) base = pastaDe(anterior);
  }
  if (!base) {
    if (!ed.video?.partes?.length) throw new Error("o pedido não tem vídeo");
    await registrar(ed, "baixando o vídeo", { status: "preparando" });
    bruto = path.join(pasta, "_entrada", `video${extensao(ed.video.nome, ed.video.tipo)}`);
    await baixar(ed.video.partes, bruto);
    const { data: mats } = await db.from("edicao_material").select("*").eq("edicao_id", ed.id).order("ordem");
    for (const [k, m] of (mats ?? []).entries()) {
      const id = `m${k + 1}`;
      if (m.tipo === "link") materiais.push({ id, tipo: "link", url: m.url, descricao: m.descricao });
      else if (m.arquivo?.partes?.length) {
        const entrada = path.join(pasta, "_entrada", `${id}${extensao(m.arquivo.nome, m.arquivo.tipo)}`);
        await baixar(m.arquivo.partes, entrada);
        materiais.push({ id, tipo: m.tipo, entrada, descricao: m.descricao });
      }
    }
    if (materiais.length) await registrar(ed, `${materiais.length} material(is) baixado(s)`);
  }

  const r = await editar({
    pasta,
    base,
    bruto,
    materiais,
    pedido: { titulo: ed.titulo, roteiro: ed.roteiro, opcoes: ed.opcoes ?? {} },
    perfil,
    versao: ed.versao,
    ajuste: ed.ajuste,
    motor: ia,
    aviso: (m) => registrar(ed, m).catch((e) => console.error(e.message)),
    aoPasso: (p) => registrar(ed, `${ia.nome} ${p}`).catch(() => {}),
    aoPreparar: (p) => sincronizarSons(db, p, { cache: path.join(RAIZ, "_sons"), aviso: (m) => registrar(ed, m) }),
  });

  // Cópia no PC (é daqui que o criador posta)
  fs.mkdirSync(SAIDA, { recursive: true });
  const dia = new Date().toLocaleDateString("sv-SE");
  const local = path.join(SAIDA, `${dia} ${slug(ed.titulo)}${ed.versao > 1 ? ` v${ed.versao}` : ""}.mp4`);
  fs.copyFileSync(r.final, local);

  await registrar(ed, "subindo o vídeo pronto pro painel", { status: "enviando" });
  const web = await versaoWeb(r.final);
  const caminho = `${ed.id}/final-v${ed.versao}.mp4`;
  const up = await db.storage.from(BUCKET).upload(caminho, fs.readFileSync(web), { contentType: "video/mp4", upsert: true });
  if (up.error) throw new Error(`não consegui subir o vídeo: ${up.error.message}`);

  await registrar(ed, "pronto", {
    status: "pronto",
    resultado: { caminho, tamanho: fs.statSync(web).size, duracao: Math.round(r.info.duracao * 10) / 10, local },
    resumo: r.resumo || null,
    uso: r.uso,
    erro: null,
    concluido_em: agora(),
  });

  // O bruto e os materiais já estão tratados na oficina: libera o storage e o disco
  const partes = [...(ed.video?.partes ?? [])];
  const { data: mats } = await db.from("edicao_material").select("arquivo").eq("edicao_id", ed.id);
  for (const m of mats ?? []) partes.push(...(m.arquivo?.partes ?? []));
  if (partes.length) await db.storage.from(BUCKET).remove(partes);
  fs.rmSync(path.join(pasta, "_entrada"), { recursive: true, force: true });
}

// ── laço ───────────────────────────────────────────────────────────
async function pegarProximo() {
  const { data } = await db.from("edicao").select("*").eq("status", "na_fila").order("criado_em").limit(1).maybeSingle();
  if (!data) return null;
  const { data: pego } = await db
    .from("edicao")
    .update({ status: "preparando", estacao: MAQUINA, iniciado_em: agora(), erro: null, etapa: `a estação (${MAQUINA}) pegou o pedido` })
    .eq("id", data.id)
    .eq("status", "na_fila")
    .select("*")
    .maybeSingle();
  return pego;
}

/** Conecta (pergunta login na 1ª vez) e, se ainda não tem internet, espera e tenta de novo. */
async function conectarComPaciencia() {
  for (;;) {
    try {
      const c = await conectar();
      return c;
    } catch (e) {
      if (!e.tentarDeNovo) throw e;
      console.error(`[${hora()}] ${e.message}: tentando de novo em 30 s`);
      await new Promise((r) => setTimeout(r, 30_000));
    }
  }
}

async function principal() {
  if (tem("--help") || tem("-h")) {
    console.log(AJUDA);
    return;
  }
  if (tem("--sair")) {
    esquecerSessao();
    console.log(`Login esquecido (${ARQUIVO_SESSAO}). Na próxima vez a estação pergunta de novo.`);
    return;
  }
  if (tem("--preparar")) {
    const r = await garantirFerramentas({ aviso: (m) => console.log(m) });
    console.log(r.hyperframes ? "Kit pronto (HyperFrames, GSAP e Chrome)." : "O kit vai usar o npx (não deu pra instalar o HyperFrames aqui).");
    return;
  }
  if (tem("--testar-motor")) {
    // Com --motor, confere esse (sem precisar de login); sem ele, o que está escolhido no painel
    let config = valor("--motor") ? configMotor({ motor: valor("--motor"), modelo: valor("--modelo") }) : null;
    let chaveOpenRouter = process.env.OPENROUTER_API_KEY?.trim() || null;
    if (!config) {
      try {
        db = (await conectar({ interativo: false })).db;
        config = await lerConfigMotor(db);
        chaveOpenRouter = await lerChaveOpenRouter(db);
      } catch (e) {
        console.log(`(sem acesso à escolha do painel: ${e.message}; conferindo o Claude)`);
        config = configMotor({});
      }
    }
    const r = await conferirMotor(config, { chaveOpenRouter });
    console.log(`${MOTORES[config.motor].rotulo}${config.modelo ? ` (${config.modelo})` : ""}: ${r.ok ? "pronto ✓" : `NÃO está pronto: ${r.erro}`}${r.aviso ? `\natenção: ${r.aviso}` : ""}`);
    process.exitCode = r.ok ? 0 : 1; // sem process.exit: no Windows ele quebra com fetch aberto
    return;
  }

  const faltando = conferirFerramentas();
  if (faltando.length) {
    console.error(`Falta instalar no PC (rode o instalador de novo ou veja editor/INSTALAR.md):\n  - ${faltando.join("\n  - ")}`);
    process.exit(1);
  }

  const conexao = await conectarComPaciencia();
  db = conexao.db;
  if (conexao.modo === "dono") db.auth.startAutoRefresh();
  console.log(`Conectada ao sistema${conexao.endereco ? ` ${conexao.endereco}` : ""} como ${conexao.quem}.`);

  // Instalador: "--motor codex" na 1ª vez já salva a escolha no painel
  const pedido = valor("--motor");
  if (pedido) {
    const c = configMotor({ motor: pedido });
    const { error } = await db.from("configuracao").upsert({ chave: "editor", valor: { motor: c.motor, modelo: null } }, { onConflict: "chave" });
    console.log(error ? `Não consegui salvar quem edita (${error.message}): escolha no painel.` : `Quem edita: ${MOTORES[c.motor].rotulo} (dá pra trocar no painel, Editor de vídeo).`);
  }

  await conferirMotorAgora(true);

  const kit = await garantirFerramentas({ aviso: (msg) => console.log(msg) });
  console.log(`Programas: ffmpeg ${FERRAMENTAS.ffmpeg} · whisper ${FERRAMENTAS.whisper} · HyperFrames ${kit.hyperframes ? "instalado" : "pelo npx"}`);
  if (!FERRAMENTAS.chrome) console.log("Sem Google Chrome no PC: os prints de página usam o Chrome do HyperFrames.");
  fs.mkdirSync(RAIZ, { recursive: true });

  // Pedido que ficou pela metade (a estação caiu no meio): volta pra fila
  const { data: presos } = await db.from("edicao").select("id").in("status", EM_ANDAMENTO).eq("estacao", MAQUINA);
  for (const p of presos ?? []) await db.from("edicao").update({ status: "na_fila", etapa: "a estação reiniciou: recomeçando" }).eq("id", p.id);

  console.log(`\nEstação de edição ligada em ${MAQUINA}. Vídeos prontos também vão pra: ${SAIDA}`);
  console.log("Esperando pedidos do painel. Deixe esta janela aberta (Ctrl+C pra parar).");
  await batida();
  setInterval(() => batida().catch((e) => console.error(`[${hora()}] batida falhou: ${e.message}`)), 30_000);

  for (;;) {
    // Quem edita não está pronto: não pega pedido (eles esperam na fila) até resolver
    if (!(await conferirMotorAgora()).ok) {
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }
    let ed = null;
    try {
      ed = await pegarProximo();
    } catch (e) {
      console.error(`[${hora()}] erro lendo a fila: ${e.message}`);
    }
    if (!ed) {
      await new Promise((r) => setTimeout(r, ESPERA_MS));
      continue;
    }
    atual = ed;
    const t0 = Date.now();
    console.log(`\n[${hora()}] ▶ ${ed.titulo} (v${ed.versao})`);
    try {
      // A escolha do painel vale a cada pedido (trocar lá não precisa reiniciar)
      const config = await lerConfigMotor(db);
      const ia = await prepararMotor(config, { chaveOpenRouter: config.motor === "openrouter" ? await lerChaveOpenRouter(db) : null }).catch((e) => {
        Object.assign(motor, { config, ok: false, erro: e.message, aviso: null, em: Date.now() });
        throw e;
      });
      Object.assign(motor, { config, ok: true, erro: null, em: Date.now() });
      await batida();
      await registrar(ed, `quem edita: ${MOTORES[ia.id].rotulo}${ia.modelo ? ` · ${ia.modelo}` : ""}`);
      await processar(ed, ia);
      console.log(`[${hora()}] ✓ pronto em ${Math.round((Date.now() - t0) / 60_000)} min`);
    } catch (e) {
      console.error(`[${hora()}] ✗ ${e.message}`);
      if (!e.cancelada)
        await db
          .from("edicao")
          .update({ status: "erro", erro: String(e.message).slice(0, 1500), etapa: "deu erro", concluido_em: agora() })
          .eq("id", ed.id);
    }
    atual = null;
    await batida();
  }
}

process.on("SIGINT", async () => {
  console.log("\nParando a estação…");
  if (db) await db.from("configuracao").upsert({ chave: "estacao_edicao", valor: valorDaBatida(false) }, { onConflict: "chave" });
  setTimeout(() => process.exit(0), 300); // um respiro pra conexão fechar (no Windows, sair na hora quebra o node)
});

try {
  await principal();
} catch (e) {
  console.error(`\nA estação não ligou: ${e.message}`);
  process.exitCode = 1;
}
