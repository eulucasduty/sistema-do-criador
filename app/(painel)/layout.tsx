import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, usuarioLogado } from "@/lib/supabase/server";
import { conferirBanco } from "@/lib/passos";
import { Marca } from "../marca";
import { BotaoTema } from "../tema";
import { sair } from "./acoes";
import { Menu } from "./menu";

export default async function LayoutPainel({ children }: LayoutProps<"/">) {
  const claims = await usuarioLogado();
  if (!claims) redirect("/login");

  const supabase = await createClient();
  const { data: membro, error } = await supabase.from("equipe").select("nome, papel").eq("usuario_id", claims.sub).maybeSingle();

  if (error || !membro) {
    const problema = error ? (await conferirBanco())?.mensagem ?? null : null;
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div className="max-w-md">
          <h1 className="titulo text-2xl">{problema ? "Falta um passo no banco" : "Sem acesso"}</h1>
          <p className="mt-2 text-sm text-suave">
            {problema ?? "Esse login não é o dono do sistema. Só a primeira conta criada entra (e quem ela adicionar na tabela equipe)."}
          </p>
          <form action={sair} className="mt-5">
            <button className="btn btn-sm btn-2">Sair</button>
          </form>
        </div>
      </main>
    );
  }

  const { count: alertas } = await supabase.from("alerta").select("id", { count: "exact", head: true }).eq("resolvido", false);

  return (
    <div className="md:flex">
      <aside className="border-b-2 border-tinta bg-superficie p-3 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:flex-col md:border-b-0 md:border-r-2 md:p-4">
        <div className="mb-3 flex items-start justify-between gap-3 md:mb-6 md:block">
          <Link href="/" className="block">
            <Marca />
          </Link>
          <div className="flex flex-col items-end gap-2 pt-1 md:hidden">
            <Link href="/conta" className="rotulo">Conta</Link>
            <BotaoTema className="rotulo" />
          </div>
        </div>

        <Menu alertas={alertas ?? 0} />

        <div className="mt-auto hidden border-t-2 border-tinta pt-4 md:block">
          <p className="truncate text-xs text-suave">{String(claims.email ?? membro.nome)}</p>
          <div className="mt-1 flex items-center gap-3 text-xs leading-5">
            <Link href="/conta" className="text-apagado hover:text-texto">Minha conta</Link>
            <form action={sair} className="flex">
              <button className="text-apagado hover:text-texto">Sair</button>
            </form>
          </div>
          <BotaoTema className="mt-3 text-xs text-apagado hover:text-texto" />
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
