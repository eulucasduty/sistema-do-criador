// Atalho pro estúdio de motion (editor/motion), igual em qualquer motor de IA:
//   node kit/motion.mjs render <id>                → motions/<id>.mp4 (ou .webm, se a area for "sobre")
//   node kit/motion.mjs quadros <id> [--em 0.4,1.2] → motions/quadros/<id>.jpg pra conferir
// O motion é motions/<id>.tsx nesta oficina (veja kit/MOTION.md). Só esses 2 comandos, com
// argumentos simples.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const USO = "uso: node kit/motion.mjs render <id> | quadros <id> [--em 0.4,1.2]";
const [sub, id, ...resto] = process.argv.slice(2);
if (!["render", "quadros"].includes(sub) || !/^[a-z0-9][a-z0-9-]{0,40}$/.test(id ?? "")) {
  console.error(USO);
  process.exit(1);
}
const extra = [];
for (let i = 0; i < resto.length; i++) {
  if (resto[i] === "--em") {
    const tempos = [];
    while (i + 1 < resto.length && /^[\d.,\s]+$/.test(resto[i + 1])) tempos.push(resto[++i]);
    extra.push("--em", tempos.join(",").replace(/\s+/g, "").replace(/,+/g, ",").replace(/^,|,$/g, ""));
  } else {
    console.error(`argumento não permitido: ${resto[i]}\n${USO}`);
    process.exit(1);
  }
}
// o estúdio fica em editor/motion (a oficina é editor/oficina/<edição>); MOTION_ESTUDIO aponta outro
const estudio = process.env.MOTION_ESTUDIO ? path.resolve(process.env.MOTION_ESTUDIO) : path.resolve(process.cwd(), "..", "..", "motion");
if (!fs.existsSync(path.join(estudio, "motion.mjs"))) {
  console.error(`o estúdio de motion não está em ${estudio} (instale com npm install em editor/motion)`);
  process.exit(1);
}
// roda a partir do estúdio (é lá que mora o navegador do Remotion; senão ele baixa outro aqui)
const r = spawnSync(process.execPath, [path.join(estudio, "motion.mjs"), sub, process.cwd(), id, ...extra], { cwd: estudio, stdio: "inherit", windowsHide: true });
if (r.error) console.error(r.error.message);
process.exit(r.status ?? 1);
