// Roda no NAVEGADOR: tira só o áudio de um vídeo grande (mais de 45 MB, o limite do storage) pra
// transcrever. Sem ffmpeg e sem gastar a VPS: o próprio navegador decodifica o áudio e regrava em
// WAV 16 kHz mono (~1,9 MB por minuto). Vídeo de referência longo: só os primeiros 10 minutos.

export const MAX_SEGUNDOS_AUDIO = 600;
const TAXA = 16_000;

function paraWav(amostras: Float32Array, taxa: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + amostras.length * 2);
  const v = new DataView(buf);
  const txt = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF");
  v.setUint32(4, 36 + amostras.length * 2, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  txt(36, "data");
  v.setUint32(40, amostras.length * 2, true);
  for (let i = 0; i < amostras.length; i++) {
    const s = Math.max(-1, Math.min(1, amostras[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/** O áudio do vídeo, em WAV 16 kHz mono. Lança erro em português se o navegador não conseguir ler. */
export async function extrairAudio(video: File): Promise<{ arquivo: File; segundos: number; cortado: boolean }> {
  const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Contexto();
  let decodificado: AudioBuffer;
  try {
    decodificado = await ctx.decodeAudioData(await video.arrayBuffer());
  } catch {
    throw new Error("o navegador não conseguiu ler o áudio desse vídeo: exporta em MP4 menor que 45 MB ou usa o link");
  } finally {
    ctx.close().catch(() => {});
  }
  const segundos = Math.min(decodificado.duration, MAX_SEGUNDOS_AUDIO);
  const offline = new OfflineAudioContext(1, Math.ceil(segundos * TAXA), TAXA);
  const fonte = offline.createBufferSource();
  fonte.buffer = decodificado;
  fonte.connect(offline.destination);
  fonte.start(0);
  const pronto = await offline.startRendering();
  const nome = `${video.name.replace(/\.[^.]+$/, "") || "referencia"}.wav`;
  return { arquivo: new File([paraWav(pronto.getChannelData(0), TAXA)], nome, { type: "audio/wav" }), segundos: Math.round(segundos), cortado: decodificado.duration > MAX_SEGUNDOS_AUDIO };
}
