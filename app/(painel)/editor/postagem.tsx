import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { estacaoLigada, type BatidaEstacao } from "@/lib/editor";
import { palavraNormal } from "@/lib/entregas/blocos";
import { BotaoGerar } from "../esteira/botoes";
import { AutoAtualizar } from "./atualizar";
import { entregaDoVideo, palavraNaAutomacao, pedirLegenda, postarAgora, salvarPostagem } from "./postagem-acoes";

// O cartão "Postar no Instagram" da edição pronta: a legenda escrita pela estação (dá pra mudar),
// um botão que posta como Reel, e a ligação do CTA com a automação de comentários e a entrega.

const ANDANDO = ["aguardando_estacao", "escrevendo", "enviando", "processando", "publicando"];

export async function CartaoPostagem({ edicaoId, duracao }: { edicaoId: string; duracao?: number }) {
  const supabase = await createClient();
  const [{ data: p }, { data: cfg }, { data: automacoes }] = await Promise.all([
    supabase.from("postagem").select("*").eq("edicao_id", edicaoId).maybeSingle(),
    supabase.from("configuracao").select("valor").eq("chave", "estacao_roteiros").maybeSingle(),
    supabase.from("ig_automacao").select("id, nome, ativa, todas_as_midias, palavras").eq("ativa", true).order("criado_em"),
  ]);
  const ligada = estacaoLigada(cfg?.valor as BatidaEstacao | null);
  const palavra: string | null = p?.palavra ?? null;
  const { data: entrega } = palavra
    ? await supabase.from("entrega").select("id, slug, titulo, status, publicada, na_dm, palavra").not("palavra", "is", null).limit(200)
    : { data: null };
  const minhaEntrega = (entrega ?? []).find((e) => palavraNormal(e.palavra) === palavraNormal(palavra));
  const cobre = (automacoes ?? []).find((a) => a.todas_as_midias && (a.palavras ?? []).some((x: string) => palavraNormal(x) === palavraNormal(palavra)));
  const principal = (automacoes ?? []).find((a) => a.todas_as_midias);

  return (
    <section id="postar" className="card space-y-3 p-4">
      {p && ANDANDO.includes(p.status) && <AutoAtualizar segundos={5} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="rotulo">Postar no Instagram</h2>
        {p?.status === "publicada" && <span className="chip text-ok">publicado</span>}
      </div>

      {!p && (
        <form action={pedirLegenda} className="space-y-2">
          <input type="hidden" name="edicao_id" value={edicaoId} />
          <p className="text-sm text-suave">A estação escreve a legenda (na tua voz, com o “comenta” do vídeo) e aí é um clique pra postar.</p>
          <BotaoGerar rotulo="Escrever a legenda" gerando="Mandando pra estação…" className="btn btn-sm" />
        </form>
      )}

      {p && (p.status === "aguardando_estacao" || p.status === "escrevendo") && (
        <div className="space-y-1 text-sm">
          <p>{p.etapa ?? "a estação está escrevendo a legenda"}…</p>
          {!ligada && <p className="text-quente">A estação está desligada: abre o atalho da estação de edição no teu PC que ela escreve a legenda.</p>}
        </div>
      )}

      {p && ["enviando", "processando", "publicando"].includes(p.status) && (
        <div className="space-y-1 text-sm">
          <p>{p.etapa ?? "subindo pro Instagram"}…</p>
          <p className="text-xs text-apagado">Pode sair da página: o servidor termina sozinho.</p>
        </div>
      )}

      {p?.status === "publicada" && (
        <div className="space-y-2 text-sm">
          <p className="text-suave">
            No ar {p.publicado_em ? `desde ${new Date(p.publicado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : ""}.
          </p>
          {p.permalink && (
            <a href={p.permalink} target="_blank" rel="noreferrer" className="btn btn-sm">
              Ver no Instagram
            </a>
          )}
          {p.legenda && <p className="whitespace-pre-wrap rounded-lg bg-black/20 p-3 text-xs text-suave">{p.legenda}</p>}
        </div>
      )}

      {p && (p.status === "pronta" || p.status === "erro") && (
        <>
          {p.status === "erro" && p.erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{p.erro}</p>}
          {p.legenda ? (
            <form action={postarAgora} className="space-y-3">
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="edicao_id" value={edicaoId} />
              <label className="block space-y-1">
                <span className="text-xs text-apagado">Legenda (até 2.200 caracteres; muda o que quiser)</span>
                <textarea name="legenda" rows={8} defaultValue={p.legenda} maxLength={2200} className="campo" required />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-xs text-apagado">Palavra do CTA</span>
                  <input name="palavra" defaultValue={palavra ?? ""} className="campo" placeholder="ex.: MANYCHAT" />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-apagado">Capa no segundo (opcional)</span>
                  <input name="capa_s" type="number" min={0} max={duracao ?? 900} step={0.1} defaultValue={p.capa_s ?? ""} className="campo" placeholder="o Instagram escolhe" />
                </label>
                <label className="flex items-center gap-2 pt-5 text-sm">
                  <input type="checkbox" name="feed" defaultChecked={p.compartilhar_feed} /> aparecer no feed
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <BotaoGerar rotulo="Postar agora" gerando="Mandando pro Instagram…" className="btn" />
                <button formAction={salvarPostagem} className="btn btn-sm btn-2">
                  Só salvar
                </button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-suave">A legenda não saiu.</p>
          )}
          <form action={pedirLegenda}>
            <input type="hidden" name="edicao_id" value={edicaoId} />
            <BotaoGerar rotulo="Reescrever a legenda" gerando="Mandando pra estação…" className="text-xs text-marca" />
          </form>
        </>
      )}

      {/* O CTA do vídeo: quem comentar recebe a DM? E o material? */}
      {palavra && p?.status !== "aguardando_estacao" && p?.status !== "escrevendo" && (
        <div className="space-y-2 border-t border-borda pt-3 text-sm">
          <p className="rotulo">CTA “{palavra}”</p>
          {cobre ? (
            <p className="text-suave">
              ✓ quem comentar <b>{palavra}</b> recebe a DM da automação “{cobre.nome}”.
            </p>
          ) : principal ? (
            <form action={palavraNaAutomacao} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="edicao_id" value={edicaoId} />
              <input type="hidden" name="automacao_id" value={principal.id} />
              <input type="hidden" name="palavra" value={palavra} />
              <span className="text-quente">nenhuma automação responde “{palavra}”.</span>
              <BotaoGerar rotulo={`Pôr na “${principal.nome}”`} gerando="Pondo…" className="btn btn-sm btn-2" />
            </form>
          ) : (
            <p className="text-quente">nenhuma automação ativa em todas as publicações: crie uma em Instagram pra responder “{palavra}”.</p>
          )}
          {minhaEntrega ? (
            <p className="text-suave">
              {minhaEntrega.publicada ? "✓ material no ar" : "material em rascunho"}:{" "}
              <Link href={`/materiais/${minhaEntrega.id}`} className="text-marca">
                {minhaEntrega.titulo || `/m/${minhaEntrega.slug}`}
              </Link>
              {minhaEntrega.publicada && minhaEntrega.na_dm ? " (vai na DM de quem comentar)" : ""}
            </p>
          ) : (
            <details>
              <summary className="cursor-pointer text-marca">Criar o material de “{palavra}” a partir deste vídeo</summary>
              <form action={entregaDoVideo} className="mt-2 space-y-2">
                <input type="hidden" name="edicao_id" value={edicaoId} />
                <input type="hidden" name="palavra" value={palavra} />
                <textarea
                  name="pedido"
                  rows={4}
                  className="campo"
                  placeholder="O que entregar (opcional): cola aqui o prompt, os links e o que não pode faltar. Sem nada, a estação monta pelo que você falou no vídeo."
                />
                <BotaoGerar rotulo="Montar o material" gerando="Mandando pra estação…" className="btn btn-sm" />
              </form>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
