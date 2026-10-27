import Link from "next/link";
import { FormularioAutomacao } from "../formulario";
import { midiasParaEscolher } from "../midias";

export const dynamic = "force-dynamic";

export default async function PaginaNovaAutomacao() {
  const { midias, erro } = await midiasParaEscolher();

  return (
    <div className="max-w-4xl">
      <Link href="/instagram" className="text-xs text-suave hover:text-texto">
        ← Automações
      </Link>
      <h1 className="mt-3 titulo">Nova automação</h1>
      <p className="mt-1 text-sm text-suave">Ela nasce desligada: confira as mensagens, salve e ligue quando quiser que comece.</p>
      <section className="card mt-6 p-4">
        <FormularioAutomacao midias={midias} erroMidias={erro} />
      </section>
    </div>
  );
}
