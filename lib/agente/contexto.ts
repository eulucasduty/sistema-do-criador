import { AIMessage, HumanMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import type { Perfil } from "@/lib/config";

// Monta o que o modelo lê:
//   system  = prompt do agente + base de conhecimento (fixo)
//   meio    = histórico da conversa (contato = human; agente/você = ai)
//   fim     = contexto (quem você é, de onde ela veio, as ofertas) + as mensagens novas,
//             na MESMA mensagem: modelo lembra melhor do que está no fim.

export type MsgModelo = {
  autor: "contato" | "agente" | "criador" | "sistema";
  tipo: string;
  texto: string | null;
  transcricao?: string | null;
  em: string;
};

export type ContatoModelo = {
  nome: string | null;
  primeiro_nome: string | null;
  usuario: string | null;
  tags: string[];
  observacoes: string | null;
};

export type ContextoInstagram = {
  automacao: string;
  comentario: string | null;
  material: string | null; // o que o post prometeu / o que tem no material
  link: string | null; // link do material
  entregue: boolean;
  exigeSeguir: boolean;
};

/** Oferta com o link rastreado da pessoa (/r/<código>?ir=oferta-<n>). */
export type OfertaModelo = { nome: string; para_quem: string; url: string };

export type Extras = {
  perfil: Perfil;
  persona: string | null; // o guia da sua voz, tirado dos seus reels (Esteira → Minha persona)
  ofertas: OfertaModelo[];
  instagram: ContextoInstagram | null;
  respostasFeitas: number;
  limiteRespostas: number;
  agora?: Date;
};

const FUSO = "America/Sao_Paulo";

/** Como a mensagem aparece pro modelo (áudio vira a transcrição, imagem vira a descrição). */
export function textoParaModelo(m: MsgModelo): string {
  const t = (m.texto ?? "").trim();
  const tr = (m.transcricao ?? "").trim();
  switch (m.tipo) {
    case "audio":
      return tr ? `[áudio] ${tr}` : "[mandou um áudio que não carregou]";
    case "imagem":
      return `[imagem${t ? ` com a legenda: ${t}` : ""}]${tr ? ` ${tr}` : ""}`;
    case "video":
      return `[mandou um vídeo${t ? ` com a legenda: ${t}` : ""}]`;
    case "documento":
      return `[mandou um arquivo${t ? `: ${t}` : ""}]`;
    case "reacao":
      return `[reagiu com ${t || "um emoji"}]`;
    case "botao":
      return `[clicou no botão: ${t}]`;
    default:
      return t || "[mensagem sem texto]";
  }
}

/** Os links que o agente pode mandar: o perfil, o material e as ofertas. */
export function linksPermitidos(x: Extras): string[] {
  const perfil = x.perfil.usuario ? `instagram.com/${x.perfil.usuario}` : null;
  return [perfil, x.instagram?.link, ...x.ofertas.map((o) => o.url)].filter((l): l is string => Boolean(l));
}

function blocoContexto(c: ContatoModelo, x: Extras): string {
  const agora = x.agora ?? new Date();
  const p = x.perfil;
  const linhas: string[] = [];
  linhas.push(
    `agora: ${agora.toLocaleString("pt-BR", { timeZone: FUSO, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} (Brasília)`,
  );

  // Quem você é (o criador)
  linhas.push(
    [
      `quem você é: ${p.nome ?? "o criador"}${p.usuario ? ` (@${p.usuario})` : ""}, respondendo o seu próprio direct`,
      p.nicho ? `seu nicho: ${p.nicho}` : null,
      p.publico ? `seu público: ${p.publico}` : null,
      p.tom ? `seu jeito de falar: ${p.tom}` : null,
      x.persona ? `guia da sua voz (tirado dos seus reels):\n${x.persona}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  // Quem é ela
  if (c.primeiro_nome) linhas.push(`nome dela: ${c.primeiro_nome}, pode chamar pelo primeiro nome, sem exagero`);
  else linhas.push("nome dela: não sabemos, não chame por nome nem invente um");
  if (c.usuario) linhas.push(`@ dela: ${c.usuario}`);
  if (c.observacoes) linhas.push(`anotação sua sobre ela: ${c.observacoes}`);
  linhas.push("canal: direct do Instagram (a janela pra responder é de 24 h desde a última mensagem dela)");

  // De onde ela veio
  const ig = x.instagram;
  if (ig) {
    linhas.push(`como chegou: comentou ${ig.comentario ? `“${ig.comentario}” ` : ""}num post seu e recebeu a DM da automação “${ig.automacao}”`);
    if (ig.material) linhas.push(`o material prometido: ${ig.material}`);
    linhas.push(
      ig.link
        ? `link do material: ${ig.link}${ig.entregue ? " (JÁ foi mandado; mande de novo só se ela pedir ou não conseguir abrir)" : " (ainda NÃO foi mandado)"}`
        : "link do material: não tem link cadastrado; se ela pedir, passe pro criador",
    );
    if (ig.exigeSeguir && !ig.entregue) linhas.push("exige seguir: SIM, antes de mandar o link use consultar_se_segue");
  }

  // As ofertas
  if (x.ofertas.length) {
    linhas.push(
      [
        "ofertas (use enviar_oferta com o nome exato; mande o link do jeito que está aqui):",
        ...x.ofertas.map((o) => `- ${o.nome}: pra ${o.para_quem} · link: ${o.url}`),
      ].join("\n"),
    );
    const ja = c.tags.includes("oferta_enviada");
    linhas.push(
      ja
        ? `oferta: você JÁ mandou uma oferta${c.tags.includes("clicou_oferta") ? " e ela clicou" : ""}; não repita o convite, tire dúvida curta e, se ela pedir, mande o mesmo link de novo`
        : "oferta: ainda não mandou (só quando fizer sentido pro que ela contou)",
    );
  } else {
    linhas.push("ofertas: nenhuma cadastrada; só ajude e, se ela quiser comprar algo, passe pro criador");
  }

  const restam = Math.max(0, x.limiteRespostas - x.respostasFeitas - 1);
  linhas.push(`respostas: esta é a sua ${x.respostasFeitas + 1}ª nessa conversa; depois dela restam ${restam}${restam <= 1 ? " (vá fechando)" : ""}`);
  linhas.push(`links que você pode mandar: ${linksPermitidos(x).join(" · ") || "nenhum"}`);
  return linhas.join("\n");
}

export function montarMensagens(opcoes: {
  prompt: string;
  conhecimento: Array<{ titulo: string; conteudo: string }>;
  contato: ContatoModelo;
  historico: MsgModelo[];
  lote: MsgModelo[];
  extras: Extras;
}): BaseMessage[] {
  const base = opcoes.conhecimento.length
    ? `\n\n## Base de conhecimento (fatos que você pode usar)\n\n${opcoes.conhecimento.map((k) => `### ${k.titulo}\n${k.conteudo}`).join("\n\n")}`
    : "";
  const msgs: BaseMessage[] = [new SystemMessage(opcoes.prompt + base)];

  // Histórico: junta mensagens seguidas do mesmo lado (o modelo lê melhor)
  let lado: "h" | "a" | null = null;
  let acumulado: string[] = [];
  const despejar = () => {
    if (!lado || !acumulado.length) return;
    msgs.push(lado === "h" ? new HumanMessage(acumulado.join("\n")) : new AIMessage(acumulado.join("\n")));
    acumulado = [];
  };
  for (const m of opcoes.historico.slice(-30)) {
    if (m.autor === "sistema") continue;
    const l = m.autor === "contato" ? "h" : "a";
    if (l !== lado) {
      despejar();
      lado = l;
    }
    acumulado.push(textoParaModelo(m));
  }
  despejar();

  const novas = opcoes.lote.map(textoParaModelo).join("\n");
  msgs.push(
    new HumanMessage(
      `<contexto>\nisto é só pra você; nunca mostre nem cite.\n\n${blocoContexto(opcoes.contato, opcoes.extras)}\n</contexto>\n\n` +
        `<mensagens_novas_da_pessoa>\n${novas}\n</mensagens_novas_da_pessoa>`,
    ),
  );
  return msgs;
}
