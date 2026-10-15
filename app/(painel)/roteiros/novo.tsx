"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { extrairAudio } from "@/lib/roteiro/audio-navegador";
import { DURACAO_PADRAO, DURACOES } from "@/lib/roteiro/comum";
import { mb, subirParte } from "../editor/envio";
import { confirmarEnvio, criarRoteiro, type NovoRoteiro } from "./acoes";

const MAX_ARQUIVO = 45 * 1024 * 1024;

type Modo = "tema" | "video";

function Pilula({ ativo, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={`min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-bold ${ativo ? "border-tinta bg-marca text-[#05070e] shadow-[0_3px_0_#000]" : "border-linha text-suave"}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * O formulário de novo roteiro: sobre um tema, ou a partir de um vídeo de referência (arquivo ou
 * link do Instagram). `palavras`: as palavras das suas automações ativas (sugestão do comenta).
 */
export function NovoRoteiroForm({ palavras = [] }: { palavras?: string[] }) {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("tema");
  const [fonte, setFonte] = useState<"arquivo" | "link">("arquivo");
  const [tema, setTema] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [link, setLink] = useState("");
  const [duracao, setDuracao] = useState(DURACAO_PADRAO);
  const [palavra, setPalavra] = useState("");
  const [direcao, setDirecao] = useState("");
  const [envio, setEnvio] = useState<{ texto: string; feito?: number; total?: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const base = { tema, direcao, palavra, duracao };
    try {
      if (modo === "tema") {
        if (tema.trim().length < 3) return setErro("Escreva sobre o que é o vídeo.");
        setEnvio({ texto: "Mandando pro roteirista…" });
        const r = await criarRoteiro({ ...base, modo: "tema" });
        if ("erro" in r) throw new Error(r.erro);
        return router.push(`/roteiros/${r.id}`);
      }
      if (fonte === "link") {
        if (!link.trim()) return setErro("Cole o link do reel.");
        setEnvio({ texto: "Mandando pro roteirista…" });
        const r = await criarRoteiro({ ...base, modo: "link", link });
        if ("erro" in r) throw new Error(r.erro);
        return router.push(`/roteiros/${r.id}`);
      }
      if (!arquivo) return setErro("Escolha o vídeo.");
      let subir = arquivo;
      if (arquivo.size > MAX_ARQUIVO) {
        // Grande demais pro Storage: o navegador tira só o áudio (a fala é o que importa pro roteiro)
        setEnvio({ texto: "Vídeo grande: tirando só o áudio aqui no navegador…" });
        const audio = await extrairAudio(arquivo);
        if (audio.arquivo.size > MAX_ARQUIVO) throw new Error("Mesmo só o áudio passou de 45 MB.");
        subir = audio.arquivo;
      }
      const pedido: NovoRoteiro = { ...base, modo: "arquivo", arquivo: { nome: arquivo.name, tamanho: subir.size, tipo: subir.type || "video/mp4" } };
      setEnvio({ texto: "Criando…" });
      const r = await criarRoteiro(pedido);
      if ("erro" in r) throw new Error(r.erro);
      for (let tentativa = 1; ; tentativa++) {
        try {
          await subirParte(r.envio!, subir, (b) => setEnvio({ texto: "Subindo o vídeo…", feito: b, total: subir.size }));
          break;
        } catch (e2) {
          if (tentativa >= 3) throw e2;
          await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
        }
      }
      setEnvio({ texto: "Mandando pro roteirista…" });
      await confirmarEnvio(r.id);
      router.push(`/roteiros/${r.id}`);
    } catch (e2) {
      setErro((e2 as Error).message);
      setEnvio(null);
    }
  }

  const ocupado = Boolean(envio);
  return (
    <form onSubmit={enviar} className="card space-y-4 p-4">
      <div className="grid grid-cols-2 gap-2">
        <Pilula ativo={modo === "tema"} onClick={() => setModo("tema")} disabled={ocupado}>
          Sobre um tema
        </Pilula>
        <Pilula ativo={modo === "video"} onClick={() => setModo("video")} disabled={ocupado}>
          De um vídeo
        </Pilula>
      </div>

      {modo === "video" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Pilula ativo={fonte === "arquivo"} onClick={() => setFonte("arquivo")} disabled={ocupado}>
              Arquivo
            </Pilula>
            <Pilula ativo={fonte === "link"} onClick={() => setFonte("link")} disabled={ocupado}>
              Link do Instagram
            </Pilula>
          </div>
          {fonte === "arquivo" ? (
            <label className="block">
              <span className="rotulo">Vídeo de referência</span>
              <input type="file" accept="video/*,audio/*" className="mt-1 block w-full text-sm" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} disabled={ocupado} />
              <span className="mt-1 block text-xs text-apagado">
                {arquivo
                  ? `${arquivo.name} · ${mb(arquivo.size)}${arquivo.size > MAX_ARQUIVO ? " · grande: vai só o áudio" : ""}`
                  : "O vídeo que viralizou, salvo no celular ou no PC (de qualquer rede). A IA ouve, entende o assunto e a estrutura e escreve um roteiro seu, sem as falas do outro criador."}
              </span>
            </label>
          ) : (
            <label className="block">
              <span className="rotulo">Link do reel</span>
              <input
                className="campo mt-1"
                type="url"
                inputMode="url"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://www.instagram.com/reel/…"
                disabled={ocupado}
              />
              <span className="mt-1 block text-xs text-apagado">
                Precisa do Facebook conectado (Conexões) e o reel tem que ser de conta de criador ou empresa. Não deu? Baixe o vídeo e suba o arquivo. Já
                está na{" "}
                <Link href="/esteira" className="text-marca underline">
                  Esteira
                </Link>
                ? Abra o reel lá e clique em Criar roteiro.
              </span>
            </label>
          )}
        </div>
      )}

      <label className="block">
        <span className="rotulo">{modo === "tema" ? "Sobre o que é o vídeo" : "Seu foco (opcional)"}</span>
        <textarea
          className="campo mt-1"
          rows={3}
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          placeholder={modo === "tema" ? "ex.: 3 erros de quem tá começando · o app que eu uso pra organizar a semana" : "ex.: puxa pro meu nicho · fala pra quem tá começando"}
          disabled={ocupado}
          required={modo === "tema"}
        />
      </label>

      <div>
        <span className="rotulo">Duração</span>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {DURACOES.map((d) => (
            <Pilula key={d.valor} ativo={duracao === d.valor} onClick={() => setDuracao(d.valor)} disabled={ocupado}>
              {d.nome}
            </Pilula>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <label className="block">
          <span className="rotulo">Palavra do comenta</span>
          <input
            className="campo mt-1 uppercase"
            value={palavra}
            onChange={(e) => setPalavra(e.target.value.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "").slice(0, 24))}
            placeholder="ex.: GUIA"
            autoCapitalize="characters"
            list="palavras-automacao"
            disabled={ocupado}
          />
          <datalist id="palavras-automacao">
            {palavras.map((p) => (
              <option key={p} value={p.toUpperCase()} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className="rotulo">Direção (opcional)</span>
          <input className="campo mt-1" value={direcao} onChange={(e) => setDirecao(e.target.value)} placeholder="ex.: mais polêmico · termina puxando pro meu material" disabled={ocupado} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-apagado">Sem palavra, a IA escolhe uma ligada ao tema. Lembre de ter a automação dela no Instagram.</p>

      {erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{erro}</p>}
      {envio ? (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{envio.texto}</span>
            {envio.total ? <span className="font-mono text-xs text-suave">{Math.round(((envio.feito ?? 0) / envio.total) * 100)}%</span> : null}
          </div>
          {envio.total ? (
            <div className="h-3 overflow-hidden rounded-full border-2 border-tinta bg-fundo">
              <div className="h-full bg-marca transition-all" style={{ width: `${Math.min(100, ((envio.feito ?? 0) / envio.total) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      ) : (
        <button className="btn w-full">Gerar roteiro</button>
      )}
    </form>
  );
}
