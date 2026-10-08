# Estilo desta edição: Clássico · Massinha

O padrão do criador **como brinquedo 3D**: o rosto em tela cheia com as emendas em zoom e pop, **legenda gordinha** (Unbounded branca com sombra lilás, a palavra falada vira uma **pílula laranja**) e, quando ele mostra algo, a tela divide com um fundo pêssego e lilás, cards brancos **bem redondos** com brilho por dentro e sombra macia. Fofo, colorido e com muita mola.
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

Receitas que combinam com a Massinha: **brinquedos pulando** (Claudinhos de massinha entrando com mola `pula` e quicando em fila), **montagem** (peças que encaixam umas nas outras: `Card` redondos empilhando com mola), **o Codinho comemorando** (acena e pula quando dá certo), **bolhas** com números (`Numero` dentro de círculos que crescem).

## Como editar

- **Legenda `bolha`** (padrão): caixa normal, até 3 palavras, Unbounded grossa e branca com sombra lilás; a palavra falada vira uma **pílula laranja**. Dê 4 a 8 destaques.
  - `limpa`: caixa normal, mais sóbria.
- **Motions com cara de coisa de verdade:** `terminal` quando ele fala de prompt; `material` e
  `print` numa janela (com `url`), com `foco` e `destaque`; `logos` oficiais; `contador` e
  `comparacao` com número ou dinheiro; `comentarios` e `chat` pra comentário e direct; `lista` e
  `fluxo` pro passo a passo; `notificacao` pro resultado chegando.
- **Card nunca vazio:** cada um mostra nome, número, logo ou a frase que ele falou.
- **Câmera:** varie `aberto`, `medio` e `fechado` nas emendas; `empurrar` nos trechos longos.
- **Emendas:** zoom (0,3 s) com pop em toda troca de tomada. Troque por `flash` em no máximo 1 de cada 4.
- **Sons:** `pop` em quase tudo que entra, `ding` no resultado, `riser` + `impacto` na revelação.

## Nunca

- Canto reto, traço fino, sombra dura (aqui tudo é redondo e macio)
- Preto puro (a tinta é ameixa `#2b1d3a`)
- Texto longo em Unbounded (é larga: títulos de até 4 palavras)
- Logo desenhada à mão ou interface imitada quando existe a de verdade.
- Legenda em cima dos olhos ou da boca.
- Filtro, escurecido ou mudança de cor no vídeo dele.

## Identidade visual

### Style Prompt
Reel vertical de criador de tecnologia com cara de brinquedo de massinha 3D. O rosto em tela cheia, emendas com zoom. Quando ele mostra algo, a tela divide: em cima um gradiente pêssego (#ffe8dc) pra lilás (#e4dcff) com bolhas macias flutuando, cards brancos de canto de 44 px com brilho por dentro e sombra macia arroxeada, títulos na Unbounded (redonda e larga), destaque laranja (#ff6a3d) e lilás (#8b7bff). Personagens de massinha: volume, brilho e sombra no chão. Muita mola.

### Colors
- `#ffe8dc` pêssego → `#e4dcff` lilás (fundo)
- `#ffffff` card, sombra `rgba(120,60,90,0.22)`
- `#2b1d3a` tinta (ameixa), `#8a7b94` rótulo
- `#ff6a3d` laranja (destaque, pílula da legenda), `#8b7bff` lilás, `#ffc533` amarelo, `#2fbf71` verde

### Typography
- `Unbounded` (800): títulos, números, palavra em tela cheia e legenda
- `Jakarta` (500/800): texto dos cards

## Cena livre neste estilo
Fundo em gradiente `#ffe8dc` → `#e4dcff`, texto `#2b1d3a`, título em `"Unbounded"` 800, destaque `#ff6a3d`, card branco com `border-radius: 44px` e `box-shadow: 0 22px 44px rgba(120, 60, 90, 0.22)`.
