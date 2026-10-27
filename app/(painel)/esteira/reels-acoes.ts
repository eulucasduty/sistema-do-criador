"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { exigirEquipe } from "@/lib/supabase/server";
import { lerConfig, salvarConfig } from "@/lib/config";
import { ESTILO_PADRAO, estiloDe, estiloValido, legendaValida, partesDe, type EnvioParte } from "@/lib/editor";
import { slugDe } from "@/lib/entregas/blocos";
import { legendaDoReel } from "@/lib/postagem/legenda-carrossel";
import { medir } from "@/lib/roteiro/anti-ia";
import { versaoDoTexto } from "@/lib/roteiro/da-texto";
import type { VersaoRoteiro } from "@/lib/roteiro/escrever";
import {
  AGENDA_REELS_PADRAO,
  MAX_TAKES,
  ajustesValidos,
  horarioValido,
  proximoHorario,
  velocidadeValida,
  volumeValido,
  type AgendaReels,
  type PedidoGravacao,
} from "@/lib/reels";

// A esteira de reels (pedido do Duty, 19/10): roteiro → gravador → edição → review → agenda → postado.
// O gravador manda os takes direto do navegador pro storage (bucket "edicao", em partes de até 45 MB,
// como o editor): aqui só se cria a edição e os links assinados. Server Action é endpoint público,
// então cada uma confere login e equipe (exigirEquipe).

const BUCKET = "edicao";
const ESTEIRA = "/esteira?aba=reels";
const limpo = (s: unknown, max = 500) => String(s ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
const linhas = (s: unknown) =>
  limpo(s, 6000)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 60);
const atualizar = () => {
  revalidatePath("/esteira");
  revalidatePath("/roteiros");
  revalidatePath("/editor");
};

/** O texto que vai pra edição como roteiro/contexto (o editor confere os nomes e a palavra do CTA). */
function textoDoRoteiro(v: VersaoRoteiro): string {
  return [
    `GANCHO\n${v.gancho.join("\n")}`,
    `CORPO\n${v.corpo.join("\n")}`,
    `CTA\n${v.cta.join("\n")}`,
    v.palavra_cta ? `palavra do comenta: ${v.palavra_cta}` : "",
    v.dicas?.length ? `o que mostrar na tela:\n${v.dicas.map((d) => `- ${d}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── roteiro ─────────────────────────────────────────────────────────

/** "Editar" no card: o texto mexido vira a versão mais nova (as outras ficam no histórico). */
export async function salvarRoteiroEditado(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const volta = limpo(formData.get("volta"), 200) || `/roteiros/${id}`;
  const db = createAdminClient();
  const { data: r } = await db.from("roteiro").select("id, versoes").eq("id", id).maybeSingle();
  const versoes = (r?.versoes ?? []) as VersaoRoteiro[];
  if (!r || !versoes.length) redirect(`${volta}${volta.includes("?") ? "&" : "?"}erro=${encodeURIComponent("roteiro sem texto pra editar")}`);
  const base = versoes[Number(formData.get("v") ?? 0) || 0] ?? versoes[0];
  const gancho = linhas(formData.get("gancho"));
  const corpo = linhas(formData.get("corpo"));
  const cta = linhas(formData.get("cta"));
  if (!gancho.length || !cta.length) redirect(`${volta}${volta.includes("?") ? "&" : "?"}erro=${encodeURIComponent("o gancho e o CTA não podem ficar vazios")}`);
  const medida = medir([...gancho, ...corpo, ...cta]);
  const nova: VersaoRoteiro = {
    ...base,
    titulo: limpo(formData.get("titulo"), 120) || base.titulo,
    palavra_cta: limpo(formData.get("palavra"), 40).toUpperCase() || base.palavra_cta,
    gancho,
    corpo,
    cta,
    checagem: { ...base.checagem, palavras: medida.palavras, segundos: medida.segundos },
    leitor: [],
    reescritas: [],
    gerado_em: new Date().toISOString(),
    modelo: "editado à mão",
    custo_usd: 0,
  };
  const { error } = await db
    .from("roteiro")
    .update({ versoes: [nova, ...versoes].slice(0, 5), titulo: nova.titulo, palavra_cta: nova.palavra_cta || null })
    .eq("id", id);
  if (error) redirect(`${volta}${volta.includes("?") ? "&" : "?"}erro=${encodeURIComponent(error.message)}`);
  atualizar();
  redirect(volta);
}

/**
 * "Colar roteiro" (pedido do Duty, 20/10: "uma opção de colocar um roteiro na esteira"): o texto dele
 * entra pronto na coluna Roteiros, sem IA. Com os títulos GANCHO / CORPO / CTA vale a divisão dele;
 * sem, o sistema picota (1ª frase = gancho, o fim que pede ação = CTA).
 */
export async function colarRoteiro(formData: FormData) {
  const { usuarioId } = await exigirEquipe();
  const texto = limpo(formData.get("texto"), 8000);
  if (texto.split(/\s+/).filter(Boolean).length < 5) redirect(`${ESTEIRA}&erro=${encodeURIComponent("cola o texto do roteiro (pelo menos uma frase)")}`);
  const v = versaoDoTexto(texto, {
    titulo: limpo(formData.get("titulo"), 120),
    palavra: limpo(formData.get("palavra"), 40).replace(/[^\p{L}\p{N}]/gu, ""),
    duracaoAlvo: 45,
    deOndeVeio: "colado na esteira",
    modelo: "colado à mão",
  });
  if (!v.gancho.length) redirect(`${ESTEIRA}&erro=${encodeURIComponent("não achei o gancho no texto")}`);
  const { error } = await createAdminClient()
    .from("roteiro")
    .insert({
      origem: "manual",
      titulo: v.titulo,
      palavra_cta: v.palavra_cta || null,
      duracao_alvo: Math.min(180, Math.max(15, v.checagem.segundos || 45)),
      status: "pronto",
      versoes: [v],
      criado_por: usuarioId,
    });
  if (error) redirect(`${ESTEIRA}&erro=${encodeURIComponent(`não salvou: ${error.message}`)}`);
  atualizar();
  redirect(ESTEIRA);
}

/** Tira o roteiro da esteira (não vai ser gravado). Continua em /roteiros. */
export async function arquivarRoteiro(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const desfazer = formData.get("desfazer") === "1";
  await createAdminClient().from("roteiro").update({ arquivado_em: desfazer ? null : new Date().toISOString() }).eq("id", id);
  atualizar();
  redirect(limpo(formData.get("volta"), 200) || ESTEIRA);
}

// ── gravador ────────────────────────────────────────────────────────

type CriadaGravacao = { id: string; takes: EnvioParte[][] };

/**
 * O gravador mandou: cria a edição (status "subindo") com os takes e devolve os links pra subir cada
 * parte. Devolve {erro} em vez de lançar (em produção o Next esconde a mensagem de Server Action).
 */
export async function criarGravacao(p: PedidoGravacao): Promise<CriadaGravacao | { erro: string }> {
  try {
    const { usuarioId } = await exigirEquipe();
    const db = createAdminClient();
    const { data: r } = await db.from("roteiro").select("id, titulo, versoes, palavra_cta").eq("id", limpo(p.roteiroId, 60)).maybeSingle();
    const versoes = (r?.versoes ?? []) as VersaoRoteiro[];
    const v = versoes[Math.max(0, Math.floor(Number(p.versao) || 0))] ?? versoes[0];
    if (!r || !v) throw new Error("roteiro não encontrado");
    const takes = (p.takes ?? []).slice(0, MAX_TAKES);
    if (!takes.length) throw new Error("grave pelo menos um take");
    for (const [k, t] of takes.entries()) {
      if (!(t.tamanho > 0)) throw new Error(`take ${k + 1}: vazio`);
      if (t.tamanho > 1024 * 1024 * 1024) throw new Error(`take ${k + 1}: maior que 1 GB`);
      if (t.partes !== partesDe(t.tamanho)) throw new Error(`take ${k + 1}: número de partes não bate`);
      if (!(t.fim > t.inicio)) throw new Error(`take ${k + 1}: o corte do fim tem que vir depois do começo`);
    }
    let musica: { id: string; nome: string; arquivo: string; volume: number } | null = null;
    if (p.musica?.id) {
      const { data: m } = await db.from("musica").select("id, nome, arquivo").eq("id", limpo(p.musica.id, 60)).maybeSingle();
      if (m) musica = { ...m, volume: volumeValido(p.musica.volume) };
    }
    const estilo = estiloDe(ESTILO_PADRAO);
    const { data: ed, error } = await db
      .from("edicao")
      .insert({
        titulo: limpo(p.titulo, 120) || r.titulo || v.titulo || "reel",
        roteiro: textoDoRoteiro(v),
        roteiro_id: r.id,
        cta_palavra: v.palavra_cta || r.palavra_cta || null,
        opcoes: { estilo: estilo.id, legenda: estilo.legenda, gravador: true, ajustes: ajustesValidos(p.ajustes), musica },
        status: "subindo",
        etapa: "subindo os takes do gravador",
        criado_por: usuarioId,
      })
      .select("id")
      .single();
    if (error || !ed) throw new Error(`não consegui criar: ${error?.message}`);

    const envios: EnvioParte[][] = [];
    const meta = [];
    for (const [k, t] of takes.entries()) {
      const partes = Array.from({ length: t.partes }, (_, i) => `${ed.id}/take-${String(k + 1).padStart(2, "0")}-${String(i).padStart(3, "0")}`);
      const links: EnvioParte[] = [];
      for (const caminho of partes) {
        const { data, error: e } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho, { upsert: true });
        if (e || !data) throw new Error(`link de envio: ${e?.message}`);
        links.push({ caminho, url: data.signedUrl });
      }
      envios.push(links);
      meta.push({
        partes,
        nome: limpo(t.nome, 120),
        tamanho: t.tamanho,
        tipo: limpo(t.tipo, 80),
        inicio: Math.max(0, Number(t.inicio) || 0),
        fim: Math.max(0, Number(t.fim) || 0),
        velocidade: velocidadeValida(t.velocidade),
      });
    }
    await db.from("edicao").update({ video: { takes: meta, dia: new Date().toISOString().slice(0, 10) } }).eq("id", ed.id);
    return { id: ed.id, takes: envios };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** Todos os takes subiram: o vídeo vai pra coluna "Pra editar". */
export async function confirmarGravacao(id: string): Promise<{ erro?: string }> {
  await exigirEquipe();
  const { error } = await createAdminClient()
    .from("edicao")
    .update({ status: "gravado", etapa: "gravado: escolha a edição", log: [{ t: new Date().toISOString(), msg: "takes enviados pelo gravador" }] })
    .eq("id", limpo(id, 60))
    .eq("status", "subindo");
  atualizar();
  return error ? { erro: error.message } : {};
}

/** Link pra subir uma música nova da biblioteca (o navegador sobe direto pro storage). */
export async function linkMusica(nome: string, tipo: string, tamanho: number): Promise<{ caminho: string; url: string } | { erro: string }> {
  try {
    await exigirEquipe();
    if (!(tamanho > 0) || tamanho > 45 * 1024 * 1024) throw new Error("a música tem que ter até 45 MB");
    if (!/^audio\//.test(tipo) && !/\.(mp3|m4a|wav|aac|ogg)$/i.test(nome)) throw new Error("só arquivo de áudio (mp3, m4a, wav)");
    const ext = (nome.match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "mp3").toLowerCase();
    const caminho = `musicas/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUploadUrl(caminho, { upsert: true });
    if (error || !data) throw new Error(`link de envio: ${error?.message}`);
    return { caminho, url: data.signedUrl };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

/** A música subiu: entra na biblioteca. */
export async function salvarMusica(m: { nome: string; caminho: string; tipo: string; tamanho: number; duracao: number | null }): Promise<{ id: string; url: string | null } | { erro: string }> {
  try {
    const { usuarioId } = await exigirEquipe();
    if (!/^musicas\/[0-9a-f-]{36}\.[a-z0-9]{2,4}$/.test(m.caminho)) throw new Error("caminho inválido");
    const db = createAdminClient();
    const { data, error } = await db
      .from("musica")
      .insert({ nome: limpo(m.nome, 120) || "música", arquivo: m.caminho, tipo: limpo(m.tipo, 80), tamanho: m.tamanho, duracao_s: m.duracao, criado_por: usuarioId })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "não salvou");
    const { data: link } = await db.storage.from(BUCKET).createSignedUrl(m.caminho, 3600);
    return { id: data.id, url: link?.signedUrl ?? null };
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

export async function apagarMusica(id: string): Promise<void> {
  await exigirEquipe();
  const db = createAdminClient();
  const { data: m } = await db.from("musica").select("arquivo").eq("id", limpo(id, 60)).maybeSingle();
  if (!m) return;
  await db.storage.from(BUCKET).remove([m.arquivo]);
  await db.from("musica").delete().eq("id", limpo(id, 60));
}

// ── pra editar → editando ───────────────────────────────────────────

/** Escolheu o estilo de edição: entra na fila da estação. */
export async function mandarProEditor(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const db = createAdminClient();
  const { data: ed } = await db.from("edicao").select("id, opcoes, roteiro, status").eq("id", id).maybeSingle();
  if (!ed || ed.status !== "gravado") redirect(`/editor/${id}?erro=${encodeURIComponent("esse vídeo não está esperando edição")}`);
  const estilo = estiloValido(formData.get("estilo"));
  const nota = limpo(formData.get("nota"), 2000);
  await db
    .from("edicao")
    .update({
      opcoes: { ...(ed.opcoes ?? {}), estilo, legenda: legendaValida(estilo, formData.get("legenda")) },
      roteiro: nota ? `${ed.roteiro ?? ""}\n\nobservação do Duty pra edição:\n${nota}`.trim() : ed.roteiro,
      status: "na_fila",
      etapa: "esperando a estação",
      log: [{ t: new Date().toISOString(), msg: "edição escolhida, na fila" }],
    })
    .eq("id", id)
    .eq("status", "gravado");
  atualizar();
  redirect(`/editor/${id}`);
}

// ── review → postagem ───────────────────────────────────────────────

const lerAgenda = async (): Promise<AgendaReels> => ({ ...AGENDA_REELS_PADRAO, ...(await lerConfig<Partial<AgendaReels>>("agenda_reels", {})) });

/** Os horários já tomados por reels que ainda não saíram. */
async function ocupados(db: ReturnType<typeof createAdminClient>, menos?: string): Promise<string[]> {
  const { data } = await db.from("postagem").select("id, publicar_em").not("publicar_em", "is", null).neq("status", "publicada").gte("publicar_em", new Date().toISOString());
  return (data ?? []).filter((p) => p.id !== menos).map((p) => p.publicar_em as string);
}

/**
 * "Aprovar": o reel vai pra agenda (o próximo horário livre), a legenda ganha a 1ª linha do CTA e,
 * se a palavra ainda não tem material, a estação monta um pelo que ele falou no vídeo.
 */
export async function aprovarReel(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const volta = limpo(formData.get("volta"), 200) || `/editor/${id}`;
  const erro = (m: string): never => redirect(`${volta}${volta.includes("?") ? "&" : "?"}erro=${encodeURIComponent(m)}`);
  const db = createAdminClient();
  const { data: ed } = await db.from("edicao").select("id, titulo, status, cta_palavra, roteiro_id").eq("id", id).maybeSingle();
  if (!ed || ed.status !== "pronto") erro("só dá pra aprovar um vídeo pronto");
  let { data: p } = await db.from("postagem").select("id, status, palavra, legenda, publicar_em").eq("edicao_id", id).maybeSingle();
  if (!p) {
    const { data: novo, error } = await db
      .from("postagem")
      .insert({ edicao_id: id, palavra: ed!.cta_palavra, status: "aguardando_estacao", etapa: "na fila da estação: o Claude escreve a legenda" })
      .select("id, status, palavra, legenda, publicar_em")
      .single();
    if (error || !novo) erro(`não criou o post: ${error?.message}`);
    p = novo;
  }
  if (["enviando", "processando", "publicando", "publicada"].includes(p!.status)) erro("esse vídeo já foi pro Instagram");
  let palavra: string | null = p!.palavra ?? ed!.cta_palavra ?? null;
  if (!palavra && ed!.roteiro_id) {
    const { data: r } = await db.from("roteiro").select("palavra_cta").eq("id", ed!.roteiro_id).maybeSingle();
    palavra = r?.palavra_cta ?? null;
  }
  const quando = p!.publicar_em && Date.parse(p!.publicar_em) > Date.now() ? p!.publicar_em : proximoHorario((await lerAgenda()).horarios, await ocupados(db, p!.id)).toISOString();
  await db
    .from("postagem")
    .update({ publicar_em: quando, palavra, ...(p!.status === "pronta" && p!.legenda ? { legenda: legendaDoReel(palavra, p!.legenda) } : {}) })
    .eq("id", p!.id);
  await db.from("edicao").update({ aprovada_em: new Date().toISOString() }).eq("id", id);

  // O material da palavra: se ainda não existe, a estação monta pelo que ele falou no vídeo
  if (palavra) {
    const { data: tem } = await db.from("entrega").select("id").ilike("palavra", palavra).limit(1);
    if (!tem?.length) {
      const base = slugDe(palavra) || "material";
      let slug = base;
      for (let k = 2; k < 50; k++) {
        const { data: usado } = await db.from("entrega").select("id").eq("slug", slug).maybeSingle();
        if (!usado) break;
        slug = `${base}-${k}`.slice(0, 40);
      }
      await db.from("entrega").insert({ slug, palavra, titulo: "", edicao_id: id, status: "aguardando_estacao", etapa: "na fila da estação: o Claude monta o material" });
      revalidatePath("/materiais");
    }
  }
  atualizar();
  redirect(volta);
}

/** Muda o horário do post agendado (o campo vem no horário de Brasília). */
export async function reagendarReel(formData: FormData) {
  await exigirEquipe();
  const id = limpo(formData.get("id"), 60);
  const volta = limpo(formData.get("volta"), 200) || ESTEIRA;
  const v = limpo(formData.get("quando"), 20);
  const quando = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? new Date(`${v}:00-03:00`) : null;
  if (!quando || Number.isNaN(quando.getTime())) redirect(`${volta}${volta.includes("?") ? "&" : "?"}erro=${encodeURIComponent("horário inválido")}`);
  const db = createAdminClient();
  const { data: atual } = await db.from("postagem").select("status").eq("id", id).maybeSingle();
  if (!atual) redirect(`${volta}${volta.includes("?") ? "&" : "?"}erro=${encodeURIComponent("não achei esse post")}`);
  if (!["pronta", "erro", "aguardando_estacao", "escrevendo"].includes(atual!.status))
    redirect(`${volta}${volta.includes("?") ? "&" : "?"}erro=${encodeURIComponent("esse post já foi pro Instagram: não dá mais pra mudar o horário")}`);
  const { error } = await db.from("postagem").update({ publicar_em: quando!.toISOString() }).eq("id", id);
  if (error) redirect(`${volta}${volta.includes("?") ? "&" : "?"}erro=${encodeURIComponent(`não salvou o horário: ${error.message}`)}`);
  // um post com erro volta pra fila (confira no Instagram se não saiu antes); sem legenda, a estação escreve de novo
  const p = atual;
  if (p?.status === "erro") {
    const { data: l } = await db.from("postagem").select("legenda").eq("id", id).maybeSingle();
    await db
      .from("postagem")
      .update(l?.legenda?.trim() ? { status: "pronta", erro: null, etapa: null } : { status: "aguardando_estacao", erro: null, etapa: "na fila da estação: o Claude escreve a legenda" })
      .eq("id", id)
      .eq("status", "erro");
  }
  atualizar();
  redirect(volta);
}

/** Tira da agenda (continua aprovado; dá pra postar pelo botão ou reagendar). */
export async function desagendarReel(formData: FormData) {
  await exigirEquipe();
  await createAdminClient().from("postagem").update({ publicar_em: null }).eq("id", limpo(formData.get("id"), 60)).in("status", ["pronta", "erro", "aguardando_estacao", "escrevendo"]);
  atualizar();
  redirect(limpo(formData.get("volta"), 200) || ESTEIRA);
}

/** Os horários do dia em que sai um reel aprovado. */
export async function salvarAgendaReels(formData: FormData) {
  await exigirEquipe();
  const horarios = [...new Set(limpo(formData.get("horarios"), 300).split(/[\s,;]+/).map((h) => h.padStart(5, "0")).filter(horarioValido))].sort().slice(0, 12);
  if (!horarios.length) redirect(`${ESTEIRA}&erro=${encodeURIComponent("ponha pelo menos um horário (ex.: 11:00, 19:00)")}`);
  await salvarConfig("agenda_reels", { horarios });
  atualizar();
  redirect(ESTEIRA);
}
