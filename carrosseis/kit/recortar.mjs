import sharp from "sharp";
import { dentroDaOficina } from "./contrato.mjs";

const [origem, destino, ...medidas] = process.argv.slice(2);
if (!origem || !destino || medidas.length !== 4) throw new Error("Uso: node kit/recortar.mjs origem destino x y largura altura");
const [left, top, width, height] = medidas.map(Number);
if (![left, top, width, height].every(Number.isInteger) || left < 0 || top < 0 || width < 1 || height < 1) throw new Error("Coordenadas de recorte inválidas.");
await sharp(dentroDaOficina(process.cwd(), origem)).extract({ left, top, width, height }).png().toFile(dentroDaOficina(process.cwd(), destino));
console.log(`Recorte salvo em ${destino}`);
