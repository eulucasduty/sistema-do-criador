import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { lerPerfil } from "@/lib/config";
import type { CopiaCarrossel, Slide } from "./criacao";

// Um slide da cópia de carrossel em PNG 1080x1350 (o tamanho do feed 4:5). Gerado pelo
// next/og (Satori): leve, sem navegador e sem ffmpeg. O visual vem do estilo copiado da
// referência (ou da sua marca): cores, tipo de letra do título, caixa alta.
// Rodapé com a sua foto e o seu @ em todo slide; "arrasta →" na capa.

const L = 1080;
const A = 1350;
const P = 88;

type Fonte = { name: string; data: ArrayBuffer; weight: 400 | 500 | 700 | 800; style: "normal" };

let fontes: Promise<Fonte[]> | null = null;
let avatar: { url: string; dado: Promise<string | null> } | null = null;

const ler = (arquivo: string) => readFile(path.join(process.cwd(), "public", arquivo));

function carregarFontes(): Promise<Fonte[]> {
  fontes ??= Promise.all(
    (
      [
        ["Lilita", "fontes/lilita-one-latin-400-normal.woff", 400],
        ["Jakarta", "fontes/plus-jakarta-sans-latin-500-normal.woff", 500],
        ["Jakarta", "fontes/plus-jakarta-sans-latin-700-normal.woff", 700],
        ["Jakarta", "fontes/plus-jakarta-sans-latin-800-normal.woff", 800],
        ["Playfair", "fontes/playfair-display-latin-700-normal.woff", 700],
        ["Mono", "fontes/jetbrains-mono-latin-500-normal.woff", 500],
      ] as const
    ).map(async ([name, arquivo, weight]) => {
      const b = await ler(arquivo);
      return { name, weight, style: "normal" as const, data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
    }),
  );
  return fontes;
}

/** A sua foto de perfil (vem do Instagram quando você conecta). Guardada enquanto o link não mudar. */
function carregarAvatar(url: string | null): Promise<string | null> {
  if (!url) return Promise.resolve(null);
  if (avatar?.url !== url) {
    avatar = {
      url,
      dado: fetch(url, { signal: AbortSignal.timeout(10_000) })
        .then(async (r) => (r.ok ? `data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : null))
        .catch(() => null),
    };
  }
  return avatar.dado;
}

function tamanhoTitulo(texto: string, capa: boolean): number {
  const n = texto.length;
  if (capa) return n <= 18 ? 132 : n <= 32 ? 110 : n <= 52 ? 90 : 74;
  return n <= 18 ? 100 : n <= 32 ? 86 : n <= 52 ? 70 : 58;
}

export async function renderizarSlide(copia: CopiaCarrossel, indice: number): Promise<ImageResponse> {
  const perfil = await lerPerfil();
  const [fs, foto] = await Promise.all([carregarFontes(), carregarAvatar(perfil.foto_url)]);
  const e = copia.estilo;
  const s: Slide = copia.slides[indice] ?? copia.slides[0];
  const total = copia.slides.length;
  const capa = s.tipo === "capa";
  const familiaTitulo = e.fonte_titulo === "display" ? "Lilita" : e.fonte_titulo === "serif" ? "Playfair" : "Jakarta";
  const pesoTitulo = e.fonte_titulo === "display" ? 400 : e.fonte_titulo === "serif" ? 700 : 800;
  const titulo = e.caixa_alta ? s.titulo.toUpperCase() : s.titulo;
  const muitos = (s.itens?.length ?? 0) > 5; // lista longa: letra e espaço menores

  const corpo = (texto: string, tamanho = 42) => (
    <div style={{ display: "flex", fontFamily: "Jakarta", fontWeight: 500, fontSize: tamanho, lineHeight: 1.4, opacity: 0.88, whiteSpace: "pre-line" }}>
      {texto}
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: L,
          height: A,
          display: "flex",
          flexDirection: "column",
          background: e.fundo,
          color: e.texto,
          padding: P,
          fontFamily: "Jakarta",
        }}
      >
        {/* topo: kicker */}
        {s.kicker ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 36 }}>
            <div style={{ display: "flex", fontFamily: "Jakarta", fontWeight: 800, fontSize: 30, letterSpacing: 4, color: e.destaque, textTransform: "uppercase" }}>
              {s.kicker}
            </div>
            <div style={{ display: "flex", width: 72, height: 6, background: e.destaque, borderRadius: 3 }} />
          </div>
        ) : (
          <div style={{ display: "flex", height: 12 }} />
        )}

        {/* miolo */}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: capa ? "center" : "flex-start", gap: 36 }}>
          <div
            style={{
              display: "flex",
              fontFamily: familiaTitulo,
              fontWeight: pesoTitulo,
              fontSize: tamanhoTitulo(titulo, capa),
              lineHeight: e.fonte_titulo === "display" ? 1.0 : 1.08,
              letterSpacing: e.fonte_titulo === "display" ? 1 : -1,
              whiteSpace: "pre-line",
            }}
          >
            {titulo}
          </div>

          {capa && s.subtitulo ? corpo(s.subtitulo, 46) : null}
          {s.tipo === "texto" && s.texto ? corpo(s.texto, s.texto.length < 160 ? 48 : s.texto.length < 240 ? 44 : 40) : null}

          {s.tipo === "lista" && (s.itens?.length ?? 0) > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: muitos ? 18 : 26 }}>
              {(s.itens ?? []).map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 26 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 64,
                      height: 64,
                      flexShrink: 0,
                      borderRadius: 32,
                      background: e.destaque,
                      color: e.fundo,
                      fontFamily: "Jakarta",
                      fontWeight: 800,
                      fontSize: 32,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ display: "flex", fontFamily: "Jakarta", fontWeight: 700, fontSize: muitos ? 34 : 40, lineHeight: 1.3, paddingTop: muitos ? 10 : 6 }}>{item}</div>
                </div>
              ))}
            </div>
          ) : null}

          {s.tipo === "cta" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
              {s.texto ? corpo(s.texto) : null}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 10,
                  border: `6px solid ${e.destaque}`,
                  borderRadius: 32,
                  padding: "34px 44px",
                }}
              >
                <div style={{ display: "flex", fontFamily: "Jakarta", fontWeight: 700, fontSize: 40, opacity: 0.9 }}>comenta</div>
                <div style={{ display: "flex", fontFamily: familiaTitulo, fontWeight: pesoTitulo, fontSize: 118, lineHeight: 1, color: e.destaque }}>
                  {s.palavra || copia.palavra_cta}
                </div>
                <div style={{ display: "flex", fontFamily: "Jakarta", fontWeight: 700, fontSize: 36, opacity: 0.9 }}>que eu te mando no direct</div>
              </div>
            </div>
          ) : null}
        </div>

        {/* rodapé: a sua foto e o seu @ · página */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} width={68} height={68} style={{ borderRadius: 34, border: `3px solid ${e.destaque}` }} alt="" />
            ) : null}
            <div style={{ display: "flex", fontFamily: "Jakarta", fontWeight: 700, fontSize: 30 }}>{perfil.usuario ? `@${perfil.usuario}` : (perfil.nome ?? "")}</div>
          </div>
          {capa ? (
            <div style={{ display: "flex", fontFamily: "Jakarta", fontWeight: 800, fontSize: 32, color: e.destaque }}>arrasta →</div>
          ) : (
            <div style={{ display: "flex", fontFamily: "Mono", fontWeight: 500, fontSize: 28, opacity: 0.7 }}>
              {indice + 1}/{total}
            </div>
          )}
        </div>
      </div>
    ),
    { width: L, height: A, fonts: fs },
  );
}
