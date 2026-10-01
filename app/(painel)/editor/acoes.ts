"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, exigirEquipe } from "@/lib/supabase/server";
import { configEditor, estiloValido, legendaValida, partesDe, type ArquivoPedido, type EnvioParte, type PedidoEdicao } from "@/lib/editor";
import { lookValido } from "./opcoes";

/** "Quem edita os seus vídeos": salva a escolha (a estação lê a cada pedido, sem reiniciar). */
export async function salvarMotor(formData: FormData) {
  const supabase = await createClient(); // sessão de quem está logado: a RLS só deixa a equipe
  const valor = configEditor({ motor: formData.get("motor"), modelo: String(formData.get("modelo") ?? "").trim() || null });
  const { error } = await supabase
    .from("configuracao")
    .upsert({ chave: "editor", valor, descricao: "Quem edita os seus vídeos: claude (plano Claude), codex (plano do ChatGPT) ou openrouter (paga por vídeo)" }, { onConflict: "chave" });
  revalidatePath("/editor");
  redirect(error ? `/editor?erro=${encodeURIComponent(`não salvou: ${error.message}`)}#motor` : "/editor?motor=salvo#motor");
}

// O vídeo e os materiais vão direto do navegador pro storage (bucket "edicao"), em partes de
// até 45 MB (o limite do storage é 50 MB por arquivo): aqui só se cria o pedido e os links
// assinados de envio. A estação (no PC do criador) junta as partes.

const BUCKET = "edicao";
const limpo = (s: unknown, max = 500) => String(s ?? "").trim().slice(0, max);
function conferirArquivo(a: ArquivoPedido | undefined, rotulo: string) {
  if (!a || !(a.tamanho > 0)) throw new Error(`${rotulo}: arquivo vazio`);
  if (a.tamanho > 2 * 1024 * 1024 * 1024) throw new Error(`${rotulo}: maior que 2 GB (exporte em 1080p)`);
  if (a.partes !== partesDe(a.tamanho)) throw new Error(`${rotulo}: número de partes não bate`);
}

type Criada = { id: string; video: EnvioParte[]; materiais: EnvioParte[][] };

/**
 * Cria o pedido (status "subindo") e devolve os links pra subir cada parte.
 * Devolve {erro} em vez de lançar: em produção o Next esconde a mensagem de erro de Server Action.
 */
export async function criarEdicao(p: PedidoEdicao): Promise<Criada | { erro: string }> {
  try {
    return await criar(p);
  } catch (e) {
    return { erro: (e as Error).message };
  }
}

async function criar(p: PedidoEdicao): Promise<Criada> {
  const { usuarioId } = await exigirEquipe();
  const titulo = limpo(p.titulo, 120);
  if (!titulo) throw new Error("dê um título");
  conferirArquivo(p.video, "vídeo");
  if ((p.materiais ?? []).length > 12) throw new Error("no máximo 12 materiais");
  for (const [k, m] of (p.materiais ?? []).entries()) {
    if (m.tipo === "link") {
      if (!/^https?:\/\/\S+$/i.test(limpo(m.url, 1000))) throw new Error(`material ${k + 1}: link inválido`);
    } else conferirArquivo(m.arquivo, `material ${k + 1}`);
    if (!limpo(m.descricao)) throw new Error(`material ${k + 1}: escreva o que é`);
  }

  const db = createAdminClient();
  const { data: ed, error } = await db
    .from("edicao")
    .insert({
      titulo,
      roteiro: limpo(p.roteiro, 8000) || null,
      opcoes: { estilo: estiloValido(p.estilo), legenda: legendaValida(p.estilo, p.legenda), ...(lookValido(p.cor) ? { cor: lookValido(p.cor) } : {}) },
      status: "subindo",
      criado_por: usuarioId,
    })
    .select("id")
    .single();
  if (error || !ed) throw new Error(`não consegui criar: ${error?.message}`);

  const dia = new Date().toISOString().slice(0, 10);
  async function links(prefixo: string, a: ArquivoPedido): Promise<{ partes: string[]; envios: EnvioParte[] }> {
    const partes = Array.from({ length: a.partes }, (_, i) => `${ed!.id}/${prefixo}-${String(i).padStart(3, "0")}`);
    const envios: EnvioParte[] = [];
    for (const caminho of partes) {
      const { data, error: e } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho, { upsert: true });
      if (e || !data) throw new Error(`link de envio: ${e?.message}`);
      envios.push({ caminho, url: data.signedUrl });
    }
    return { partes, envios };
  }

  const v = await links("video", p.video);
  await db.from("edicao").update({ video: { partes: v.partes, nome: limpo(p.video.nome, 200), tamanho: p.video.tamanho, tipo: limpo(p.video.tipo, 80), dia } }).eq("id", ed.id);

  const materiais: EnvioParte[][] = [];
  for (const [k, m] of (p.materiais ?? []).entries()) {
    if (m.tipo === "link") {
      await db.from("edicao_material").insert({ edicao_id: ed.id, ordem: k, tipo: "link", descricao: limpo(m.descricao), url: limpo(m.url, 1000) });
      materiais.push([]);
      continue;
    }
    const l = await links(`material-${k + 1}`, m.arquivo!);
    await db.from("edicao_material").insert({
      edicao_id: ed.id,
      ordem: k,
      tipo: m.tipo === "video" ? "video" : "imagem",
      descricao: limpo(m.descricao),
      arquivo: { partes: l.partes, nome: limpo(m.arquivo!.nome, 200), tamanho: m.arquivo!.tamanho, tipo: limpo(m.arquivo!.tipo, 80) },
    });
    materiais.push(l.envios);
  }
  return { id: ed.id, video: v.envios, materiais };
}

/** Tudo subiu: entra na fila da estação. */
export async function confirmarEdicao(id: string) {
  await exigirEquipe();
  const db = createAdminClient();
  await db.from("edicao").update({ status: "na_fila", etapa: "esperando a estação", log: [{ t: new Date().toISOString(), msg: "arquivos enviados, na fila" }] }).eq("id", id).eq("status", "subindo");
  revalidatePath("/editor");
}

/** Pede um ajuste: nova versão que parte da anterior (a estação reaproveita a oficina). */
export async function pedirAjuste(formData: FormData) {
  const { usuarioId } = await exigirEquipe();
  const id = String(formData.get("id"));
  const ajuste = limpo(formData.get("ajuste"), 4000);
  if (!ajuste) redirect(`/editor/${id}?erro=${encodeURIComponent("escreva o que mudar")}`);
  const db = createAdminClient();
  const { data: ant } = await db.from("edicao").select("id, titulo, versao, roteiro, opcoes, status").eq("id", id).single();
  if (!ant || ant.status !== "pronto") redirect(`/editor/${id}?erro=${encodeURIComponent("só dá pra ajustar uma edição pronta")}`);
  const { data: nova, error } = await db
    .from("edicao")
    .insert({ titulo: ant.titulo, roteiro: ant.roteiro, opcoes: ant.opcoes, versao: ant.versao + 1, origem_id: ant.id, ajuste, status: "na_fila", etapa: "esperando a estação", criado_por: usuarioId, log: [{ t: new Date().toISOString(), msg: `ajuste da versão ${ant.versao}` }] })
    .select("id")
    .single();
  if (error || !nova) redirect(`/editor/${id}?erro=${encodeURIComponent(error?.message ?? "erro")}`);
  revalidatePath("/editor");
  redirect(`/editor/${nova.id}`);
}

export async function cancelarEdicao(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  await createAdminClient().from("edicao").update({ status: "cancelada", etapa: "cancelada pelo painel" }).eq("id", id).in("status", ["subindo", "na_fila", "preparando", "editando", "renderizando"]);
  revalidatePath(`/editor/${id}`);
}

export async function tentarDeNovo(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  await createAdminClient().from("edicao").update({ status: "na_fila", erro: null, etapa: "de volta na fila" }).eq("id", id).in("status", ["erro", "cancelada"]);
  revalidatePath(`/editor/${id}`);
}

/** Apaga o pedido e todos os arquivos dele no storage (o que ficou no PC continua lá). */
export async function apagarEdicao(formData: FormData) {
  await exigirEquipe();
  const id = String(formData.get("id"));
  const db = createAdminClient();
  const { data: arquivos } = await db.storage.from(BUCKET).list(id, { limit: 1000 });
  if (arquivos?.length) await db.storage.from(BUCKET).remove(arquivos.map((a) => `${id}/${a.name}`));
  await db.from("edicao").update({ origem_id: null }).eq("origem_id", id);
  await db.from("edicao").delete().eq("id", id);
  revalidatePath("/editor");
  redirect("/editor");
}
