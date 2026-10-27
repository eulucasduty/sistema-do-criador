// A parte dos carrosséis da estação: roda junto com a edição de vídeo (em paralelo, um carrossel
// por vez), no mesmo login e com o mesmo "Quem edita" do painel. ESTACAO_CARROSSEIS=0 desliga.
//
// O painel só enfileira (tabela carrossel_trabalho, migration 004). Aqui: pega o pedido mais antigo
// (atômico: só quem mudar o status primeiro leva), baixa TODOS os slides originais do bucket
// "esteira", monta a oficina (carrosseis/produzir.mjs), a IA faz a arte, o kit confere e
// renderiza, e os PNG/MP4 sobem pra carrosseis/<pedido>/ no mesmo bucket. No fim,
// concluir_carrossel() publica a versão completa em referencia.copia_cli numa transação só.
// Tudo pela RLS (o login da estação é o do dono), sem chave secreta no PC.

import fs from "node:fs";
import path from "node:path";
import { ehLimite, prepararOficina, produzirCarrossel, RAIZ_OFICINAS } from "../../carrosseis/produzir.mjs";
import { FERRAMENTAS, hyperframesLocal } from "./ferramentas.mjs";
import { lerChaveOpenRouter, lerConfigMotor, MOTORES, prepararMotor } from "./motor.mjs";

const BUCKET = "esteira";
const ESPERA_MS = 8000;
const EM_ANDAMENTO = ["criando", "renderizando", "enviando"];
const hora = () => new Date().toLocaleTimeString("pt-BR");
const ehVideo = (c) => /\.(mp4|mov|webm|m4v)$/i.test(c);
const nn = (n) => String(n).padStart(2, "0");

/** Quem edita, como escolhido no painel (vale a cada pedido: trocar lá não precisa reiniciar). */
async function iaDoPainel(db) {
  const config = await lerConfigMotor(db);
  return prepararMotor(config, { chaveOpenRouter: config.motor === "openrouter" ? await lerChaveOpenRouter(db) : null });
}

/**
 * Liga a parte dos carrosséis. `motorPronto()`: a estação diz se quem edita está instalado e logado
 * (sem isso os pedidos esperam na fila). `prepararIA` e `esperaMs` só mudam nos testes.
 * Devolve { parar } (desliga a batida e o laço).
 */
export function iniciarCarrosseis({ db, maquina, motorPronto = async () => true, prepararIA = iaDoPainel, esperaMs = ESPERA_MS }) {
  const log = (m) => console.log(`[${hora()}] [carrossel] ${m}`);
  let atual = null;
  let parando = false;
  let ultimoErro = "";
  let pausaAte = 0;

  // O kit usa o mesmo ffmpeg e Chrome da estação (ou o Chrome do HyperFrames, se não tiver outro)
  if (FERRAMENTAS.ffmpeg) process.env.FFMPEG_BIN ||= FERRAMENTAS.ffmpeg;
  if (FERRAMENTAS.ffprobe) process.env.FFPROBE_BIN ||= FERRAMENTAS.ffprobe;
  if (FERRAMENTAS.chrome) process.env.CHROME_BIN ||= FERRAMENTAS.chrome;
  else if (hyperframesLocal()) process.env.HF_CLI ||= hyperframesLocal();

  const batida = (ligada = true) =>
    db
      .from("configuracao")
      .upsert({ chave: "estacao_carrosseis", valor: { visto_em: ligada ? new Date().toISOString() : null, maquina, ocupada: ligada && Boolean(atual), trabalho_id: (ligada && atual) || null } }, { onConflict: "chave" })
      .then(({ error }) => error && avisarUmaVez(`batida: ${error.message}`))
      .catch((e) => avisarUmaVez(`batida: ${e.message}`));
  function avisarUmaVez(m) {
    if (m === ultimoErro) return;
    ultimoErro = m;
    log(m);
  }
  const mudar = async (id, campos) => {
    const { error } = await db.from("carrossel_trabalho").update(campos).eq("id", id);
    if (error) throw new Error(`não consegui atualizar o pedido: ${error.message}`);
  };

  async function pegarProximo() {
    const { data: fila, error } = await db.from("carrossel_trabalho").select("id").eq("status", "aguardando_estacao").order("criado_em").limit(1).maybeSingle();
    if (error) throw new Error(/carrossel_trabalho|schema cache|does not exist/i.test(error.message) ? "falta rodar a migration 004 (carrosséis) no banco: npm run migrar ou o SQL Editor" : error.message);
    if (!fila) return null;
    const { data } = await db
      .from("carrossel_trabalho")
      .update({ status: "criando", estacao: maquina, processando_desde: new Date().toISOString(), erro: null, etapa: "baixando todos os slides originais" })
      .eq("id", fila.id)
      .eq("status", "aguardando_estacao")
      .select("*")
      .maybeSingle();
    return data ?? null;
  }

  async function processar(t) {
    const t0 = Date.now();
    const pasta = path.join(RAIZ_OFICINAS, t.id);
    fs.rmSync(pasta, { recursive: true, force: true });
    const entrada = path.join(pasta, "_entrada");
    fs.mkdirSync(entrada, { recursive: true });
    const arquivos = [];
    for (const [i, caminho] of t.referencias.entries()) {
      const { data, error } = await db.storage.from(BUCKET).download(caminho);
      if (error || !data) throw new Error(`não consegui baixar o slide ${i + 1}: ${error?.message ?? "arquivo vazio"}`);
      const local = path.join(entrada, `${nn(i + 1)}${path.extname(caminho) || ".png"}`);
      fs.writeFileSync(local, Buffer.from(await data.arrayBuffer()));
      arquivos.push({ entrada: local, video: ehVideo(caminho) });
    }
    const { data: cfg } = await db.from("configuracao").select("valor").eq("chave", "perfil").maybeSingle();
    const aviso = (m) => log(m);
    const oficina = await prepararOficina({ pasta, arquivos, pedido: { headline: t.headline, modo_texto: t.modo_texto, direcao: t.pedido }, perfil: cfg?.valor ?? {}, aviso });

    const ia = await prepararIA(db);
    const quem = `${MOTORES[ia.id].nome}${ia.modelo ? ` (${ia.modelo})` : ""}`;
    await mudar(t.id, { motor: ia.id, etapa: `${quem} está vendo os ${oficina.total} slides e criando as artes em PT-BR` });
    log(`${quem} criando ${oficina.total} slides${oficina.videos.length ? ` (${oficina.videos.length} em vídeo)` : ""}`);

    // Os passos da IA viram a etapa no painel (no máximo a cada 4 s)
    let ultima = 0;
    let fila = Promise.resolve();
    const aoPasso = (p) => {
      if (Date.now() - ultima < 4000) return;
      ultima = Date.now();
      fila = fila.then(() => mudar(t.id, { etapa: `${MOTORES[ia.id].nome} ${p}`.slice(0, 300) })).catch(() => {});
    };
    const etapa = async (m) => {
      await fila;
      log(m);
      await mudar(t.id, { etapa: m, ...(/renderizando/.test(m) ? { status: "renderizando" } : { status: "criando" }) });
    };
    const produzido = await produzirCarrossel({ pasta, total: oficina.total, videos: oficina.videos, ia, aoPasso, etapa });
    await fila;

    await mudar(t.id, { status: "enviando", etapa: "subindo os slides prontos pro painel" });
    const enviados = [];
    for (let i = 1; i <= oficina.total; i++) {
      const png = `carrosseis/${t.id}/${nn(i)}.png`;
      const sobe = async (caminho, arquivo, tipo) => {
        const { error } = await db.storage.from(BUCKET).upload(caminho, fs.readFileSync(arquivo), { contentType: tipo, upsert: true });
        if (error) throw new Error(`não consegui subir o slide ${i}: ${error.message}`);
        enviados.push(caminho);
      };
      await sobe(png, path.join(pasta, "saida", `${nn(i)}.png`), "image/png");
      if (!oficina.videos.includes(i)) continue;
      // Slide em vídeo: a entrega é o MP4; o PNG de cima fica como capa no painel
      await sobe(png.replace(/\.png$/, ".mp4"), path.join(pasta, "saida", `${nn(i)}.mp4`), "video/mp4");
    }
    const entrega = Array.from({ length: oficina.total }, (_, k) => `carrosseis/${t.id}/${nn(k + 1)}.${oficina.videos.includes(k + 1) ? "mp4" : "png"}`);
    const { data: antes } = await db.from("referencia").select("copia_cli").eq("id", t.referencia_id).maybeSingle();
    const resultado = {
      titulo: produzido.conteudo.titulo,
      legenda: produzido.conteudo.legenda,
      textos: produzido.conteudo.slides.map((s) => ({ n: s.n, original: s.original, ptbr: s.ptbr })),
      idioma: "pt-BR",
      pedido_id: t.id,
      arquivos: entrega,
      gerado_em: new Date().toISOString(),
      motor: ia.id,
      modelo: ia.modelo ?? null,
      uso: produzido.uso ?? null,
    };
    // Publica a versão completa e fecha o pedido juntos (o painel nunca vê metade dos slides)
    const { error } = await db.rpc("concluir_carrossel", { p_trabalho: t.id, p_resultado: resultado });
    if (error) {
      await db.storage.from(BUCKET).remove(enviados);
      throw new Error(`não consegui publicar o carrossel: ${error.message}`);
    }
    // A versão anterior saiu do ar: libera o storage
    const velhos = (antes?.copia_cli?.arquivos ?? []).filter((c) => typeof c === "string" && c.startsWith("carrosseis/") && !c.startsWith(`carrosseis/${t.id}/`));
    const comCapas = [...velhos, ...velhos.filter(ehVideo).map((c) => c.replace(/\.[^.]+$/, ".png"))];
    if (comCapas.length) await db.storage.from(BUCKET).remove(comCapas);
    fs.rmSync(entrada, { recursive: true, force: true });
    log(`✓ ${oficina.total} slides prontos em PT-BR em ${Math.max(1, Math.round((Date.now() - t0) / 60_000))} min`);
  }

  async function laco() {
    // Pedido que ficou pela metade (a estação caiu no meio): volta pra fila
    const { error } = await db
      .from("carrossel_trabalho")
      .update({ status: "aguardando_estacao", processando_desde: null, etapa: "a estação reiniciou: de volta na fila" })
      .in("status", EM_ANDAMENTO)
      .eq("estacao", maquina);
    if (error) avisarUmaVez(/carrossel_trabalho|schema cache|does not exist/i.test(error.message) ? "falta rodar a migration 004 (carrosséis) no banco: npm run migrar ou o SQL Editor" : error.message);
    while (!parando) {
      let t = null;
      try {
        if (Date.now() >= pausaAte && (await motorPronto())) t = await pegarProximo();
      } catch (e) {
        avisarUmaVez(`fila: ${e.message}`);
        await new Promise((r) => setTimeout(r, Math.max(esperaMs, 60_000)));
        continue;
      }
      if (!t) {
        await new Promise((r) => setTimeout(r, esperaMs));
        continue;
      }
      atual = t.id;
      ultimoErro = "";
      await batida();
      log(`▶ ${t.referencias.length} slides (pedido ${t.id.slice(0, 8)})`);
      try {
        await processar(t);
      } catch (e) {
        const msg = String(e.message ?? e);
        log(`✗ ${msg.split("\n")[0].slice(0, 300)}`);
        if (ehLimite(msg)) {
          pausaAte = Date.now() + 20 * 60_000;
          await mudar(t.id, { status: "aguardando_estacao", processando_desde: null, etapa: "a IA bateu no limite do plano: a estação tenta de novo em 20 min" }).catch(() => {});
        } else if (e.motor) {
          pausaAte = Date.now() + 60_000;
          await mudar(t.id, { status: "aguardando_estacao", processando_desde: null, etapa: `quem edita não está pronto: ${msg.slice(0, 200)}` }).catch(() => {});
        } else await mudar(t.id, { status: "erro", etapa: null, erro: msg.slice(0, 1500), processando_desde: null }).catch(() => {});
      } finally {
        atual = null;
        await batida();
      }
    }
  }

  log("ligada: copia carrosséis com o mesmo \"Quem edita\" dos vídeos (ESTACAO_CARROSSEIS=0 desliga)");
  void batida();
  const relogio = setInterval(() => void batida(), 30_000);
  void laco().catch((e) => log(`parou: ${e.message}`));
  return {
    async parar() {
      parando = true;
      clearInterval(relogio);
      await batida(false);
    },
  };
}
