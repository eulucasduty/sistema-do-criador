# Estilo desta edição: Clássico · Terminal

O padrão do criador **com cara de Claude Code**: o rosto em tela cheia com as emendas em glitch e tecla, **legenda de terminal** (mono minúscula, a palavra falada dentro de uma caixa laranja, cursor no fim) e, quando ele mostra algo, a tela divide com um fundo quase preto de **grade de terminal**, cards escuros de fio fino, laranja do Claude e verde de sucesso. Técnico, limpo, de quem constrói.
É uma variação do Clássico: a mesma estrutura, outra identidade. Vale por cima do
`kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 3 s):** a frase dele com a legenda, plano `medio` ou `fechado`, e já um motion em
   cima: o número (`contador`, `comparacao`), a tela de que ele fala (`material`) ou um **motion
   animado** curto (2,5 a 3,5 s) se a ideia é uma cena.
2. **Corpo:** um motion a cada 3 a 5 s, no **padrão 2x1**: a cada 2 motions na faixa de cima, 1 em
   tela cheia. Os motions animados contam como tela cheia.
3. **Frase de efeito:** uma `palavra` em tela cheia (no máximo 2 por vídeo), no gancho ou na virada.
4. **Fim:** `cta` (o comentário sendo digitado e o cursor clicando em "Seguir").

Motion em **60 a 80%** do vídeo: este estilo é pra prender com animação o tempo todo.

## Movimento (automático)

Como no Clássico: cada card tem câmera própria (aproxima e inclina em 3D), entra em 3D e sai com
movimento; o fundo desliza; o print ganha cursor que clica no `destaque`, o fluxo tem o pacote de
luz, a lista acende o item da vez, o chat digita, os comentários ganham curtida e o `cta` tem o
clique no "Seguir". Pra ficar bom: `i` em cada item de `lista`, `fluxo` e `chat`; `destaque` e
`foco_inicial` no `material`; cenas de 2,5 a 6 s; `cta` com pelo menos 2,5 s.

## Motion animado (vídeo): 2 a 3 por vídeo

Este estilo pede **2 a 3 motions animados por vídeo** (`kit/MOTION.md` e os exemplos em
`kit/motion-exemplos/`): o mais forte em `tela-cheia` (3 a 6 s) na ideia principal, os outros na
`faixa` ou em tela cheia curtos (2,5 a 4 s). Os motions saem sozinhos na identidade deste estilo
(fundo, personagens, cards e letras): você só escreve a cena. Personagens:
- `Claudinho` (o Claude) quando o assunto é o Claude ou "a IA";
- `Codinho` (o Claude Code: janelinha de terminal com cara, que digita, pensa e comemora) quando
  ele fala de Claude Code, de mandar a IA fazer, de programar ou de sistema;
- `TerminalClaude` (a tela do Claude Code com o pedido sendo digitado, o "✻ Pensando…" e as
  ferramentas chegando) quando ele mostra o que pediu pra IA.
Se o pedido falar em motion ou animação, faça o que ele pediu.

## Cor do vídeo

O criador já grava com o filtro e o brilho dele. **Nada mexe na cor do vídeo neste estilo**: sem
escurecido atrás de texto, sem grão, vinheta ou banho de cor por cima dele. A identidade (fundo,
textura, cor) fica só nos cards e nos motions.

Receitas que combinam com o Terminal: **o pedido e o resultado** (`TerminalClaude` digitando o que ele pediu, pensando e soltando as ferramentas; o `Codinho` ao lado digitando), **o sistema subindo** (linhas `ok` em verde uma atrás da outra com um `Numero` contando), **os Claudinhos em pixel art** (aqui eles saem em 8 bits sozinhos) trabalhando em fila, **barra de progresso** de deploy chegando a 100%.

## Como editar

- **Legenda `terminal`** (padrão): até 3 palavras, letra mono; a palavra falada fica numa **caixa laranja** e o bloco termina com um cursor `▍`. Dê 4 a 8 destaques.
  - `limpa`: caixa normal, mais sóbria.
- **Motions com cara de coisa de verdade:** `terminal` quando ele fala de prompt; `material` e
  `print` numa janela (com `url`), com `foco` e `destaque`; `logos` oficiais; `contador` e
  `comparacao` com número ou dinheiro; `comentarios` e `chat` pra comentário e direct; `lista` e
  `fluxo` pro passo a passo; `notificacao` pro resultado chegando.
- **Card nunca vazio:** cada um mostra nome, número, logo ou a frase que ele falou.
- **Câmera:** varie `aberto`, `medio` e `fechado` nas emendas; `empurrar` nos trechos longos.
- **Emendas:** glitch (sacode o quadro, sem mexer na cor) com som de tecla em toda troca. Troque por `zoom` ou `seco` em no máximo 1 de cada 4.
- **Sons:** os automáticos (`tecla`, `teclado`, `pop`, `ding`) e, na revelação, `riser` + `impacto`.

## Nunca

- Fundo claro ou card branco (aqui tudo é tela escura)
- Neon exagerado, gradiente colorido, letra arredondada
- Emoji no lugar de ícone
- Logo desenhada à mão ou interface imitada quando existe a de verdade.
- Legenda em cima dos olhos ou da boca.
- Filtro, escurecido ou mudança de cor no vídeo dele.

## Identidade visual

### Style Prompt
Reel vertical de criador de tecnologia com a cara da tela do Claude Code. O rosto em tela cheia, emendas em glitch. Quando ele mostra algo, a tela divide: em cima um fundo quase preto (#0f0e0d) com grade fina de terminal e uma luz laranja no canto, cards escuros (#181614) de fio fino e canto de 14 px, letra mono nos títulos, laranja do Claude (#d97757) no destaque e verde (#7bd88f) no que deu certo. Personagens em pixel art. Linhas de tela e grão por cima dos motions.

### Colors
- `#0f0e0d` fundo, grade `rgba(255,255,255,0.035)`
- `#181614` card, fio `#34302a`
- `#f1ece4` texto, `#8f877b` rótulo
- `#d97757` laranja (destaque, caixa da legenda, cursor), `#7bd88f` verde (sucesso), `#ff6b6b` vermelho

### Typography
- `Mono` (JetBrains Mono): títulos, números, palavra em tela cheia, rótulos e legenda
- `Jakarta` (500/800): texto dos cards

## Cena livre neste estilo
Fundo `#0f0e0d` com grade fina, texto `#f1ece4`, título em `"Mono"`, destaque `#d97757`, sucesso `#7bd88f`, card `#181614` com `border: 2px solid #34302a` e `border-radius: 14px`.
