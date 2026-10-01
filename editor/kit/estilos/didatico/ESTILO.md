# Estilo desta edição: Didático leve (inspirado em Ali Abdaal)

**Simpático e claro.** O criador fala de frente e o terço de cima enche de **títulos em serifa
macia, em tons pastel, com as letras crescendo uma a uma**; a palavra-chave vira uma **pílula
branca com letra carmim** e ganha **dois riscos vermelhos à mão** embaixo. A legenda é uma
**pílula cinza-clara em que a frase aparece apagada e cada palavra escurece quando é falada**. Nos
trechos de lista, ele encolhe pra uma janelinha arredondada e um cartão claro toma a tela. **Cada
coisa que entra tem um som.**
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 5 s):** `cabecalho` com o título do vídeo em duas linhas, frase normal, e um
   aparte à mão em cima (`rotulo`). Marque 1 palavra com `*…*`.
2. **Corpo:** a cada ideia nova, um título (`cabecalho` ou `lettering`) por 3 a 5 s. Quando ele
   lista coisas, uma `lista` em tela cheia (ele vai pra janelinha à esquerda).
3. **Ênfase solta:** `carimbo` amarelo inclinado (a tira de marca-texto) numa expressão curta.
4. **Fim:** `cta`.

Títulos e cartões em **40 a 60%** do vídeo.

## Como editar

- **Legenda `pilula`** (padrão): frase normal, começa minúscula, 2 a 4 palavras (até 23 letras),
  numa linha. Sem `destaques` (o preenchimento já acompanha a fala).
- **Títulos:** frase normal, nunca caixa alta. Duas linhas de 2 a 3 palavras. O `rotulo` é o
  aparte manuscrito ("sem pagar nada", "olha isso"). Os riscos à mão e a saída borrada são
  automáticos.
- **`lettering`** pra uma frase curta no meio do vídeo: 1 linha, com a palavra marcada.
- **`lista`** com `"area": "tela-cheia"`: título curto em serifa e 3 itens; os números vêm em
  círculos azul, lavanda e coral. Dê `i` nos itens.
- **Imagens:** `fotos` no modo `card` (print com canto redondo e sombra) e `material` em tela
  cheia pra captura de site.
- **`carimbo`:** `"cor": "#F4D542"`, `"tinta": "#1B1624"`, `"inclinar": -6`, 1 a 3 palavras em
  frase normal.
- **Câmera:** aberto, sem punch-in.
- **Emendas:** secas.
- **Sons:** automáticos e em todo evento: `tecla` nas letras, `whoosh` nos riscos, `pop` nos
  itens, `ding` quando uma imagem pousa, `obturador` em foto.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 6.2, "tipo": "cabecalho", "rotulo": "sem pagar nada", "linhas": ["O sistema que", "*responde* sozinho"] },
    { "de": 6.3, "ate": 11.5, "tipo": "lista", "area": "tela-cheia", "titulo": "Três coisas", "itens": [{ "texto": "Responde os comentários", "i": 21 }, { "texto": "Chama na DM", "i": 24 }, { "texto": "Conversa com todo mundo", "i": 28 }] },
    { "de": 11.6, "ate": 15.5, "tipo": "lettering", "linhas": [{ "texto": "É muito *simples*", "i": 37 }] },
    { "de": 18.9, "ate": 22.6, "tipo": "carimbo", "texto": "de graça", "cor": "#F4D542", "tinta": "#1B1624", "y": 0.2, "inclinar": -6 }
  ]
}
```

## Nunca

- CAIXA ALTA em título ou legenda.
- Contorno pesado, neon, fundo preto puro, grade escura.
- Tremor, zoom agressivo, glitch.
- Título com mais de 2 linhas.

## Identidade visual

### Style Prompt
Talking head casual, cor natural com os pretos levantados. No terço de cima, sobre um escurecido
suave, títulos em serifa macia de peso médio com degradê do azul-céu pro lavanda; uma palavra numa
pílula branca com letra carmim; dois riscos vermelhos desenhados à mão embaixo; um aparte em letra
manuscrita amarelo-manteiga. Legenda em sans geométrica numa pílula cinza-clara com sombra fraca,
as palavras passando de cinza pra quase preto. Nas listas, um cartão branco arredondado sobre
papel quente, com círculos numerados azul, lavanda e coral, e o criador numa janela arredondada à
esquerda.

### Colors
- títulos: degradê `#CFDAFA` → `#E2BBFC`; segunda linha `#95CFEB` → `#C3B4FA`
- pílula de ênfase `#FFFFFF` com texto `#B14260`; riscos `#D7315B`; aparte `#F3DE9C`
- marca-texto `#F4D542`
- legenda: pílula `#E6E4E7`, texto `#A3A1A4` → `#181719`
- cartões: fundo `#F9F6F3`, texto `#1B1624`; círculos `#5DCDF1`, `#C9B1FB`, `#FD976D`

### Typography
- `Fraunces` 600: títulos (96 px), título de lista
- `Poppins` 600: legenda (56 px)
- `Manuscrita` (Caveat): apartes

### What NOT to Do
- Preto puro, neon, cor saturada
- Sans pesada em caixa alta
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `#F9F6F3`, cartão branco com `border-radius: 30px` e sombra marrom macia, título em
`"Fraunces"` 600, texto `#1B1624`, acentos pastel.
