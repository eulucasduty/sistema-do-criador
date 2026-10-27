// Teste da esteira de reels e do roteiro sem IA (sem banco, sem IA): npm run reels:testar
//   · agenda dos reels, legenda com o CTA, etapas da esteira, ajustes da estação;
//   · roteiro colado / pela transcrição (lib/roteiro/da-texto.ts);
//   · monitor: a janela de 2 dias atrás e a ordem do mais viral (lib/monitor/comum.ts).
import assert from "node:assert/strict";
import { proximoHorario, etapaDaEdicao, filtroCss, AJUSTES_NEUTROS } from "@/lib/reels";
import { legendaDoReel, ctaDoReel } from "@/lib/postagem/legenda-carrossel";
import { ehPortugues, linhasDe, palavraDoComenta, partesDoTexto, versaoDoTexto } from "@/lib/roteiro/da-texto";
import { janelaDosPosts, viralidade } from "@/lib/monitor/comum";
import { filtroAjustes } from "../editor/estacao/takes.mjs";

let n = 0;
const ok = (nome: string, f: () => void) => {
  f();
  n++;
  console.log(`✓ ${nome}`);
};

ok("agenda: próximo horário livre", () => {
  const base = new Date("2026-10-20T10:00:00-03:00");
  const a = proximoHorario(["11:00", "19:00"], [], base);
  assert.equal(a.toISOString(), new Date("2026-10-20T11:00:00-03:00").toISOString());
  const b = proximoHorario(["11:00", "19:00"], [a.toISOString()], base);
  assert.equal(b.toISOString(), new Date("2026-10-20T19:00:00-03:00").toISOString());
  const c = proximoHorario(["11:00", "19:00"], [a.toISOString(), b.toISOString()], base);
  assert.equal(c.toISOString(), new Date("2026-10-21T11:00:00-03:00").toISOString());
});

ok("legenda do reel: CTA na 1ª linha, sem duplicar", () => {
  const est = "olha isso aqui que eu fiz com o claude.\ncomenta CLAUDE que eu te mando o passo a passo.\n\n#ia #claude";
  const l = legendaDoReel("claude", est);
  assert.ok(l.startsWith(ctaDoReel("CLAUDE")));
  assert.ok(!/comenta claude que/i.test(l));
  assert.equal(legendaDoReel("claude", l), l);
  assert.equal(legendaDoReel(null, est), est.trim());
});

ok("etapas da esteira", () => {
  assert.equal(etapaDaEdicao({ status: "gravado", aprovada_em: null }, null), "pra_editar");
  assert.equal(etapaDaEdicao({ status: "editando", aprovada_em: null }, null), "editando");
  assert.equal(etapaDaEdicao({ status: "pronto", aprovada_em: null }, null), "review");
  assert.equal(etapaDaEdicao({ status: "pronto", aprovada_em: "x" }, { status: "pronta" }), "postagem");
  assert.equal(etapaDaEdicao({ status: "pronto", aprovada_em: "x" }, { status: "publicada" }), "postados");
});

ok("ajustes de imagem", () => {
  assert.equal(filtroAjustes(AJUSTES_NEUTROS), null);
  assert.ok(filtroAjustes({ brilho: 0.3, iluminacao: -0.2, nitidez: 0.5 }));
  assert.match(filtroCss({ brilho: 0.3, iluminacao: -0.2, nitidez: 0.5 }), /brightness/);
});

// ── roteiro sem IA ──
const fala =
  "Esse aqui é o jeito mais rápido de criar um agente no WhatsApp sem saber programar. Você abre o Claude, cola esse prompt e ele monta tudo pra você, inclusive as mensagens de boas vindas, o cardápio e as respostas pras perguntas mais comuns dos teus clientes. Depois é só conectar o número. Em dez minutos tá rodando. Comenta AGENTE que eu te mando o prompt completo no direct.";

ok("transcrição vira gancho / corpo / CTA", () => {
  const p = partesDoTexto(fala);
  assert.equal(p.gancho.join(" "), "Esse aqui é o jeito mais rápido de criar um agente no WhatsApp sem saber programar.");
  assert.ok(p.gancho.length <= 2);
  assert.equal(p.cta.length, 1);
  assert.match(p.cta[0], /^Comenta AGENTE/);
  assert.ok(p.corpo.length >= 3);
  for (const l of [...p.gancho, ...p.corpo, ...p.cta]) assert.ok(l.split(" ").length <= 12, `linha longa: ${l}`);
  assert.equal([...p.gancho, ...p.corpo, ...p.cta].join(" ").replace(/\s+/g, " "), fala, "não perde nem inventa palavra");
});

ok("palavra do comenta", () => {
  assert.equal(palavraDoComenta('comenta "prompt" aqui embaixo'), "PROMPT");
  assert.equal(palavraDoComenta("comente a palavra agente"), "AGENTE");
  assert.equal(palavraDoComenta("comenta aqui embaixo o que achou"), null);
  assert.equal(palavraDoComenta("sem pedido nenhum"), null);
});

ok("linha longa quebra sem sobrar palavra sozinha", () => {
  const l = linhasDe("um dois tres quatro cinco seis sete oito nove dez onze doze treze");
  assert.equal(l.length, 2);
  assert.ok(l.every((x) => x.split(" ").length >= 6));
});

ok("roteiro colado com GANCHO / CORPO / CTA", () => {
  const v = versaoDoTexto("GANCHO\nolha o que o claude fez\nCORPO\nprimeiro ele leu a planilha\ndepois montou o relatório\nCTA\ncomenta RELATORIO que eu te mando", {
    duracaoAlvo: 45,
    deOndeVeio: "colado",
    modelo: "colado à mão",
  });
  assert.deepEqual(v.gancho, ["olha o que o claude fez"]);
  assert.deepEqual(v.corpo, ["primeiro ele leu a planilha", "depois montou o relatório"]);
  assert.deepEqual(v.cta, ["comenta RELATORIO que eu te mando"]);
  assert.equal(v.palavra_cta, "RELATORIO");
  assert.equal(v.titulo, "olha o que o claude fez");
  assert.ok(v.checagem.segundos > 0 && v.custo_usd === 0);
});

ok("palavra informada vale por cima da do texto", () => {
  assert.equal(versaoDoTexto(fala, { palavra: "zap", duracaoAlvo: 45, deOndeVeio: null, modelo: "x" }).palavra_cta, "ZAP");
});

ok("língua da fala: o gringo é traduzido, o brasileiro não", () => {
  assert.equal(ehPortugues(fala), true);
  assert.equal(ehPortugues("This is the fastest way to build an agent. Comment AGENT and I will send you the prompt."), false);
  assert.equal(ehPortugues("Inbox Agent."), true, "curto demais: não gasta tradução");
});

// ── monitor ──
ok("janela: 2 dias atrás, um dia de posts", () => {
  const agora = new Date("2026-10-20T09:00:00-03:00");
  const d = 86_400_000;
  // criador que já tinha visto ontem (o modo antigo): começa da janela de 2 dias atrás
  let j = janelaDosPosts(new Date(agora.getTime() - 3600_000).toISOString(), 2, agora);
  assert.equal(j.ate.getTime(), agora.getTime() - 2 * d);
  assert.equal(j.desde.getTime(), agora.getTime() - 3 * d);
  // conferência diária: a janela anda do fim da última
  j = janelaDosPosts(new Date(agora.getTime() - 3 * d).toISOString(), 2, agora);
  assert.equal(j.desde.getTime(), agora.getTime() - 3 * d);
  // ficou uma semana sem conferir: no máximo 3 dias
  j = janelaDosPosts(new Date(agora.getTime() - 9 * d).toISOString(), 2, agora);
  assert.equal(j.desde.getTime(), agora.getTime() - 5 * d);
  // primeira vez
  j = janelaDosPosts(null, 2, agora);
  assert.equal(j.desde.getTime(), agora.getTime() - 3 * d);
  // atraso 0: o modo antigo (desde o visto, primeira vez 48 h)
  j = janelaDosPosts(null, 0, agora);
  assert.equal(j.desde.getTime(), agora.getTime() - 2 * d);
  assert.equal(j.ate.getTime(), agora.getTime());
});

ok("viralidade: views no YouTube, curtidas + comentários no Instagram", () => {
  assert.equal(viralidade({ views: 1000, curtidas: 5 }), 1000);
  assert.equal(viralidade({ curtidas: 100, comentarios: 10 }), 130);
  const posts = [{ curtidas: 10, comentarios: 0 }, { curtidas: 50, comentarios: 40 }, { curtidas: 200, comentarios: 1 }];
  assert.deepEqual(
    posts.sort((a, b) => viralidade(b) - viralidade(a)).map((p) => p.curtidas),
    [200, 50, 10],
  );
});

console.log(`\n${n} conferências, tudo certo`);
