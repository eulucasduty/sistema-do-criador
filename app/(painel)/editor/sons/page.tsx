import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FUNCOES_SOM, VOLUMES_SOM } from "@/lib/editor";
import { alternarSom, apagarSom, mudarVolume, tornarPrincipal } from "./acoes";
import { SubirSom } from "./subir";

export const dynamic = "force-dynamic";

type Som = { id: string; nome: string; funcao: string | null; principal: boolean; descricao: string; origem: string; arquivo: string; volume: number; ativo: boolean };
const ORIGEM: Record<string, string> = { criador: "seu", kit: "kit", "99hud": "kit" };

// Os sons que vêm no kit do editor (editor/kit/sons): valem quando você não tem um principal na função
const KIT: Record<string, string> = {
  obturador: "obturador-99hud",
  ding: "ding-99hud",
  tecla: "tick-99hud",
  whoosh: "whoosh-99hud",
  pop: "pop-99hud",
  teclado: "teclado-kit",
  riser: "riser-kit",
  click: "click-kit",
  impacto: "impacto-kit",
  notificacao: "notificacao-kit",
};

export default async function PaginaSons() {
  const supabase = await createClient();
  const { data } = await supabase.from("edicao_som").select("id, nome, funcao, principal, descricao, origem, arquivo, volume, ativo").order("principal", { ascending: false }).order("nome");
  const sons = (data ?? []) as Som[];
  const urls = new Map<string, string>();
  if (sons.length) {
    const { data: assinados } = await createAdminClient()
      .storage.from("edicao")
      .createSignedUrls(
        sons.map((s) => s.arquivo),
        3600,
      );
    for (const a of assinados ?? []) if (a.path && a.signedUrl) urls.set(a.path, a.signedUrl);
  }

  // O que toca em cada função: o seu principal, senão o do kit, senão o primeiro seu que estiver ligado
  const tocaEm = (funcao: string) => {
    const seus = sons.filter((s) => s.funcao === funcao && s.ativo);
    const principal = seus.find((s) => s.principal);
    if (principal) return { nome: principal.nome, de: "seu" };
    if (KIT[funcao]) return { nome: KIT[funcao], de: "kit" };
    if (seus[0]) return { nome: seus[0].nome, de: "seu" };
    return null;
  };

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <Link href="/editor" className="text-xs text-apagado hover:text-texto">
          ← Editor de vídeo
        </Link>
        <h1 className="titulo mt-1">Meus sons</h1>
        <p className="mt-1 text-sm text-suave">
          Os efeitos que entram nas suas edições. Cada função tem um <b>principal</b>, que entra sozinho (ex.: o clique em toda emenda). Os outros o editor usa
          quando combinam, pela descrição. Todo som é nivelado no mesmo volume antes de entrar.
        </p>
      </header>

      <section className="card p-4">
        <h2 className="rotulo">O que toca em cada função</h2>
        <p className="mt-1 text-xs text-apagado">
          O kit já traz um som pra cada função. Suba o seu e marque como principal pra ele entrar no lugar.
        </p>
        <ul className="mt-3 divide-y divide-linha text-sm">
          {FUNCOES_SOM.filter((f) => f.funcao).map((f) => {
            const toca = tocaEm(f.funcao!);
            return (
              <li key={f.funcao} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  <b>{f.nome}</b> <span className="text-xs text-apagado">· {f.quando}</span>
                </span>
                {toca ? (
                  <span className="font-mono text-xs text-suave">
                    {toca.nome} <span className="text-apagado">({toca.de})</span>
                  </span>
                ) : (
                  <span className="text-xs text-morno">nenhum: suba um</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <SubirSom />

      {!sons.length && <p className="text-sm text-apagado">Você ainda não subiu nenhum som: o editor usa os do kit.</p>}

      {FUNCOES_SOM.map((f) => {
        const lista = sons.filter((s) => s.funcao === f.funcao);
        if (!lista.length) return null;
        return (
          <section key={f.funcao ?? "extras"} className="space-y-2">
            <div>
              <h2 className="rotulo">{f.nome}</h2>
              <p className="text-xs text-apagado">{f.quando}</p>
            </div>
            <ul className="space-y-2">
              {lista.map((s) => (
                <li key={s.id} className={`card space-y-2 p-3 ${s.ativo ? "" : "opacity-50"} ${s.principal ? "border-marca" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold">{s.nome}</span>
                    {s.principal && <span className="chip text-marca">principal</span>}
                    <span className="chip">{ORIGEM[s.origem] ?? s.origem}</span>
                    {!s.ativo && <span className="chip text-apagado">desligado</span>}
                  </div>
                  <p className="text-sm text-suave">{s.descricao}</p>
                  {urls.get(s.arquivo) && <audio controls preload="none" src={urls.get(s.arquivo)} className="h-9 w-full max-w-md" />}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {f.funcao && !s.principal && s.ativo && (
                      <form action={tornarPrincipal}>
                        <input type="hidden" name="id" value={s.id} />
                        <button className="btn btn-sm btn-2">Usar como principal</button>
                      </form>
                    )}
                    <span className="text-apagado">volume:</span>
                    {VOLUMES_SOM.map((v) => (
                      <form key={v.valor} action={mudarVolume}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="volume" value={v.valor} />
                        <button className={`rounded-lg border-2 px-2 py-0.5 ${Number(s.volume) === v.valor ? "border-tinta bg-marca text-[#05070e]" : "border-linha text-suave"}`}>{v.nome}</button>
                      </form>
                    ))}
                    <form action={alternarSom}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-suave hover:text-texto">{s.ativo ? "desligar" : "ligar"}</button>
                    </form>
                    <form action={apagarSom}>
                      <input type="hidden" name="id" value={s.id} />
                      <button className="text-quente">apagar</button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
