# Estilo desta edição: Impacto (inspirado em Alex Hormozi)

O formato que dominou os vídeos curtos de negócio: **o criador falando direto pra câmera e a
legenda gigante mandando no vídeo**. Blocos de duas linhas em caixa alta, letra preta e redonda,
branca com sombra macia, e **uma das linhas pintada**: amarelo na ênfase, verde quando é dinheiro
ou ganho, vermelho quando é negação ou erro. Emoji embaixo de um bloco a cada quatro ou cinco.
Corte seco alternando dois enquadramentos e uma imagem estourando na tela a cada frase importante.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 2 s):** rosto em plano `fechado` e a legenda já na primeira palavra. Nenhum
   título, nenhum card: a frase dele é o gancho.
2. **Corpo:** legenda o tempo todo. A cada 3 a 6 s o enquadramento alterna entre `aberto` e
   `medio` (o estilo já faz isso sozinho). A cada frase que cita uma coisa concreta (uma tela, um
   número, um produto), entra uma imagem por 1 a 2,5 s.
3. **Fim:** `cta` se ele pedir comentário.

Motion cobre **pouco: 15 a 30%** do vídeo. Quem carrega é a legenda.

## Como editar

- **Legenda `impacto`** (padrão): 2 linhas, até 3 palavras por linha, caixa alta. O bloco aparece
  inteiro de uma vez e fica na altura do peito (embaixo do queixo) ou, em selfie de perto, em cima
  da cabeça. **Não é karaokê**: a palavra não acende; a linha com a palavra-chave nasce pintada.
  - Dê `destaques` nas palavras-chave (6 a 12 no vídeo): a linha dela vira amarela.
  - Dinheiro (R$ 1.200, 10 mil, milhão, lucro, grátis) sai **verde** sozinho; palavra de alerta
    (nunca, jamais, erro, pior, proibido, golpe) sai **vermelha** sozinha. Pra pintar outra
    palavra de vermelho ("não", "nada", "caro"): `{ "palavra": "nada", "cor": "vermelho" }`.
  - `emojis`: 1 a cada 4 ou 5 blocos, preso à palavra (`{ "i": 4, "emoji": "💰" }`). Fica embaixo
    do bloco. Emoji que ilustra a palavra, nunca decorativo.
  - Variante `torta` (`"legenda": { "estilo": "torta" }`): os blocos inclinam de 2 a 6 graus,
    alternando o lado. É a cara de 2022. Use se o pedido disser.
- **Imagens:** `fotos` (aqui o modo é `solta`: a imagem como ela é, sem moldura). O montador põe
  embaixo do queixo com ele visível; em selfie de perto, sobe pra faixa de cima. Ou, pra uma prova
  forte, `material`/`print` com `"area": "tela-cheia"` e `"sangrar": true` por 1 a 2 s.
- **Seta vermelha** (`anotacao` com `"forma": "seta"`, `"cor": "erro"`) apontando pro que ele
  mostra, com 1 ou 2 palavras em caixa alta.
- **Câmera:** o estilo alterna `aberto` e `medio` a cada 3 a 6 s. Escreva `angulos` só pra pôr
  `fechado` na frase mais forte.
- **Emendas:** secas. Sem onda, sem flash.
- **Sons:** `whoosh` quando a imagem entra, `pop` no emoji. Sem `riser` nem `ding`.

## Exemplo de plano

```json
{
  "legenda": {
    "destaques": ["ManyChat", "Instagram", { "palavra": "nada", "cor": "vermelho" }],
    "emojis": [{ "i": 4, "emoji": "💰" }, { "i": 26, "emoji": "📩" }, { "i": 101, "emoji": "👇" }]
  },
  "angulos": [{ "de": 0, "ate": 3.27, "plano": "fechado" }],
  "cenas": [
    { "de": 3.4, "ate": 6.1, "tipo": "fotos", "itens": [{ "material": "m1" }] },
    { "de": 12.6, "ate": 15.4, "tipo": "anotacao", "forma": "seta", "de_ponto": { "x": 0.16, "y": 0.36 }, "para": { "x": 0.36, "y": 0.5 }, "cor": "erro", "texto": "olha aqui" },
    { "de": 22.8, "ate": 28, "tipo": "cta", "palavra": "MANYCHAT", "frase": "comenta" }
  ]
}
```

## Nunca

- Legenda em caixa baixa, com mais de 2 linhas, ou em cima do rosto.
- Barra de progresso, logo fixa, manchete no alto.
- Dissolve, barras de cinema, filtro de cor: a imagem é natural.
- Card de lista, fluxo ou gráfico bonito. Aqui é foto, print e legenda.

## Identidade visual

### Style Prompt
Talking head de negócios, cru e direto. O criador de frente, cor natural. Legenda enorme em
Montserrat Black caixa alta, branca, sem contorno, com sombra preta macia em volta; blocos de duas
linhas em que uma linha inteira vem pintada de amarelo vivo, verde vivo ou vermelho. Um emoji
grande centralizado embaixo de alguns blocos. De vez em quando uma foto ou print sem moldura
aparece por cima, ou toma a tela por um segundo. Setas vermelhas desenhadas à mão. Corte seco com
aproximação.

### Colors
- `#FFFFFF` legenda
- `#F9FF09` amarelo (ênfase), `#37FF29` verde (dinheiro), `#ED4056` vermelho (negação)
- sombra `rgba(0,0,0,.9)` de 12 a 18 px

### Typography
- `Montserrat` 900 em tudo: legenda (104 px, entrelinha 0.96), título de card, seta

### What NOT to Do
- Contorno preto na legenda (é sombra macia)
- Karaokê palavra por palavra
- Card com design elaborado, degradê, vidro
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Evite. Se precisar: texto `#ffffff` em `"Montserrat"` 900 caixa alta com
`text-shadow: 0 0 14px rgba(0,0,0,.9)`, destaque `#F9FF09`.
