// Reconstrói um fundo discreto para substituir texto, mantendo a cor e o grão da referência.
import sharp from "sharp";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { dentroDaOficina } from "./contrato.mjs";

export async function criarFundo(origem, destino, left, top, width, height) {
  const { data, info } = await sharp(origem).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (![left, top, width, height].every(Number.isInteger) || left < 0 || top < 0 || width < 1 || height < 1 || left + width > info.width || top + height > info.height) throw new Error("Área de fundo inválida.");
  const pixel = (x, y, c) => data[(Math.max(0, Math.min(info.height - 1, y)) * info.width + Math.max(0, Math.min(info.width - 1, x))) * info.channels + c];
  const media = (x, y, c) => { let s = 0; for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++)s+=pixel(x+dx,y+dy,c); return s/49; };
  const cima = Math.max(4, top - 8), baixo = Math.min(info.height - 5, top + height + 8);
  const xs = [left, left + Math.floor(width / 2), left + width - 1];
  const cores = [cima, baixo].map(y => xs.map(x => [0,1,2].map(c => media(x, y, c))));
  const ruido = Array.from({ length: 32 * 32 }, (_, i) => {
    const x = 15 + i % 32, y = 15 + Math.floor(i / 32);
    return pixel(x,y,0) - media(x,y,0);
  });
  const buf = Buffer.alloc(width * height * 3);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const fy=y/Math.max(1,height-1), fx=x/Math.max(1,width-1)*2, faixa=Math.min(1,Math.floor(fx)), t=fx-faixa;
    const grain = ruido[((top+y)%32)*32+(left+x)%32];
    const mescla = Math.min(1, Math.min(x,y,width-1-x,height-1-y)/8);
    for(let c=0;c<3;c++){
      const a=cores[0][faixa][c]*(1-t)+cores[0][faixa+1][c]*t;
      const b=cores[1][faixa][c]*(1-t)+cores[1][faixa+1][c]*t;
      const novo = a*(1-fy)+b*fy+grain;
      buf[(y*width+x)*3+c]=Math.max(0,Math.min(255,Math.round(novo*mescla+pixel(left+x,top+y,c)*(1-mescla))));
    }
  }
  await sharp(buf,{raw:{width,height,channels:3}}).png().toFile(destino);
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const [origem,destino,...medidas]=process.argv.slice(2);
  if(!origem||!destino||medidas.length!==4)throw new Error("Uso: node kit/fundo.mjs origem destino x y largura altura");
  criarFundo(dentroDaOficina(process.cwd(),origem),dentroDaOficina(process.cwd(),destino),...medidas.map(Number)).then(()=>console.log(`Fundo salvo: ${destino}`)).catch(e=>{console.error(e);process.exitCode=1;});
}
