// A estação do editor abre esta parte automaticamente. Sozinha: npm run carrossel:estacao.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { usarClienteDaEstacao } from "@/lib/supabase/admin";
import { conectar } from "../editor/estacao/sessao.mjs";
import { prepararOficina, produzirCarrossel, enviarCarrossel } from "@/lib/carrossel/processar";
import { type PedidoCarrossel } from "@/lib/carrossel/comum";
import { encerrarAgentesCarrossel } from "@/carrosseis/agente.mjs";

const { db } = await conectar();
usarClienteDaEstacao(db);
const maquina = os.hostname();
const uma = process.argv.includes("--uma");
const raiz = path.resolve("carrosseis/oficina");
fs.mkdirSync(raiz, { recursive: true });
const trava = path.join(raiz, "estacao.pid");
try {
  const pid = Number(fs.readFileSync(trava, "utf8"));
  let viva = false;
  if (pid > 0) { try { process.kill(pid, 0); viva = true; } catch {} }
  if (viva) throw new Error(`Já existe uma estação de carrosséis neste PC (PID ${pid}).`);
  fs.unlinkSync(trava);
} catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
fs.writeFileSync(trava, String(process.pid), { flag: "wx" });
let atual: string | null = null;
const log = (s: string) => console.log(`[${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}] [carrossel] ${s}`);
async function batida(desligando = false) {
  const { error } = await db.from("configuracao").upsert({ chave: "estacao_carrosseis", valor: {
    visto_em: desligando ? null : new Date().toISOString(), maquina, ocupada: Boolean(atual), trabalho_id: atual,
  } }, { onConflict: "chave" });
  if (error) log(`Batida: ${error.message}`);
}
async function mudar(id: string, campos: Record<string, unknown>) {
  const { error } = await db.from("carrossel_trabalho").update(campos).eq("id", id);
  if (error) throw new Error(error.message);
}
async function proxima(): Promise<PedidoCarrossel | null> {
  const { data: fila, error } = await db.from("carrossel_trabalho").select("id").eq("status", "aguardando_estacao").order("criado_em").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (!fila) return null;
  const { data, error: pegoErro } = await db.from("carrossel_trabalho").update({
    status: "criando", estacao: maquina, processando_desde: new Date().toISOString(), erro: null, etapa: "baixando todos os slides de referência",
  }).eq("id", fila.id).eq("status", "aguardando_estacao").select("*").maybeSingle();
  if (pegoErro) throw new Error(pegoErro.message);
  return data as PedidoCarrossel | null;
}
let timer: ReturnType<typeof setInterval>;
async function sair() {
  clearInterval(timer);
  await batida(true).catch(() => {});
  try { if (fs.readFileSync(trava, "utf8") === String(process.pid)) fs.unlinkSync(trava); } catch {}
}
let parando = false;
async function parar() {
  if (parando) return;
  parando = true;
  await encerrarAgentesCarrossel();
  await sair();
  process.exit(0);
}
process.on("SIGINT", () => void parar());
process.on("SIGTERM", () => void parar());
process.on("message", m => { if (m === "parar") void parar(); });
if (process.send) process.on("disconnect", () => void parar());
async function principal() {
  const { error } = await db.from("carrossel_trabalho").update({ status: "aguardando_estacao", processando_desde: null, etapa: "a estação reiniciou: de volta na fila" })
    .in("status", ["criando", "renderizando", "enviando"]).eq("estacao", maquina);
  if (error) throw new Error(`Aplique a migration 031 antes de abrir a estação: ${error.message}`);
  log("Ligada: cópias em PT-BR com todos os slides, foto e @, pelo Codex ou Claude Code escolhido no painel.");
  await batida();
  timer = setInterval(() => void batida().catch(e => log(e.message)), 30_000);
  let pausaAte = 0;
  for (;;) {
    let trabalho;
    try { trabalho = Date.now() >= pausaAte ? await proxima() : null; }
    catch (e) { log(`Fila: ${(e as Error).message}`); }
    if (!trabalho) {
      if (uma) break;
      await new Promise(ok => setTimeout(ok, 5000));
      continue;
    }
    atual = trabalho.id;
    await batida();
    try {
      log(`▶ ${trabalho.id}: ${trabalho.referencias.length} slides via ${trabalho.agente}`);
      const pasta = await prepararOficina(db, trabalho);
      const produzido = await produzirCarrossel(pasta, trabalho, async s => { log(s); await mudar(trabalho.id, { etapa: s.slice(0, 300) }); });
      await mudar(trabalho.id, { status: "enviando", etapa: "enviando os PNGs completos para o painel" });
      const resultado = await enviarCarrossel(db, pasta, trabalho, produzido);
      await mudar(trabalho.id, { status: "pronto", resultado, etapa: null, erro: null, processando_desde: null });
      log(`✓ ${resultado.arquivos.length} slides prontos em PT-BR.`);
    } catch (e) {
      const erro = e as Error & { limite?: boolean };
      log(`✗ ${erro.message}`);
      if (erro.limite) {
        pausaAte = Date.now() + 20 * 60_000;
        await mudar(trabalho.id, { status: "aguardando_estacao", processando_desde: null, etapa: "limite do plano: a estação tenta novamente em 20 minutos" });
      } else await mudar(trabalho.id, { status: "erro", etapa: null, erro: erro.message.slice(0, 1500), processando_desde: null });
    } finally { atual = null; await batida(); }
    if (uma) break;
  }
}
principal().finally(sair).catch(e => { console.error(e); process.exitCode = 1; });
