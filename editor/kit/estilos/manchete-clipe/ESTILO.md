# Estilo desta edição: Manchete + clipe (inspirado em GaryVee)

**Tela preta, a manchete em duas linhas no alto e o vídeo num clipe no meio.** A primeira linha da
manchete é fina e branca; a segunda é pesada, com a frase-chave em vermelho. A legenda é pequena,
branca, dentro do terço de baixo do clipe. Os 27% de baixo ficam pretos, livres pro texto do post.
Nenhum efeito, nenhum som: o conteúdo é a fala. É o formato de corte de palestra e de opinião.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

A tela é a mesma do começo ao fim:

- **manchete** fixa no alto (`plano.manchete`): resume a tese do vídeo, não a primeira frase;
- **clipe** no meio, com o rosto enquadrado;
- **legenda** dentro do clipe.

O que muda é só a fala. No máximo 1 ou 2 inserts no vídeo inteiro.

## Como editar

- **Manchete:** `"Linha 1 | *frase-chave*"`. Linha 1 com 4 a 6 palavras em caixa normal; linha 2
  com 2 a 5 palavras e a parte marcada em vermelho. Ex.: `"Como eu criei um | *ManyChat de graça*"`.
  Sem ponto final, sem caixa alta, sem emoji.
- **Legenda `clipe`** (padrão): branca, fina, frase normal, 2 a 3 palavras, sem destaque. Não dê
  `destaques`.
  - Variante `caixa-amarela` (`"legenda": { "estilo": "caixa-amarela" }`): condensada itálica preta
    em caixa alta sobre um retângulo amarelo. É a versão de 2025. Use se o pedido disser.
- **Inserts:** só se for indispensável mostrar algo. `material` ou `print` em `"area": "tela-cheia"`
  com `"sangrar": true`, de 1,5 a 3 s. Nada de card.
- **Câmera:** parada. Sem `angulos`.
- **Emendas:** secas.
- **Sons:** nenhum (o estilo já desliga os automáticos). Não escreva `sons`.

## Exemplo de plano

```json
{
  "manchete": "Como eu criei um | *ManyChat de graça*",
  "rosto": { "x": 0.5, "y": 0.5 },
  "cenas": []
}
```

## Nunca

- Qualquer animação chamativa, emoji, sticker, barra de progresso.
- Legenda grande, colorida ou em caixa alta (na variante padrão).
- Card, lista, gráfico, cabeçalho, palavra em tela cheia.
- Música ou efeito sonoro.

## Identidade visual

### Style Prompt
Fundo preto puro. No alto, duas linhas centralizadas em sans neutra de letras juntas: a primeira
regular e branca, a segunda bold e branca com a frase-chave em vermelho. No meio, o vídeo num
retângulo de largura total, sem borda nem canto arredondado. Dentro dele, embaixo, legenda branca
pequena com sombra. Embaixo do clipe, preto vazio.

### Colors
- `#000000` fundo, `#FFFFFF` texto
- `#E52339` vermelho da frase-chave
- variante: caixa `#F8EA0E` com texto preto

### Typography
- `Inter` 500 (linha 1, ~64 px) e 700 (linha 2, ~82 px), `letter-spacing: -0.02em`
- legenda: `Inter` 500, 50 px
- variante: `DinCondensada` 800 itálica (Barlow Condensed), caixa alta

### What NOT to Do
- Fonte de gibi, contorno, karaokê
- Moldura, sombra ou canto arredondado no clipe
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use.
