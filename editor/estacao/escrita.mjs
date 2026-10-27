// A parte da estação que ESCREVE (no seu PC, com o mesmo "quem edita" do painel: Claude, ChatGPT
// ou OpenRouter). Roda junto da edição, num laço à parte, uma tarefa por vez, a mais antiga primeiro:
//   legendas   a legenda do post do vídeo editado (botão "Postar no Instagram" do editor)
//   materiais  o rascunho do material do CTA, a página /m/<endereço> (Materiais)
// O painel só põe o pedido na fila (status "aguardando_estacao"); a estação pega, escreve e devolve.
// Estação desligada: o pedido espera na fila.

import fs from "node:fs";
import path from "node:path";
import { lerChaveOpenRouter, lerConfigMotor, prepararMotor } from "./motor.mjs";

const ESPERA_MS = 6000;
const hora = () => new Date().toLocaleTimeString("pt-BR");
const log = (msg) => console.log(`[${hora()}] [escrita] ${msg}`);
const faltaTabela = (e) => e && (e.code === "42P01" || e.code === "PGRST205" || /does not exist|Could not find the table/i.test(e.message ?? ""));

// ── a fala e a palavra do CTA de uma edição pronta (a oficina, neste PC) ──
/** A fala corrida (dados/palavras.json, com as correções do plano) e a palavra do CTA do plano. */
export function falaECta(pasta) {
  let fala = "";
  let cta = null;
  try {
    const plano = JSON.parse(fs.readFileSync(path.join(pasta, "plano.json"), "utf8"));
    const c = (plano.cenas ?? []).find((x) => x.tipo === "cta" && x.palavra);
    if (c) cta = String(c.palavra).trim().slice(0, 40) || null;
    const palavras = JSON.parse(fs.readFileSync(path.join(pasta, "dados", "palavras.json"), "utf8")).map((w) => String(w.text ?? w.texto ?? "").trim());
    for (const e of plano.legenda?.edicoes ?? []) if (palavras[e.i] !== undefined) palavras[e.i] = String(e.texto ?? "");
    fala = palavras.filter(Boolean).join(" ");
    for (const x of plano.legenda?.correcoes ?? []) if (x.de && x.para) fala = fala.replaceAll(String(x.de), String(x.para));
  } catch {}
  if (!cta) cta = fala.match(/comenta(?:r)?\s+(?:a\s+palavra\s+)?["“]?([\p{L}\p{N}]{2,30})/iu)?.[1] ?? null;
  return { fala: fala.slice(0, 20000), cta };
}

// ── o que a IA recebe ──────────────────────────────────────────────
const FORMATO = "Não crie nem leia arquivos e não rode comandos: responda só com o JSON, na sua mensagem final, sem nada antes ou depois.";

function quemE(perfil) {
  const p = perfil ?? {};
  return [
    p.nome || p.usuario ? `criador: ${p.nome ?? ""}${p.usuario ? ` (@${p.usuario})` : ""}` : "",
    p.nicho ? `nicho: ${p.nicho}` : "",
    p.publico ? `pra quem fala: ${p.publico}` : "",
    p.tom ? `jeito de falar: ${p.tom}` : "",
    p.regras ? `o que nunca pode aparecer: ${p.regras}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const SISTEMA_LEGENDA = `Você escreve a LEGENDA de um reel de um criador do Instagram. A legenda vai no post, embaixo do vídeo.

Como ela é (copie o jeito das legendas dele que vêm de exemplo; sem exemplo, siga o jeito de falar dele):
- curta: 2 a 5 linhas. A primeira linha é um gancho que completa o vídeo (não repete a primeira frase dele).
- na voz dele, de igual pra igual, frase curta, nada de tom de guru, de anúncio ou de IA.
- se o vídeo tem CTA de comentário, a legenda repete o pedido com a MESMA palavra ("comenta PALAVRA que eu te mando …", com o que ele promete no vídeo). Uma vez só, perto do fim.
- 3 a 5 hashtags no fim, em minúscula, do assunto do vídeo. Sem hashtag genérica de engajamento.
- emoji: no máximo 2, e só se as legendas de exemplo usam.

Nunca:
- travessão (—), "não é X, é Y", trio de adjetivos, "descubra", "revolucionário", "neste vídeo", "confira".
- prometer o que ele não falou no vídeo; número, resultado ou preço que ele não disse.

Responda SÓ um JSON: {"legenda": "...", "palavra": "PALAVRA do CTA ou null"}
${FORMATO}`;

function pedidoDaLegenda({ ed, fala, cta, exemplos, perfil, guia }) {
  const partes = [
    `## Quem é\n${quemE(perfil) || "(perfil não preenchido)"}`,
    `## O vídeo\ntítulo que ele deu: ${ed.titulo}`,
    fala ? `o que ele fala (transcrição automática, pode ter nome de marca trocado: corrija):\n"${fala.slice(0, 6000)}"` : "(sem a transcrição: escreva a partir do título e do contexto)",
    ed.roteiro?.trim() ? `contexto que ele escreveu no pedido da edição:\n${ed.roteiro.trim().slice(0, 2000)}` : "",
    cta
      ? `a palavra do CTA que está no vídeo: ${cta}`
      : "o vídeo não tem palavra de CTA marcada: se a fala pede pra comentar alguma palavra, use ela; senão, palavra = null e sem pedido de comentário",
    exemplos.length ? `## Legendas dele de verdade (o jeito a copiar)\n${exemplos.map((l, k) => `--- exemplo ${k + 1}\n${l.slice(0, 700)}`).join("\n")}` : "",
    guia ? `## Guia da voz dele (tirado dos reels)\n${guia.slice(0, 3500)}` : "",
  ];
  return `${SISTEMA_LEGENDA}\n\n${partes.filter(Boolean).join("\n\n")}`;
}

const SISTEMA_MATERIAL = `Você monta o MATERIAL que um criador do Instagram entrega pra quem comenta a palavra do vídeo. O material vira uma página no celular: quem abre veio do Instagram e quer fazer o que o vídeo mostrou, agora.

O que entregar (é o que faz a página valer o comentário):
- O que o vídeo PROMETEU, completo e pronto pra usar: se ele falou de um prompt, o prompt inteiro, colável (com [colchetes] onde a pessoa troca pelo dela); se falou de passo a passo, cada passo com a ação exata (onde clicar, o que fazer); se falou de template, checklist ou lista, o texto inteiro.
- Se o pedido dele trouxe prompts, links ou textos colados, use EXATAMENTE eles (pode organizar e explicar, não reescreva sem motivo).
- Comece por um texto de 1 ou 2 frases dizendo o que a pessoa vai conseguir; termine com o próximo passo concreto.

Os blocos que existem (JSON):
- {"tipo": "texto", "texto": "..."} parágrafo curto (aceita **negrito**)
- {"tipo": "passos", "titulo": "...", "itens": [{"titulo": "...", "texto": "...", "prompt": "... (opcional)", "link": {"titulo": "...", "url": "https://... (opcional)"}}]}
- {"tipo": "prompt", "titulo": "...", "texto": "o prompt inteiro", "dica": "como usar (opcional)"}
- {"tipo": "link", "titulo": "texto do botão", "url": "https://...", "descricao": "pra que serve (opcional)"}
- {"tipo": "template", "titulo": "...", "texto": "o texto pra copiar e adaptar", "descricao": "..."}
- {"tipo": "aviso", "texto": "uma atenção ou dica importante"}

Regras:
- LINK: só os que ele passou ou sites oficiais que você tem certeza que existem. NUNCA invente endereço. Precisa de um link que não tem? Bloco "link" com "url": "" e o título dizendo o que é: ele completa no painel.
- Na voz dele, simples, frases curtas, sem termo técnico sem explicar.
- Nada de travessão (—), "não é X, é Y", tom de guru ou de anúncio.
- Nunca preço, resultado ou número que ele não disse.
- De 4 a 12 blocos. Título da página curto (até 6 palavras), subtítulo de uma linha.

Responda SÓ um JSON: {"titulo": "...", "subtitulo": "...", "blocos": [...]}
${FORMATO}`;

function pedidoDoMaterial({ e, fala, tituloVideo, roteiro, perfil }) {
  const atual = e.ajuste?.trim() ? { titulo: e.titulo, subtitulo: e.subtitulo ?? undefined, blocos: Array.isArray(e.blocos) ? e.blocos : [] } : null;
  const partes = [
    `## Quem é\n${quemE(perfil) || "(perfil não preenchido)"}`,
    `## O material\npalavra do comentário: ${e.palavra ?? "(sem palavra)"}${e.titulo ? `\ntítulo que ele deu: ${e.titulo}` : ""}`,
    e.pedido?.trim() ? `## O que ele pediu pra entregar (use os prompts e links daqui como estão)\n${e.pedido.trim().slice(0, 12000)}` : "",
    tituloVideo ? `## O vídeo\ntítulo: ${tituloVideo}` : "",
    fala ? `o que ele fala no vídeo (transcrição automática, pode ter nome trocado: corrija marcas e ferramentas):\n"${fala.slice(0, 8000)}"` : "",
    roteiro?.trim() ? `contexto do pedido da edição:\n${roteiro.trim().slice(0, 3000)}` : "",
    atual ? `## A versão atual da página (JSON)\n${JSON.stringify(atual).slice(0, 15000)}\n\n## O ajuste que ele pediu\n${e.ajuste.trim()}\nMude só o que ele pediu e devolva a página inteira.` : "",
  ];
  return `${SISTEMA_MATERIAL}\n\n${partes.filter(Boolean).join("\n\n")}`;
}

// ── o que a IA devolve ─────────────────────────────────────────────
function extrairJSON(texto) {
  const t = String(texto ?? "").replace(/```(?:json)?/gi, "");
  const i = t.indexOf("{");
  const f = t.lastIndexOf("}");
  if (i < 0 || f <= i) return null;
  try {
    return JSON.parse(t.slice(i, f + 1));
  } catch {
    return null;
  }
}
const semTravessao = (s) => String(s ?? "").replace(/\s+—\s+/g, ", ").replace(/—/g, ",");

function lerLegenda(texto, palavraPadrao) {
  const j = extrairJSON(texto);
  let legenda = semTravessao(j?.legenda).trim();
  if (!legenda) throw new Error(`a IA não devolveu a legenda: ${String(texto ?? "").slice(0, 200)}`);
  if (/R\$\s?\d/.test(legenda)) legenda = legenda.replace(/[^\n]*R\$\s?\d[^\n]*\n?/g, "").trim();
  const palavra = String(j?.palavra ?? palavraPadrao ?? "").trim().replace(/^null$/i, "") || null;
  return { legenda: legenda.slice(0, 2200), palavra: palavra ? palavra.slice(0, 40) : null };
}

function lerMaterial(texto) {
  const j = extrairJSON(texto);
  // O painel limpa e confere os blocos de novo ao mostrar e ao salvar (lib/entregas/blocos.ts)
  const blocos = (Array.isArray(j?.blocos) ? j.blocos : []).filter((b) => b && typeof b === "object" && typeof b.tipo === "string").slice(0, 40);
  if (!blocos.length) throw new Error(`a IA não devolveu os blocos do material: ${String(texto ?? "").slice(0, 200)}`);
  return { titulo: semTravessao(j?.titulo).trim().slice(0, 120) || "Material", subtitulo: semTravessao(j?.subtitulo).trim().slice(0, 240) || null, blocos };
}

// ── o laço ─────────────────────────────────────────────────────────
/**
 * Liga a escrita. `db`: o cliente logado da estação (passa pela RLS). `raiz`: a pasta das oficinas
 * (a escrita usa uma pasta à parte lá dentro). `pastaDe(ed)`: a oficina de uma edição neste PC.
 * `pronto()`: se quem edita está pronto (sem ele, espera). Nunca termina.
 */
export async function iniciarEscrita({ db, maquina, raiz, pastaDe, pronto = () => true }) {
  const ETAPA = `a estação (${maquina}) pegou: a IA está escrevendo`;
  const volta = { status: "aguardando_estacao", etapa: "a estação reiniciou: de volta na fila", processando_desde: null };
  // O que ficou pela metade (a estação caiu no meio): volta pra fila
  for (const tabela of ["postagem", "entrega"]) {
    const { error } = await db.from(tabela).update(volta).eq("status", "escrevendo").eq("estacao", maquina);
    if (faltaTabela(error)) log("o banco ainda não tem as tabelas de postar e materiais: rode o supabase/migrations/003_postagem_materiais.sql no SQL Editor");
  }

  async function pegar(tabela) {
    const { data: fila, error } = await db.from(tabela).select("id").eq("status", "aguardando_estacao").order("criado_em").limit(1);
    if (error) throw Object.assign(new Error(error.message), { semTabela: faltaTabela(error) });
    if (!fila?.length) return null;
    const { data: pego } = await db
      .from(tabela)
      .update({ status: "escrevendo", estacao: maquina, etapa: ETAPA, processando_desde: new Date().toISOString(), erro: null })
      .eq("id", fila[0].id)
      .eq("status", "aguardando_estacao")
      .select("*")
      .maybeSingle();
    return pego ? { tabela, linha: pego } : null;
  }

  async function contexto() {
    const [{ data: cfg }, { data: reels }] = await Promise.all([
      db.from("configuracao").select("chave, valor").in("chave", ["perfil", "persona"]),
      db.from("meu_reel").select("legenda").not("legenda", "is", null).order("publicado_em", { ascending: false }).limit(10),
    ]);
    const valor = (c) => (cfg ?? []).find((x) => x.chave === c)?.valor ?? {};
    const exemplos = (reels ?? [])
      .map((r) => String(r.legenda ?? "").trim())
      .filter((l) => l.length > 20)
      .slice(0, 6);
    return { perfil: valor("perfil"), guia: typeof valor("persona").guia === "string" ? valor("persona").guia : "", exemplos };
  }

  async function rodar(id, prompt, minutos) {
    const config = await lerConfigMotor(db);
    const ia = await prepararMotor(config, { chaveOpenRouter: config.motor === "openrouter" ? await lerChaveOpenRouter(db) : null });
    const pasta = path.join(raiz, "_escrita", String(id).slice(0, 8));
    fs.rmSync(pasta, { recursive: true, force: true });
    fs.mkdirSync(pasta, { recursive: true });
    try {
      return (await ia.rodar(pasta, prompt, { minutos })).resumo;
    } finally {
      fs.rmSync(pasta, { recursive: true, force: true });
    }
  }

  async function fazerLegenda(p) {
    const { data: ed } = await db.from("edicao").select("*").eq("id", p.edicao_id).maybeSingle();
    if (!ed) throw new Error("a edição desse post não existe mais");
    log(`▶ legenda: ${ed.titulo}`);
    // Edição feita antes de a estação guardar a fala: lê da oficina, se ela ainda estiver neste PC
    const daOficina = ed.transcricao && ed.cta_palavra ? { fala: "", cta: null } : falaECta(pastaDe(ed));
    const fala = ed.transcricao || daOficina.fala;
    const cta = p.palavra || ed.cta_palavra || daOficina.cta;
    const prompt = pedidoDaLegenda({ ed, fala, cta, ...(await contexto()) });
    const l = lerLegenda(await rodar(p.id, prompt, 10), cta);
    // você pode ter mexido na palavra enquanto esperava: a sua vale
    const { data: agora } = await db.from("postagem").select("palavra").eq("id", p.id).maybeSingle();
    await db.from("postagem").update({ status: "pronta", legenda: l.legenda, palavra: agora?.palavra || l.palavra, etapa: null, erro: null }).eq("id", p.id).eq("status", "escrevendo");
    log(`✓ legenda pronta · ${l.legenda.length} caracteres · palavra ${l.palavra ?? "nenhuma"}`);
  }

  async function fazerMaterial(e) {
    log(`▶ material: ${e.titulo || e.palavra || e.slug}${e.ajuste ? " (ajuste)" : ""}`);
    let fala = "";
    let tituloVideo = null;
    let roteiro = null;
    if (e.edicao_id) {
      const { data: ed } = await db.from("edicao").select("*").eq("id", e.edicao_id).maybeSingle();
      if (ed) {
        fala = ed.transcricao || falaECta(pastaDe(ed)).fala;
        tituloVideo = ed.titulo;
        roteiro = ed.roteiro;
      }
    }
    const { perfil } = await contexto();
    const c = lerMaterial(await rodar(e.id, pedidoDoMaterial({ e, fala, tituloVideo, roteiro, perfil }), 15));
    await db
      .from("entrega")
      .update({ status: "pronta", titulo: c.titulo, subtitulo: c.subtitulo, blocos: c.blocos, ajuste: null, etapa: null, erro: null })
      .eq("id", e.id)
      .eq("status", "escrevendo");
    log(`✓ material pronto · ${c.blocos.length} blocos`);
  }

  let avisouSemTabela = false;
  for (;;) {
    let tarefa = null;
    try {
      // legenda primeiro (é rápida e você está esperando pra postar), depois o material
      if (pronto()) tarefa = (await pegar("postagem")) ?? (await pegar("entrega"));
    } catch (e) {
      if (e.semTabela) {
        if (!avisouSemTabela) log("o banco ainda não tem as tabelas de postar e materiais: rode o supabase/migrations/003_postagem_materiais.sql no SQL Editor");
        avisouSemTabela = true;
        await new Promise((r) => setTimeout(r, 5 * 60_000));
        continue;
      }
      log(`erro lendo a fila: ${e.message}`);
    }
    if (!tarefa) {
      await new Promise((r) => setTimeout(r, ESPERA_MS));
      continue;
    }
    const { tabela, linha } = tarefa;
    const t0 = Date.now();
    try {
      if (tabela === "postagem") await fazerLegenda(linha);
      else await fazerMaterial(linha);
      log(`  em ${Math.round((Date.now() - t0) / 1000)} s`);
    } catch (e) {
      log(`✗ ${tabela === "postagem" ? "legenda" : "material"}: ${e.message}`);
      await db.from(tabela).update({ status: "erro", etapa: null, erro: String(e.message).slice(0, 500) }).eq("id", linha.id).eq("status", "escrevendo");
    } finally {
      await db.from(tabela).update({ processando_desde: null }).eq("id", linha.id);
    }
  }
}
