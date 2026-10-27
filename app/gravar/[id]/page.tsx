import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { VersaoRoteiro } from "@/lib/roteiro/escrever";
import { Gravador } from "./gravador";

// O gravador da esteira de reels (pedido do Duty, 19/10): câmera do celular com o teleprompter na
// tela, gravando em takes (gancho, corpo, CTA…), como o do CapCut. Fora do layout do painel (tela
// cheia). O login vale igual (proxy.ts) e a RLS só deixa a equipe ler o roteiro.

export const dynamic = "force-dynamic";

export const metadata = { title: "Gravar · criador" };

export default async function PaginaGravar({ params, searchParams }: PageProps<"/gravar/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const [{ data: r }, { data: musicas }] = await Promise.all([
    supabase.from("roteiro").select("id, titulo, versoes").eq("id", id).maybeSingle(),
    supabase.from("musica").select("id, nome, arquivo, duracao_s").order("criado_em", { ascending: false }).limit(100),
  ]);
  const versoes = (r?.versoes ?? []) as VersaoRoteiro[];
  const n = Math.min(Math.max(0, Number(q.v ?? 0) || 0), Math.max(0, versoes.length - 1));
  const v = versoes[n];
  if (!r || !v) notFound();
  // Link assinado (6 h) pra ouvir a música no navegador enquanto escolhe
  const assinados = new Map<string, string>();
  if (musicas?.length) {
    const { data } = await createAdminClient()
      .storage.from("edicao")
      .createSignedUrls(
        musicas.map((m) => m.arquivo),
        6 * 3600,
      );
    for (const s of data ?? []) if (s.path && s.signedUrl) assinados.set(s.path, s.signedUrl);
  }
  return (
    <Gravador
      roteiroId={r.id}
      versao={n}
      titulo={r.titulo ?? v.titulo ?? "reel"}
      palavra={v.palavra_cta ?? null}
      partes={[
        { nome: "GANCHO", linhas: v.gancho },
        { nome: "CORPO", linhas: v.corpo },
        { nome: "CTA", linhas: v.cta },
      ]}
      segundos={v.checagem?.segundos ?? 45}
      musicas={(musicas ?? []).map((m) => ({ id: m.id, nome: m.nome, url: assinados.get(m.arquivo) ?? null }))}
    />
  );
}
