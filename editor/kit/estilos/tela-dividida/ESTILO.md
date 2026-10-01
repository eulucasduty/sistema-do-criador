# Estilo desta edição: Tela dividida

A tela vira duas: **em cima o motion explica** (cards, grade, fluxo, print) e **embaixo o criador
fala numa janela** de cantos arredondados com quatro cantoneiras brancas. Fundo violeta profundo
com brilho. É o estilo pra vídeo que ensina: lista, passo a passo, "olha essa tela".
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 3 s):** já abre dividido, com o card mais forte em cima (a `grade` com o que ele
   promete, ou o `material` que prova). Não comece com o rosto sozinho.
2. **Meio:** um card por ideia, trocando a cada 3 a 6 s. A janela dele fica embaixo o tempo todo;
   quando o card troca, só o conteúdo de cima muda.
3. **Virada:** uma vez no vídeo, inverta com `"faixa": "baixo"` (ele sobe pra janela de cima e o
   card desce). Dá o respiro sem sair do formato.
4. **Fim:** ele em tela cheia com os colchetes no rosto (`anotacao` com `"em": "rosto"`) e depois
   o `cta`.

Motion em **70 a 85%** do vídeo. Rosto em tela cheia só no fim e em 1 respiro curto no meio.

## Como editar

- **Legenda:** `destaque` (padrão): duas linhas, a linha da palavra-chave maior, em caixa alta e
  com brilho violeta. Fica entre o card e a janela. Dê `destaques` em 3 a 6 palavras do vídeo.
- **Cards que fazem o estilo** (todos na faixa de cima, sem `area`):
  - `grade` no gancho ou no resumo: 4 itens, misturando imagem (`material`) e ícone;
  - `fluxo` pra "ele faz isso, depois isso": até 3 nós, com `i` em cada um;
  - `lista` pro passo a passo (até 5 itens) e uma vez com `"faixa": "baixo"`;
  - `material` ou `print` com `foco`, `"regua": true` e `"chip": "NO FRAME EXATO"` quando a
    imagem tem que aparecer na palavra certa (dê o `i` da palavra);
  - `comparacao` e `contador` quando ele fala número.
- **Título dos cards:** frase curta em caixa normal, com a última palavra em destaque:
  `"Ele faz *sozinho*"`. Em cima dele, um `rotulo` em caixa alta de 1 ou 2 palavras.
- **Câmera:** não mexa (`angulos` vazio). A janela já enquadra o rosto.
- **Emendas:** secas. O card trocando já marca o ritmo.
- **Sons:** `pop` na entrada de cada item, `click` no destaque, `whoosh` quando o card troca. Os
  componentes já tocam; não some som a mais.

## Exemplo de plano

```json
{
  "legenda": { "destaques": ["grátis", "Instagram"] },
  "rosto": { "x": 0.5, "y": 0.55 },
  "cenas": [
    { "de": 0, "ate": 5.8, "tipo": "grade", "rotulo": "O QUE ISSO ABRE", "titulo": "O que muda pra | *você*", "itens": [{ "material": "m1", "texto": "Teu sistema", "icone": "layout-dashboard" }, { "icone": "message-circle", "texto": "Comentário respondido" }, { "icone": "send", "texto": "Direct na hora" }, { "icone": "wallet", "texto": "Sem mensalidade" }] },
    { "de": 5.9, "ate": 11.2, "tipo": "fluxo", "rotulo": "AUTOMÁTICO", "titulo": "Ele faz *sozinho*", "nos": [{ "nome": "Lê", "sub": "o comentário", "icone": "message-circle", "i": 19 }, { "nome": "Chama", "sub": "na DM", "icone": "send", "i": 24 }, { "nome": "Conversa", "sub": "com todo mundo", "icone": "messages-square", "i": 28 }] },
    { "de": 11.3, "ate": 15.2, "tipo": "lista", "faixa": "baixo", "titulo": "É simples", "itens": [{ "texto": "Cria o app", "icone": "app-window", "i": 42 }, { "texto": "Conecta o Instagram", "icone": "link", "i": 50 }] },
    { "de": 15.3, "ate": 18.6, "tipo": "material", "material": "m1", "titulo": "o sistema *pronto*", "regua": true, "chip": "NO FRAME EXATO", "i": 61 },
    { "de": 18.8, "ate": 22.4, "tipo": "anotacao", "forma": "colchetes", "em": "rosto", "cor": "branco" },
    { "de": 22.6, "ate": 28, "tipo": "cta", "palavra": "MANYCHAT", "frase": "comenta" }
  ]
}
```

## Nunca

- Card em tela cheia (`"area": "tela-cheia"`): aqui o motion mora na faixa.
- `cabecalho`, `lettering` ou `manchete` junto de card (os dois querem o alto).
- Onda de calor, flash ou glitch nas emendas. Zoom no rosto.
- Card vazio ou com texto que ele não falou.

## Identidade visual

### Style Prompt
Reel vertical em tela dividida. Em cima, um palco violeta quase preto com um brilho roxo no
centro, onde entram painéis escuros de borda lilás fina e canto arredondado: grade de cards com
imagem, fluxo de três passos com ícones em quadrados violeta, lista numerada. Embaixo, o criador
numa janela arredondada com borda luminosa e quatro cantoneiras brancas. Títulos em sans pesada
com a palavra final em lilás, rótulos pequenos em mono com letras espaçadas. Movimento curto, com
mola leve.

### Colors
- `#0b0716` fundo, com brilho radial `#542ea8`
- `#191030` painel, borda `rgba(196,166,250,.3)`
- `#f2eafc` texto, `#b3a6d6` texto de apoio
- `#9153f8` violeta (ícones, selos), `#c4a6fa` lilás (destaque do título, rótulos)
- `#d4f83a` lima: só em 1 detalhe por cena (marca-texto, chip)

### Typography
- `Jakarta` 800: títulos dos cards e itens
- `Archivo` larga 900: palavra em tela cheia; condensada 700: lista em foco
- `Mono` 500 com `letter-spacing: 0.24em`: rótulos em caixa alta

### What NOT to Do
- Nada de dourado, de sombra dura de tinta preta nem de fonte de gibi
- Nada de fundo claro: todo painel é escuro
- Lima em mais de um elemento por cena
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo transparente (o palco violeta já está atrás), painel `var(--card)` com `border: var(--card-borda)`
e `border-radius: 26px`, título em `"Jakarta"` 800, destaque `var(--acento2)`, rótulo em `var(--f-mono)`
caixa alta com `letter-spacing: 0.24em`.
