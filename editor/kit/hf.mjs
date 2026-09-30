// Atalho pro HyperFrames da estação (o mesmo do render), igual em qualquer motor de IA:
//   node kit/hf.mjs lint
//   node kit/hf.mjs snapshot --at "1.2,3.4,8"
//   node kit/hf.mjs inspect
// Usa o HyperFrames que a estação instalou (HF_CLI, funciona sem internet); sem ele, o npx.
// Só esses 3 comandos, com argumentos simples (nada de caminho de fora nem caractere de shell).

import { spawnSync } from "node:child_process";
import fs from "node:fs";

const VERSAO = "0.8.92";
const USO = 'uso: node kit/hf.mjs lint | snapshot --at "1.2,3.4" | inspect';
const [sub, ...resto] = process.argv.slice(2);
if (!["lint", "snapshot", "inspect"].includes(sub)) {
  console.error(USO);
  process.exit(1);
}

// No PowerShell, "--at 1.2,3.4" sem aspas chega separado ("1.2" "3.4"): junta de volta
const args = [];
for (let i = 0; i < resto.length; i++) {
  const a = resto[i];
  if (a === "--at") {
    const tempos = [];
    while (i + 1 < resto.length && /^[\d.,\s]+$/.test(resto[i + 1])) tempos.push(resto[++i]);
    args.push("--at", tempos.join(",").replace(/\s+/g, "").replace(/,+/g, ",").replace(/^,|,$/g, ""));
  } else args.push(a);
}
const ruim = args.find((a) => !/^[\w.,:=-]+$/.test(a) || a.includes(".."));
if (ruim !== undefined) {
  console.error(`argumento não permitido: ${ruim}\n${USO}`);
  process.exit(1);
}

const cli = process.env.HF_CLI;
const env = { ...process.env, HYPERFRAMES_NO_UPDATE_CHECK: "1", HYPERFRAMES_NO_AUTO_INSTALL: "1" };
const r =
  cli && fs.existsSync(cli)
    ? spawnSync(process.execPath, [cli, sub, ...args], { stdio: "inherit", env, windowsHide: true })
    : spawnSync(`npx --yes hyperframes@${VERSAO} ${[sub, ...args].join(" ")}`, { shell: true, stdio: "inherit", env, windowsHide: true });
if (r.error) console.error(r.error.message);
process.exit(r.status ?? 1);
