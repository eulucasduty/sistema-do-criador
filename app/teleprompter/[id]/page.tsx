import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { VersaoRoteiro } from "@/lib/roteiro/escrever";
import { Teleprompter } from "./teleprompter";

// O teleprompter na tela (celular ou tablet), fora do layout do painel: tela cheia, texto grande,
// rolagem sozinha. O login vale igual (proxy.ts) e a RLS só deixa a equipe ler o roteiro.

export const dynamic = "force-dynamic";

export const metadata = { title: "Teleprompter · criador" };

export default async function PaginaTeleprompter({ params, searchParams }: PageProps<"/teleprompter/[id]">) {
  const { id } = await params;
  const q = await searchParams;
  const supabase = await createClient();
  const { data: r } = await supabase.from("roteiro").select("id, titulo, versoes").eq("id", id).maybeSingle();
  const versoes = (r?.versoes ?? []) as VersaoRoteiro[];
  if (!r || !versoes.length) notFound();
  const n = Math.min(Math.max(0, Number(q.v ?? 0) || 0), versoes.length - 1);
  const v = versoes[n];
  return <Teleprompter id={r.id} versao={n} partes={[{ nome: "GANCHO", linhas: v.gancho }, { nome: "CORPO", linhas: v.corpo }, { nome: "CTA", linhas: v.cta }]} segundos={v.checagem?.segundos ?? 45} />;
}
