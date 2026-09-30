"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { esquecerConfig, type LembreteComentario } from "@/lib/config";
import type { Estado } from "../agente/form-acao";

// Ações das Automações (o ManyChat grátis). Tudo pelo cliente da sessão: a RLS vale.

const MAX_ENTREGA = 6;
const MAX_TOQUES = 3;
const https = (url: string) => /^https:\/\/\S+$/i.test(url);

const linhas = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

/** As mensagens picotadas da entrega (vazias saem; botão só com link https). */
function lerEntrega(formData: FormData): { mensagens: Array<{ texto: string; botao_titulo?: string; botao_url?: string }>; erro?: string } {
  const mensagens: Array<{ texto: string; botao_titulo?: string; botao_url?: string }> = [];
  for (let i = 0; i < MAX_ENTREGA; i++) {
    const texto = String(formData.get(`entrega_${i}_texto`) ?? "").trim().slice(0, 1000);
    const titulo = String(formData.get(`entrega_${i}_botao_titulo`) ?? "").trim().slice(0, 20);
    const url = String(formData.get(`entrega_${i}_botao_url`) ?? "").trim();
    if (url && !https(url)) return { mensagens, erro: `o link do botão da mensagem ${i + 1} precisa começar com https://` };
    if (!texto && !url) continue;
    mensagens.push({ texto, ...(url ? { botao_titulo: titulo || "abrir", botao_url: url } : {}) });
  }
  return { mensagens };
}

/** Os toques de quem sumiu (horas entre 1 e 23,5: a janela do Instagram é de 24 h). */
function lerFollowups(formData: FormData) {
  const saida: Array<{ horas: number; texto: string }> = [];
  for (let i = 0; i < MAX_TOQUES; i++) {
    const texto = String(formData.get(`followup_${i}_texto`) ?? "").trim().slice(0, 300);
    const horas = Number(String(formData.get(`followup_${i}_horas`) ?? "").replace(",", "."));
    if (!texto || !Number.isFinite(horas)) continue;
    saida.push({ horas: Math.min(23.5, Math.max(1, horas)), texto });
  }
  return saida.sort((x, y) => x.horas - y.horas);
}

/** Cria ou salva. Deu certo = vai pra página da automação; senão devolve o erro (o formulário fica como está). */
export async function salvarAutomacao(formData: FormData): Promise<{ erro: string } | undefined> {
  const id = String(formData.get("id") ?? "");
  const entrega = lerEntrega(formData);
  if (entrega.erro) return { erro: entrega.erro };
  const dados = {
    nome: String(formData.get("nome") ?? "").trim().slice(0, 80) || "Automação",
    modo: formData.get("modo") === "agente" ? "agente" : "botao",
    contexto: String(formData.get("contexto") ?? "").trim().slice(0, 2000) || null,
    todas_as_midias: formData.get("todas_as_midias") === "on",
    midias: [...new Set(formData.getAll("midias").map(String).filter(Boolean))],
    palavras: [
      ...new Set(
        String(formData.get("palavras") ?? "")
          .split(/[,\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ].slice(0, 30),
    respostas_publicas: linhas(formData.get("respostas_publicas")).slice(0, 10),
    dm_abertura: String(formData.get("dm_abertura") ?? "").trim().slice(0, 1000),
    botao_abertura: String(formData.get("botao_abertura") ?? "").trim().slice(0, 20) || "quero",
    exigir_seguir: formData.get("exigir_seguir") === "on",
    dm_nao_segue: String(formData.get("dm_nao_segue") ?? "").trim().slice(0, 1000) || null,
    botao_seguir: String(formData.get("botao_seguir") ?? "").trim().slice(0, 20) || "Já segui ✅",
    entrega_mensagens: entrega.mensagens,
    dm_entrega: null,
    link_entrega: String(formData.get("link_entrega") ?? "").trim() || null,
    tag:
      String(formData.get("tag") ?? "")
        .trim()
        .replace(/^#/, "")
        .toLowerCase()
        .replace(/\s+/g, "_")
        .slice(0, 40) || null,
    followups: lerFollowups(formData),
  };

  if (!dados.todas_as_midias && !dados.midias.length) return { erro: "Escolha pelo menos um post (ou marque “todos os posts”)." };
  if (!dados.dm_abertura) return { erro: "Escreva a 1ª DM." };
  if (dados.link_entrega && !https(dados.link_entrega)) return { erro: "O link do material precisa começar com https://" };
  if (!dados.entrega_mensagens.length && !dados.link_entrega) return { erro: "Coloque o link do material ou pelo menos uma mensagem na entrega." };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("ig_automacao").update(dados).eq("id", id);
    if (error) return { erro: error.message };
    revalidatePath("/instagram", "layout");
    redirect(`/instagram/${id}?salvo=1`);
  }
  const { data, error } = await supabase.from("ig_automacao").insert(dados).select("id").single();
  if (error || !data) return { erro: error?.message ?? "não salvou" };
  revalidatePath("/instagram", "layout");
  redirect(`/instagram/${data.id}?salvo=1`);
}

export async function alternarAutomacao(formData: FormData) {
  const supabase = await createClient();
  await supabase
    .from("ig_automacao")
    .update({ ativa: formData.get("ativa") === "sim" })
    .eq("id", String(formData.get("id")));
  revalidatePath("/instagram", "layout");
}

export async function apagarAutomacao(formData: FormData) {
  const supabase = await createClient();
  await supabase.from("ig_automacao").delete().eq("id", String(formData.get("id")));
  revalidatePath("/instagram", "layout");
  redirect("/instagram");
}

/** Lembrete público no comentário de quem não respondeu a 1ª DM. */
export async function salvarLembrete(_: Estado, formData: FormData): Promise<Estado> {
  const num = (k: string, min: number, max: number, padrao: number) => {
    const v = Number(String(formData.get(k) ?? "").replace(",", "."));
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : padrao;
  };
  const valor: LembreteComentario = {
    ativo: formData.get("ativo") === "on",
    horas: num("horas", 1, 47, 12),
    por_minuto: Math.round(num("por_minuto", 1, 10, 5)),
    textos: linhas(formData.get("textos"))
      .map((t) => t.slice(0, 300))
      .slice(0, 10),
  };
  if (valor.ativo && !valor.textos.length) return { erro: "escreva pelo menos um texto (ou desligue o lembrete)" };
  const supabase = await createClient();
  const { error } = await supabase.from("configuracao").upsert({ chave: "lembrete_comentario", valor }, { onConflict: "chave" });
  esquecerConfig("lembrete_comentario");
  if (error) return { erro: error.message };
  revalidatePath("/instagram");
  return { ok: "Salvo." };
}
