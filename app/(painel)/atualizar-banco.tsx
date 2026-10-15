import { linkDoSqlEditor, sqlDaMigracao, type Migracao } from "@/lib/passos";
import { REPO_URL } from "@/lib/app";
import { Copiar } from "./copiar";

/** O SQL de atualização que falta rodar (versão nova do sistema): copiar e colar no Supabase. */
export function AtualizarBanco({ faltando }: { faltando: Migracao[] }) {
  if (!faltando.length) return null;
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-suave">
      <li>
        <span className="block">Copie o SQL de atualização:</span>
        <span className="mt-1 flex flex-wrap gap-2">
          {faltando.map((m) => {
            const sql = sqlDaMigracao(m.arquivo);
            return sql ? (
              <Copiar key={m.arquivo} texto={sql} rotulo={`Copiar o SQL (${m.pra_que})`} className="btn btn-sm" />
            ) : (
              <a key={m.arquivo} href={`${REPO_URL}/blob/main/supabase/migrations/${m.arquivo}`} target="_blank" rel="noreferrer" className="text-marca underline">
                abrir o {m.arquivo}
              </a>
            );
          })}
        </span>
      </li>
      <li>
        <a href={linkDoSqlEditor()} target="_blank" rel="noreferrer" className="text-marca underline">
          Abra o SQL Editor do seu Supabase
        </a>
        , cole tudo (Ctrl+V) e clique em <b className="text-texto">Run</b>. Tem que aparecer “Success”. Pode rodar de novo sem medo.
      </li>
      <li>Volte aqui e recarregue a página (F5).</li>
    </ol>
  );
}
