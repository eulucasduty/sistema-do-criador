// "Meus sons": a biblioteca do painel (criador.edicao_som; origem kit, 99hud ou criador) vai pra oficina, nivelada,
// em assets/sons/biblioteca + dados/sons.json (o montador e o Claude leem dali).
// Cache no PC (editor/oficina/_sons) pra não baixar e nivelar de novo a cada edição.

import fs from "node:fs";
import path from "node:path";
import { nivelarSom } from "./preparar.mjs";

export async function sincronizarSons(db, pasta, { cache, aviso = () => {} }) {
  const { data: lista, error } = await db.from("edicao_som").select("id, nome, funcao, principal, descricao, origem, arquivo, volume, atualizado_em").eq("ativo", true).order("nome");
  if (error || !lista?.length) return 0; // sem biblioteca, o montador usa o catálogo do kit
  const destino = path.join(pasta, "assets", "sons", "biblioteca");
  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });
  fs.mkdirSync(cache, { recursive: true });
  const prontos = [];
  for (const s of lista) {
    try {
      const chave = `${s.id}-${new Date(s.atualizado_em).getTime()}`;
      const mp3 = path.join(cache, `${chave}.mp3`);
      const info = path.join(cache, `${chave}.json`);
      if (!fs.existsSync(info)) {
        const { data, error: e } = await db.storage.from("edicao").download(s.arquivo);
        if (e) throw new Error(e.message);
        const bruto = path.join(cache, `${chave}-bruto${path.extname(s.arquivo) || ".mp3"}`);
        fs.writeFileSync(bruto, Buffer.from(await data.arrayBuffer()));
        const { duracao } = await nivelarSom(bruto, mp3);
        fs.rmSync(bruto, { force: true });
        fs.writeFileSync(info, JSON.stringify({ duracao }));
      }
      fs.copyFileSync(mp3, path.join(destino, `${s.nome}.mp3`));
      const { duracao } = JSON.parse(fs.readFileSync(info, "utf8"));
      prontos.push({ nome: s.nome, funcao: s.funcao, principal: s.principal, descricao: s.descricao, origem: s.origem, volume: Number(s.volume), arquivo: `biblioteca/${s.nome}.mp3`, duracao });
    } catch (e) {
      await aviso(`o som ${s.nome} não deu: ${String(e.message).slice(0, 120)}`);
    }
  }
  fs.writeFileSync(path.join(pasta, "dados", "sons.json"), JSON.stringify(prontos, null, 2));
  await aviso(`${prontos.length} sons da tua biblioteca`);
  return prontos.length;
}
