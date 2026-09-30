import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { haQuanto, nomeDoContato } from "@/lib/formato";
import { ROTULO_ALERTA, type TipoAlerta } from "@/lib/alertas";
import { resolverAlerta } from "../acoes";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

const FILTROS = [
  { valor: "", rotulo: "Todos" },
  { valor: "precisa", rotulo: "Precisa de você" },
  { valor: "pausado", rotulo: "Agente pausado" },
  { valor: "nao-contatar", rotulo: "Não contatar" },
];

type Um<T> = T | T[] | null;
const um = <T,>(v: Um<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

type Lead = {
  id: string;
  nome: string | null;
  instagram_usuario: string | null;
  tags: string[];
  nao_contatar: boolean;
  agente_pausado_ate: string | null;
  ultima_mensagem_em: string | null;
  criado_em: string;
  ig_fluxo: Array<{ criado_em: string; automacao: Um<{ nome: string }> }>;
};

type Alerta = {
  id: string;
  tipo: TipoAlerta;
  motivo: string | null;
  criado_em: string;
  contato_id: string | null;
  contato: Um<{ id: string; nome: string | null; instagram_usuario: string | null }>;
};

const pausado = (ate: string | null) => ate === "infinity" || (ate ? Date.parse(ate) > Date.now() : false);

export default async function PaginaLeads({ searchParams }: PageProps<"/contatos">) {
  const sp = await searchParams;
  const q = String(sp.q ?? "")
    .replace(/^@/, "")
    .replace(/[,()%*\\"]/g, " ")
    .trim()
    .slice(0, 60);
  const filtro = String(sp.f ?? "");
  const tag = String(sp.tag ?? "").slice(0, 40);
  const pagina = Math.max(1, Number(sp.p ?? 1) || 1);

  const supabase = await createClient();
  const [{ data: dadosAlertas }, { data: comTags }] = await Promise.all([
    supabase
      .from("alerta")
      .select("id, tipo, motivo, criado_em, contato_id, contato:contato_id (id, nome, instagram_usuario)")
      .eq("resolvido", false)
      .order("criado_em", { ascending: false })
      .limit(200),
    supabase.from("contato").select("tags").neq("tags", "{}").order("ultima_mensagem_em", { ascending: false, nullsFirst: false }).limit(1000),
  ]);
  const alertas = (dadosAlertas ?? []) as unknown as Alerta[];
  const alertaDe = new Map<string, Alerta>();
  for (const a of alertas) if (a.contato_id && !alertaDe.has(a.contato_id)) alertaDe.set(a.contato_id, a);

  // As etiquetas mais usadas viram filtro
  const usoDaTag = new Map<string, number>();
  for (const c of comTags ?? []) for (const t of (c.tags as string[]) ?? []) usoDaTag.set(t, (usoDaTag.get(t) ?? 0) + 1);
  const tags = [...usoDaTag.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);

  let consulta = supabase
    .from("contato")
    .select("id, nome, instagram_usuario, tags, nao_contatar, agente_pausado_ate, ultima_mensagem_em, criado_em, ig_fluxo (criado_em, automacao:automacao_id (nome))", {
      count: "exact",
    });
  if (q) consulta = consulta.or(`nome.ilike.%${q}%,instagram_usuario.ilike.%${q}%`);
  if (tag) consulta = consulta.contains("tags", [tag]);
  if (filtro === "precisa") consulta = consulta.in("id", alertaDe.size ? [...alertaDe.keys()] : ["00000000-0000-0000-0000-000000000000"]);
  // 'infinity' também é maior que agora
  if (filtro === "pausado") consulta = consulta.gt("agente_pausado_ate", new Date().toISOString());
  if (filtro === "nao-contatar") consulta = consulta.eq("nao_contatar", true);

  const { data, count } = await consulta
    .order("ultima_mensagem_em", { ascending: false, nullsFirst: false })
    .order("criado_em", { ascending: false })
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  const leads = (data ?? []) as unknown as Lead[];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  const link = (mudanca: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const atual = { q, f: filtro, tag, p: pagina, ...mudanca };
    for (const [k, v] of Object.entries(atual)) if (v && !(k === "p" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return `/contatos${s ? `?${s}` : ""}`;
  };

  return (
    <div className="max-w-5xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Leads</h1>
          <p className="mt-1 text-sm text-suave">
            Quem comentou nos seus posts ou falou com você no direct · {total.toLocaleString("pt-BR")} {total === 1 ? "pessoa" : "pessoas"}
            {filtro || tag || q ? " neste filtro" : ""}
          </p>
        </div>
        <form className="flex gap-2" action="/contatos">
          {filtro && <input type="hidden" name="f" value={filtro} />}
          {tag && <input type="hidden" name="tag" value={tag} />}
          <input name="q" defaultValue={q} placeholder="@ ou nome" className="campo w-56" />
          <button className="btn btn-sm btn-2">Buscar</button>
        </form>
      </header>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="rotulo">
            Precisa de você {alertas.length > 0 && <span className="text-marca">· {alertas.length}</span>}
          </h2>
          {alertas.length > 6 && (
            <Link href={link({ f: "precisa", p: 1 })} className="text-xs text-marca hover:underline">
              ver todos
            </Link>
          )}
        </div>
        {!alertas.length ? (
          <p className="card p-4 text-sm text-suave">Ninguém esperando você agora.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {alertas.slice(0, 6).map((a) => {
              const contato = um(a.contato);
              return (
                <li key={a.id} className="card flex items-start justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className={`chip ${a.tipo === "erro" || a.tipo === "nao_contatar" ? "text-quente" : "text-marca"}`}>
                        {ROTULO_ALERTA[a.tipo] ?? a.tipo}
                      </span>
                      {contato ? (
                        <Link href={`/contatos/${contato.id}`} className="font-medium hover:text-marca">
                          {nomeDoContato(contato)}
                        </Link>
                      ) : a.tipo === "erro" ? (
                        <Link href="/conexoes" className="font-medium hover:text-marca">
                          Conexões
                        </Link>
                      ) : null}
                    </p>
                    {a.motivo && <p className="mt-1 line-clamp-2 text-suave">{a.motivo}</p>}
                    <p className="mt-1 text-xs text-apagado">{haQuanto(a.criado_em)}</p>
                  </div>
                  <form action={resolverAlerta}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn btn-sm btn-2" title="Marca como resolvido (sai daqui)">
                      Resolver
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <Link
              key={f.valor}
              href={link({ f: f.valor, p: 1 })}
              className={`rounded-full border px-3 py-1 text-xs ${
                filtro === f.valor ? "border-marca bg-marca-fundo text-marca" : "border-borda text-suave hover:text-texto"
              }`}
            >
              {f.rotulo}
            </Link>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-apagado">Etiquetas:</span>
            {tags.map((t) => (
              <Link
                key={t}
                href={link({ tag: tag === t ? "" : t, p: 1 })}
                className={`rounded-full px-2.5 py-0.5 text-xs ${tag === t ? "bg-marca text-[#05070e]" : "bg-superficie-2 text-suave hover:text-texto"}`}
              >
                {t.replace(/_/g, " ")}
              </Link>
            ))}
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-borda">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-superficie text-left text-xs text-suave">
              <tr>
                <th className="px-4 py-2.5 font-medium">Pessoa</th>
                <th className="px-4 py-2.5 font-medium">Veio de</th>
                <th className="px-4 py-2.5 font-medium">Etiquetas</th>
                <th className="px-4 py-2.5 font-medium">Situação</th>
                <th className="px-4 py-2.5 font-medium">Última mensagem</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((c) => {
                const fluxo = [...(c.ig_fluxo ?? [])].sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
                const automacao = fluxo ? um(fluxo.automacao) : null;
                const alerta = alertaDe.get(c.id);
                return (
                  <tr key={c.id} className="border-t border-borda hover:bg-superficie">
                    <td className="px-4 py-2.5">
                      <Link href={`/contatos/${c.id}`} className="block">
                        <span className="font-medium">{nomeDoContato(c)}</span>
                        {c.instagram_usuario && c.nome !== `@${c.instagram_usuario}` && (
                          <span className="block text-xs text-apagado">@{c.instagram_usuario}</span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-suave">{automacao?.nome ?? (fluxo ? "automação apagada" : "direct")}</td>
                    <td className="px-4 py-2.5 text-xs text-suave">
                      {c.tags.length ? c.tags.slice(0, 3).map((t) => t.replace(/_/g, " ")).join(" · ") : "—"}
                      {c.tags.length > 3 && <span className="text-apagado"> +{c.tags.length - 3}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {alerta ? (
                        <span className="text-marca">{ROTULO_ALERTA[alerta.tipo] ?? alerta.tipo}</span>
                      ) : c.nao_contatar ? (
                        <span className="text-quente">não contatar</span>
                      ) : pausado(c.agente_pausado_ate) ? (
                        <span className="text-morno">agente pausado</span>
                      ) : (
                        <span className="text-apagado">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-suave">{c.ultima_mensagem_em ? haQuanto(c.ultima_mensagem_em) : "—"}</td>
                  </tr>
                );
              })}
              {!leads.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-suave">
                    {q || filtro || tag ? "Ninguém com esse filtro." : "Ninguém ainda. Quem comentar num post com automação aparece aqui."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {paginas > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-suave">
            <span>
              Página {pagina} de {paginas}
            </span>
            <div className="flex gap-2">
              {pagina > 1 && (
                <Link href={link({ p: pagina - 1 })} className="rounded-lg border border-borda px-3 py-1.5 hover:text-texto">
                  Anterior
                </Link>
              )}
              {pagina < paginas && (
                <Link href={link({ p: pagina + 1 })} className="rounded-lg border border-borda px-3 py-1.5 hover:text-texto">
                  Próxima
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
