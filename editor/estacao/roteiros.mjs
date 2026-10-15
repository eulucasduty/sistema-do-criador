// A parte da estação que ESCREVE os roteiros pra teleprompter. Roda junto da estação de edição
// (scripts/estacao-edicao.mjs liga com ligarRoteiros), com o mesmo login e a mesma IA escolhida no
// painel (Editor de vídeo → Quem edita): Claude ou ChatGPT no plano do criador, sem custo, ou a
// OpenRouter, paga por uso. Não espera a edição de vídeo terminar: são dois laços independentes.
//
// O painel (servidor) transcreve e analisa a referência, quando tem (Gemini, centavos), e deixa o
// roteiro "aguardando_estacao". Aqui: pega o mais antigo, escreve, passa pela checagem anti-IA e
// pela segunda leitura, reescreve o que reprovar (lib/roteiro/escritor.mjs) e grava a versão.
// A voz vem do perfil e da persona do criador (configuracao "perfil" e "persona") e dos reels dele
// já transcritos (tabela meu_reel). Tudo passa pela RLS, como o resto da estação.
// Plano no limite: o pedido volta pra fila e a estação tenta de novo em 20 minutos.

import os from "node:os";
import { MAX_VERSOES, achatar, entradaDoRoteiro, escreverRoteiro, falaCorrida, vozDoCriador } from "../../lib/roteiro/escritor.mjs";
import { padraoValido } from "../../lib/roteiro/padrao-inicial.mjs";
import { MODELO_PADRAO, MOTORES, configMotor, lerChaveOpenRouter, lerConfigMotor } from "./motor.mjs";
import { claudeTexto, codexTexto } from "./texto.mjs";

const ESPERA_MS = 5000;
const BATIDA_MS = 30_000;
const PAUSA_LIMITE_MS = 20 * 60_000;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * O motor de texto (o contrato do escritor) a partir da escolha do painel. Escreve com o modelo
 * escolhido; a segunda leitura, que é curta, vai com esforço baixo (no Claude, no Sonnet).
 * @returns {import("../../lib/roteiro/escritor.mjs").Motor}
 */
export function motorDeTexto(config, { chaveOpenRouter = null, maquina = os.hostname() } = {}) {
  const { motor, modelo: escolhido } = configMotor(config);
  if (motor === "codex") {
    const modelo = escolhido ?? MODELO_PADRAO.codex;
    const rodar = (sistema, prompt, esforco, minutos) => codexTexto({ sistema, prompt, modelo, esforco, minutos });
    return {
      nome: `ChatGPT${modelo ? ` · ${modelo}` : ""} (plano do ChatGPT, estação ${maquina})`,
      async escrever(mensagens) {
        const { sistema, prompt } = achatar(mensagens);
        return { texto: (await rodar(sistema, prompt, "medium", 10)).texto, custo: 0 };
      },
      async ler(sistema, usuario) {
        return { texto: (await rodar(sistema, usuario, "low", 5)).texto, custo: 0 };
      },
    };
  }
  const naOpenRouter = motor === "openrouter";
  if (naOpenRouter && !chaveOpenRouter) throw new Error("falta a chave da OpenRouter: cole no painel (Início → passo 2)");
  const escritor = escolhido ?? MODELO_PADRAO[motor];
  // Na OpenRouter o leitor vai no mesmo modelo (é o que a chave tem); no plano, o Sonnet basta
  const leitor = naOpenRouter ? escritor : "sonnet";
  const openrouter = naOpenRouter ? { chave: chaveOpenRouter } : null;
  let gasto = 0;
  const rodar = async (sistema, prompt, modelo, esforco, minutos) => {
    const r = await claudeTexto({ sistema, prompt, modelo, esforco, minutos, openrouter });
    gasto += r.uso.custo_usd ?? 0;
    return { texto: r.texto, custo: naOpenRouter ? (r.uso.custo_usd ?? 0) : 0 };
  };
  return {
    nome: naOpenRouter ? `Claude · ${escritor} (OpenRouter, estação ${maquina})` : `Claude · ${escritor} (plano do Claude, estação ${maquina})`,
    async escrever(mensagens) {
      const { sistema, prompt } = achatar(mensagens);
      return rodar(sistema, prompt, escritor, "medium", 10);
    },
    ler: (sistema, usuario) => rodar(sistema, usuario, leitor, "low", 5),
    // No plano: quanto seria na API (referência, não é cobrado)
    ...(naOpenRouter ? {} : { equivalenteApi: () => gasto }),
  };
}

/**
 * Liga o laço dos roteiros. `pronto()`: a IA escolhida está instalada e logada (a estação de edição
 * confere); sem isso os pedidos esperam na fila. Devolve { parar }.
 * @param {{ db: any, maquina?: string, pronto?: () => boolean, log?: (msg: string) => void }} o
 */
export function ligarRoteiros({ db, maquina = os.hostname(), pronto = () => true, log = console.log }) {
  let atual = null;
  let pausaAte = 0;
  let parado = false;

  /** O painel mostra se a parte dos roteiros está ligada (mais de 90 s sem bater = desligada). */
  async function batida(ligada = true) {
    const valor = { visto_em: ligada ? new Date().toISOString() : null, maquina, ocupada: ligada && Boolean(atual), roteiro_id: (ligada && atual) || null };
    const { error } = await db.from("configuracao").upsert({ chave: "estacao_roteiros", valor }, { onConflict: "chave" });
    if (error) log(`roteiros: a batida falhou (${error.message})`);
  }

  async function pegar() {
    const { data: fila, error } = await db.from("roteiro").select("id").eq("status", "aguardando_estacao").order("criado_em").limit(1);
    if (error) throw new Error(error.message);
    if (!fila?.length) return null;
    const { data: pego } = await db
      .from("roteiro")
      .update({ status: "escrevendo", estacao: maquina, etapa: `a estação (${maquina}) pegou o roteiro`, processando_desde: new Date().toISOString(), erro: null })
      .eq("id", fila[0].id)
      .eq("status", "aguardando_estacao")
      .select("*")
      .maybeSingle();
    return pego ?? null;
  }

  async function lerConfig(chave) {
    const { data } = await db.from("configuracao").select("valor").eq("chave", chave).maybeSingle();
    return data?.valor ?? null;
  }

  /** A voz: perfil, persona e a fala dos reels do criador (os mais falados primeiro). */
  async function lerVoz() {
    const [perfil, persona, { data: reels }] = await Promise.all([
      lerConfig("perfil"),
      lerConfig("persona"),
      db.from("meu_reel").select("assistido, publicado_em").not("assistido", "is", null).order("publicado_em", { ascending: false }).limit(15),
    ]);
    const exemplos = (reels ?? [])
      .map((r) => falaCorrida(r.assistido))
      .filter((t) => t.split(" ").length > 40)
      .sort((a, b) => b.length - a.length);
    return vozDoCriador({ perfil: perfil ?? {}, persona: persona ?? {}, exemplos });
  }

  /** Grava a versão nova (a mais nova primeiro, até 5) e o roteiro fica pronto. */
  async function gravarVersao(r, versao) {
    const { data: antes } = await db.from("roteiro").select("versoes, titulo, custo_usd").eq("id", r.id).maybeSingle();
    if (!antes) throw new Error("o roteiro foi apagado no painel");
    const versoes = [versao, ...(Array.isArray(antes.versoes) ? antes.versoes : [])].slice(0, MAX_VERSOES);
    const { error } = await db
      .from("roteiro")
      .update({
        status: "pronto",
        etapa: null,
        erro: null,
        versoes,
        titulo: antes.titulo || versao.titulo,
        custo_usd: Number((Number(antes.custo_usd || 0) + versao.custo_usd).toFixed(4)),
      })
      .eq("id", r.id);
    if (error) throw new Error(`não consegui gravar o roteiro: ${error.message}`);
  }

  async function fazer(r) {
    const t0 = Date.now();
    log(`roteiro ▶ ${r.titulo || r.tema || "a partir de uma referência"} (${r.duracao_alvo} s)`);
    const config = await lerConfigMotor(db);
    const motor = motorDeTexto(config, { chaveOpenRouter: config.motor === "openrouter" ? await lerChaveOpenRouter(db) : null, maquina });
    const quem = MOTORES[config.motor]?.nome ?? "a IA";
    await db.from("roteiro").update({ etapa: `a estação (${maquina}) está escrevendo com ${quem}` }).eq("id", r.id);
    const [voz, padrao] = await Promise.all([lerVoz(), lerConfig("padrao_viral").then(padraoValido)]);
    const versao = await escreverRoteiro({
      entrada: entradaDoRoteiro(r),
      padrao,
      voz,
      motor,
      aoReescrever: async (n) => {
        log(`roteiro   reescrevendo o que a checagem anti-IA barrou (rodada ${n})`);
        await db.from("roteiro").update({ etapa: `${quem} está reescrevendo o que a checagem anti-IA barrou (rodada ${n})` }).eq("id", r.id);
      },
    });
    await gravarVersao(r, versao);
    const c = versao.checagem;
    log(`roteiro ✓ pronto em ${Math.round((Date.now() - t0) / 1000)} s · ~${c.segundos} s de fala · ${c.aprovado && !versao.leitor.length ? "passou na checagem anti-IA" : "com ressalvas"}`);
  }

  async function laco() {
    // O que ficou pela metade nesta máquina (a estação caiu no meio): volta pra fila
    await db
      .from("roteiro")
      .update({ status: "aguardando_estacao", etapa: "a estação reiniciou: de volta na fila", processando_desde: null })
      .eq("status", "escrevendo")
      .eq("estacao", maquina);
    await batida();
    const t = setInterval(() => batida().catch(() => {}), BATIDA_MS);
    while (!parado) {
      let r = null;
      try {
        if (Date.now() >= pausaAte && pronto()) r = await pegar();
      } catch (e) {
        log(`roteiros: erro lendo a fila (${e.message})`);
      }
      if (!r) {
        await dormir(ESPERA_MS);
        continue;
      }
      atual = r.id;
      await batida().catch(() => {});
      try {
        await fazer(r);
      } catch (e) {
        log(`roteiro ✗ ${e.message}`);
        if (e.limite) {
          pausaAte = Date.now() + PAUSA_LIMITE_MS;
          const volta = new Date(pausaAte).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
          await db.from("roteiro").update({ status: "aguardando_estacao", etapa: `o plano da IA bateu no limite de uso: a estação tenta de novo às ${volta}` }).eq("id", r.id);
        } else {
          await db.from("roteiro").update({ status: "erro", etapa: null, erro: String(e.message).slice(0, 500) }).eq("id", r.id);
        }
      } finally {
        await db.from("roteiro").update({ processando_desde: null }).eq("id", r.id);
        atual = null;
        await batida().catch(() => {});
      }
    }
    clearInterval(t);
  }

  // Se o laço cair (internet, banco), religa sozinho em 30 s
  const rodar = () =>
    laco().catch((e) => {
      log(`roteiros: a parte que escreve parou (${e.message}): religo em 30 s`);
      if (!parado) setTimeout(rodar, 30_000);
    });
  rodar();
  log("Roteiros: a estação também escreve os roteiros pra teleprompter que você pedir no painel.");

  return {
    async parar() {
      parado = true;
      await batida(false).catch(() => {});
    },
  };
}
