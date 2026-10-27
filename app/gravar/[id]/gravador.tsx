"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PARTE_BYTES, partesDe } from "@/lib/editor";
import { AJUSTES_NEUTROS, VELOCIDADES, filtroCss, type AjustesVideo, type PedidoGravacao } from "@/lib/reels";
import { subirParte } from "../../(painel)/editor/envio";
import { confirmarGravacao, criarGravacao, linkMusica, salvarMusica } from "../../(painel)/esteira/reels-acoes";

// O gravador da esteira de reels, no jeito do teleprompter do CapCut (pedido do Duty, 19/10):
//   · câmera do celular em tela cheia, com o roteiro rolando em cima (velocidade e letra ajustáveis);
//   · grava, pausa, recomeça e salva o take; grava quantos quiser (gancho, corpo 1, corpo 2, CTA…);
//   · cada take: corta o começo e o fim logo depois de gravar, apaga e regrava se não gostou;
//   · ajusta a velocidade de cada take, o brilho, a iluminação e a nitidez, e põe música (as dele);
//   · nada sobe até "Mandar pra edição": aí os takes vão pro storage e o vídeo cai em "Pra editar".
// Os takes ficam guardados no aparelho (IndexedDB) enquanto não manda: fechar a página não perde nada.

type Parte = { nome: string; linhas: string[] };
type Musica = { id: string; nome: string; url: string | null };
type Take = { id: string; blob: Blob; tipo: string; duracao: number; inicio: number; fim: number; velocidade: number };
type Guardado = { takes: Take[]; ajustes: AjustesVideo; musica: { id: string; volume: number } | null };
type Pref = { fonte: number; ritmo: number };
type Estado = "parado" | "gravando" | "pausado";

const PREF = "gravador";
const RITMO_MIN = 0.4;
const RITMO_MAX = 2.5;
const TIPOS = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const seg = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const mb = (b: number) => `${(b / 1048576).toFixed(b > 10 * 1048576 ? 0 : 1)} MB`;

// ── guardado no aparelho (IndexedDB) ──────────────────────────────
function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((ok, falha) => {
    const r = indexedDB.open("gravador-criador", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("roteiros");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error);
  });
}
async function noAparelho<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  try {
    const db = await abrirBanco();
    return await new Promise<T | null>((ok) => {
      const req = fn(db.transaction("roteiros", modo).objectStore("roteiros"));
      req.onsuccess = () => ok((req.result as T) ?? null);
      req.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}
const lerGuardado = (chave: string) => noAparelho<Guardado>("readonly", (s) => s.get(chave));
const guardar = (chave: string, v: Guardado) => noAparelho("readwrite", (s) => s.put(v, chave));
const esquecer = (chave: string) => noAparelho("readwrite", (s) => s.delete(chave));

function lerPref(): Pref {
  let salvo: Partial<Pref> = {};
  try {
    salvo = JSON.parse(localStorage.getItem(PREF) ?? "{}");
  } catch {}
  return { fonte: salvo.fonte ?? Math.round(Math.min(44, Math.max(22, window.innerWidth / 14))), ritmo: salvo.ritmo ?? 1 };
}

const nada = () => () => {};

/** O vídeo sai sempre em pé, 9:16 (1080×1920), como o Reels. */
const SAIDA = { w: 1080, h: 1920 };

/**
 * Câmera que entrega o quadro deitado (webcam do computador, e alguns celulares mesmo com o
 * pedido de 1080×1920): grava por um canvas 9:16 com o centro do quadro (o mesmo recorte da
 * prévia). Já em pé, grava a câmera direto.
 */
function fluxoEmPe(fluxo: MediaStream, video: HTMLVideoElement | null): { fluxo: MediaStream; parar: () => void } {
  const w = video?.videoWidth ?? 0;
  const h = video?.videoHeight ?? 0;
  const canvas = document.createElement("canvas");
  if (!video || !w || !h || Math.abs(w / h - SAIDA.w / SAIDA.h) < 0.02 || typeof canvas.captureStream !== "function") return { fluxo, parar: () => {} };
  canvas.width = SAIDA.w;
  canvas.height = SAIDA.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { fluxo, parar: () => {} };
  let quadro = 0;
  const desenhar = () => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw && vh) {
      const alvo = SAIDA.w / SAIDA.h;
      const [sw, sh] = vw / vh > alvo ? [vh * alvo, vh] : [vw, vw / alvo];
      ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, SAIDA.w, SAIDA.h);
    }
    quadro = requestAnimationFrame(desenhar);
  };
  desenhar();
  const imagem = canvas.captureStream(30);
  const saida = new MediaStream([...imagem.getVideoTracks(), ...fluxo.getAudioTracks()]);
  return {
    fluxo: saida,
    parar: () => {
      cancelAnimationFrame(quadro);
      imagem.getTracks().forEach((t) => t.stop());
    },
  };
}

/** Só desenha no navegador: câmera, gravação e letra dependem do aparelho. */
export function Gravador(props: { roteiroId: string; versao: number; titulo: string; palavra: string | null; partes: Parte[]; segundos: number; musicas: Musica[] }) {
  const noNavegador = useSyncExternalStore(nada, () => true, () => false);
  return noNavegador ? <Tela {...props} /> : <div className="fixed inset-0 bg-black" />;
}

function Tela({ roteiroId, versao, titulo, palavra, partes, segundos, musicas: musicasIniciais }: { roteiroId: string; versao: number; titulo: string; palavra: string | null; partes: Parte[]; segundos: number; musicas: Musica[] }) {
  const router = useRouter();
  const camera = useRef<HTMLVideoElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const posicao = useRef(0);
  const inicioDoTake = useRef(0);
  const gravador = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const descartar = useRef(false);
  const tempo = useRef({ acumulado: 0, desde: 0 });

  const [fluxo, setFluxo] = useState<MediaStream | null>(null);
  const [frente, setFrente] = useState(true);
  const [erroCamera, setErroCamera] = useState<string | null>(() => (navigator.mediaDevices ? null : "Este navegador não abre a câmera. Abre pelo Chrome ou pelo Safari, no endereço https."));
  const [estado, setEstado] = useState<Estado>("parado");
  const [relogio, setRelogio] = useState(0);
  const [pref, setPref] = useState<Pref>(lerPref);
  const [takes, setTakes] = useState<Take[]>([]);
  const [ajustes, setAjustes] = useState<AjustesVideo>(AJUSTES_NEUTROS);
  const [musica, setMusica] = useState<{ id: string; volume: number } | null>(null);
  const [musicas, setMusicas] = useState<Musica[]>(musicasIniciais);
  const [revendo, setRevendo] = useState<{ take: Take; novo: boolean } | null>(null);
  const [tela, setTela] = useState<"camera" | "takes">("camera");
  const [carregou, setCarregou] = useState(false);
  const [envio, setEnvio] = useState<{ feito: number; total: number; texto: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // ── preferências e o que ficou guardado no aparelho ──
  useEffect(() => {
    try {
      localStorage.setItem(PREF, JSON.stringify(pref));
    } catch {}
  }, [pref]);
  useEffect(() => {
    lerGuardado(roteiroId).then((g) => {
      if (g) {
        setTakes(g.takes ?? []);
        setAjustes(g.ajustes ?? AJUSTES_NEUTROS);
        setMusica(g.musica ?? null);
      }
      setCarregou(true);
    });
  }, [roteiroId]);
  useEffect(() => {
    if (carregou) guardar(roteiroId, { takes, ajustes, musica });
  }, [carregou, roteiroId, takes, ajustes, musica]);

  // ── câmera ──
  useEffect(() => {
    if (!navigator.mediaDevices) return;
    let vivo = true;
    let atual: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: frente ? "user" : "environment", width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 }, frameRate: { ideal: 30 } },
        audio: { echoCancellation: false, noiseSuppression: true },
      })
      .then((s) => {
        if (!vivo) return s.getTracks().forEach((t) => t.stop());
        atual = s;
        setFluxo(s);
        setErroCamera(null);
      })
      .catch((e: Error) => setErroCamera(e.name === "NotAllowedError" ? "Libera a câmera e o microfone pro site (no cadeado da barra de endereço) e recarrega." : `Não consegui abrir a câmera: ${e.message}`));
    return () => {
      vivo = false;
      atual?.getTracks().forEach((t) => t.stop());
    };
  }, [frente]);
  useEffect(() => {
    if (camera.current && fluxo) camera.current.srcObject = fluxo;
  }, [fluxo, tela, revendo]);

  // Tela acesa enquanto o gravador está aberto
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;
    let trava: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((t) => (trava = t), () => {});
    return () => {
      trava?.release().catch(() => {});
    };
  }, []);

  // ── teleprompter: rola sozinho enquanto grava (px/s = altura do texto / segundos × ritmo) ──
  useEffect(() => {
    if (estado !== "gravando") return;
    const el = rolagem.current;
    const texto = conteudo.current;
    if (!el || !texto) return;
    posicao.current = el.scrollTop;
    const pxPorSegundo = (texto.offsetHeight / Math.max(10, segundos)) * pref.ritmo;
    let antes = performance.now();
    let quadro = 0;
    const passo = (agora: number) => {
      posicao.current += (pxPorSegundo * (agora - antes)) / 1000;
      antes = agora;
      el.scrollTop = posicao.current;
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [estado, pref.ritmo, segundos]);

  // relógio do take (sem contar as pausas)
  useEffect(() => {
    if (estado !== "gravando") return;
    const t = setInterval(() => setRelogio((tempo.current.acumulado + Date.now() - tempo.current.desde) / 1000), 250);
    return () => clearInterval(t);
  }, [estado]);

  const irPara = (k: number) => {
    const el = rolagem.current;
    const alvo = conteudo.current?.querySelector<HTMLElement>(`[data-parte="${k}"]`);
    if (el && alvo) {
      el.scrollTop = alvo.offsetTop;
      posicao.current = el.scrollTop;
    }
  };

  // ── gravação ──
  const comecar = useCallback(() => {
    if (!fluxo) return;
    const tipo = TIPOS.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) ?? "";
    let rec: MediaRecorder;
    const emPe = fluxoEmPe(fluxo, camera.current);
    try {
      rec = new MediaRecorder(emPe.fluxo, { ...(tipo ? { mimeType: tipo } : {}), videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 160_000 });
    } catch (e) {
      emPe.parar();
      return setErro(`Este navegador não grava vídeo: ${(e as Error).message}`);
    }
    pedacos.current = [];
    descartar.current = false;
    inicioDoTake.current = rolagem.current?.scrollTop ?? 0;
    rec.ondataavailable = (e) => e.data.size && pedacos.current.push(e.data);
    rec.onstop = () => {
      emPe.parar();
      const duracao = (tempo.current.acumulado + (tempo.current.desde ? Date.now() - tempo.current.desde : 0)) / 1000;
      tempo.current = { acumulado: 0, desde: 0 };
      setEstado("parado");
      setRelogio(0);
      if (descartar.current || !pedacos.current.length) return;
      const blob = new Blob(pedacos.current, { type: rec.mimeType || tipo || "video/webm" });
      const take: Take = { id: crypto.randomUUID(), blob, tipo: blob.type, duracao, inicio: 0, fim: duracao, velocidade: 1 };
      setRevendo({ take, novo: true });
    };
    gravador.current = rec;
    tempo.current = { acumulado: 0, desde: Date.now() };
    rec.start(1000);
    setEstado("gravando");
  }, [fluxo]);

  const pausarOuContinuar = () => {
    const rec = gravador.current;
    if (estado === "parado") return comecar();
    if (!rec) return;
    if (estado === "gravando") {
      rec.pause();
      tempo.current = { acumulado: tempo.current.acumulado + Date.now() - tempo.current.desde, desde: 0 };
      setEstado("pausado");
    } else {
      rec.resume();
      tempo.current = { ...tempo.current, desde: Date.now() };
      setEstado("gravando");
    }
  };
  /** Joga fora o take que está gravando e volta o teleprompter pro começo dele. */
  const recomecar = () => {
    descartar.current = true;
    gravador.current?.stop();
    if (rolagem.current) rolagem.current.scrollTop = inicioDoTake.current;
    posicao.current = inicioDoTake.current;
  };
  const salvarTake = () => {
    descartar.current = false;
    if (estado === "pausado") tempo.current = { ...tempo.current, desde: 0 };
    gravador.current?.stop();
  };

  // ── takes ──
  const usarTake = (t: Take) => {
    setTakes((ts) => (ts.some((x) => x.id === t.id) ? ts.map((x) => (x.id === t.id ? t : x)) : [...ts, t]));
    setRevendo(null);
  };
  const regravar = () => {
    if (revendo?.novo) soltarTake(revendo.take.blob);
    if (rolagem.current) rolagem.current.scrollTop = inicioDoTake.current;
    posicao.current = inicioDoTake.current;
    setRevendo(null);
    setTela("camera");
  };
  const mover = (k: number, d: number) =>
    setTakes((ts) => {
      const n = [...ts];
      const j = k + d;
      if (j < 0 || j >= n.length) return ts;
      [n[k], n[j]] = [n[j], n[k]];
      return n;
    });
  const mudarTake = (id: string, campos: Partial<Take>) => setTakes((ts) => ts.map((t) => (t.id === id ? { ...t, ...campos } : t)));
  const total = takes.reduce((s, t) => s + Math.max(0, t.fim - t.inicio) / t.velocidade, 0);

  // ── música nova ──
  async function subirMusica(arquivo: File) {
    setErro(null);
    const duracao = await new Promise<number | null>((ok) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => ok(Number.isFinite(a.duration) ? Math.round(a.duration) : null);
      a.onerror = () => ok(null);
      a.src = URL.createObjectURL(arquivo);
    });
    const l = await linkMusica(arquivo.name, arquivo.type, arquivo.size);
    if ("erro" in l) return setErro(l.erro);
    try {
      await subirParte(l.url, arquivo, () => {});
    } catch (e) {
      return setErro((e as Error).message);
    }
    const r = await salvarMusica({ nome: arquivo.name.replace(/\.[^.]+$/, ""), caminho: l.caminho, tipo: arquivo.type, tamanho: arquivo.size, duracao });
    if ("erro" in r) return setErro(r.erro);
    setMusicas((ms) => [{ id: r.id, nome: arquivo.name.replace(/\.[^.]+$/, ""), url: r.url }, ...ms]);
    setMusica({ id: r.id, volume: musica?.volume ?? 0.15 });
  }

  // ── mandar pra edição ──
  async function mandar() {
    setErro(null);
    if (!takes.length) return setErro("Grave pelo menos um take.");
    const ext = (t: Take) => (t.tipo.includes("mp4") ? "mp4" : "webm");
    const pedido: PedidoGravacao = {
      roteiroId,
      versao,
      titulo,
      takes: takes.map((t, k) => ({ nome: `take-${k + 1}.${ext(t)}`, tamanho: t.blob.size, tipo: t.tipo, partes: partesDe(t.blob.size), inicio: t.inicio, fim: t.fim, velocidade: t.velocidade })),
      ajustes,
      musica,
    };
    const bytes = takes.reduce((s, t) => s + t.blob.size, 0);
    try {
      setEnvio({ feito: 0, total: bytes, texto: "Preparando o envio…" });
      const r = await criarGravacao(pedido);
      if ("erro" in r) throw new Error(r.erro);
      let feito = 0;
      for (const [k, t] of takes.entries()) {
        const texto = `Subindo o take ${k + 1} de ${takes.length}…`;
        for (const [i, envio] of r.takes[k].entries()) {
          const parte = t.blob.slice(i * PARTE_BYTES, Math.min(t.blob.size, (i + 1) * PARTE_BYTES));
          for (let tentativa = 1; ; tentativa++) {
            try {
              await subirParte(envio.url, parte, (b) => setEnvio({ feito: feito + b, total: bytes, texto }));
              break;
            } catch (e) {
              if (tentativa >= 3) throw e;
              await new Promise((ok) => setTimeout(ok, 2000 * tentativa));
            }
          }
          feito += parte.size;
        }
      }
      setEnvio({ feito: bytes, total: bytes, texto: "Mandando pra esteira…" });
      const c = await confirmarGravacao(r.id);
      if (c.erro) throw new Error(c.erro);
      await esquecer(roteiroId);
      router.push(`/editor/${r.id}`);
    } catch (e) {
      setErro(`${(e as Error).message} (os takes continuam guardados no aparelho: dá pra tentar de novo)`);
      setEnvio(null);
    }
  }

  const botao = "flex h-11 min-w-11 items-center justify-center rounded-xl border-2 border-white/15 bg-black/40 px-3 text-sm font-bold text-white backdrop-blur active:bg-white/20";
  const mudarPref = (c: Partial<Pref>) => setPref((p) => ({ ...p, ...c }));

  // ── revisão de um take (logo depois de gravar, ou "cortar" na lista) ──
  const revisao = revendo ? <RevisaoTake key={revendo.take.id} take={revendo.take} novo={revendo.novo} ajustes={ajustes} aoUsar={usarTake} aoRegravar={regravar} aoVoltar={() => setRevendo(null)} /> : null;

  // ── a lista dos takes (por cima da câmera: o teleprompter fica onde parou) ──
  const listaDeTakes =
    tela !== "takes" ? null : (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-fundo text-texto">
        <div className="mx-auto max-w-xl space-y-4 p-4 pb-[max(env(safe-area-inset-bottom),24px)]">
          <header className="flex items-center justify-between gap-3">
            <button type="button" className="btn btn-sm btn-2" onClick={() => setTela("camera")} disabled={Boolean(envio)}>
              ← Gravar mais
            </button>
            <p className="font-mono text-xs text-suave">
              {takes.length} take(s) · ~{seg(total)}
            </p>
          </header>
          <h1 className="titulo text-xl">{titulo}</h1>

          <section className="space-y-2">
            <h2 className="rotulo">Takes, na ordem do vídeo</h2>
            {!takes.length && <p className="text-sm text-apagado">Nenhum take ainda. Volta pra câmera e grava a primeira parte.</p>}
            {takes.map((t, k) => (
              <div key={t.id} className="card flex gap-3 p-2">
                <MiniTake take={t} ajustes={ajustes} />
                <div className="min-w-0 flex-1 space-y-2 text-sm">
                  <p className="font-bold">
                    Take {k + 1} <span className="font-mono text-xs font-normal text-suave">· {seg((t.fim - t.inicio) / t.velocidade)} · {mb(t.blob.size)}</span>
                  </p>
                  <label className="flex items-center gap-2 text-xs text-suave">
                    velocidade
                    <select className="campo w-auto py-1" value={t.velocidade} onChange={(e) => mudarTake(t.id, { velocidade: Number(e.target.value) })} disabled={Boolean(envio)}>
                      {VELOCIDADES.map((v) => (
                        <option key={v} value={v}>
                          {String(v).replace(".", ",")}x
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" className="btn btn-sm btn-2" onClick={() => setRevendo({ take: t, novo: false })} disabled={Boolean(envio)}>
                      Cortar
                    </button>
                    <button type="button" className="btn btn-sm btn-2" onClick={() => mover(k, -1)} disabled={k === 0 || Boolean(envio)} aria-label="Subir">
                      ↑
                    </button>
                    <button type="button" className="btn btn-sm btn-2" onClick={() => mover(k, 1)} disabled={k === takes.length - 1 || Boolean(envio)} aria-label="Descer">
                      ↓
                    </button>
                    <button type="button" className="btn btn-sm btn-perigo" onClick={() => {
                        soltarTake(t.blob);
                        setTakes((ts) => ts.filter((x) => x.id !== t.id));
                      }} disabled={Boolean(envio)}>
                      Apagar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="rotulo">Ajustar</h2>
            {(
              [
                ["brilho", "Brilho", -1, 1],
                ["iluminacao", "Iluminação", -1, 1],
                ["nitidez", "Nitidez", 0, 1],
              ] as const
            ).map(([chave, nome, min, max]) => (
              <label key={chave} className="block text-sm">
                <span className="flex justify-between">
                  {nome} <span className="font-mono text-xs text-suave">{Math.round(ajustes[chave] * 100)}</span>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={0.05}
                  value={ajustes[chave]}
                  onChange={(e) => setAjustes((a) => ({ ...a, [chave]: Number(e.target.value) }))}
                  className="w-full accent-[var(--color-marca)]"
                  disabled={Boolean(envio)}
                />
              </label>
            ))}
            <button type="button" className="text-xs text-suave underline" onClick={() => setAjustes(AJUSTES_NEUTROS)} disabled={Boolean(envio)}>
              voltar ao original
            </button>
            <p className="text-xs text-apagado">A prévia nos takes é aproximada. O ajuste de verdade é feito na junção dos takes, na estação.</p>
          </section>

          <section className="card space-y-3 p-4">
            <h2 className="rotulo">Música de fundo</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="musica" checked={!musica} onChange={() => setMusica(null)} disabled={Boolean(envio)} /> sem música
            </label>
            {musicas.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <input type="radio" name="musica" checked={musica?.id === m.id} onChange={() => setMusica({ id: m.id, volume: musica?.volume ?? 0.15 })} disabled={Boolean(envio)} />
                  <span className="truncate">{m.nome}</span>
                </label>
                {m.url && <audio src={m.url} controls preload="none" className="h-8 w-40 shrink-0" />}
              </div>
            ))}
            {musica && (
              <label className="block text-sm">
                <span className="flex justify-between">
                  Volume da música <span className="font-mono text-xs text-suave">{Math.round(musica.volume * 100)}%</span>
                </span>
                <input type="range" min={0.03} max={0.6} step={0.01} value={musica.volume} onChange={(e) => setMusica({ ...musica, volume: Number(e.target.value) })} className="w-full accent-[var(--color-marca)]" />
              </label>
            )}
            <label className="btn btn-sm btn-2 cursor-pointer">
              + Subir música minha
              <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && subirMusica(e.target.files[0])} disabled={Boolean(envio)} />
            </label>
            <p className="text-xs text-apagado">A música entra por baixo da voz no fim da edição. As que você sobe ficam na biblioteca pros próximos vídeos.</p>
          </section>

          {erro && <p className="rounded-lg bg-quente/10 px-3 py-2 text-sm text-quente">{erro}</p>}
          {envio ? (
            <div className="card space-y-2 p-4">
              <div className="flex justify-between text-sm">
                <span>{envio.texto}</span>
                <span className="font-mono text-xs text-suave">
                  {mb(envio.feito)} de {mb(envio.total)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border-2 border-tinta bg-fundo">
                <div className="h-full bg-marca transition-all" style={{ width: `${Math.min(100, (envio.feito / Math.max(1, envio.total)) * 100)}%` }} />
              </div>
              <p className="text-xs text-apagado">Não feche a página até terminar de subir.</p>
            </div>
          ) : (
            <button type="button" className="btn w-full" onClick={mandar} disabled={!takes.length}>
              Mandar pra edição
            </button>
          )}
          <p className="text-xs text-apagado">
            Vai pra coluna “Pra editar” da esteira, onde você escolhe o estilo de edição. Os takes são juntados na ordem acima{palavra ? `, e a palavra do comenta é ${palavra}` : ""}.
          </p>
        </div>
      </div>
    );

  // ── câmera com o teleprompter ──
  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black text-white">
      {/* a prévia é o quadro 9:16 que vai ser gravado, inteiro: no computador sobram as laterais pretas */}
      <video
        ref={camera}
        autoPlay
        playsInline
        muted
        className="absolute left-1/2 top-1/2 max-w-none object-cover"
        style={{ width: "min(100vw, calc(100dvh * 9 / 16))", aspectRatio: "9 / 16", transform: `translate(-50%, -50%)${frente ? " scaleX(-1)" : ""}` }}
      />
      {erroCamera && <p className="absolute inset-x-4 top-1/2 z-40 -translate-y-1/2 rounded-xl bg-black/80 p-4 text-center text-sm">{erroCamera}</p>}

      {/* teleprompter na parte de cima, perto da lente */}
      <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/80 via-black/60 to-transparent pt-[max(env(safe-area-inset-top),8px)]" style={{ height: "46vh" }}>
        <div className="flex items-center justify-between gap-2 px-3">
          <Link href="/esteira?aba=reels" className={botao} aria-label="Sair">
            ✕
          </Link>
          <div className="flex gap-1">
            {partes.map((p, k) => (
              <button key={p.nome} type="button" className="rounded-lg border border-white/20 px-2 py-1 font-mono text-[10px] font-bold tracking-widest text-white/80" onClick={() => irPara(k)} disabled={estado === "gravando"}>
                {p.nome}
              </button>
            ))}
          </div>
          <span className="font-mono text-xs text-white/70">{pref.ritmo.toFixed(1).replace(".", ",")}x</span>
        </div>
        <div className="pointer-events-none absolute inset-x-0 z-20 border-y border-marca/50 bg-marca/10" style={{ top: `calc(max(env(safe-area-inset-top),8px) + 48px + ${pref.fonte * 0.2}px)`, height: pref.fonte * 1.45 }} />
        <div ref={rolagem} className="absolute inset-x-0 bottom-0 overflow-y-auto" style={{ top: "calc(max(env(safe-area-inset-top),8px) + 48px)", touchAction: estado === "gravando" ? "none" : "pan-y" }}>
          <div ref={conteudo} className="px-5 pb-[40vh] text-center" style={{ fontSize: pref.fonte, lineHeight: 1.45 }}>
            {partes.map((p, k) => (
              <div key={p.nome} data-parte={k} className="pb-[0.8em] pt-[0.2em]">
                <p className="font-mono text-[0.32em] font-bold tracking-[0.3em] text-marca/80">{p.nome}</p>
                {p.linhas.map((l, i) => (
                  <p key={i} className="font-semibold [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">
                    {l}
                  </p>
                ))}
              </div>
            ))}
            <p className="font-mono text-[0.32em] tracking-[0.3em] text-white/40">FIM</p>
          </div>
        </div>
      </div>

      {/* controles de baixo */}
      <div className="absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/85 to-transparent px-3 pb-[max(env(safe-area-inset-bottom),14px)] pt-10">
        {erro && <p className="mb-2 rounded-lg bg-quente/80 px-3 py-2 text-sm">{erro}</p>}
        <div className="mb-3 flex items-center justify-center gap-2 text-xs">
          <button type="button" className={botao} onClick={() => mudarPref({ ritmo: Math.max(RITMO_MIN, +(pref.ritmo - 0.1).toFixed(1)) })} aria-label="Teleprompter mais devagar">
            −
          </button>
          <span className="w-16 text-center text-white/70">velocidade</span>
          <button type="button" className={botao} onClick={() => mudarPref({ ritmo: Math.min(RITMO_MAX, +(pref.ritmo + 0.1).toFixed(1)) })} aria-label="Teleprompter mais rápido">
            +
          </button>
          <span className="w-3" />
          <button type="button" className={botao} onClick={() => mudarPref({ fonte: Math.max(16, pref.fonte - 3) })} aria-label="Letra menor">
            A−
          </button>
          <button type="button" className={botao} onClick={() => mudarPref({ fonte: Math.min(80, pref.fonte + 3) })} aria-label="Letra maior">
            A+
          </button>
        </div>
        <p className="mb-2 text-center font-mono text-sm">
          {estado === "parado" ? (takes.length ? `${takes.length} take(s) gravado(s)` : "pronto pra gravar") : `${estado === "pausado" ? "pausado · " : "● "}${seg(relogio)}`}
        </p>
        <div className="mx-auto flex max-w-md items-center justify-between">
          {estado === "parado" ? (
            <button type="button" className={`${botao} w-24`} onClick={() => setTela("takes")}>
              Takes ({takes.length})
            </button>
          ) : (
            <button type="button" className={`${botao} w-24`} onClick={recomecar}>
              ⟲ Recomeçar
            </button>
          )}
          <button
            type="button"
            onClick={pausarOuContinuar}
            disabled={!fluxo}
            aria-label={estado === "gravando" ? "Pausar" : estado === "pausado" ? "Continuar" : "Gravar"}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-transparent disabled:opacity-40"
          >
            {estado === "gravando" ? <span className="h-8 w-8 rounded-md bg-white" /> : <span className={`rounded-full bg-red-600 ${estado === "pausado" ? "h-10 w-10 animate-pulse" : "h-14 w-14"}`} />}
          </button>
          {estado === "parado" ? (
            <button type="button" className={`${botao} w-24`} onClick={() => setFrente((f) => !f)} aria-label="Trocar câmera">
              ⇄ Câmera
            </button>
          ) : (
            <button type="button" className={`${botao} w-24 border-marca text-marca`} onClick={salvarTake}>
              ✓ Salvar
            </button>
          )}
        </div>
        {estado === "parado" && takes.length > 0 && (
          <button type="button" className="mx-auto mt-3 block rounded-xl bg-marca px-5 py-2.5 text-sm font-black text-black" onClick={() => setTela("takes")}>
            Revisar e mandar pra edição →
          </button>
        )}
      </div>
      {listaDeTakes}
      {revisao}
    </div>
  );
}

/** Um link por take (o mesmo na miniatura e na revisão); solto quando o take sai. */
const urls = new WeakMap<Blob, string>();
function urlDoTake(blob: Blob): string {
  let u = urls.get(blob);
  if (!u) {
    u = URL.createObjectURL(blob);
    urls.set(blob, u);
  }
  return u;
}
function soltarTake(blob: Blob) {
  const u = urls.get(blob);
  if (u) URL.revokeObjectURL(u);
  urls.delete(blob);
}

/** Miniatura que mostra o take com os ajustes (a prévia da cor). */
function MiniTake({ take, ajustes }: { take: Take; ajustes: AjustesVideo }) {
  return (
    <video
      src={`${urlDoTake(take.blob)}#t=${Math.max(0.1, take.inicio + 0.1)}`}
      preload="metadata"
      muted
      playsInline
      className="h-32 w-[72px] shrink-0 rounded-lg bg-black object-cover"
      style={{ filter: filtroCss(ajustes) }}
    />
  );
}

/**
 * O take logo depois de gravar (ou "Cortar" na lista): corta o começo e o fim (os silêncios), confere
 * na velocidade escolhida e decide: usar ou apagar e regravar.
 */
function RevisaoTake({ take, novo, ajustes, aoUsar, aoRegravar, aoVoltar }: { take: Take; novo: boolean; ajustes: AjustesVideo; aoUsar: (t: Take) => void; aoRegravar: () => void; aoVoltar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const url = urlDoTake(take.blob);
  const [duracao, setDuracao] = useState(take.duracao);
  const [inicio, setInicio] = useState(take.inicio);
  const [fim, setFim] = useState(take.fim);
  const [velocidade, setVelocidade] = useState(take.velocidade);
  const [tocando, setTocando] = useState(false);

  // MP4 traz a duração; o WebM do Chrome às vezes vem como Infinity (aí vale o relógio da gravação)
  const aoCarregar = () => {
    const d = video.current?.duration;
    if (d && Number.isFinite(d)) {
      setDuracao(d);
      if (novo) setFim(d);
    }
    if (video.current) video.current.currentTime = inicio;
  };
  useEffect(() => {
    if (video.current) video.current.playbackRate = velocidade;
  }, [velocidade]);

  const tocar = () => {
    const v = video.current;
    if (!v) return;
    if (tocando) {
      v.pause();
      return setTocando(false);
    }
    v.currentTime = inicio;
    v.play().then(() => setTocando(true), () => {});
  };
  const aoAndar = () => {
    const v = video.current;
    if (v && v.currentTime >= fim) {
      v.pause();
      v.currentTime = fim;
      setTocando(false);
    }
  };
  const ver = (t: number) => {
    if (video.current) video.current.currentTime = t;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black text-white">
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-3 p-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <p className="text-center font-mono text-xs text-white/60">{novo ? "take gravado: corta o começo e o fim" : "cortar o take"}</p>
        {url && (
          <video
            ref={video}
            src={url}
            playsInline
            preload="auto"
            onLoadedMetadata={aoCarregar}
            onTimeUpdate={aoAndar}
            onEnded={() => setTocando(false)}
            onClick={tocar}
            className="mx-auto max-h-[52vh] w-auto rounded-2xl bg-black"
            style={{ filter: filtroCss(ajustes) }}
          />
        )}
        <button type="button" onClick={tocar} className="mx-auto rounded-xl border-2 border-white/20 px-5 py-2 text-sm font-bold">
          {tocando ? "Pausar" : "▶ Ver com o corte"}
        </button>
        <label className="block text-sm">
          <span className="flex justify-between">
            Começa em <span className="font-mono text-xs text-white/70">{inicio.toFixed(1)} s</span>
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duracao)}
            step={0.05}
            value={inicio}
            onChange={(e) => {
              const v = Math.min(Number(e.target.value), fim - 0.3);
              setInicio(Math.max(0, v));
              ver(Math.max(0, v));
            }}
            className="w-full accent-[var(--color-marca)]"
          />
        </label>
        <label className="block text-sm">
          <span className="flex justify-between">
            Termina em <span className="font-mono text-xs text-white/70">{fim.toFixed(1)} s</span>
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(0.1, duracao)}
            step={0.05}
            value={fim}
            onChange={(e) => {
              const v = Math.max(Number(e.target.value), inicio + 0.3);
              setFim(Math.min(duracao, v));
              ver(Math.min(duracao, v));
            }}
            className="w-full accent-[var(--color-marca)]"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm">
          Velocidade do take
          <select className="campo w-auto py-1 text-texto" value={velocidade} onChange={(e) => setVelocidade(Number(e.target.value))}>
            {VELOCIDADES.map((v) => (
              <option key={v} value={v}>
                {String(v).replace(".", ",")}x
              </option>
            ))}
          </select>
        </label>
        <p className="text-center font-mono text-xs text-white/60">fica com {((fim - inicio) / velocidade).toFixed(1)} s</p>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
          {novo ? (
            <button type="button" onClick={aoRegravar} className="rounded-xl border-2 border-white/20 py-3 text-sm font-bold">
              Apagar e regravar
            </button>
          ) : (
            <button type="button" onClick={aoVoltar} className="rounded-xl border-2 border-white/20 py-3 text-sm font-bold">
              Voltar
            </button>
          )}
          <button type="button" onClick={() => aoUsar({ ...take, duracao, inicio, fim: Math.min(fim, duracao), velocidade })} className="rounded-xl bg-marca py-3 text-sm font-black text-black">
            {novo ? "Usar este take" : "Salvar o corte"}
          </button>
        </div>
      </div>
    </div>
  );
}
