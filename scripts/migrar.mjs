// Aplica supabase/migrations/*.sql em ordem, uma vez cada, uma transação por arquivo.
// Uso: npm run migrar   (precisa de DATABASE_URL no .env.local: a conexão direta do Postgres do Supabase)
// Guarda o que já foi aplicado em criador._migracao: rodar de novo só aplica os arquivos novos.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida no .env.local (Supabase → Connect → a conexão do Postgres)");
  process.exit(1);
}

const pasta = path.join(process.cwd(), "supabase", "migrations");
if (!fs.existsSync(pasta)) {
  console.error(`não achei ${pasta} (rode o comando na pasta do projeto)`);
  process.exit(1);
}
const arquivos = fs.readdirSync(pasta).filter((f) => f.endsWith(".sql")).sort();

const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();

await db.query(`
  create schema if not exists criador;
  create table if not exists criador._migracao (
    id          uuid primary key default gen_random_uuid(),
    arquivo     text not null unique,
    aplicada_em timestamptz not null default now()
  );
  alter table criador._migracao enable row level security;
`);

const { rows } = await db.query("select arquivo from criador._migracao");
const aplicadas = new Set(rows.map((r) => r.arquivo));

let novas = 0;
for (const arquivo of arquivos) {
  if (aplicadas.has(arquivo)) continue;
  const sql = fs.readFileSync(path.join(pasta, arquivo), "utf8");
  try {
    await db.query("begin");
    await db.query(sql);
    await db.query("insert into criador._migracao (arquivo) values ($1)", [arquivo]);
    await db.query("commit");
    console.log(`✓ ${arquivo}`);
    novas++;
  } catch (erro) {
    await db.query("rollback");
    console.error(`✗ ${arquivo}: ${erro.message}`);
    await db.end();
    process.exit(1);
  }
}

console.log(novas ? `${novas} migration(s) aplicada(s).` : "Banco já estava em dia.");
await db.end();
