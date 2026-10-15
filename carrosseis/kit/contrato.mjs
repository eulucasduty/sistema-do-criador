import path from "node:path";

export function dentroDaOficina(raiz, arquivo) {
  const destino = path.resolve(raiz, arquivo);
  const relativo = path.relative(path.resolve(raiz), destino);
  if (relativo === ".." || relativo.startsWith(`..${path.sep}`) || path.isAbsolute(relativo)) throw new Error("Arquivo fora da oficina.");
  return destino;
}

export function conferirConteudo(c, total, final = false) {
  if (!c || c.idioma !== "pt-BR") throw new Error("A entrega precisa ser em pt-BR.");
  if (!c.titulo?.trim() || !c.legenda?.trim()) throw new Error("Falta título ou legenda em PT-BR.");
  if (!Array.isArray(c.slides) || c.slides.length !== total) throw new Error(`Esperados ${total} slides; nenhuma referência pode ser omitida.`);
  for (let i = 0; i < total; i++) {
    if (c.slides[i].n !== i + 1 || !c.slides[i].original?.trim() || !c.slides[i].ptbr?.trim()) throw new Error(`Slide ${i + 1}: falta transcrição, tradução ou a ordem está errada.`);
  }
  if (final && ["todos_slides_vistos", "mensagem_preservada", "ptbr_conferido", "visual_conferido"].some(k => c.revisao?.[k] !== true)) throw new Error("O CLI ainda não conferiu todos os slides, o PT-BR e a fidelidade visual.");
  return c;
}
