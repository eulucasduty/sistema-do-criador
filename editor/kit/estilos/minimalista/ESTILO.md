# Estilo desta edição: Minimalista (inspirado em Dan Koe)

**Só a pessoa falando.** Takes longos, sem zoom, sem música, sem efeito. **Uma linha de legenda em
serifa minúscula âmbar**, a frase inteira de uma vez, na altura do peito. O vídeo abre com um
**cartão preto com uma frase em serifa branca minúscula**, segurando uns 5 segundos. É o estilo de
ideia, reflexão e escrita: o silêncio entre as frases faz parte.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Cartão de abertura (3 a 5 s):** `palavra` com a tese do vídeo, minúscula, 1 ou 2 linhas.
   Fundo preto puro, letra branca, parada. (Se ele já começa falando forte, pule o cartão.)
2. **Corpo:** ele falando. Legenda e mais nada. Jump cut mantendo o enquadramento.
3. **Uma vez, se a fala pedir:** `citacao` em tela preta com a frase que resume, minúscula.

Motion em **menos de 15%** do vídeo.

## Como editar

- **Legenda `serifa`** (padrão): tudo minúsculo, vírgulas mantidas, 2 a 6 palavras numa linha,
  âmbar, sem contorno. Aparece inteira e troca seca. **Sem `destaques`.**
- **Cartão e citação:** minúsculo, sem aspas, sem ponto de exclamação. Na citação, `autor` em
  minúsculo.
- **Câmera:** parada. Não escreva `angulos`. Nada de `empurrar`.
- **Emendas:** secas (jump cut).
- **Sons:** nenhum. Não escreva `sons`.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 3.25, "tipo": "palavra", "texto": "o claude me paga | r$ 1.200 todo mês." },
    { "de": 18.9, "ate": 22.7, "tipo": "citacao", "texto": "é só seguir o que eu estou fazendo.", "autor": "nome do criador" }
  ]
}
```

## Nunca

- Destaque palavra a palavra, caixa alta, contorno, caixa atrás da legenda.
- Emoji, zoom, punch-in, transição.
- Efeito sonoro, música.
- Card, lista, gráfico colorido, tarja, barra de progresso.

## Identidade visual

### Style Prompt
Talking head seco, cor apagada, sombras levemente frias. Uma linha de legenda em serifa clássica
(Garamond) minúscula, âmbar, com sombra preta macia, na altura do peito. Cartões em preto puro com
uma frase em serifa branca minúscula centralizada. Nada se mexe além dele.

### Colors
- `#000000` cartão
- `#F0B419` legenda
- `#FFFFFF` texto do cartão

### Typography
- `Garamond` (EB Garamond 500): legenda (58 px), cartão (até 104 px), citação

### What NOT to Do
- Qualquer cor além do âmbar e do branco
- Sans, caixa alta, negrito pesado
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use.
