# Estilo desta edição: Motion explicativo

Abre **no rosto, com um título condensado gigante** no alto. Depois o criador **encolhe pra uma
janelinha no canto de baixo** e a tela vira uma **lista de pontos que acendem um a um** no ritmo
da fala, cada um com um ícone que se desenha. É o estilo pra "três pontos", "cinco erros",
"o passo a passo".
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 3 s):** rosto em tela cheia + `cabecalho` de título, duas linhas condensadas em
   caixa alta, a segunda em lilás. A frase termina com ponto: `"PRECISA CABER" / "NA SUA ROTINA."`.
2. **Corpo (60 a 75% do vídeo):** uma `lista` com `"area": "tela-cheia"` e `"modo": "foco"`. Ele
   vai pra janelinha embaixo à direita. Todos os itens aparecem apagados; o da vez acende quando
   ele fala (dê `i` em cada um). Do lado da janelinha, o `rodape`: ícone, duas linhas e um traço.
3. **Volta (3 a 6 s):** rosto em tela cheia com outro `cabecalho` (a conclusão).
4. **Fim:** `cta`.

## Como editar

- **Lista em foco:** 3 itens é o ideal (máximo 4). Cada item: `texto` de 1 a 2 palavras em caixa
  alta, `sub` com a explicação em caixa normal (até 5 palavras) e `icone`. O `titulo` da lista
  repete o tema em duas linhas (`"TRÊS PONTOS | PARA SUA ROTINA."`) e o `rotulo` é a categoria
  (`"ALIMENTAÇÃO · VIDA REAL"`).
- **Ícones se desenham:** escolha ícone de traço simples (`calendar-days`, `pie-chart`,
  `clipboard-check`, `target`, `message-circle`).
- **Legenda:** `frase` (padrão): a frase inteira numa caixa escura de duas linhas, embaixo. Sem
  destaque de palavra. Corrija nomes com `correcoes`.
- **Câmera:** aberto no gancho. Sem zoom, sem inclinar.
- **Emendas:** secas.
- **Sons:** `pop` quando cada item acende; `whoosh` na troca pro corpo. Nada além.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 3.2, "tipo": "cabecalho", "linhas": ["MANYCHAT", "DE GRAÇA."] },
    { "de": 3.3, "ate": 15.5, "tipo": "lista", "area": "tela-cheia", "modo": "foco",
      "rotulo": "INSTAGRAM · AUTOMAÇÃO", "titulo": "TRÊS COISAS | QUE ELE FAZ.",
      "itens": [
        { "texto": "RESPONDE", "sub": "Lê e responde os comentários", "icone": "message-circle", "i": 19 },
        { "texto": "CHAMA NA DM", "sub": "Manda o material na hora", "icone": "send", "i": 24 },
        { "texto": "CONVERSA", "sub": "Com todo mundo que comenta", "icone": "messages-square", "i": 28 }
      ],
      "rodape": { "linhas": ["UM PASSO", "DE CADA VEZ."], "icone": "footprints" } },
    { "de": 15.6, "ate": 22.6, "tipo": "cabecalho", "rotulo": "SEM GASTAR NADA", "linhas": ["É SÓ SEGUIR", "O PROMPT."] },
    { "de": 22.8, "ate": 28, "tipo": "cta", "palavra": "MANYCHAT", "frase": "comenta" }
  ]
}
```

## Nunca

- Item de lista com frase comprida no `texto` (a frase vai no `sub`).
- Lista sem `i` nos itens: o foco tem que andar com a fala.
- Mais de uma lista em foco por vídeo. Card de faixa (tela dividida).

## Identidade visual

### Style Prompt
Fundo quase preto com um brilho violeta no canto de cima à direita. Títulos em sans condensada
pesada, caixa alta, grandes, alinhados à esquerda, com a segunda linha em lilás e um traço em
degradê embaixo. Lista de linhas largas com borda fina: ícone de traço num quadrado à esquerda,
nome condensado em caixa alta e uma linha de apoio pequena; a linha da vez ganha borda lilás e um
degradê violeta. O criador numa janela pequena de canto pouco arredondado, embaixo à direita, com
duas linhas condensadas e um ícone de traço ao lado. Legenda numa caixa escura no rodapé.

### Colors
- `#0a0712` fundo, brilho `#683ccc` no canto
- `#f2eafc` texto, `#c4a6fa` segunda linha e ícones, `#8377a8` itens apagados
- `#9153f8` degradê da linha em foco

### Typography
- `Archivo` condensada 700: títulos, itens e rodapé (caixa alta)
- `Jakarta` 500: linha de apoio dos itens
- `Jakarta` 800 com `letter-spacing: 0.22em`: rótulo

### What NOT to Do
- Nada de título centralizado ou em caixa normal
- Nada de card com sombra: aqui são linhas com borda
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `var(--void)`, título em `"Archivo"` com `font-stretch: 62%`, peso 700, caixa alta; destaque
`var(--acento2)`; linhas com `border: 1px solid rgba(196,166,250,.16)` e `border-radius: 14px`.
