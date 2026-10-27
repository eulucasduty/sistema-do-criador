import "server-only";
import { spawn } from "node:child_process";
import { acharReelPublico } from "@/lib/instagram/descoberta";

// Vídeo de referência por LINK (extra: o caminho garantido é o arquivo).
//   · Instagram: primeiro a Business Discovery (API oficial, a mesma da esteira: conta de criador
//     ou empresa, sem música licenciada); não deu, o yt-dlp.
//   · TikTok, YouTube e afins: yt-dlp (na imagem do Docker; local, YTDLP_BIN ou no PATH), só o
//     formato que já vem com áudio e vídeo juntos (sem ffmpeg), até 45 MB, direto pra memória.
// Nada vai pro disco nem pro storage: o vídeo de terceiro só passa pela transcrição.

export const MAX_BYTES = 45 * 1024 * 1024;

const SITES = /(^|\.)(instagram\.com|tiktok\.com|youtube\.com|youtu\.be|facebook\.com|fb\.watch|x\.com|twitter\.com|threads\.net|kwai\.com)$/i;

/** Link aceito: http(s) de rede social conhecida (o yt-dlp não sai buscando qualquer endereço). */
export function linkValido(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return /^https?:$/.test(u.protocol) && SITES.test(u.hostname);
  } catch {
    return false;
  }
}

export async function baixarUrl(url: string): Promise<{ buf: Buffer; mime: string }> {
  const r = await fetch(url, { signal: AbortSignal.timeout(90_000) });
  if (!r.ok) throw new Error(`download ${r.status}`);
  const tamanho = Number(r.headers.get("content-length") ?? 0);
  if (tamanho > MAX_BYTES) throw new Error(`vídeo grande demais (${Math.round(tamanho / 1e6)} MB)`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error(`vídeo grande demais (${Math.round(buf.length / 1e6)} MB)`);
  return { buf, mime: (r.headers.get("content-type") ?? "video/mp4").split(";")[0].trim() || "video/mp4" };
}

function motivoDoYtdlp(saida: string): string {
  if (/login|log in|sign in|cookies|authentication|private|rate-limit/i.test(saida)) return "o site pediu login pra liberar esse vídeo";
  if (/not a bot/i.test(saida)) return "o YouTube bloqueou o servidor (pede login)";
  if (/unavailable|not available|removed|404/i.test(saida)) return "o vídeo não está disponível";
  if (/max-filesize|larger than/i.test(saida)) return "o vídeo passa de 45 MB";
  if (/Unsupported URL/i.test(saida)) return "esse link não é de um vídeo";
  return saida.split("\n").filter(Boolean).pop()?.slice(0, 160) ?? "falhou";
}

function ytdlp(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = process.env.YTDLP_BIN || "yt-dlp";
    // Vídeo com áudio junto; sem isso (o YouTube hoje só tem separado), só o áudio m4a: a
    // transcrição precisa da fala, e o Gemini lê o m4a como mp4
    const formato = "b[ext=mp4][filesize<45M]/b[ext=mp4]/b/ba[ext=m4a]/w";
    const args = ["--js-runtimes", "node", "--no-cache-dir", "--no-playlist", "--no-warnings", "--no-progress", "-q", "--max-filesize", "45M", "-f", formato, "-o", "-", url];
    let filho;
    try {
      filho = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    } catch (e) {
      return reject(new Error(`baixador indisponível (${(e as Error).message})`));
    }
    const partes: Buffer[] = [];
    let tamanho = 0;
    let erro = "";
    const prazo = setTimeout(() => filho.kill("SIGKILL"), 150_000);
    filho.stdout.on("data", (b: Buffer) => {
      tamanho += b.length;
      if (tamanho > MAX_BYTES) filho.kill("SIGKILL");
      else partes.push(b);
    });
    filho.stderr.on("data", (b: Buffer) => (erro = (erro + b.toString()).slice(-2000)));
    filho.on("error", (e: NodeJS.ErrnoException) =>
      reject(new Error(e.code === "ENOENT" ? "o servidor não tem o baixador de link (yt-dlp)" : `baixador: ${e.message}`)),
    );
    filho.on("close", (codigo) => {
      clearTimeout(prazo);
      if (tamanho > MAX_BYTES) return reject(new Error("o vídeo passa de 45 MB"));
      if (codigo !== 0 || !tamanho) return reject(new Error(motivoDoYtdlp(erro) || `o baixador saiu com ${codigo}`));
      resolve(Buffer.concat(partes));
    });
  });
}

/** Baixa o vídeo de um link de rede social. Erro com o motivo em português (o painel mostra). */
export async function baixarDoLink(url: string): Promise<{ buf: Buffer; mime: string; fonte: string }> {
  if (!linkValido(url)) throw new Error("link não aceito: use o link de um vídeo do Instagram, TikTok ou YouTube");
  const host = new URL(url).hostname;
  let motivoInstagram: string | null = null;
  if (/instagram\.com$/i.test(host)) {
    const { reel, motivo } = await acharReelPublico({ url, reelVideoId: null }).catch((e) => ({ reel: null, motivo: (e as Error).message }));
    if (reel?.media_url) {
      try {
        const { buf, mime } = await baixarUrl(reel.media_url);
        return { buf, mime, fonte: `instagram (@${reel.autor}, API da Meta)` };
      } catch (e) {
        motivoInstagram = (e as Error).message;
      }
    } else motivoInstagram = motivo;
  }
  try {
    return { buf: await ytdlp(url), mime: "video/mp4", fonte: `link (${host.replace(/^www\./, "")})` };
  } catch (e) {
    const yt = (e as Error).message;
    throw new Error(`não consegui baixar o vídeo do link: ${motivoInstagram ? `${motivoInstagram}; ` : ""}${yt}. Baixa o vídeo e sobe o arquivo.`);
  }
}
