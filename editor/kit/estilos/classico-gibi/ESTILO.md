# Estilo desta edição: Clássico · Gibi

O padrão do criador **em história em quadrinhos**: o rosto em tela cheia com as emendas em zoom e whoosh, **legenda de gibi torta** (Bangers branca, contorno preto grosso e sombra laranja) e, quando ele mostra algo, a tela divide com um papel amarelado de **retícula**, cards brancos de **contorno preto grosso e sombra dura** (cara de adesivo), destaque laranja e amarelo. Barulhento, divertido e rápido.
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

Receitas que combinam com o Gibi: **briga em nuvem** (`NuvemDeBriga` com Claudinhos pulando pra fora), **antes e depois em dois quadrinhos** (dois `Card` lado a lado, o da direita entra com mola e `Faiscas`), **balão de fala** (`Balao` com a frase de efeito saindo do Claudinho), **onomatopeia** (`Titulo` grande, uma palavra tipo "PÁ!" ou "BUM!", com `Onda` e tremor de câmera).

## Como editar

- **Legenda `hq`** (padrão): caixa alta, até 3 palavras, Bangers branca com contorno preto e sombra laranja deslocada; cada bloco vem levemente torto (um pra cada lado). A palavra falada acende em **amarelo** e as de `destaques` crescem. Dê 4 a 8 destaques.
  - `limpa`: caixa normal, com caixinha acompanhando a palavra. Pra trecho sério.
- **Motions com cara de coisa de verdade:** `terminal` quando ele fala de prompt; `material` e
  `print` numa janela (com `url`), com `foco` e `destaque`; `logos` oficiais; `contador` e
  `comparacao` com número ou dinheiro; `comentarios` e `chat` pra comentário e direct; `lista` e
  `fluxo` pro passo a passo; `notificacao` pro resultado chegando.
- **Card nunca vazio:** cada um mostra nome, número, logo ou a frase que ele falou.
- **Câmera:** varie `aberto`, `medio` e `fechado` nas emendas; `empurrar` nos trechos longos.
- **Emendas:** zoom (0,3 s) com whoosh em toda troca de tomada. Troque por `flash` ou `glitch` em no máximo 1 de cada 4.
- **Sons:** os automáticos e, na revelação, `riser` terminando nela + `impacto`. Gibi pede barulho: `pop` nas entradas.

## Nunca

- Card sem contorno ou com sombra macia (aqui a sombra é dura, deslocada)
- Tudo reto: a legenda e os balões vêm tortos
- Gradiente suave, vidro, neon
- Logo desenhada à mão ou interface imitada quando existe a de verdade.
- Legenda em cima dos olhos ou da boca.
- Filtro, escurecido ou mudança de cor no vídeo dele.

## Identidade visual

### Style Prompt
Reel vertical de criador de tecnologia em linguagem de HQ. O rosto em tela cheia, emendas com zoom. Quando ele mostra algo, a tela divide: em cima um papel amarelado com retícula laranja e raios de capa de gibi, cards brancos com contorno preto de 5 px e sombra dura deslocada, títulos em Bangers com sombra amarela, rótulos em caixinhas amarelas de contorno preto. Personagens em adesivo (contorno grosso, sombra dura, brilho). Movimento com mola exagerada, tremores no impacto.

### Colors
- `#fbf1d8` papel amarelado (fundo), retícula `#ff6b35` a 22%
- `#ffffff` card, contorno e sombra dura `#1a1a1a`
- `#ff6b35` laranja (destaque), `#ffcf33` amarelo (rótulo, palavra acesa da legenda, sombra do título)
- `#2bb673` verde, `#e63946` vermelho

### Typography
- `Bangers`: títulos, palavra em tela cheia, números, rótulos e legenda
- `Jakarta` (500/800): texto dos cards
- `Mono`: url e terminal

## Cena livre neste estilo
Fundo `#fbf1d8` com retícula, texto `#1a1a1a`, título em `"Bangers"`, destaque `#ff6b35`, card branco com `border: 5px solid #1a1a1a`, `border-radius: 22px` e `box-shadow: 8px 8px 0 #1a1a1a`.
