# Estilo desta edição: Ícones animados

O criador em **tela cheia o tempo todo** e, **no alto, o passo da vez**: um **ícone que se
desenha** num quadradinho, um **número grande** e **duas linhas condensadas** em caixa alta, com
um traço embaixo. A cada passo o cabeçalho **rola** pro próximo. Quase nada além disso: é o estilo
mais limpo da família, pra "os passos são simples".
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Abertura (2 a 3 s):** `cabecalho` com `icone` e uma linha só, o tema: `"3 PASSOS *SIMPLES*"`.
2. **Um `cabecalho` de passo por etapa**, com `numero` ("01", "02"…), `icone` e 2 `linhas`: a 1ª
   é o verbo, a 2ª o resto (`["ESCOLHA", "UMA ENTREGA"]`). Cada um começa quando ele começa a
   falar daquele passo e termina onde o próximo começa (colados, pra rolar).
3. **Fecho:** `cabecalho` com `rotulo` em cima ("TUDO EM UM LUGAR"), `icone` e o nome do que ele
   oferece. Depois o `cta`.

Cabeçalho na tela em **90% do vídeo ou mais**.

## Como editar

- **Ícones:** de traço simples, um diferente por passo, ligado ao verbo (`target`, `book-open`,
  `briefcase`, `link`, `clipboard-check`, `workflow`). Eles se desenham sozinhos.
- **Legenda:** `simples`: pequena, branca, com sombra, embaixo do queixo ou em cima da cabeça.
- **Nada por cima do rosto.** Se ele mostra um material, use `fotos` (o montador encaixa) em no
  máximo 1 passo.
- **Câmera:** alterne `aberto` e `medio` a cada passo. É o que dá ritmo aqui.
- **Emendas:** secas.
- **Sons:** `pop` na troca de passo. Mais nada.

## Exemplo de plano

```json
{
  "angulos": [{ "de": 3.3, "ate": 6.2, "plano": "medio" }, { "de": 11.6, "ate": 15.5, "plano": "medio" }],
  "cenas": [
    { "de": 0, "ate": 3.2, "tipo": "cabecalho", "icone": "circle-check", "linhas": ["3 PASSOS *SIMPLES*"] },
    { "de": 3.2, "ate": 6.2, "tipo": "cabecalho", "numero": "01", "icone": "target", "linhas": ["CRIE", "O APLICATIVO"] },
    { "de": 6.2, "ate": 11.5, "tipo": "cabecalho", "numero": "02", "icone": "link", "linhas": ["CONECTE", "O INSTAGRAM"] },
    { "de": 11.5, "ate": 15.5, "tipo": "cabecalho", "numero": "03", "icone": "clipboard-check", "linhas": ["COLE", "O PROMPT"] },
    { "de": 15.5, "ate": 22.7, "tipo": "cabecalho", "rotulo": "TUDO DE GRAÇA", "icone": "workflow", "linhas": ["MANYCHAT PRÓPRIO"] }
  ]
}
```

## Nunca

- Card, lista ou tela dividida: tira a limpeza do estilo.
- Linha de passo com mais de 3 palavras.
- Passo sem ícone ou sem número.

## Identidade visual

### Style Prompt
O criador em tela cheia, natural. No alto, centralizado sobre um escurecido violeta: um quadrado
de canto arredondado com um ícone de traço lilás, um número grande condensado em lilás e, à
direita, duas linhas condensadas brancas em caixa alta; embaixo, um traço lilás curto. Quando o
passo muda, o conjunto sobe e o próximo entra por baixo. Legenda pequena branca com sombra.

### Colors
- `#0b0716` escurecido do alto
- `#c4a6fa` ícone, número e traço
- `#f2eafc` linhas

### Typography
- `Archivo` condensada 700: número e linhas (caixa alta, 78 px)
- `Jakarta` 800 com `letter-spacing: 0.24em`: rótulo

### What NOT to Do
- Nada de ícone preenchido ou colorido: só traço
- Nada de emoji no lugar do ícone
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use: o estilo é o cabeçalho de passo.
