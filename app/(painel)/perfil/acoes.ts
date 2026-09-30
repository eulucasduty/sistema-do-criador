"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirEquipe } from "@/lib/supabase/server";
import { lerPerfil, salvarConfig, type Perfil } from "@/lib/config";

const texto = (v: FormDataEntryValue | null, max = 300) => String(v ?? "").trim().slice(0, max) || null;
const hex = (v: FormDataEntryValue | null, padrao: string) => (/^#[0-9a-f]{6}$/i.test(String(v ?? "")) ? String(v).toLowerCase() : padrao);

export async function salvarPerfil(formData: FormData) {
  await exigirEquipe();
  const antes = await lerPerfil();
  const cor = String(formData.get("cor"));
  const perfil: Perfil = {
    ...antes,
    nome: texto(formData.get("nome"), 60),
    usuario: texto(formData.get("usuario"), 60)?.replace(/^@/, "") ?? null,
    nicho: texto(formData.get("nicho"), 200),
    publico: texto(formData.get("publico"), 400),
    tom: texto(formData.get("tom"), 1500),
    cor: cor === "quente" || cor === "contraste" ? cor : "natural",
    legenda: formData.get("legenda") === "limpa" ? "limpa" : "bangers",
    cores: {
      fundo: hex(formData.get("cor_fundo"), antes.cores.fundo),
      texto: hex(formData.get("cor_texto"), antes.cores.texto),
      destaque: hex(formData.get("cor_destaque"), antes.cores.destaque),
    },
  };
  await salvarConfig("perfil", perfil);
  revalidatePath("/", "layout");
  redirect("/perfil?salvo=1");
}

/** Traz de novo o @, o nome e a foto do Instagram. */
export async function atualizarDoInstagram() {
  await exigirEquipe();
  let destino = "/perfil?ig=ok";
  try {
    const { sincronizarPerfil } = await import("@/lib/instagram/api");
    await sincronizarPerfil();
  } catch (e) {
    destino = `/perfil?erro=${encodeURIComponent((e as Error).message.slice(0, 160))}`;
  }
  revalidatePath("/", "layout");
  redirect(destino);
}
