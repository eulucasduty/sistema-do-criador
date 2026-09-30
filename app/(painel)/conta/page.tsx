import { usuarioLogado } from "@/lib/supabase/server";
import { FormSenha } from "./form-senha";

export default async function PaginaConta() {
  const claims = await usuarioLogado();
  return (
    <div className="max-w-2xl">
      <h1 className="titulo">Minha conta</h1>
      <p className="mt-1 text-sm text-suave">Logado como {String(claims?.email ?? "—")}.</p>
      <section className="card mt-6 p-4">
        <h2 className="mb-3 text-sm font-medium">Trocar a senha</h2>
        <FormSenha />
      </section>
    </div>
  );
}
