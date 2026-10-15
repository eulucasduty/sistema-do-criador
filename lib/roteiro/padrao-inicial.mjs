// O guia do PADRÃO VIRAL que o escritor de roteiros segue (configuracao "padrao_viral", editável em
// Roteiros → Padrão viral). Regras (gancho, estrutura, ritmo, vocabulário, CTA) + exemplos de fala
// como few-shot: é o exemplo de fala de verdade que tira a cara de texto de IA. Por isso o melhor é
// trocar os exemplos ilustrativos daqui pela transcrição de reels que viralizaram no seu nicho (a
// Esteira transcreve pra você). Sem nada salvo no banco, vale o PADRAO_INICIAL.
//
// JavaScript puro: o painel e a estação (que escreve os roteiros no PC do criador) usam o mesmo.

/** @typedef {{ titulo: string, fonte: string, transcricao: string, por_que: string }} ExemploViral */
/** @typedef {{ regras: string, exemplos: ExemploViral[], proibidas: string[], atualizado_em?: string, fonte?: string }} PadraoViral */

/** @type {PadraoViral} */
export const PADRAO_INICIAL = {
  fonte: "o padrão inicial do sistema (troque os exemplos pelos virais do seu nicho)",
  proibidas: [],
  regras: `DOIS FORMATOS QUE COSTUMAM VIRALIZAR

A) NOVIDADE OU DICA PRÁTICA (30 a 50 s)
1. Gancho (0 a 2 s): uma frase de impacto que já nomeia a coisa. Tipos:
   ruptura ("[a novidade] acabou com [o jeito antigo]", "já era pra quem ainda [faz do jeito difícil]");
   dor + imagem absurda ("se [o problema] vive te [atrapalhando], [solução exagerada e visual]");
   bastidor + dinheiro ("é com [essa coisa simples] que quem tá por dentro tá [ganhando ou economizando]");
   reconhecimento ("eu tenho certeza que você já viu [coisa] que todo mundo posta").
2. O nome da coisa (e se é de graça ou barata) até o 8º segundo.
3. O que faz e como funciona, em frases curtas, falando SOBRE a tela.
4. A virada no meio: "a parte mais interessante é que…", "o mais insano disso é que…", "só que…".
5. O ganho como dor resolvida, do jeito que a pessoa sente: "você para de travar…", "em vez de fazer de novo e de novo…".
6. Como começar em UMA frase, antes do CTA.
7. CTA de passo a passo com a palavra (ver CTA).

B) CASE OU HISTÓRIA COM RESULTADO (60 a 100 s)
1. Gancho com paradoxo + número grande + esforço pequeno: "[alguém improvável] conseguiu [resultado] com só [pouca coisa]".
2. Prova na hora, apontando a tela: o número, o print, o antes e depois.
3. "Só que como isso é possível?" e os passos do que foi feito ("primeiro, …").
4. A revelação e a objeção já respondida ("você pode achar que…").
5. A tese: "o ponto que eu quero te mostrar é: …".
6. Trazer pro espectador: "agora imagina isso na sua vida / no seu negócio".
7. CTA no fim. Dá pra fechar em loop: a última frase emenda na primeira do vídeo.

GANCHO (0 a 3 s)
- A 1ª frase já é o choque. Nada de "oi gente", "nesse vídeo eu vou", apresentação ou contexto antes.
- 1ª linha com até 10 palavras. A 2ª linha explica a promessa ou dobra a aposta.
- O sujeito é concreto: a coisa pelo nome, "esse app", "essa receita", "esse cara". Nada genérico.

RITMO
- Vídeo que viraliza fala rápido: 3,8 a 4,4 palavras por segundo. 30 a 45 s dá por volta de 100 a 150 palavras.
- Frase falada de 8 a 17 palavras, emendada com "e", "só que", "aí", "então". No teleprompter, uma ideia por linha.
- Lista falada com a mesma palavra repetida funciona ("outro jeito, outro horário, outra ordem"; "o que comprar, quando comprar e quanto guardar"). Lista de adjetivos soltos, não.
- Nenhuma frase de efeito fechando bloco. O vídeo termina no CTA, sem despedida.

FALAR SOBRE A TELA
- O texto é dito em cima do que aparece: "esse link aqui", "olha isso aqui", "aqui é o gráfico". Cada "aqui" precisa de uma dica de gravação dizendo o que aparece.
- Troca de imagem a cada 2 a 4 s (prints, demonstração, gravação de tela). Tela dividida com a pessoa embaixo e a coisa em cima funciona.

PROVA
- Mostrar, não afirmar: a coisa funcionando, o número na tela, o antes e depois.
- Número só se for público ou do próprio criador (aí em [colchetes] pra ele preencher). Resultado de outro criador não vira do criador.
- Uma recomendação pessoal dá autoridade: "é o que eu mais uso", "eu te recomendo começar por aqui".

VOCABULÁRIO
- "de graça", "basta", "passo a passo", "absurdo", "insano", "bizarro", "só que", "basicamente" (pouco), "cara", "tá", "pra", "a gente".
- Exagero com imagem ("brigar até a morte", "acabou com o jeito antigo"): é o que segura o dedo.
- Marca, app ou produto pelo nome certo e só se existe de verdade.

CTA (últimos 3 a 5 s)
- O mais comum nos virais: "se você quer o passo a passo, comenta [PALAVRA] aqui embaixo que eu te mando".
- A palavra é o nome da coisa ou do assunto, curta, em maiúscula. A automação do Instagram responde no direct, então a palavra tem que ter automação ativa.
- Vem logo depois do "como começar": o vídeo dá a essência de graça e o CTA entrega o passo a passo completo.

O QUE OS VIRAIS FAZEM E VOCÊ NÃO PRECISA COPIAR
- Contradição ("não é uma dica, são cinco"): fale direto, "são cinco dicas, cada uma resolve uma coisa".
- "Não, não, não" negando a crença de quem assiste: troque por mostrar o que dá pra fazer.`,
  exemplos: [
    {
      titulo: "Os três potes do salário",
      fonte: "exemplo ilustrativo do sistema, formato novidade ou dica (troque por um viral de verdade do seu nicho)",
      transcricao: `Se o seu dinheiro some todo mês e você nem sabe pra onde,
faz o teste dos três potes.
É de graça e leva uns dez minutos.
Você abre três caixinhas no app do seu banco, sabe aquelas caixinhas?
Uma pra conta fixa, uma pra gastar e uma que você não encosta.
Aí no dia que o salário cai, você já divide na hora.
Só que tem um detalhe que muda tudo.
Você divide antes de pagar qualquer conta.
Então em vez de descobrir no fim do mês quanto sobrou,
você já sabe no começo quanto pode gastar.
Pra começar, abre o app agora e cria a primeira caixinha.
Se você quer a planilha pra dividir, comenta POTES aqui embaixo que eu te mando.`,
      por_que:
        "Dor que todo mundo tem no gancho, nome do método e 'de graça' no 4º segundo, passo a passo em frases de 6 a 14 palavras com lista falada ('uma pra… uma pra…'), a virada 'só que tem um detalhe', ganho como dor resolvida ('em vez de descobrir no fim do mês'), como começar em uma frase e CTA com a palavra do assunto.",
    },
    {
      titulo: "Quinze minutos na sala de casa",
      fonte: "exemplo ilustrativo do sistema, formato case com resultado (troque por um viral de verdade do seu nicho)",
      transcricao: `Essa mulher de cinquenta e dois anos começou a treinar na sala de casa
e em seis meses subia três andares de escada sem parar.
Olha isso aqui: no primeiro vídeo ela faz três agachamentos e senta.
Só que como isso é possível sem academia?
Primeiro, ela treinava só quinze minutos, todo dia, no mesmo horário.
Depois, ela trocava um exercício por semana, nunca mais que um.
E ela anotava tudo num caderno, cada repetição.
Você pode achar que quinze minutos é pouco, enfim,
mas o caderno mostra que ela não faltou um dia.
O ponto que eu quero te mostrar é esse:
o que fez a diferença foi a constância.
Agora imagina você começando isso amanhã cedo.
Se você quer o treino de quinze minutos que ela fez, comenta CADERNO que eu te mando.`,
      por_que:
        "Paradoxo + resultado concreto + esforço pequeno no gancho, prova imediata apontando a tela, 'só que como isso é possível?' abrindo os passos, objeção respondida antes, a tese, trazer pra quem assiste e CTA com a entrega concreta.",
    },
  ],
};

/**
 * O guia salvo no banco, normalizado. Sem regras salvas, vale o PADRAO_INICIAL.
 * @param {unknown} salvo
 * @returns {PadraoViral}
 */
export function padraoValido(salvo) {
  const s = /** @type {Partial<PadraoViral> | null} */ (salvo && typeof salvo === "object" ? salvo : null);
  if (!s?.regras || !String(s.regras).trim()) return PADRAO_INICIAL;
  return {
    regras: String(s.regras),
    exemplos: Array.isArray(s.exemplos) ? s.exemplos.filter((e) => e && String(e.transcricao ?? "").trim()) : [],
    proibidas: Array.isArray(s.proibidas) ? s.proibidas.map(String).filter((p) => p.trim()) : [],
    atualizado_em: s.atualizado_em,
    fonte: s.fonte,
  };
}

/**
 * O guia no formato do prompt: regras + exemplos de fala.
 * @param {PadraoViral} p
 */
export function padraoEmTexto(p) {
  return {
    regras: p.regras.trim(),
    exemplos: p.exemplos.map((e, i) => `### Exemplo ${i + 1}: ${e.titulo}\n(${e.fonte})\n${e.transcricao.trim()}\nPor que funcionou: ${e.por_que}`).join("\n\n"),
  };
}
