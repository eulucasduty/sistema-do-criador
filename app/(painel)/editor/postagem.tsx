import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { estacaoLigada, type BatidaEstacao } from "@/lib/editor";
import { palavraNormal } from "@/lib/entregas/blocos";
import { AVISO_MIGRACAO, faltaMigracao } from "@/lib/entregas/servidor";
import { POSTAGEM_ANDANDO } from "@/lib/postagem/publicar";
import { BotaoGerar } from "../esteira/botoes";
import { AutoAtualizar } from "./atualizar";
import { AcompanharPostagem } from "./acompanhar";
import { materialDoVideo, palavraNaAutomacao, pedirLegenda, postarAgora, postNaAutomacao, salvarPostagem } from "./postagem-acoes";

// O cartão "Postar no Instagram" da edição pronta: a legenda escrita pela estação (dá pra mudar),
// um botão que posta como Reel, e a ligação do CTA com as automações e o material.

type Automacao = { id: string; nome: string; todas_as_midias: boolean; palavras: string[] | null; midias: string[] | null };

const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export async function CartaoPostagem({ edicaoId, duracao }: { edicaoId: string; duracao?: number }) {
  const supabase = await createClient();
  const [{ data: p, error }, { data: cfg }, { data: automacoes }] = await Promise.all([
    supabase.from("postagem").select("*").eq("edicao_id", edicaoId).maybeSingle(),
    supabase.from("configuracao").select("valor").eq("chave", "estacao_edicao").maybeSingle(),
    supabase.from("ig_automacao").select("id, nome, todas_as_midias, palavras, midias").eq("ativa", true).order("criado_em"),
  ]);

  if (error) {
    return (
      <section id="postar" className="card space-y-2 p-4">
        <h2 className="rotulo">Postar no Instagram</h2>
        <p className="text-sm text-suave">{faltaMigracao(error) ? AVISO_MIGRACAO : `Não deu pra ler o post: ${error.message}`}</p>
      </section>
    );
  }

  const ligada = estacaoLigada(cfg?.valor as BatidaEstacao | null);
  const palavra: string | null = p?.palavra ?? null;
  const { data: entregas } = palavra ? await supabase.from("entrega").select("id, slug, titulo, publicada, na_dm, palavra").not("palavra", "is", null).limit(200) : { data: null };
  const material = (entregas ?? []).find((e) => palavraNormal(e.palavra) === palavraNormal(palavra));

  // Quem responde a palavra neste post: automação em todas as publicações, ou só neste post
  const lista = (automacoes ?? []) as Automacao[];
  const respondePalavra = (a: Automacao) => !(a.palavras ?? []).length || (a.palavras ?? []).some((x) => palavraNormal(x) === palavraNormal(palavra));
  const cobre = lista.find((a) => respondePalavra(a) && (a.todas_as_midias || Boolean(p?.media_id && (a.midias ?? []).includes(p.media_id))));
  const geral = lista.find((a) => a.todas_as_midias);
  const porPost = p?.media_id ? lista.find((a) => !a.todas_as_midias && (a.palavras ?? []).some((x) => palavraNormal(x) === palavraNormal(palavra))) : undefined;
  const escrevendo = p?.status === "aguardando_estacao" || p?.status === "escrevendo";

  return (
    <section id="postar" className="card scroll-mt-6 space-y-3 p-4">
      {escrevendo && <AutoAtualizar segundos={5} />}
      {p && POSTAGEM_ANDANDO.includes(p.status) && <AcompanharPostagem id={p.id} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="rotulo">Postar no Instagram</h2>
        {p?.status === "publicada" && <span className="chip text-ok">publicado</span>}
      </div>

      {!p && (
        <form action={pedirLegenda} className="space-y-2">
          <input type="hidden" name="edicao_id" value={edicaoId} />
          <p className="text-sm text-suave">A estação escreve a legenda (na sua voz, com o “comenta” do vídeo) e aí é um clique pra postar como Reel.</p>
          <BotaoGerar rotulo="Escrever a legenda" gerando="Mandando pra estação…" className="btn btn-sm" />
        </form>
      )}

      {escrevendo && (
        <div className="space-y-1 text-sm">
          <p>{p?.etapa ?? "a estação está escrevendo a legenda"}…</p>
          {!ligada && <p className="text-quente">A estação está desligada: abra o atalho Estação de edição no seu PC que ela escreve a legenda.</p>}
        </div>
      )}

      {p && POSTAGEM_ANDANDO.includes(p.status) && (
        <div className="space-y-1 text-sm">
          <p>{p.etapa ?? "subindo pro Instagram"}…</p>
          <p className="text-xs text-apagado">Deixe a página aberta pra acompanhar. Se fechar, o relógio termina sozinho (se ele estiver ligado no Início).</p>
        </div>
      )}

      {p?.status === "publicada" && (
        <div className="space-y-2 text-sm">
          <p className="text-suave">No ar{p.publicado_em ? ` desde ${dataHora(p.publicado_em)}` : ""}.</p>
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
                <span className="text-xs text-apagado">Legenda (até 2.200 caracteres; mude o que quiser)</span>
                <textarea name="legenda" rows={8} defaultValue={p.legenda} maxLength={2200} className="campo" required />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-xs text-apagado">Palavra do CTA</span>
                  <input name="palavra" defaultValue={palavra ?? ""} className="campo" placeholder="ex.: PLANILHA" maxLength={40} />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-apagado">Capa no segundo (opcional)</span>
                  <input name="capa_s" type="number" min={0} max={duracao ?? 900} step={0.1} defaultValue={p.capa_s ?? ""} className="campo" placeholder="automática" />
                </label>
                <label className="flex items-center gap-2 pt-5 text-sm">
                  <input type="checkbox" name="feed" defaultChecked={p.compartilhar_feed} /> aparecer no feed
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BotaoGerar rotulo="Postar agora" gerando="Mandando pro Instagram…" className="btn" />
                <button formAction={salvarPostagem} className="btn btn-sm btn-2">
                  Só salvar
                </button>
              </div>
              <p className="text-xs text-apagado">
                Sai como Reel na sua conta, pela API oficial do Instagram. Precisa da permissão de publicar no seu app da Meta (
                <Link href="/#instagram" className="text-marca underline">
                  Início → passo 4
                </Link>
                ).
              </p>
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
      {palavra && !escrevendo && (
        <div className="space-y-2 border-t border-borda pt-3 text-sm">
          <p className="rotulo">CTA “{palavra}”</p>
          {cobre ? (
            <p className="text-suave">
              ✓ quem comentar <b>{palavra}</b> recebe a DM da automação “{cobre.nome}”.
            </p>
          ) : porPost ? (
            <form action={postNaAutomacao} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="edicao_id" value={edicaoId} />
              <input type="hidden" name="automacao_id" value={porPost.id} />
              <input type="hidden" name="midia_id" value={p?.media_id ?? ""} />
              <span className="text-quente">a automação “{porPost.nome}” responde “{palavra}”, mas não neste post.</span>
              <BotaoGerar rotulo="Pôr este post nela" gerando="Pondo…" className="btn btn-sm btn-2" />
            </form>
          ) : geral ? (
            <form action={palavraNaAutomacao} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="edicao_id" value={edicaoId} />
              <input type="hidden" name="automacao_id" value={geral.id} />
              <input type="hidden" name="palavra" value={palavra} />
              <span className="text-quente">nenhuma automação responde “{palavra}”.</span>
              <BotaoGerar rotulo={`Pôr na “${geral.nome}”`} gerando="Pondo…" className="btn btn-sm btn-2" />
            </form>
          ) : (
            <p className="text-quente">
              nenhuma automação ligada responde “{palavra}”{p?.status === "publicada" ? " neste post" : ""}:{" "}
              <Link href="/instagram/nova" className="underline">
                crie uma em Automações
              </Link>{" "}
              {p?.status === "publicada" ? "e escolha este post." : "(depois de postar, dá pra escolher este post nela)."}
            </p>
          )}
          {material ? (
            <p className="text-suave">
              {material.publicada ? "✓ material no ar" : "material em rascunho"}:{" "}
              <Link href={`/materiais/${material.id}`} className="text-marca">
                {material.titulo || `/m/${material.slug}`}
              </Link>
              {material.publicada && material.na_dm ? " (vai na DM de quem comentar)" : ""}
            </p>
          ) : (
            <details>
              <summary className="cursor-pointer text-marca">Criar o material de “{palavra}” a partir deste vídeo</summary>
              <form action={materialDoVideo} className="mt-2 space-y-2">
                <input type="hidden" name="edicao_id" value={edicaoId} />
                <input type="hidden" name="palavra" value={palavra} />
                <textarea
                  name="pedido"
                  rows={4}
                  className="campo"
                  placeholder="O que entregar (opcional): cole aqui o prompt, os links e o que não pode faltar. Sem nada, a estação monta pelo que você falou no vídeo."
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
