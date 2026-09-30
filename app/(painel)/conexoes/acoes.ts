"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { exigirEquipe } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { urlDoApp } from "@/lib/app";

// Conexões: Instagram, Facebook, relógio e o teste da chave da IA. As ações que usam a
// chave secreta conferem login E equipe (Server Action é endpoint público).

const voltar = (destino: string, ancora: string, q: Record<string, string>) =>
  redirect(`${destino}?${new URLSearchParams(q).toString()}#${ancora}`);

const destinoDe = (formData: FormData) => (formData.get("voltar") === "/" ? "/" : "/conexoes");

/** Cola o token do Instagram (gerado no app da Meta): valida, guarda, liga os webhooks e traz o seu perfil. */
export async function conectarInstagram(formData: FormData) {
  await exigirEquipe();
  const token = String(formData.get("token") ?? "").trim();
  const destino = destinoDe(formData);
  let q: Record<string, string> = { ig: "ok" };
  try {
    if (token.length < 20) throw new Error("token vazio ou curto demais");
    const { conectarToken } = await import("@/lib/instagram/api");
    const c = await conectarToken(token);
    if (c.erro) q = { ig: "parcial", msg: c.erro };
  } catch (e) {
    q = { ig: "erro", msg: (e as Error).message.slice(0, 200) };
  }
  revalidatePath("/", "layout");
  voltar(destino, "instagram", q);
}

export async function reinscreverInstagram(formData: FormData) {
  await exigirEquipe();
  let q: Record<string, string> = { ig: "ok" };
  try {
    const { inscreverWebhooks } = await import("@/lib/instagram/api");
    await inscreverWebhooks();
  } catch (e) {
    q = { ig: "erro", msg: (e as Error).message.slice(0, 200) };
  }
  voltar(destinoDe(formData), "instagram", q);
}

/**
 * Login do Facebook (token de usuário, de preferência o estendido): guarda o token da página
 * ligada ao seu Instagram e, em seguida, busca de novo as referências que ficaram esperando.
 */
export async function conectarFacebookAcao(formData: FormData) {
  await exigirEquipe();
  const token = String(formData.get("token") ?? "").trim();
  let q: Record<string, string> = { fb: "ok" };
  try {
    if (token.length < 20) throw new Error("token vazio ou curto demais");
    const { conectarFacebook } = await import("@/lib/instagram/descoberta");
    await conectarFacebook(token);
    after(async () => {
      const { buscarDeNovo } = await import("@/lib/esteira/referencia");
      const { data } = await createAdminClient()
        .from("referencia")
        .select("id")
        .eq("aguardando_video", true)
        .not("url", "is", null)
        .gte("criado_em", new Date(Date.now() - 7 * 86400e3).toISOString());
      for (const r of data ?? []) await buscarDeNovo(r.id).catch(() => {});
    });
  } catch (e) {
    q = { fb: "erro", msg: (e as Error).message.slice(0, 200) };
  }
  revalidatePath("/", "layout");
  voltar(destinoDe(formData), "facebook", q);
}

/** "Ligar o relógio": agenda no Supabase (pg_cron) a chamada de /api/relogio a cada minuto. */
export async function ligarRelogio(formData: FormData) {
  await exigirEquipe();
  let q: Record<string, string> = { relogio: "ok" };
  try {
    const segredo = process.env.CRON_SECRET;
    if (!segredo) throw new Error("falta a variável CRON_SECRET (veja o passo a passo)");
    const url = urlDoApp();
    if (!url.startsWith("https://")) throw new Error(`o endereço do sistema precisa ser https (hoje é ${url}); preencha APP_URL`);
    const { error } = await createAdminClient().rpc("ligar_relogio", { p_url: url, p_segredo: segredo });
    if (error) throw new Error(error.message);
    // Primeira batida agora, sem esperar o minuto virar
    await fetch(`${url}/api/relogio`, { headers: { Authorization: `Bearer ${segredo}` }, signal: AbortSignal.timeout(15_000) }).catch(() => {});
  } catch (e) {
    q = { relogio: "erro", msg: (e as Error).message.slice(0, 200) };
  }
  revalidatePath("/", "layout");
  voltar(destinoDe(formData), "relogio", q);
}

export async function desligarRelogio(formData: FormData) {
  await exigirEquipe();
  await createAdminClient().rpc("desligar_relogio");
  revalidatePath("/", "layout");
  voltar(destinoDe(formData), "relogio", { relogio: "desligado" });
}

/** Confere a chave da OpenRouter (e quanto crédito ainda tem). */
export async function testarIA(formData: FormData) {
  await exigirEquipe();
  let q: Record<string, string>;
  try {
    const chave = process.env.OPENROUTER_API_KEY;
    if (!chave) throw new Error("falta a variável OPENROUTER_API_KEY");
    const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(15_000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`a OpenRouter recusou a chave (${r.status})`);
    const limite = j?.data?.limit_remaining;
    q = { ia: "ok", msg: typeof limite === "number" ? `sobram US$ ${limite.toFixed(2)} de limite nessa chave` : "chave válida" };
  } catch (e) {
    q = { ia: "erro", msg: (e as Error).message.slice(0, 200) };
  }
  voltar(destinoDe(formData), "ia", q);
}
