import { createAdminClient } from "@/lib/supabase/admin";
import { conferirBanco } from "@/lib/passos";
import { REPO_URL } from "@/lib/app";
import { Marca } from "../marca";
import { BotaoTema } from "../tema";
import { FormLogin } from "./form-login";

// Login. No primeiro acesso (ninguém na equipe ainda) vira "criar a sua conta": quem cria
// primeiro é o dono. Se o banco não estiver pronto, diz o que falta.

export const dynamic = "force-dynamic";

async function temDono(): Promise<{ dono: boolean; problema: string | null }> {
  const problema = await conferirBanco();
  if (problema) return { dono: false, problema };
  const { count } = await createAdminClient().from("equipe").select("id", { count: "exact", head: true });
  return { dono: (count ?? 0) > 0, problema: null };
}

export default async function PaginaLogin() {
  const { dono, problema } = await temDono();
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <BotaoTema className="absolute right-4 top-4 text-xs text-apagado hover:text-texto" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Marca tamanho="lg" />
          <p className="mt-4 text-sm text-suave">Referências, roteiro na sua voz, editor de vídeo e automações do Instagram.</p>
        </div>
        {problema ? (
          <div className="card space-y-2 p-5 text-sm">
            <p className="font-bold">Falta um passo da instalação</p>
            <p className="text-suave">{problema}.</p>
            <p className="text-suave">
              O passo a passo completo está no{" "}
              <a href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer" className="text-marca underline">
                README do repositório
              </a>
              .
            </p>
          </div>
        ) : (
          <div className="card p-5">
            {!dono && (
              <p className="mb-4 rounded-lg bg-marca-fundo px-3 py-2 text-sm text-suave">
                Primeiro acesso: crie a sua conta. Quem cria primeiro vira o dono do sistema.
              </p>
            )}
            <FormLogin criar={!dono} />
          </div>
        )}
      </div>
    </main>
  );
}
