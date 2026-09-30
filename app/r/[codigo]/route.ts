import { createAdminClient } from "@/lib/supabase/admin";
import { lerConfig, lerPerfil, type Oferta } from "@/lib/config";

// Link com o código do contato (vai na DM do Instagram): conta o clique e leva pro
// destino. Assim você sabe quem clicou em quê, e o agente sabe se a pessoa já abriu.
//
// ?ir=…
//   oferta-<n>  → a oferta n (Agente → Ofertas); marca o contato com a tag clicou_oferta
//   <número>    → o botão daquela mensagem da sequência da automação (?a=<automação>)
//   (nada)      → o link do material da automação (?a=<automação>), ou o seu perfil

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const cod = codigo.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const q = new URL(req.url).searchParams;
  const automacao = q.get("a");
  const ir = q.get("ir");
  const db = createAdminClient();
  const { data: contato } = await db.from("contato").select("id, tags").eq("codigo", cod).maybeSingle();
  const auto = automacao && /^[0-9a-f-]{36}$/i.test(automacao) ? automacao : null;
  const perfil = await lerPerfil();
  let destino = perfil.usuario ? `https://instagram.com/${perfil.usuario}` : "https://instagram.com";

  const oferta = ir?.match(/^oferta-(\d{1,2})$/);
  if (oferta) {
    const ofertas = await lerConfig<Oferta[]>("ofertas", []);
    const url = ofertas[Number(oferta[1]) - 1]?.link?.trim();
    if (url && /^https:\/\//i.test(url)) destino = url;
    if (contato && !(contato.tags ?? []).includes("clicou_oferta")) {
      await db.from("contato").update({ tags: [...(contato.tags ?? []), "clicou_oferta"] }).eq("id", contato.id);
    }
  } else if (auto) {
    const { data: a } = await db.from("ig_automacao").select("link_entrega, entrega_mensagens").eq("id", auto).maybeSingle();
    const url =
      ir !== null && /^\d{1,2}$/.test(ir)
        ? (a?.entrega_mensagens as Array<{ botao_url?: string }> | undefined)?.[Number(ir)]?.botao_url
        : (a?.link_entrega as string | null | undefined);
    if (url && /^https:\/\//i.test(url)) destino = url;
  }
  if (contato) await db.from("clique").insert({ contato_id: contato.id, automacao_id: auto, destino });
  return Response.redirect(destino, 302);
}
