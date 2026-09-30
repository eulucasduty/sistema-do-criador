// Estação de edição de vídeo: roda no PC do criador e fica esperando pedidos do painel.
//   npm run estacao        (passo a passo da instalação: editor/INSTALAR.md)
//
// Pega o pedido mais antigo "na fila", lê o perfil do criador (criador.configuracao "perfil"),
// baixa o vídeo e os materiais do storage (em partes), faz a edição (editor/estacao/fluxo.mjs:
// oficina → Claude Code no plano Claude do criador → render) e sobe o vídeo pronto pro painel.
// O vídeo final também fica no PC (EDITOR_SAIDA; padrão: Vídeos/Sistema do Criador).
// Pra parar: Ctrl+C.

import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { editar, versaoWeb } from "../editor/estacao/fluxo.mjs";
import { acharPrograma, COMO_INSTALAR, FERRAMENTAS, faltaNoFfmpeg } from "../editor/estacao/ferramentas.mjs";
import { sincronizarSons } from "../editor/estacao/sons.mjs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const chave = process.env.SUPABASE_SECRET_KEY;
if (!url || !chave) {
  console.error("Falta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY no .env.local (veja editor/INSTALAR.md)");
  process.exit(1);
}
const db = createClient(url, chave, { db: { schema: "criador" }, auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "edicao";
const RAIZ = path.resolve("editor", "oficina");
const SAIDA = process.env.EDITOR_SAIDA || path.join(os.homedir(), "Videos", "Sistema do Criador");
const MAQUINA = os.hostname();
const ESPERA_MS = 8000;
const EM_ANDAMENTO = ["preparando", "editando", "renderizando", "enviando"];

const hora = () => new Date().toLocaleTimeString("pt-BR");
const agora = () => new Date().toISOString();
let atual = null;

// ── o que a estação precisa no PC ──────────────────────────────────
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
  if (!acharPrograma(FERRAMENTAS.claude) || !roda(FERRAMENTAS.claude, ["--version"])) faltando.push(COMO_INSTALAR.claude);
  if (spawnSync("npx --version", { shell: true, windowsHide: true }).status !== 0) faltando.push(COMO_INSTALAR.node);
  return faltando;
}

// ── perfil do criador (painel → Perfil): @, foto, nicho, público, tom, look e legenda padrão ──
async function lerPerfil() {
  const { data, error } = await db.from("configuracao").select("valor").eq("chave", "perfil").maybeSingle();
  if (error) console.error(`[${hora()}] não consegui ler o perfil (vai sem @ e sem foto): ${error.message}`);
  return data?.valor && typeof data.valor === "object" ? data.valor : {};
}

// ── batida: o painel mostra se a estação está ligada ───────────────
async function batida() {
  await db
    .from("configuracao")
    .upsert({ chave: "estacao_edicao", valor: { visto_em: agora(), maquina: MAQUINA, ocupada: Boolean(atual), edicao_id: atual?.id ?? null } }, { onConflict: "chave" })
    .then(({ error }) => error && console.error(`[${hora()}] batida falhou: ${error.message}`));
}

// ── registro no log do pedido (o painel mostra) ────────────────────
function statusDaEtapa(msg) {
  if (/^o Claude|^o lint/.test(msg)) return "editando";
  if (/^renderizando/.test(msg)) return "renderizando";
  return undefined;
}
async function registrar(ed, msg, campos = {}) {
  console.log(`[${hora()}] ${msg}`);
  const { data } = await db.from("edicao").select("log, status").eq("id", ed.id).maybeSingle();
  if (data?.status === "cancelada") throw Object.assign(new Error("cancelada pelo painel"), { cancelada: true });
  const log = [...(Array.isArray(data?.log) ? data.log : []), { t: agora(), msg: msg.slice(0, 300) }].slice(-250);
  const status = campos.status ?? statusDaEtapa(msg);
  await db.from("edicao").update({ ...campos, ...(status ? { status } : {}), etapa: msg.slice(0, 300), log }).eq("id", ed.id);
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
async function processar(ed) {
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
    aviso: (m) => registrar(ed, m).catch((e) => console.error(e.message)),
    aoPasso: (p) => registrar(ed, `o Claude ${p}`).catch(() => {}),
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

async function principal() {
  const faltando = conferirFerramentas();
  if (faltando.length) {
    console.error(`Falta instalar no PC (passo a passo em editor/INSTALAR.md):\n  - ${faltando.join("\n  - ")}`);
    process.exit(1);
  }
  console.log(`Programas: ffmpeg ${FERRAMENTAS.ffmpeg} · whisper ${FERRAMENTAS.whisper} · Claude ${FERRAMENTAS.claude}`);
  if (!FERRAMENTAS.chrome) console.log("Sem Google Chrome no PC: os prints de página usam o Chrome do HyperFrames (instale o Chrome se algum print falhar).");
  fs.mkdirSync(RAIZ, { recursive: true });

  // Pedido que ficou pela metade (a estação caiu no meio): volta pra fila
  const { data: presos } = await db.from("edicao").select("id").in("status", EM_ANDAMENTO).eq("estacao", MAQUINA);
  for (const p of presos ?? []) await db.from("edicao").update({ status: "na_fila", etapa: "a estação reiniciou: recomeçando" }).eq("id", p.id);

  console.log(`Estação de edição ligada em ${MAQUINA}. Vídeos prontos também vão pra: ${SAIDA}`);
  console.log("Esperando pedidos do painel (Ctrl+C pra parar)…");
  await batida();
  setInterval(batida, 30_000);

  for (;;) {
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
    await batida();
    const t0 = Date.now();
    console.log(`\n[${hora()}] ▶ ${ed.titulo} (v${ed.versao})`);
    try {
      await processar(ed);
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
  await db.from("configuracao").upsert({ chave: "estacao_edicao", valor: { visto_em: null, maquina: MAQUINA, ocupada: false, edicao_id: null } }, { onConflict: "chave" });
  process.exit(0);
});

await principal();
