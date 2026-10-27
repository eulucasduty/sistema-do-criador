// A parte da estação que ESCREVE (decisão do criador, 06/10: "joga o agente de roteiro igual o editor
// de vídeo"). Roda no PC dele, no Claude Code do plano dele, sem custo de API. Três filas, uma
// tarefa por vez, a mais antiga primeiro:
//   roteiros  escreve, passa pela checagem anti-IA e pela segunda leitura, reescreve o que reprovar
//   legendas  a legenda do post do vídeo editado (desde 08/10, botão "Postar" do editor)
//   entregas  o rascunho do material do CTA, a página /m/<palavra> (desde 08/10, Materiais)
//
// Quem abre: a própria estação de edição (npm run editor:estacao) sobe esta como processo filho e
// religa se ela cair. Sozinha (testes): npm run roteiro:estacao [-- --uma]  (--uma: pega uma e sai).
// O servidor continua transcrevendo e analisando a referência (Gemini, centavos). Estação desligada:
// o pedido espera na fila; a API só entra pelo botão manual do painel (só nos roteiros).
import os from "node:os";
import { usarClienteDaEstacao } from "@/lib/supabase/admin";
import { conectar } from "../editor/estacao/sessao.mjs";
import { escreverRoteiro } from "@/lib/roteiro/escrever";
import { motorLocal } from "@/lib/roteiro/motor-local";
import { entradaDoRoteiro, gravarVersao } from "@/lib/roteiro/processar";
import { ctaDaEdicao, falaDaEdicao, lerLegenda, pedidoDaLegenda } from "@/lib/postagem/legenda";
import { lerEntrega, pedidoDaEntrega } from "@/lib/entregas/escrever";
import { normalizarBlocos } from "@/lib/entregas/blocos";
import { rodarClaudeTexto } from "@/editor/estacao/claude.mjs";
import { rodarCodexTexto } from "@/editor/estacao/codex.mjs";
import { lerConfigMotor } from "@/editor/estacao/motor.mjs";

const { db } = await conectar();
usarClienteDaEstacao(db);
const rodarTexto = async (p: { sistema: string; prompt: string; modelo?: string; esforco?: string; minutos?: number }) => (await lerConfigMotor(db)).motor === "codex" ? rodarCodexTexto(p) : rodarClaudeTexto(p);
const MAQUINA = os.hostname();
const ESPERA_MS = 5000;
const PAUSA_LIMITE_MS = 20 * 60_000; // o plano do Claude bateu no limite: espera e tenta de novo
const UMA = process.argv.includes("--uma");
const LEGENDA_MODELO = process.env.LEGENDA_MODELO || "opus";
const ENTREGA_MODELO = process.env.ENTREGA_MODELO || "opus";

const hora = () => new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
const log = (msg: string) => console.log(`[${hora()}] [escrita] ${msg}`);
let atual: string | null = null;

type Tabela = "roteiro" | "postagem" | "entrega";
type Linha = { id: string } & Record<string, unknown>;
type Tarefa = { tabela: Tabela; linha: Linha };
type LinhaPostagem = { id: string; edicao_id: string; palavra: string | null };
type LinhaEntrega = { id: string; slug: string; palavra: string | null; titulo: string; subtitulo: string | null; blocos: unknown; pedido: string | null; ajuste: string | null; edicao_id: string | null };
const ETAPA_PEGOU = `a estação (${MAQUINA}) pegou: o Claude está escrevendo`;

/** O painel mostra se a estação está escrevendo (mais de 90 s sem bater = desligada). */
async function batida(desligando = false) {
  const { error } = await db
    .from("configuracao")
    .upsert(
      { chave: "estacao_roteiros", valor: { visto_em: desligando ? null : new Date().toISOString(), maquina: MAQUINA, ocupada: Boolean(atual), roteiro_id: atual } },
      { onConflict: "chave" },
    );
  if (error) log(`batida falhou: ${error.message}`);
}

/**
 * Pega o pedido mais antigo de uma fila (a trava é a troca de status, igual em todas). Nos roteiros, o
 * pedido feito à mão passa na frente dos automáticos do monitor de criadores (18/10).
 */
async function pegar(tabela: Tabela): Promise<Tarefa | null> {
  let consulta = db.from(tabela).select("id").eq("status", "aguardando_estacao");
  if (tabela === "roteiro") consulta = consulta.order("automatico");
  const { data: fila } = await consulta.order("criado_em").limit(1);
  if (!fila?.length) return null;
  const { data: pego } = await db
    .from(tabela)
    .update({ status: "escrevendo", estacao: MAQUINA, etapa: ETAPA_PEGOU, processando_desde: new Date().toISOString(), erro: null })
    .eq("id", fila[0].id)
    .eq("status", "aguardando_estacao")
    .select("*")
    .maybeSingle();
  return pego ? { tabela, linha: pego as Linha } : null;
}

async function proxima(): Promise<Tarefa | null> {
  // legenda primeiro (é rápida e ele está esperando pra postar), depois roteiro e entrega
  return (await pegar("postagem")) ?? (await pegar("roteiro")) ?? (await pegar("entrega"));
}

async function fazerRoteiro(r: Linha, t0: number) {
  log(`▶ roteiro: ${r.titulo || r.tema || r.origem} (${r.duracao_alvo} s)`);
  const versao = await escreverRoteiro(
    entradaDoRoteiro(r as never, async (n) => {
      log(`  reescrevendo o que a checagem anti-IA barrou (rodada ${n})`);
      await db.from("roteiro").update({ etapa: `a estação está reescrevendo o que a checagem anti-IA barrou (rodada ${n})` }).eq("id", r.id);
    }),
    motorLocal(),
  );
  await gravarVersao(r.id, versao);
  log(`✓ pronto em ${Math.round((Date.now() - t0) / 1000)} s · ~${versao.checagem.segundos} s de fala · ${versao.checagem.aprovado ? "passou na checagem" : "com ressalvas"} · na API seria US$ ${versao.equivalente_api_usd ?? "?"}`);
}

async function fazerLegenda(p: LinhaPostagem, t0: number) {
  const { data: ed } = await db.from("edicao").select("id, titulo, roteiro, criado_em, versao, transcricao, cta_palavra").eq("id", p.edicao_id).single();
  if (!ed) throw new Error("a edição desse post não existe mais");
  log(`▶ legenda: ${ed.titulo}`);
  const { sistema, prompt } = await pedidoDaLegenda(ed);
  const r = await rodarTexto({ sistema, prompt, modelo: LEGENDA_MODELO, esforco: "medium", minutos: 8 });
  const l = lerLegenda(r.texto, ctaDaEdicao(ed));
  // o criador pode ter mexido na palavra enquanto esperava: a dele vale
  await db.from("postagem").update({ status: "pronta", legenda: l.legenda, palavra: p.palavra || l.palavra, etapa: null, erro: null }).eq("id", p.id);
  log(`✓ legenda pronta em ${Math.round((Date.now() - t0) / 1000)} s · ${l.legenda.length} caracteres · palavra ${l.palavra ?? "—"}`);
}

async function fazerEntrega(e: LinhaEntrega, t0: number) {
  log(`▶ entrega: ${e.titulo || e.palavra || e.slug}${e.ajuste ? " (ajuste)" : ""}`);
  let fala = "";
  let tituloVideo: string | null = null;
  let roteiro: string | null = null;
  if (e.edicao_id) {
    const { data: ed } = await db.from("edicao").select("id, titulo, roteiro, criado_em, versao, transcricao").eq("id", e.edicao_id).maybeSingle();
    if (ed) {
      fala = falaDaEdicao(ed);
      tituloVideo = ed.titulo;
      roteiro = ed.roteiro;
    }
  }
  const atual = e.ajuste ? { titulo: e.titulo, subtitulo: e.subtitulo ?? undefined, blocos: normalizarBlocos(e.blocos) } : null;
  const { sistema, prompt } = await pedidoDaEntrega({ palavra: e.palavra, titulo: e.titulo, pedido: e.pedido, ajuste: e.ajuste, fala, tituloVideo, roteiro, atual });
  const r = await rodarTexto({ sistema, prompt, modelo: ENTREGA_MODELO, esforco: "medium", minutos: 15 });
  const c = lerEntrega(r.texto);
  await db
    .from("entrega")
    .update({ status: "pronta", titulo: c.titulo, subtitulo: c.subtitulo ?? null, blocos: c.blocos, ajuste: null, etapa: null, erro: null })
    .eq("id", e.id);
  log(`✓ entrega pronta em ${Math.round((Date.now() - t0) / 1000)} s · ${c.blocos.length} blocos`);
}

async function principal() {
  // O que ficou pela metade (a estação caiu no meio): volta pra fila
  const volta = { status: "aguardando_estacao", etapa: "a estação reiniciou: de volta na fila", processando_desde: null };
  await db.from("roteiro").update(volta).eq("status", "escrevendo").eq("via", "estacao").eq("estacao", MAQUINA);
  await db.from("postagem").update(volta).eq("status", "escrevendo").eq("estacao", MAQUINA);
  await db.from("entrega").update(volta).eq("status", "escrevendo").eq("estacao", MAQUINA);
  log(`ligada em ${MAQUINA}: escreve roteiros, legendas e entregas do painel no Claude Code do teu plano (sem custo de API)`);
  await batida();
  const t = setInterval(() => void batida(), 30_000);

  let pausaAte = 0;
  for (;;) {
    let tarefa: Tarefa | null = null;
    try {
      if (Date.now() >= pausaAte) tarefa = await proxima();
    } catch (e) {
      log(`erro lendo a fila: ${(e as Error).message}`);
    }
    if (!tarefa) {
      if (UMA) break;
      await new Promise((ok) => setTimeout(ok, ESPERA_MS));
      continue;
    }
    const { tabela, linha } = tarefa;
    atual = linha.id;
    await batida();
    const t0 = Date.now();
    try {
      if (tabela === "roteiro") await fazerRoteiro(linha, t0);
      else if (tabela === "postagem") await fazerLegenda(linha as unknown as LinhaPostagem, t0);
      else await fazerEntrega(linha as unknown as LinhaEntrega, t0);
    } catch (e) {
      const erro = e as Error & { limite?: boolean };
      log(`✗ ${tabela}: ${erro.message}`);
      if (erro.limite) {
        pausaAte = Date.now() + PAUSA_LIMITE_MS;
        const hVolta = new Date(pausaAte).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
        await db.from(tabela).update({ status: "aguardando_estacao", etapa: `o plano do Claude bateu no limite de uso: a estação tenta de novo às ${hVolta}` }).eq("id", linha.id);
      } else {
        await db.from(tabela).update({ status: "erro", etapa: null, erro: erro.message.slice(0, 500) }).eq("id", linha.id);
      }
    } finally {
      await db.from(tabela).update({ processando_desde: null }).eq("id", linha.id);
      atual = null;
      await batida();
    }
    if (UMA) break;
  }
  clearInterval(t);
  if (UMA) await batida(true);
}

const sair = async () => {
  await batida(true).catch(() => {});
  process.exit(0);
};
process.on("SIGINT", sair);
process.on("SIGTERM", sair);

principal().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
