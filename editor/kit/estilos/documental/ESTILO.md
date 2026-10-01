# Estilo desta edição: Minimal documental (inspirado em Matt D'Avella)

**Plano parado, cor quente e apagada, quase nenhum gráfico.** A legenda é **branca numa caixa
quase preta arredondada**, uma ou duas linhas, entrando e saindo em corte seco. O nome de quem
fala aparece em **serifa branca, à direita, sem barra, só em fade**. As imagens que ilustram a
fala entram em tela cheia. O título de seção é um cartão quase preto com **caixa alta condensada
verde**. Quem carrega o vídeo é a composição e a fala.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Abertura:** ele falando. Aos 0,6 s, a `tarja` com nome e o que ele faz, por 4 a 5 s.
2. **Corpo:** fala com legenda, alternando com **b-roll dele** (`material` em tela cheia com
   `"sangrar": true`, 2 a 4 s) quando ele descreve algo que foi filmado ou capturado.
3. **Seção nova:** um cartão `palavra` de 1,2 a 1,5 s ("PASSO UM", "DIA 30").
4. **Fim:** ele falando. Sem `cta` chamativo; se pedir comentário, use o `cta` normal.

## Como editar

- **Legenda `caixa`** (padrão): frase normal com pontuação, 1 a 2 linhas, 2 a 9 palavras. Sem
  destaque de palavra, sem `destaques`. Variante `solta`: sem caixa, com sombra.
- **Tarja:** `nome` e `cargo` (o cargo sai em itálico). Uma vez só.
- **Cartão de seção:** `palavra` com 1 ou 2 palavras em caixa alta. No máximo 3 no vídeo.
- **Sem cards de dado.** Se precisar de número, uma `palavra` com o número.
- **Câmera:** parada, plano `aberto`. Sem `angulos`, sem `empurrar`, sem inclinar.
- **Emendas:** secas.
- **Sons:** nenhum.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0.6, "ate": 5.6, "tipo": "tarja", "cargo": "Criador de sistemas com IA" },
    { "de": 6.3, "ate": 9.4, "tipo": "material", "material": "m1", "area": "tela-cheia", "sangrar": true },
    { "de": 11.6, "ate": 13.0, "tipo": "palavra", "texto": "PASSO UM" }
  ]
}
```

## Nunca

- Legenda animada, colorida ou com palavra acendendo.
- Zoom, câmera tremida, transição chamativa.
- Cor saturada, gráfico carregado, emoji.
- Efeito sonoro.

## Identidade visual

### Style Prompt
Imagem de tripé, quente e levemente apagada, com vinheta leve. Legenda em sans bold branca dentro
de uma caixa quase preta de cantos arredondados, centralizada, no terço de baixo. Nome em serifa
branca alinhado à direita em duas linhas, a segunda em itálico, sem nenhuma barra, surgindo em
fade lento. Cartões quase pretos com duas ou três palavras em caixa alta condensada verde.

### Colors
- `#0C0C0A` caixa da legenda e cartões
- `#FFFFFF` texto
- `#7fd08a` verde do cartão de seção
- banho quente `rgba(255,190,120,.08)`

### Typography
- `Roboto` 700: legenda (54 px)
- `Garamond` 500 e itálica: nome e cargo
- `DinCondensada` 700 (Barlow Condensed): cartão de seção

### What NOT to Do
- Mais de uma cor de acento
- Qualquer coisa piscando ou pulando
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use.
