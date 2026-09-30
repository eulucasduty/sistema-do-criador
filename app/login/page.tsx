import { readFileSync } from "node:fs";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { conferirBanco, linkDoSqlEditor, type ProblemaBanco } from "@/lib/passos";
import { REPO_URL } from "@/lib/app";
import { Copiar } from "../(painel)/copiar";
import { Marca } from "../marca";
import { BotaoTema } from "../tema";
import { FormLogin } from "./form-login";

// Login. Se o banco ainda estiver vazio, vira o passo da instalação (copiar o SQL e rodar no
// Supabase). No primeiro acesso (ninguém na equipe) vira "criar a sua conta": quem cria
// primeiro é o dono.

export const dynamic = "force-dynamic";

async function situacao(): Promise<{ dono: boolean; problema: ProblemaBanco | null }> {
  const problema = await conferirBanco();
  if (problema) return { dono: false, problema };
  const { count } = await createAdminClient().from("equipe").select("id", { count: "exact", head: true });
  return { dono: (count ?? 0) > 0, problema: null };
}

function sqlDaInstalacao(): string {
  try {
    return readFileSync(path.join(process.cwd(), "supabase", "migrations", "001_sistema.sql"), "utf8");
  } catch {
    return "";
  }
}

function PassoDoBanco() {
  const sql = sqlDaInstalacao();
  return (
    <div className="card space-y-4 p-5 text-sm">
      <div>
        <p className="font-bold">Último passo da instalação: criar as tabelas</p>
        <p className="mt-1 text-suave">Leva 1 minuto. Você copia um texto e cola no Supabase.</p>
      </div>
      <ol className="list-decimal space-y-3 pl-5 text-suave">
        <li>
          <span className="block">Copie o SQL:</span>
          {sql ? (
            <span className="mt-1 block">
              <Copiar texto={sql} rotulo="Copiar o SQL" className="btn btn-sm" />
            </span>
          ) : (
            <a href={`${REPO_URL}/blob/main/supabase/migrations/001_sistema.sql`} target="_blank" rel="noreferrer" className="text-marca underline">
              abrir o arquivo do SQL
            </a>
          )}
        </li>
        <li>
          <a href={linkDoSqlEditor()} target="_blank" rel="noreferrer" className="text-marca underline">
            Abra o SQL Editor do seu Supabase
          </a>
          , cole tudo (Ctrl+V) e clique em <b className="text-texto">Run</b>. Tem que aparecer “Success”.
        </li>
        <li>Volte aqui e recarregue a página (F5).</li>
      </ol>
    </div>
  );
}

export default async function PaginaLogin() {
  const { dono, problema } = await situacao();
  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <BotaoTema className="absolute right-4 top-4 text-xs text-apagado hover:text-texto" />
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Marca tamanho="lg" />
          <p className="mt-4 text-sm text-suave">Referências, roteiro na sua voz, editor de vídeo e automações do Instagram.</p>
        </div>
        {problema?.tipo === "sql" ? (
          <PassoDoBanco />
        ) : problema ? (
          <div className="card space-y-2 p-5 text-sm">
            <p className="font-bold">Falta um passo da instalação</p>
            <p className="text-suave">{problema.mensagem}.</p>
            <p className="text-suave">
              Confira no{" "}
              <a href={`${REPO_URL}#readme`} target="_blank" rel="noreferrer" className="text-marca underline">
                passo a passo da instalação
              </a>
              . Depois de mudar variável na Vercel, clique em Redeploy.
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
