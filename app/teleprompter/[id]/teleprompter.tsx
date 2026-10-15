"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Teleprompter na tela, pensado pro celular e pro tablet: texto grande, faixa de leitura,
// rolagem sozinha calibrada pela duração estimada do roteiro (na velocidade 1,0x termina no tempo
// estimado), espelhar (pra vidro de teleprompter), tela sempre acesa. Toque no texto pausa e continua.

type Parte = { nome: string; linhas: string[] };
type Preferencias = { fonte: number; ritmo: number; espelho: boolean };

const CHAVE = "teleprompter";
const RITMO_MIN = 0.4;
const RITMO_MAX = 2.5;

/** Preferências do aparelho (fonte, velocidade, espelho); a letra começa pelo tamanho da tela. */
function lerPreferencias(): Preferencias {
  let salvo: Partial<Preferencias> = {};
  try {
    salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "{}");
  } catch {}
  return {
    fonte: salvo.fonte ?? Math.round(Math.min(64, Math.max(28, window.innerWidth / 11))),
    ritmo: salvo.ritmo ?? 1,
    espelho: salvo.espelho ?? false,
  };
}

const nada = () => () => {};

/** Só desenha no navegador: a letra e a velocidade dependem do aparelho. */
export function Teleprompter(props: { id: string; versao: number; partes: Parte[]; segundos: number }) {
  const noNavegador = useSyncExternalStore(nada, () => true, () => false);
  return noNavegador ? <Tela {...props} /> : <div className="fixed inset-0 bg-black" />;
}

function Tela({ id, versao, partes, segundos }: { id: string; versao: number; partes: Parte[]; segundos: number }) {
  const rolagem = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const posicao = useRef(0);
  const [pref, setPref] = useState<Preferencias>(lerPreferencias);
  const [rodando, setRodando] = useState(false);
  const [contagem, setContagem] = useState<number | null>(null);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(pref));
    } catch {}
  }, [pref]);
  const mudar = (campos: Partial<Preferencias>) => setPref((p) => ({ ...p, ...campos }));

  // Rolagem: px por segundo = altura do texto / segundos estimados × ritmo
  useEffect(() => {
    if (!rodando) return;
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
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) return setRodando(false);
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [rodando, pref, segundos]);

  // Tela acesa enquanto roda
  useEffect(() => {
    if (!rodando || !("wakeLock" in navigator)) return;
    let trava: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((t) => (trava = t), () => {});
    return () => {
      trava?.release().catch(() => {});
    };
  }, [rodando]);

  // Contagem 3, 2, 1 antes de começar do início
  useEffect(() => {
    if (contagem === null) return;
    const t = setTimeout(() => {
      if (contagem > 1) return setContagem(contagem - 1);
      setContagem(null);
      setRodando(true);
    }, 800);
    return () => clearTimeout(t);
  }, [contagem]);

  const alternar = useCallback(() => {
    if (contagem !== null) return setContagem(null);
    if (rodando) return setRodando(false);
    const el = rolagem.current;
    if (el && el.scrollTop < 4) setContagem(3);
    else setRodando(true);
  }, [rodando, contagem]);

  const voltarAoInicio = () => {
    setRodando(false);
    setContagem(null);
    if (rolagem.current) rolagem.current.scrollTop = 0;
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        alternar();
      } else if (e.key === "ArrowUp") mudar({ ritmo: Math.min(RITMO_MAX, +(pref.ritmo + 0.1).toFixed(1)) });
      else if (e.key === "ArrowDown") mudar({ ritmo: Math.max(RITMO_MIN, +(pref.ritmo - 0.1).toFixed(1)) });
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [alternar, pref]);

  const aoRolar = () => {
    const el = rolagem.current;
    if (!el) return;
    if (!rodando) posicao.current = el.scrollTop;
    setProgresso(el.scrollHeight > el.clientHeight ? el.scrollTop / (el.scrollHeight - el.clientHeight) : 0);
  };

  const restante = Math.max(0, Math.round((segundos * (1 - progresso)) / pref.ritmo));
  const botao = "flex h-12 min-w-12 items-center justify-center rounded-xl border-2 border-white/15 bg-white/5 px-3 text-sm font-bold text-white active:bg-white/20";

  return (
    <div className="fixed inset-0 select-none bg-black text-white">
      {/* faixa de leitura */}
      <div className="pointer-events-none fixed inset-x-0 z-10 border-y border-marca/40 bg-marca/10" style={{ top: "30vh", height: pref.fonte * 1.5 }} />
      <div className="pointer-events-none fixed left-1 z-10 text-marca" style={{ top: `calc(30vh + ${pref.fonte * 0.75}px - 0.6em)` }}>
        ▶
      </div>

      <div ref={rolagem} onScroll={aoRolar} onClick={alternar} className="absolute inset-0 overflow-y-auto" style={{ paddingTop: `calc(30vh - ${Math.round(pref.fonte * 0.48)}px)`, paddingBottom: "75vh" }}>
        <div ref={conteudo} className="mx-auto max-w-4xl px-6 sm:px-10" style={{ fontSize: pref.fonte, lineHeight: 1.5, transform: pref.espelho ? "scaleX(-1)" : undefined }}>
          {partes.map((p) => (
            <div key={p.nome} className="mb-[1.2em]">
              <p className="font-mono text-[0.32em] font-bold tracking-[0.3em] text-marca/70">{p.nome}</p>
              {p.linhas.map((l, i) => (
                <p key={i} className="font-semibold">
                  {l}
                </p>
              ))}
            </div>
          ))}
          <p className="font-mono text-[0.32em] tracking-[0.3em] text-white/40">FIM</p>
        </div>
      </div>

      {contagem !== null && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center text-[30vw] font-black text-marca/90">{contagem || ""}</div>
      )}

      {/* controles: somem enquanto roda (toque no texto pausa e eles voltam) */}
      <div
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/85 px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 backdrop-blur transition-opacity ${rodando ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2">
          <Link href={`/roteiros/${id}?v=${versao}`} className={botao} aria-label="Sair">
            ✕
          </Link>
          <button type="button" className={botao} onClick={voltarAoInicio} aria-label="Voltar ao início">
            ⟲
          </button>
          <button type="button" className={botao} onClick={() => mudar({ ritmo: Math.max(RITMO_MIN, +(pref.ritmo - 0.1).toFixed(1)) })} aria-label="Mais devagar">
            −
          </button>
          <button type="button" onClick={alternar} className="flex h-14 min-w-24 items-center justify-center rounded-2xl border-2 border-black bg-marca px-4 text-base font-black text-black shadow-[0_4px_0_#000]">
            {rodando ? "Pausar" : "Rodar"}
          </button>
          <button type="button" className={botao} onClick={() => mudar({ ritmo: Math.min(RITMO_MAX, +(pref.ritmo + 0.1).toFixed(1)) })} aria-label="Mais rápido">
            +
          </button>
          <span className="w-14 text-center font-mono text-xs text-white/70">{pref.ritmo.toFixed(1).replace(".", ",")}x</span>
        </div>
        <div className="mx-auto mt-2 flex max-w-xl flex-wrap items-center justify-center gap-2 text-xs">
          <button type="button" className={botao} onClick={() => mudar({ fonte: Math.max(20, pref.fonte - 4) })} aria-label="Letra menor">
            A−
          </button>
          <button type="button" className={botao} onClick={() => mudar({ fonte: Math.min(120, pref.fonte + 4) })} aria-label="Letra maior">
            A+
          </button>
          <button type="button" className={`${botao} ${pref.espelho ? "border-marca text-marca" : ""}`} onClick={() => mudar({ espelho: !pref.espelho })}>
            Espelhar
          </button>
          <span className="font-mono text-white/60">~{restante} s</span>
        </div>
      </div>
    </div>
  );
}
