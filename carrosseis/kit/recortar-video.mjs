import { recortarVideo } from "./video.mjs";
import { dentroDaOficina } from "./contrato.mjs";

// node kit/recortar-video.mjs referencias/02.mp4 assets/video-02.mp4 x y largura altura [inicio fim]
// Coordenadas em pixels do quadro referencias/NN.png. Grava também assets/video-02-capa.png.
const [entrada, saida, x, y, largura, altura, inicio, fim] = process.argv.slice(2);
if (!entrada || !saida || !saida.startsWith("assets/")) {
  console.error("Uso: node kit/recortar-video.mjs referencias/02.mp4 assets/video-02.mp4 [x y largura altura [inicio fim]]");
  process.exit(1);
}
const r = await recortarVideo(dentroDaOficina(process.cwd(), entrada), dentroDaOficina(process.cwd(), saida), {
  x: Number(x), y: Number(y), largura: Number(largura), altura: Number(altura), inicio: inicio && Number(inicio), fim: fim && Number(fim),
});
console.log(JSON.stringify({ video: saida, capa: saida.replace(/\.[^.]+$/, "-capa.png"), largura: r.largura, altura: r.altura, duracao_s: r.duracao_s, audio: r.audio }));
