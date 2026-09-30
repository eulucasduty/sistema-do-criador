import { tool } from "@langchain/core/tools";
import { z } from "zod";

// As ferramentas do agente. Elas NÃO mexem no banco durante o grafo: só anotam o efeito.
// Quem aplica é o turno, depois de decidir se a resposta passa no auditor — assim uma
// resposta reprovada não deixa efeito pela metade, e o simulador do painel usa as mesmas
// ferramentas sem efeito nenhum.

export const TIPOS_PASSAGEM = ["precisa_de_voce", "quer_comprar", "perguntou_se_e_ia"] as const;
export type TipoPassagem = (typeof TIPOS_PASSAGEM)[number];

export type Efeitos = {
  passagens: Array<{ tipo: TipoPassagem; motivo: string }>;
  encerrar: string | null;
  sair: string | null;
  oferta: { nome: string; resumo: string } | null;
};

export function novosEfeitos(): Efeitos {
  return { passagens: [], encerrar: null, sair: null, oferta: null };
}

export type OpcoesFerramentas = {
  /** Os nomes das ofertas cadastradas (o agente escolhe uma). */
  ofertas: string[];
  /** Pergunta pra Meta se a pessoa segue a conta (null = não deu pra saber). */
  verificarSeSegue?: () => Promise<boolean | null>;
};

export function criarFerramentas(efeitos: Efeitos, opcoes: OpcoesFerramentas) {
  const passar = tool(
    async ({ tipo, motivo }: { tipo: TipoPassagem; motivo: string }) => {
      efeitos.passagens.push({ tipo, motivo });
      return tipo === "perguntou_se_e_ia"
        ? "anotado. conte a verdade em 1 ou 2 balões curtos (é uma IA que o criador usa pra dar conta do direct) e diga que ele vai te responder pessoalmente. nada de pedir desculpa."
        : "anotado. mande um balão curto dizendo que ele vai te responder pessoalmente.";
    },
    {
      name: "passar_pro_criador",
      description:
        "Tira o agente da conversa e avisa o criador pra responder pessoalmente. Use quando: quer_comprar (quer comprar ou " +
        "negociar algo que não está nas ofertas), perguntou_se_e_ia (pergunta sincera se é robô/IA) ou precisa_de_voce " +
        "(pediu pra falar com ele, reclamação, assunto sensível, pergunta que você não responde sem inventar).",
      schema: z.object({
        tipo: z.enum(TIPOS_PASSAGEM).describe("o motivo principal"),
        motivo: z.string().describe("uma frase pro criador entender a situação sem abrir a conversa"),
      }),
    },
  );

  const encerrar = tool(
    async ({ motivo }) => {
      efeitos.encerrar = motivo;
      return "anotado. mande só o fechamento curto.";
    },
    {
      name: "encerrar_conversa",
      description: "Marca que a conversa chegou num fim natural. Use junto com um fechamento curto. Se a pessoa voltar a escrever, a conversa reabre sozinha.",
      schema: z.object({ motivo: z.string().describe("por que encerrou, em poucas palavras") }),
    },
  );

  const sair = tool(
    async ({ motivo }) => {
      efeitos.sair = motivo;
      return "anotado. peça desculpa em um balão curto e não pergunte mais nada.";
    },
    {
      name: "pediu_pra_sair",
      description: "A pessoa pediu pra não receber mais mensagem ou reclamou do contato. Ela nunca mais é chamada pelo sistema.",
      schema: z.object({ motivo: z.string().describe("o que ela disse, resumido") }),
    },
  );

  const ferramentas = [passar, encerrar, sair];

  if (opcoes.ofertas.length) {
    const nomes = opcoes.ofertas as [string, ...string[]];
    ferramentas.push(
      tool(
        async ({ oferta, resumo }: { oferta: string; resumo: string }) => {
          efeitos.oferta = { nome: oferta, resumo };
          return `anotado. na mesma resposta, em balões curtos: o convite pra "${oferta}" com o link dela (está no contexto, mande exatamente aquele). sem inventar preço nem urgência.`;
        },
        {
          name: "enviar_oferta",
          description: "Use quando uma das ofertas do contexto combina com o que a pessoa contou e você vai mandar o link dela. A conversa continua com você depois.",
          schema: z.object({
            oferta: z.enum(nomes).describe("o nome exato da oferta"),
            resumo: z.string().describe("em uma frase: quem é a pessoa e por que essa oferta"),
          }),
        },
      ) as unknown as typeof passar,
    );
  }

  if (opcoes.verificarSeSegue) {
    const verificar = opcoes.verificarSeSegue;
    ferramentas.push(
      tool(
        async () => {
          const segue = await verificar();
          return segue === true
            ? "segue sim, pode mandar o link do material."
            : segue === false
              ? "ainda NÃO segue: peça numa frase pra ela te seguir e espere ela avisar."
              : "não deu pra confirmar agora: manda o material assim mesmo.";
        },
        {
          name: "consultar_se_segue",
          description: "Confere se a pessoa segue a sua conta. Use antes de mandar o material quando o contexto disser que exige seguir.",
          schema: z.object({}),
        },
      ) as unknown as typeof passar,
    );
  }
  return ferramentas;
}
