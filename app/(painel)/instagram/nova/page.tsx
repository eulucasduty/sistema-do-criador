import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FormularioAutomacao } from "../formulario";
import { midiasParaEscolher } from "../midias";

export const dynamic = "force-dynamic";

export default async function PaginaNovaAutomacao() {
  const supabase = await createClient();
  const [{ midias, erro }, { data: agente }] = await Promise.all([
    midiasParaEscolher(),
    supabase.from("agente").select("ativo").order("criado_em").limit(1).maybeSingle(),
  ]);

  return (
    <div className="max-w-4xl">
      <Link href="/instagram" className="text-xs text-suave hover:text-texto">
        ← Automações
      </Link>
      <h1 className="mt-3 titulo">Nova automação</h1>
      <p className="mt-1 text-sm text-suave">Ela nasce desligada: confira as mensagens, salve e ligue quando quiser que comece.</p>
      <section className="card mt-6 p-4">
        <FormularioAutomacao midias={midias} erroMidias={erro} agenteLigado={Boolean(agente?.ativo)} />
      </section>
    </div>
  );
}
