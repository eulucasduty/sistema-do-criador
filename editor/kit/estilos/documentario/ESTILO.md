# Estilo desta edição: Documentário explicativo (inspirado em Vox)

Um **ensaio animado feito com as provas do assunto**: documento, print, foto e número tratados
como **papel de verdade**, em fundo creme (nunca branco puro). **Marca-texto amarelo** conduz o
olho, **traço de lápis** circula e sublinha, e os gráficos **andam aos pulinhos**, em 12 quadros
por segundo, como animação feita à mão. Corte seco: "transição não informa nada".
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 6 s):** já começa com a prova na tela: um `documento` (ou `print` real) na faixa
   de cima, com o trecho que importa marcado, enquanto ele fala.
2. **Corpo:** uma prova por ideia, trocando a cada 4 a 6 s: `lista` curta, `fotos` recortadas,
   `material`/`print` com `destaque`, `grafico` ou `contador` pro número.
3. **Respiro:** 1 ou 2 trechos só com ele, com uma `anotacao` a lápis (círculo, seta com 1 a 2
   palavras).
4. **Fim:** a conclusão numa `palavra` em serifa, ou o `cta`.

Motion em **60 a 80%** do vídeo. A imagem pode ficar parada 5 a 6 s: tudo bem.

## Como editar

- **Legenda `marca-texto`** (padrão): branca, pesada, até 4 palavras. As palavras de `destaques`
  ganham o marca-texto amarelo com letra preta. Dê 4 a 8 destaques.
- **`documento`:** `cabecalho` (o nome do veículo ou da fonte), `data`, `titulo` em serifa com um
  trecho `*marcado*`, `texto` de 2 a 3 frases com `==o trecho que importa==` e `fonte`. Só use
  texto real: o que ele mostrou, o que está no material dele ou uma fonte pública que você abriu.
  Se for resumo seu, a `fonte` diz isso ("resumo da documentação", "valores de exemplo").
- **`lista`:** `rotulo` (vira etiqueta amarela), título em serifa, até 4 itens.
- **`fotos`** (modo `card`): borda branca de papel, sombra, levemente tortas, com etiqueta amarela.
- **`print`/`material`:** sempre com `foco` e `destaque` (a caixa preta grossa).
- **`anotacao`:** `"cor": "#FFF200"` sobre o vídeo, preto sobre papel.
- **Texto:** frase normal. Título em serifa, rótulo em mono caixa alta.
- **Câmera:** aberto. Sem zoom rápido.
- **Emendas:** secas.
- **Sons:** de papel e de câmera: `obturador` na foto, `click` no destaque, `tecla` no documento.

## Exemplo de plano

```json
{
  "legenda": { "destaques": ["R$1.200", "gratuito", "comentários", "simples", "nada", "ManyChat"] },
  "cenas": [
    { "de": 0, "ate": 6.2, "tipo": "documento", "cabecalho": "Diário do Criador", "data": "1 de outubro", "titulo": "ManyChat cobra *R$ 1.200* por ano", "texto": "O plano pago sai caro pra quem está começando. ==Dá pra fazer o mesmo de graça== com um sistema próprio, ligado direto na API oficial.", "fonte": "valores de exemplo" },
    { "de": 6.3, "ate": 11.5, "tipo": "lista", "rotulo": "o que ele faz", "titulo": "Três tarefas", "itens": [{ "texto": "Responde os comentários", "i": 21 }, { "texto": "Chama na DM", "i": 24 }, { "texto": "Conversa com todo mundo", "i": 28 }] },
    { "de": 11.6, "ate": 15.5, "tipo": "fotos", "modo": "card", "itens": [{ "material": "m1" }], "rotulo": "o painel" },
    { "de": 18.9, "ate": 22.6, "tipo": "anotacao", "forma": "circulo", "em": { "x": 0.26, "y": 0.44, "w": 0.5, "h": 0.3 }, "cor": "#FFF200", "texto": "de graça" }
  ]
}
```

## Nunca

- Fundo branco puro ou preto. Degradê, neon, vidro.
- Movimento liso e perfeito nos gráficos (aqui é aos pulinhos).
- Transição enfeitada. Marca-texto em título inteiro.
- Documento ou manchete inventados como se fossem reais.

## Identidade visual

### Style Prompt
Colagem de papel sobre fundo creme texturizado. Recortes de documento com sombra, levemente
tortos, com cabeçalho em serifa, data em mono e um trecho coberto por marca-texto amarelo que se
desenha da esquerda pra direita. Fotos com borda branca de papel e etiqueta amarela em mono.
Listas com números em quadradinhos pretos. Traços de lápis circulando e sublinhando. Tudo anda em
12 quadros por segundo. Sobre o vídeo, legenda pesada branca com as palavras-chave em marca-texto.

### Colors
- `#F0EFEA` papel (fundo), `#fbfaf6` recortes
- `#131313` tinta, `#FFF200` amarelo
- `#C44C48` vermelho (etiqueta de data, 1 detalhe)

### Typography
- `Editorial` (Playfair Display 700): títulos
- `Franklin` (Libre Franklin 800 / 500): legenda, texto
- `Mono` 500 em caixa alta: rótulos, datas, fontes

### What NOT to Do
- Cantos muito arredondados, sombra colorida, brilho
- Mais de um acento além do amarelo
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `var(--void)` (papel), recorte `#fbfaf6` com `box-shadow: 0 18px 34px rgba(40,30,10,.4)` e
`border-radius: 2px`, título em `"Editorial"` 700, destaque com fundo `#FFF200`. Tweens com
`ease: "steps(n)"`.
