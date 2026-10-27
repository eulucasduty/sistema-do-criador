import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { lerPerfil } from "@/lib/config";
import type { Db } from "@/lib/supabase/admin";
import { criarComCLI } from "@/carrosseis/agente.mjs";
import { renderizar } from "@/carrosseis/kit/renderizar.mjs";
import { conferirConteudo } from "@/carrosseis/kit/contrato.mjs";
import { quadros, sondar } from "@/carrosseis/kit/video.mjs";
import { conferirReferencias, ehVideo, type PedidoCarrossel, type ResultadoCarrossel } from "./comum";

const existe = (p: string) => fs.access(p).then(() => true, () => false);
const autorDaReferencia = async (db: Db, id: string) =>
  ((await db.from("referencia").select("autor").eq("id", id).maybeSingle()).data?.autor as string | null) ?? null;
/** carrosseis/moldes/<autor>.html: fora do git e do Docker, só no PC da estação. */
const arquivoMolde = (autor: string | null) =>
  autor && /^[a-z0-9._]+$/i.test(autor) ? path.resolve("carrosseis", "moldes", `${autor.toLowerCase()}.html`) : null;

/** A oficina conserva os originais, recortes, HTML e PNGs para ajustes futuros. */
export async function prepararOficina(db: Db, trabalho: PedidoCarrossel, arquivosLocais?: string[]) {
  conferirReferencias(trabalho.referencias);
  const pasta = path.resolve("carrosseis", "oficina", trabalho.id);
  await fs.mkdir(path.join(pasta, "referencias"), { recursive: true });
  await fs.mkdir(path.join(pasta, "dados"), { recursive: true });
  await fs.mkdir(path.join(pasta, "assets"), { recursive: true });
  await fs.cp(path.resolve("carrosseis/kit"), path.join(pasta, "kit"), { recursive: true });
  const perfil = await lerPerfil();
  const avatar = perfil.foto_url ? await fetch(perfil.foto_url, { signal: AbortSignal.timeout(15_000) }).then(async r => { if (!r.ok) throw new Error("Não consegui baixar a foto do perfil"); return Buffer.from(await r.arrayBuffer()); }) : await sharp({ create: { width: 64, height: 64, channels: 3, background: perfil.cores.destaque } }).jpeg().toBuffer();
  await fs.writeFile(path.join(pasta, "assets/perfil.jpg"), avatar);
  await fs.cp(path.resolve("carrosseis/kit/fontes"), path.join(pasta, "assets/fontes"), { recursive: true });
  // O repertório do editor fornece fontes distintas; sem uma fonte exata, o CLI escolhe a mais próxima.
  await fs.cp(path.resolve("editor/kit/fontes"), path.join(pasta, "assets/fontes-editor"), { recursive: true });
  // Molde do estilo (18/10): o último carrossel nosso do mesmo criador vira ponto de partida (economiza tokens)
  const molde = arquivoMolde(await autorDaReferencia(db, trabalho.referencia_id));
  if (molde && await existe(molde)) {
    await fs.mkdir(path.join(pasta, "moldes"), { recursive: true });
    await fs.copyFile(molde, path.join(pasta, "moldes", "carrossel.html"));
  }
  const videos: Array<{ n: number; original: string; quadro: string; quadros: string }> = [];
  for (let i = 0; i < trabalho.referencias.length; i++) {
    let buf: Buffer;
    if (arquivosLocais) buf = await fs.readFile(arquivosLocais[i]);
    else {
      const { data, error } = await db.storage.from("esteira").download(trabalho.referencias[i]);
      if (error || !data) throw new Error(`Não consegui baixar o slide ${i + 1}: ${error?.message ?? "arquivo vazio"}`);
      buf = Buffer.from(await data.arrayBuffer());
    }
    const nn = String(i + 1).padStart(2, "0");
    if (ehVideo(arquivosLocais?.[i] ?? trabalho.referencias[i])) {
      // Slide em vídeo: o original, um quadro em tamanho real e uma folha com 6 momentos
      const original = path.join(pasta, "referencias", `${nn}.mp4`);
      await fs.writeFile(original, buf);
      const info = await sondar(original);
      await quadros(original, path.join(pasta, "referencias", `${nn}.png`), path.join(pasta, "referencias", `${nn}-quadros.jpg`), info.duracao_s);
      videos.push({ n: i + 1, original: `referencias/${nn}.mp4`, quadro: `referencias/${nn}.png`, quadros: `referencias/${nn}-quadros.jpg`, ...info });
    } else await sharp(buf).rotate().png().toFile(path.join(pasta, "referencias", `${nn}.png`));
  }
  await fs.writeFile(path.join(pasta, "dados/pedido.json"), JSON.stringify({
    total: trabalho.referencias.length, idioma: "pt-BR", headline: trabalho.headline,
    modo_texto: trabalho.modo_texto, modo_visual: trabalho.modo_visual ?? "copiar", direcao: trabalho.pedido, perfil: perfil.usuario ? `@${perfil.usuario.replace(/^@/, "")}` : perfil.nome || "Criador", videos,
  }, null, 2));
  await fs.writeFile(path.join(pasta, "AGENTS.md"), "Leia kit/CRIAR.md. Esta oficina contém todos os slides de referência. Trabalhe somente aqui, sem acessar a rede, credenciais ou diretórios externos. Toda a entrega deve ser em português do Brasil.\n");
  await fs.copyFile(path.join(pasta, "AGENTS.md"), path.join(pasta, "CLAUDE.md"));
  return pasta;
}

export async function produzirCarrossel(pasta: string, trabalho: PedidoCarrossel, etapa: (s: string) => Promise<void>) {
  let atualizacao = Promise.resolve();
  let ultima = 0;
  const aoPasso = (s: string) => {
    console.log(`[carrossel] ${s}`);
    if (Date.now() - ultima < 3000) return;
    ultima = Date.now();
    atualizacao = atualizacao.then(() => etapa(s)).catch(e => console.error("[carrossel] progresso:", e.message));
  };
  await etapa(`${trabalho.agente} está vendo os ${trabalho.referencias.length} slides e criando as artes em PT-BR`);
  const videos = trabalho.referencias.flatMap((c, i) => (ehVideo(c) ? [i + 1] : []));
  const modoVisual = trabalho.modo_visual ?? "copiar";
  let uso = await criarComCLI(pasta, { agente: trabalho.agente, total: trabalho.referencias.length, videos, aoPasso, modoVisual });
  await atualizacao;
  // Sem gerador de imagem o modo recriar não sai: nunca cai de volta pra cópia.
  if (modoVisual === "recriar" && /GERAÇÃO DE IMAGEM BLOQUEADA/i.test(uso.resumo ?? "")) {
    throw new Error("Geração de imagem bloqueada na conta do ChatGPT logada no Codex (403). Troque a conta (codex login) e coloque o carrossel na fila de novo.");
  }
  const conferir = async () => {
    const conteudo = JSON.parse(await fs.readFile(path.join(pasta, "conteudo.json"), "utf8"));
    const c = conferirConteudo(conteudo, trabalho.referencias.length, true);
    if (modoVisual === "recriar") {
      const html = await fs.readFile(path.join(pasta, "carrossel.html"), "utf8");
      if (/(src=|url\()\s*["']?referencias\//i.test(html)) throw new Error("No modo recriar o slide original não pode ser a base: monte cada slide do zero em HTML com as imagens novas (assets/), sem usar referencias/ no carrossel.html.");
      if (conteudo.revisao?.imagens_novas !== true) throw new Error("No modo recriar, confira que nenhuma foto, render ou ilustração do original ficou e marque revisao.imagens_novas = true.");
    }
    await renderizar(pasta);
    return c;
  };
  let c;
  try { c = await conferir(); }
  catch (e) {
    await etapa("corrigindo os problemas encontrados na conferência das artes");
    uso = await criarComCLI(pasta, { agente: trabalho.agente, total: trabalho.referencias.length, videos, aoPasso, modoVisual, correcao: (e as Error).message });
    await atualizacao;
    c = await conferir();
  }
  return { conteudo: c as { titulo: string; legenda: string; slides: Array<{ n: number; original: string; ptbr: string }> }, uso };
}

export async function enviarCarrossel(db: Db, pasta: string, trabalho: PedidoCarrossel, produzido: Awaited<ReturnType<typeof produzirCarrossel>>): Promise<ResultadoCarrossel> {
  const arquivos: string[] = [];
  for (let i = 1; i <= trabalho.referencias.length; i++) {
    const nome = `${String(i).padStart(2, "0")}.png`;
    const caminho = `carrosseis/${trabalho.id}/${nome}`;
    const { error } = await db.storage.from("esteira").upload(caminho, await fs.readFile(path.join(pasta, "saida", nome)), { contentType: "image/png", upsert: true });
    if (error) throw new Error(`Não consegui enviar slide ${i}: ${error.message}`);
    // No modo recriar um slide que era vídeo pode virar imagem parada (sem data-video, sem MP4): entrega o PNG
    const temMp4 = await existe(path.join(pasta, "saida", nome.replace(/\.png$/, ".mp4")));
    if (!ehVideo(trabalho.referencias[i - 1]) || !temMp4) { arquivos.push(caminho); continue; }
    // Slide em vídeo: a entrega é o MP4; o PNG acima fica como capa no painel
    const mp4 = caminho.replace(/\.png$/, ".mp4");
    const { error: e } = await db.storage.from("esteira").upload(mp4, await fs.readFile(path.join(pasta, "saida", nome.replace(/\.png$/, ".mp4"))), { contentType: "video/mp4", upsert: true });
    if (e) throw new Error(`Não consegui enviar o vídeo do slide ${i}: ${e.message}`);
    arquivos.push(mp4);
  }
  const resultado: ResultadoCarrossel = {
    titulo: produzido.conteudo.titulo, legenda: produzido.conteudo.legenda, textos: produzido.conteudo.slides,
    idioma: "pt-BR", agente: trabalho.agente, pedido_id: trabalho.id, arquivos,
    gerado_em: new Date().toISOString(), modelo: produzido.uso.modelo,
  };
  // Um JSON só publica a versão completa; nunca mostra ao usuário metade dos slides.
  const { error } = await db.from("referencia").update({ copia_cli: resultado }).eq("id", trabalho.referencia_id);
  if (error) throw new Error(error.message);
  // Guarda o HTML como molde do estilo deste criador para os próximos (o mais recente vale)
  const molde = arquivoMolde(await autorDaReferencia(db, trabalho.referencia_id));
  if (molde) {
    await fs.mkdir(path.dirname(molde), { recursive: true });
    await fs.copyFile(path.join(pasta, "carrossel.html"), molde).catch(e => console.error("[carrossel] molde:", e.message));
  }
  return resultado;
}
