# Estilo desta edição: Documentário de streaming (inspirado em Netflix)

**Contenção de cinema.** Barras pretas em cima e embaixo, cor fria e dessaturada, vinheta e grão.
**Lugar e data datilografados**, **nome em letra pequena branca sem caixa**, **legenda de até duas
linhas como a de filme** e cartões pretos com **caixa alta condensada bem espaçada**. A câmera
aproxima devagar e as revelações levam uma **batida grave**. Pouco texto, muito peso.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **0 a 3 s:** `local` (lugar e data), ele já falando.
2. **3 a 8 s:** `tarja` com o nome e quem ele é na história.
3. **Corpo:** só a fala, com a aproximação lenta. A cada virada do assunto, um cartão `palavra`
   de 1,5 s ("COMO | FUNCIONA").
4. **A frase que fica:** uma `citacao` em tela preta com serifa.
5. **Fim:** rosto. `cta` discreto se ele pedir.

Motion em **menos de 25%**.

## Como editar

- **Legenda `subtitulo`** (padrão): frase completa, até 2 linhas de ~34 letras, branca com
  sombra fina, como legenda de filme. Sem destaque, sem `destaques`. Corrija nomes.
- **`local`:** caixa alta em letra de máquina. Só lugar e data reais.
- **`tarja`:** `nome` e `cargo` curto, na função dele na história ("Criou o próprio ManyChat").
- **`palavra`:** 1 ou 2 linhas de uma palavra cada, caixa alta. `"ouro": [1]` deixa a segunda em
  vermelho. No máximo 3 no vídeo.
- **Provas:** `material` em tela cheia com `"sangrar": true` (o print ou a gravação crua, sem
  moldura), 2 a 4 s.
- **Câmera:** automática: `aberto` e `medio` a cada 5 a 9 s, sempre empurrando devagar.
- **Emendas:** secas.
- **Sons:** `impacto` grave nos cartões e `tecla` no `local`. Nada mais.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0.2, "ate": 3.2, "tipo": "local", "linhas": ["SÃO PAULO, BRASIL", "1 DE OUTUBRO · 09:42"] },
    { "de": 3.4, "ate": 8.6, "tipo": "tarja", "cargo": "Criou o próprio ManyChat" },
    { "de": 11.6, "ate": 13.2, "tipo": "palavra", "texto": "COMO | FUNCIONA", "ouro": [1] },
    { "de": 18.9, "ate": 22.7, "tipo": "citacao", "texto": "É só seguir o que eu estou fazendo.", "autor": "Nome do criador" }
  ]
}
```

## Nunca

- Legenda grande, colorida ou palavra a palavra.
- Emoji, card colorido, lista, gráfico animado.
- Zoom rápido, mola, pop.
- Som agudo (ding, pop, whoosh).

## Identidade visual

### Style Prompt
Imagem fria e dessaturada, com barras pretas em cima e embaixo, vinheta e grão. Texto em letra de
máquina branca com letras bem espaçadas, digitado com cursor, no alto à esquerda logo abaixo da
barra. Nome em sans branca pequena e a função em cinza claro, sem caixa, surgindo em fade.
Legenda branca de duas linhas com sombra fina. Cartões pretos com caixa alta condensada bem
espaçada, branca, e uma linha em vermelho apagado. Citação em serifa branca sobre preto.

### Colors
- `#000000` barras e cartões, `#FFFFFF` texto
- `#d24a43` vermelho apagado (1 linha do cartão)
- banho frio `rgba(40,90,110,.16)`

### Typography
- `Archivo` condensada 700 com `letter-spacing: 0.16em`: cartões
- `Maquina` (Special Elite) com `letter-spacing: 0.2em`: lugar e data
- `Inter` 700: legenda (40 px), nome
- `SerifaReta` (Instrument Serif): citação

### What NOT to Do
- Cor viva, cantos arredondados, cartão claro
- Mais de 2 linhas de legenda
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use.
