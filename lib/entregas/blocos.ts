// O formato de uma entrega (o material de um CTA): uma lista de blocos que a página pública
// /m/<slug> desenha. Vale pro painel, pra página e pra estação (que escreve o rascunho), então
// nada aqui é só do servidor.
//
//   texto     um parágrafo (aceita **negrito**)
//   passos    passo a passo numerado; cada passo pode ter um prompt pra copiar e um link
//   prompt    um prompt pronto, com botão de copiar
//   link      um botão pra um site (só https; link vazio = ainda falta o criador pôr, não aparece)
//   template  um texto pra copiar e adaptar (mensagem, roteiro, estrutura) ou um link
//   aviso     uma caixa de destaque (atenção, dica)

export type Link = { titulo: string; url: string };
export type Passo = { titulo: string; texto?: string; prompt?: string; link?: Link };
export type Bloco =
  | { tipo: "texto"; texto: string }
  | { tipo: "passos"; titulo?: string; itens: Passo[] }
  | { tipo: "prompt"; titulo?: string; texto: string; dica?: string }
  | { tipo: "link"; titulo: string; url: string; descricao?: string }
  | { tipo: "template"; titulo: string; texto?: string; url?: string; descricao?: string }
  | { tipo: "aviso"; texto: string };

export type ConteudoEntrega = { titulo: string; subtitulo?: string; blocos: Bloco[] };

export const TIPOS_BLOCO: Array<{ tipo: Bloco["tipo"]; nome: string }> = [
  { tipo: "texto", nome: "Texto" },
  { tipo: "passos", nome: "Passo a passo" },
  { tipo: "prompt", nome: "Prompt" },
  { tipo: "link", nome: "Link" },
  { tipo: "template", nome: "Template" },
  { tipo: "aviso", nome: "Aviso" },
];

const txt = (v: unknown, max: number) => String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);
/** Só https (ou vazio: falta pôr). Qualquer outra coisa vira vazio. */
export const urlSegura = (v: unknown): string => {
  const u = txt(v, 1000);
  return /^https:\/\/[^\s<>"']+$/i.test(u) ? u : "";
};
const link = (v: unknown): Link | undefined => {
  const o = (v ?? {}) as Partial<Link>;
  const url = urlSegura(o.url);
  const titulo = txt(o.titulo, 80);
  return url || titulo ? { titulo: titulo || "abrir", url } : undefined;
};

/** Limpa e valida o que veio (do painel ou da IA): tipos conhecidos, tamanhos, só https. */
export function normalizarBlocos(entrada: unknown): Bloco[] {
  const lista = Array.isArray(entrada) ? entrada : [];
  const blocos: Bloco[] = [];
  for (const b of lista.slice(0, 40)) {
    const o = (b ?? {}) as Record<string, unknown>;
    switch (o.tipo) {
      case "texto": {
        const texto = txt(o.texto, 4000);
        if (texto) blocos.push({ tipo: "texto", texto });
        break;
      }
      case "passos": {
        const itens = (Array.isArray(o.itens) ? o.itens : [])
          .slice(0, 20)
          .map((p) => {
            const q = (p ?? {}) as Record<string, unknown>;
            const passo: Passo = { titulo: txt(q.titulo, 200) };
            const t = txt(q.texto, 2000);
            const pr = txt(q.prompt, 8000);
            const l = link(q.link);
            if (t) passo.texto = t;
            if (pr) passo.prompt = pr;
            if (l) passo.link = l;
            return passo;
          })
          .filter((p) => p.titulo || p.texto || p.prompt);
        if (itens.length) blocos.push({ tipo: "passos", ...(txt(o.titulo, 200) ? { titulo: txt(o.titulo, 200) } : {}), itens });
        break;
      }
      case "prompt": {
        const texto = txt(o.texto, 12000);
        if (texto) blocos.push({ tipo: "prompt", texto, ...(txt(o.titulo, 200) ? { titulo: txt(o.titulo, 200) } : {}), ...(txt(o.dica, 600) ? { dica: txt(o.dica, 600) } : {}) });
        break;
      }
      case "link": {
        const titulo = txt(o.titulo, 120);
        if (titulo || o.url) blocos.push({ tipo: "link", titulo: titulo || "abrir", url: urlSegura(o.url), ...(txt(o.descricao, 400) ? { descricao: txt(o.descricao, 400) } : {}) });
        break;
      }
      case "template": {
        const titulo = txt(o.titulo, 200);
        const texto = txt(o.texto, 12000);
        const url = urlSegura(o.url);
        if (titulo || texto || url) blocos.push({ tipo: "template", titulo: titulo || "Template", ...(texto ? { texto } : {}), ...(url ? { url } : {}), ...(txt(o.descricao, 400) ? { descricao: txt(o.descricao, 400) } : {}) });
        break;
      }
      case "aviso": {
        const texto = txt(o.texto, 1000);
        if (texto) blocos.push({ tipo: "aviso", texto });
        break;
      }
    }
  }
  return blocos;
}

/** O que ainda falta o criador completar (links vazios), pra avisar no painel antes de publicar. */
export function pendencias(blocos: Bloco[]): string[] {
  const faltas: string[] = [];
  blocos.forEach((b, i) => {
    if (b.tipo === "link" && !b.url) faltas.push(`bloco ${i + 1} (link "${b.titulo}"): falta o endereço`);
    if (b.tipo === "passos") b.itens.forEach((p, k) => p.link && !p.link.url && faltas.push(`bloco ${i + 1}, passo ${k + 1} (link "${p.link.titulo}"): falta o endereço`));
  });
  return faltas;
}

/** "ManyChat Grátis!" → "manychat-gratis" (o endereço /m/<slug>). */
export function slugDe(texto: string): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** A palavra do comentário como o sistema compara (sem acento, minúscula, só letras e números). */
export const palavraNormal = (p: string | null | undefined): string =>
  String(p ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
