import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuanto } from "@/lib/formato";
import { DURACAO_PADRAO, DURACOES } from "@/lib/roteiro/comum";
import { MONITOR_PADRAO, REDES, inicioDoDia, linkDoCriador, type ConfigMonitor } from "@/lib/monitor/comum";
import { adicionarCriadores, alternarCriador, apagarCriador, conferirAgora, editarCriador, salvarMonitor } from "./acoes";

export const dynamic = "force-dynamic";

const numero = (n: number | null) => (n == null ? null : n >= 1_000_000 ? `${(n / 1e6).toFixed(1)} mi` : n >= 1000 ? `${Math.round(n / 1000)} mil` : String(n));

function Duracao({ valor }: { valor: number }) {
  return (
    <select name="duracao" defaultValue={valor} className="campo">
      {DURACOES.map((d) => (
        <option key={d.valor} value={d.valor}>
          {d.nome}
        </option>
      ))}
    </select>
  );
}

export default async function PaginaCriadores({ searchParams }: PageProps<"/roteiros/criadores">) {
  const q = await searchParams;
  const supabase = await createClient();
  const hoje = inicioDoDia().toISOString();
  const [{ data: criadores }, { data: cfg }, { count: feitosHoje }, { count: naFila }, { count: naEstacao }, { data: hojePorCriador }, { count: carrosseisHoje }] = await Promise.all([
    supabase.from("criador").select("*").order("criado_em", { ascending: false }),
    supabase.from("configuracao").select("valor").eq("chave", "monitor").maybeSingle(),
    supabase.from("roteiro").select("id", { count: "exact", head: true }).eq("automatico", true).gte("criado_em", hoje),
    supabase.from("roteiro").select("id", { count: "exact", head: true }).eq("automatico", true).in("status", ["na_fila", "transcrevendo"]),
    supabase.from("roteiro").select("id", { count: "exact", head: true }).eq("automatico", true).eq("status", "aguardando_estacao"),
    supabase.from("roteiro").select("criador_id").eq("automatico", true).gte("criado_em", hoje),
    supabase.from("referencia").select("id", { count: "exact", head: true }).eq("origem", "monitor").gte("criado_em", hoje),
  ]);
  const m: ConfigMonitor = { ...MONITOR_PADRAO, ...((cfg?.valor as Partial<ConfigMonitor> | null) ?? {}) };
  const lista = criadores ?? [];
  const ativos = lista.filter((c) => c.ativo).length;
  const comErro = lista.filter((c) => c.ativo && c.erro).length;
  const hojeDe = new Map<string, number>();
  for (const r of hojePorCriador ?? []) if (r.criador_id) hojeDe.set(r.criador_id, (hojeDe.get(r.criador_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/roteiros" className="text-xs text-suave hover:text-texto">
        ← Roteiros
      </Link>
      <header>
        <h1 className="titulo">Criadores monitorados</h1>
        <p className="mt-1 text-sm text-suave">
          Os perfis de referência do Instagram e do YouTube. Cada post novo em vídeo vira um roteiro sozinho, no padrão viral e na tua voz, sem as falas do outro
          criador, e cai na Esteira → Reels pra gravar. O carrossel novo deles vai pra Esteira → Carrosséis.
        </p>
      </header>
      {q.salvo && <p className="rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">{String(q.salvo)}</p>}
      {q.erro && <p className="whitespace-pre-line rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{String(q.erro)}</p>}

      <section className={`card space-y-3 p-4 ${m.ligado ? "" : "border-morno/60"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="rotulo">Monitor · {m.ligado ? "ligado" : "desligado"}</span>
            <span className="mt-1 block text-xs text-suave">
              {m.ligado
                ? `${m.hora != null ? `Confere cada criador uma vez por dia, a partir das ${m.hora}h` : `Confere cada criador a cada ${m.intervalo_min} min`}. ${m.atraso_dias > 0 ? ` Pega os mais virais de ${m.atraso_dias} dias atrás.` : ""} ${m.roteiro === "transcricao" ? "O roteiro é a fala do criador." : "A estação escreve o roteiro."} Hoje: ${feitosHoje ?? 0} de ${m.limite_dia} roteiros${m.carrosseis ? ` · ${carrosseisHoje ?? 0} de ${m.limite_carrosseis_dia} carrosséis` : ""} · ${naFila ?? 0} ouvindo a referência${naEstacao ? ` · ${naEstacao} esperando a estação` : ""}.`
                : "Desligado, ninguém é conferido. Os roteiros que já estão na fila continuam."}
            </span>
          </p>
          <form action={salvarMonitor}>
            <input type="hidden" name="ligado" value={m.ligado ? "0" : "1"} />
            <button className={`btn btn-sm ${m.ligado ? "btn-2" : ""}`}>{m.ligado ? "Desligar" : "Ligar"}</button>
          </form>
        </div>
        <form action={salvarMonitor} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="opcoes" value="1" />
          <label className="block">
            <span className="rotulo">Buscar todo dia às (h)</span>
            <input name="hora" type="number" min={0} max={23} defaultValue={m.hora ?? ""} placeholder="—" className="campo mt-1 w-24" />
          </label>
          <label className="block">
            <span className="rotulo">Sem hora: a cada (min)</span>
            <input name="intervalo_min" type="number" min={10} max={1440} defaultValue={m.intervalo_min} className="campo mt-1 w-28" />
          </label>
          <label className="block">
            <span className="rotulo">Roteiros por dia (total)</span>
            <input name="limite_dia" type="number" min={1} max={500} defaultValue={m.limite_dia} className="campo mt-1 w-28" />
          </label>
          <label className="block">
            <span className="rotulo">Posts de quantos dias atrás</span>
            <input name="atraso_dias" type="number" min={0} max={7} defaultValue={m.atraso_dias} className="campo mt-1 w-24" />
          </label>
          <label className="block">
            <span className="rotulo">Roteiro</span>
            <select name="roteiro" defaultValue={m.roteiro} className="campo mt-1">
              <option value="transcricao">a fala do criador (transcrição)</option>
              <option value="escrever">a estação escreve um novo</option>
            </select>
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="carrosseis" defaultChecked={m.carrosseis} /> trazer os carrosséis
          </label>
          <label className="block">
            <span className="rotulo">Carrosséis por dia</span>
            <input name="limite_carrosseis_dia" type="number" min={1} max={100} defaultValue={m.limite_carrosseis_dia} className="campo mt-1 w-24" />
          </label>
          <button className="btn btn-sm btn-2">Salvar</button>
        </form>
        <p className="text-xs text-apagado">
          Com a hora, a busca começa nela e passa pelos criadores em uns minutos. Com os dias atrás (2), só entra post que já teve tempo de performar: os
          daquele dia, do mais viral pro menos (views no YouTube; curtidas e comentários no Instagram), até o limite. Roteiro pela transcrição: fica pronto
          assim que o vídeo é ouvido, sem a estação (na página do roteiro, &ldquo;outra versão&rdquo; ainda pede um escrito). Hora vazia: confere a cada X min. O pedido feito à mão sempre passa na frente. Carrossel só vem do Instagram.
        </p>
      </section>

      <form action={adicionarCriadores} className="card space-y-3 p-4">
        <h2 className="rotulo">Adicionar criadores</h2>
        <textarea
          name="lista"
          rows={5}
          placeholder={"Um por linha: @ do Instagram, link do perfil ou link do canal do YouTube\n@fulano\nhttps://www.instagram.com/ciclano/\nhttps://www.youtube.com/@beltrano"}
          className="campo text-sm"
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="rotulo">@ sem link é do</span>
            <select name="rede" defaultValue="instagram" className="campo mt-1">
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
            </select>
          </label>
          <label className="block">
            <span className="rotulo">Por dia, cada um</span>
            <input name="por_dia" type="number" min={1} max={20} defaultValue={3} className="campo mt-1 w-24" />
          </label>
          <label className="block">
            <span className="rotulo">Duração</span>
            <div className="mt-1">
              <Duracao valor={DURACAO_PADRAO} />
            </div>
          </label>
        </div>
        <label className="block">
          <span className="rotulo">Orientação pro roteirista (opcional)</span>
          <input name="direcao" placeholder="ex.: puxa pra IA aplicada em negócio" className="campo mt-1" />
        </label>
        <p className="text-xs text-apagado">
          Cada um é conferido antes de entrar. Instagram: só conta de criador ou empresa, com o Facebook conectado (Conexões). YouTube: só os Shorts, por
          padrão. Na primeira vez, entra o que ele postou nas últimas 48 h.
        </p>
        <button className="btn">Adicionar</button>
      </form>

      <section className="space-y-2">
        <h2 className="rotulo">
          {lista.length} criador(es) · {ativos} ativo(s){comErro ? ` · ${comErro} com erro` : ""}
        </h2>
        {lista.length === 0 ? (
          <p className="text-sm text-apagado">Nenhum criador ainda. Cola a lista de referências aqui em cima.</p>
        ) : (
          <ul className="space-y-2">
            {lista.map((c) => (
              <li key={c.id} className={`card p-3 ${c.erro && c.ativo ? "border-quente/60" : ""} ${c.ativo ? "" : "opacity-60"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {c.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.foto} alt="" className="h-10 w-10 shrink-0 rounded-full border-2 border-linha object-cover" />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-linha font-mono text-xs text-apagado">
                        {c.rede === "youtube" ? "YT" : "IG"}
                      </span>
                    )}
                    <div className="min-w-0">
                      <a href={linkDoCriador(c)} target="_blank" rel="noreferrer" className="block truncate font-bold hover:underline">
                        @{c.usuario}
                        {c.nome ? <span className="font-normal text-suave"> · {c.nome}</span> : null}
                      </a>
                      <p className="mt-0.5 truncate text-xs text-apagado">
                        {REDES[c.rede]}
                        {numero(c.seguidores) ? ` · ${numero(c.seguidores)} seguidores` : ""} · {c.total_roteiros} roteiro(s){c.total_carrosseis ? ` · ${c.total_carrosseis} carrossel(éis)` : ""} · hoje {hojeDe.get(c.id) ?? 0}/{c.por_dia}
                        {c.checado_em ? ` · conferido ${haQuanto(c.checado_em)}` : " · ainda não conferido"}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <form action={conferirAgora}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn btn-sm btn-2" disabled={!c.ativo}>
                        Conferir
                      </button>
                    </form>
                    <form action={alternarCriador}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="ativo" value={c.ativo ? "0" : "1"} />
                      <button className="btn btn-sm btn-2">{c.ativo ? "Pausar" : "Ativar"}</button>
                    </form>
                  </div>
                </div>
                {c.erro && c.ativo ? <p className="mt-2 text-xs text-quente">{c.erro}</p> : null}
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-suave">Ajustar</summary>
                  <form action={editarCriador} className="mt-2 space-y-2">
                    <input type="hidden" name="id" value={c.id} />
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="block">
                        <span className="rotulo">Por dia</span>
                        <input name="por_dia" type="number" min={1} max={20} defaultValue={c.por_dia} className="campo mt-1 w-24" />
                      </label>
                      <label className="block">
                        <span className="rotulo">Duração</span>
                        <div className="mt-1">
                          <Duracao valor={c.duracao_alvo} />
                        </div>
                      </label>
                      {c.rede === "youtube" ? (
                        <label className="flex min-h-11 items-center gap-2 text-sm">
                          <input type="checkbox" name="so_shorts" defaultChecked={c.so_shorts} /> só Shorts
                        </label>
                      ) : (
                        <input type="hidden" name="so_shorts" value={c.so_shorts ? "on" : ""} />
                      )}
                    </div>
                    <label className="block">
                      <span className="rotulo">Orientação pro roteirista</span>
                      <input name="direcao" defaultValue={c.direcao ?? ""} className="campo mt-1" />
                    </label>
                    <label className="block">
                      <span className="rotulo">Notas</span>
                      <input name="notas" defaultValue={c.notas ?? ""} className="campo mt-1" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-sm">Salvar</button>
                      <Link href={`/roteiros?criador=${c.id}`} className="btn btn-sm btn-2">
                        Ver os roteiros dele
                      </Link>
                    </div>
                  </form>
                  <form action={apagarCriador} className="mt-2">
                    <input type="hidden" name="id" value={c.id} />
                    <button className="btn btn-sm btn-perigo">Apagar da lista</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
