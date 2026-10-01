"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ESTILOS_EDICAO, GRUPOS_ESTILO, estiloDe, partesDe, type PedidoEdicao } from "@/lib/editor";
import { confirmarEdicao, criarEdicao } from "../acoes";
import { BarraEnvio, mb, subirArquivo, type Andamento } from "../envio";
import { LOOKS_VIDEO, type LookVideo } from "../opcoes";

type Material = { chave: number; tipo: "arquivo" | "link"; arquivo: File | null; url: string; descricao: string };
export type Inicial = { titulo: string; roteiro: string; estilo: string; legenda: string; cor: LookVideo };

const escolha = (ativo: boolean) =>
  `rounded-xl border-2 px-3 py-2 text-left text-sm ${ativo ? "border-tinta bg-marca text-[#05070e] shadow-[0_3px_0_#000]" : "border-linha text-suave"}`;

export function FormularioEdicao({ inicial }: { inicial: Inicial }) {
  const router = useRouter();
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [video, setVideo] = useState<File | null>(null);
  const [roteiro, setRoteiro] = useState(inicial.roteiro);
  const [estilo, setEstilo] = useState<string>(inicial.estilo);
  const [legenda, setLegenda] = useState<string>(inicial.legenda);
  const escolhido = estiloDe(estilo);
  const [cor, setCor] = useState<LookVideo>(inicial.cor);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [envio, setEnvio] = useState<Andamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const mudar = (chave: number, campos: Partial<Material>) => setMateriais((ms) => ms.map((m) => (m.chave === chave ? { ...m, ...campos } : m)));
  const adicionar = (tipo: Material["tipo"]) => setMateriais((ms) => [...ms, { chave: Date.now() + ms.length, tipo, arquivo: null, url: "", descricao: "" }]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!video) return setErro("Escolha o vídeo.");
    const usados = materiais.filter((m) => (m.tipo === "link" ? m.url.trim() : m.arquivo));
    for (const [k, m] of usados.entries()) if (!m.descricao.trim()) return setErro(`Escreva o que é o material ${k + 1} (a descrição é o que diz pro editor quando usar).`);

    const pedido: PedidoEdicao = {
      titulo,
      roteiro,
      estilo,
      legenda,
      cor,
      video: { nome: video.name, tamanho: video.size, tipo: video.type, partes: partesDe(video.size) },
      materiais: usados.map((m) =>
        m.tipo === "link"
          ? { tipo: "link", descricao: m.descricao.trim(), url: m.url.trim() }
          : { tipo: m.arquivo!.type.startsWith("video") ? "video" : "imagem", descricao: m.descricao.trim(), arquivo: { nome: m.arquivo!.name, tamanho: m.arquivo!.size, tipo: m.arquivo!.type, partes: partesDe(m.arquivo!.size) } },
      ),
    };
    const total = video.size + usados.reduce((s, m) => s + (m.arquivo?.size ?? 0), 0);
    try {
      setEnvio({ feito: 0, total, texto: "Criando o pedido…" });
      const r = await criarEdicao(pedido);
      if ("erro" in r) throw new Error(r.erro);
      let feito = 0;
      setEnvio({ feito, total, texto: "Subindo o vídeo…" });
      await subirArquivo(video, r.video, (b) => setEnvio({ feito: feito + b, total, texto: "Subindo o vídeo…" }));
      feito += video.size;
      let k = 0;
      for (const [i, m] of usados.entries()) {
        if (!m.arquivo) continue;
        k++;
        const texto = `Subindo o material ${k}…`;
        await subirArquivo(m.arquivo, r.materiais[i], (b) => setEnvio({ feito: feito + b, total, texto }));
        feito += m.arquivo.size;
      }
      setEnvio({ feito: total, total, texto: "Mandando pra fila…" });
      await confirmarEdicao(r.id);
      router.push(`/editor/${r.id}`);
    } catch (e2) {
      setErro((e2 as Error).message);
      setEnvio(null);
    }
  }

  const ocupado = Boolean(envio);
  return (
    <form onSubmit={enviar} className="space-y-5">
      <section className="card space-y-3 p-4">
        <label className="block">
          <span className="rotulo">Título</span>
          <input className="campo mt-1" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="ex.: 3 apps que eu uso todo dia" required maxLength={120} disabled={ocupado} />
        </label>
        <label className="block">
          <span className="rotulo">Vídeo cru</span>
          <input type="file" accept="video/*" className="mt-1 block w-full text-sm" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} required disabled={ocupado} />
          <span className="mt-1 block text-xs text-apagado">
            {video ? `${video.name} · ${mb(video.size)}` : "Do jeito que saiu do celular (pode ser a junção das tomadas). Vídeo do iPhone em HDR é convertido sozinho."}
          </span>
        </label>
      </section>

      <section className="card space-y-4 p-4">
        <div>
          <h2 className="rotulo">Estilo de edição</h2>
          <p className="mt-1 text-sm text-suave">Como o vídeo vai ser editado. O mesmo vídeo cru sai diferente em cada um. O padrão vem do seu Perfil.</p>
        </div>
        {GRUPOS_ESTILO.map((g) => {
          const doGrupo = ESTILOS_EDICAO.filter((e) => e.grupo === g.id);
          if (!doGrupo.length) return null;
          return (
            <div key={g.id} className="space-y-2">
              <div>
                <h3 className="text-sm font-bold">{g.nome}</h3>
                <p className="text-xs text-apagado">{g.resumo}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {doGrupo.map((e) => {
                  const ativo = estilo === e.id;
                  return (
                    <button
                      type="button"
                      key={e.id}
                      aria-pressed={ativo}
                      disabled={ocupado}
                      onClick={() => {
                        setEstilo(e.id);
                        setLegenda(e.legenda);
                      }}
                      className={`flex gap-3 rounded-xl border-2 p-3 text-left ${ativo ? "border-marca bg-marca-fundo" : "border-linha"}`}
                    >
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-linha" aria-hidden>
                        {e.cores.map((c, k) => (
                          <span key={k} className="h-full flex-1" style={{ background: c }} />
                        ))}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2">
                          <span className="font-bold leading-tight">{e.nome}</span>
                          {ativo && <span className="font-mono text-xs text-marca">escolhido</span>}
                        </span>
                        <span className="mt-1 block text-xs leading-snug text-suave">{e.descricao}</span>
                        {e.recorte && <span className="mt-1 block text-xs text-apagado">recorta você do fundo: o render demora mais</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card space-y-3 p-4">
        <div>
          <h2 className="rotulo">Prints e gravações de tela</h2>
          <p className="mt-1 text-sm text-suave">
            O que você mostra ou cita no vídeo. Escreva o que é cada um: é isso que diz pro editor <b>quando</b> usar. Ex.: &ldquo;print do app que eu falo no começo&rdquo;.
          </p>
        </div>
        {materiais.map((m, k) => (
          <div key={m.chave} className="rounded-xl border-2 border-linha p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-apagado">
                {k + 1} · {m.tipo === "link" ? "link de uma página (vira print)" : "print ou gravação"}
              </span>
              <button type="button" className="text-xs text-quente" onClick={() => setMateriais((ms) => ms.filter((x) => x.chave !== m.chave))} disabled={ocupado}>
                tirar
              </button>
            </div>
            {m.tipo === "link" ? (
              <input className="campo mt-2" value={m.url} onChange={(e) => mudar(m.chave, { url: e.target.value })} placeholder="https://github.com/…" disabled={ocupado} />
            ) : (
              <input type="file" accept="image/*,video/*" className="mt-2 block w-full text-sm" onChange={(e) => mudar(m.chave, { arquivo: e.target.files?.[0] ?? null })} disabled={ocupado} />
            )}
            <textarea
              className="campo mt-2"
              rows={2}
              value={m.descricao}
              onChange={(e) => mudar(m.chave, { descricao: e.target.value })}
              placeholder={m.tipo === "link" ? "o que é essa página e quando ela aparece no vídeo" : "o que é e quando aparece (ex.: gravação da tela do celular criando o app, quando eu falo 'cria o app')"}
              disabled={ocupado}
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-sm btn-2" onClick={() => adicionar("arquivo")} disabled={ocupado}>
            + Print ou gravação
          </button>
          <button type="button" className="btn btn-sm btn-2" onClick={() => adicionar("link")} disabled={ocupado}>
            + Link de uma página
          </button>
        </div>
        <p className="text-xs text-apagado">Link de página pública (GitHub, site, documentação) vira print de verdade. Instagram e páginas com login não dão: suba o print.</p>
      </section>

      <section className="card space-y-4 p-4">
        <label className="block">
          <span className="rotulo">Roteiro ou contexto (opcional)</span>
          <textarea
            className="campo mt-1"
            rows={inicial.roteiro ? 12 : 4}
            value={roteiro}
            onChange={(e) => setRoteiro(e.target.value)}
            placeholder="Do que o vídeo fala, nomes que têm que sair certos, o que não pode faltar, a palavra do comenta…"
            maxLength={8000}
            disabled={ocupado}
          />
        </label>
        <div>
          <span className="rotulo">Legenda do estilo {escolhido.nome}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {escolhido.legendas.map((l) => (
              <button type="button" key={l.id} onClick={() => setLegenda(l.id)} disabled={ocupado} className={escolha(legenda === l.id)}>
                <span className="block font-bold">{l.nome}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="rotulo">Look do vídeo</span>
          <select className="campo mt-1 sm:w-auto" value={cor} onChange={(e) => setCor(e.target.value as LookVideo)} disabled={ocupado}>
            {LOOKS_VIDEO.map((l) => (
              <option key={l.valor} value={l.valor}>
                {l.nome}: {l.detalhe}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-apagado">O padrão de estilo e de look vem do seu Perfil.</span>
        </label>
      </section>

      {erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{erro}</p>}
      {envio ? <BarraEnvio envio={envio} /> : <button className="btn w-full sm:w-auto">Mandar pra edição</button>}
    </form>
  );
}
