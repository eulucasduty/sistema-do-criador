# Estilo desta edição: Clássico · Editorial

O padrão do criador **como revista**: o rosto em tela cheia com as emendas em desfoque, **legenda fina** (Inter Tight branca, as palavras de destaque ganham **marca-texto laranja**) e, quando ele mostra algo, a tela divide com papel branco de pauta fina, cards de **traço fino e canto reto, sem sombra**, serifada itálica grande. Elegante, calmo e premium, mas com motion o tempo todo.
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

Receitas que combinam com o Editorial: **diagrama de revista** (Claudinhos em line-art ligados por linhas finas que se desenham), **título que se escreve** (`Titulo` grande em serifada, palavra por palavra, com uma linha laranja crescendo embaixo), **o Codinho em traço** digitando ao lado de um `TerminalClaude`, **número grande** (`Numero` enorme em Inter Tight com rótulo fino).

## Como editar

- **Legenda `revista`** (padrão): caixa normal, até 4 palavras, Inter Tight; as palavras de `destaques` ganham **marca-texto laranja** passando atrás delas na hora em que ele fala. Dê 4 a 8 destaques.
  - `limpa`: caixinha acompanhando a palavra.
- **Motions com cara de coisa de verdade:** `terminal` quando ele fala de prompt; `material` e
  `print` numa janela (com `url`), com `foco` e `destaque`; `logos` oficiais; `contador` e
  `comparacao` com número ou dinheiro; `comentarios` e `chat` pra comentário e direct; `lista` e
  `fluxo` pro passo a passo; `notificacao` pro resultado chegando.
- **Card nunca vazio:** cada um mostra nome, número, logo ou a frase que ele falou.
- **Câmera:** varie `aberto`, `medio` e `fechado` nas emendas; `empurrar` nos trechos longos.
- **Emendas:** desfoque (0,45 s) com whoosh em toda troca. Troque por `seco` em no máximo 1 de cada 4.
- **Sons:** discretos: `whoosh`, `click`, `pop`; `riser` só na grande revelação.

## Nunca

- Sombra, gradiente, canto arredondado grande (aqui é traço fino e canto reto)
- Mais de uma cor de destaque no quadro
- Letra de gibi, neon
- Logo desenhada à mão ou interface imitada quando existe a de verdade.
- Legenda em cima dos olhos ou da boca.
- Filtro, escurecido ou mudança de cor no vídeo dele.

## Identidade visual

### Style Prompt
Reel vertical de criador de tecnologia com cara de revista. O rosto em tela cheia, emendas em desfoque. Quando ele mostra algo, a tela divide: em cima papel branco (#fbfaf7) com pauta fina e uma margem laranja, cards brancos de traço preto de 1,5 px e canto reto sem sombra, títulos grandes em serifada itálica (Instrument Serif), texto em Inter Tight, laranja (#d97757) só no que importa. Personagens em line-art (só o contorno, um traço laranja). Calmo e premium.

### Colors
- `#fbfaf7` papel (fundo), pauta `rgba(20,20,20,0.05)`
- `#ffffff` card, traço `#141414`
- `#141414` tinta, `#77736c` rótulo
- `#d97757` laranja (destaque, marca-texto da legenda, sublinhado dos rótulos)

### Typography
- `Serifa` (Instrument Serif itálica): títulos, palavra em tela cheia, chip de título
- `InterTight` (600/800): texto, números e legenda
- `Mono`: rótulos pequenos

## Cena livre neste estilo
Fundo `#fbfaf7`, texto `#141414`, título em `"Serifa"` itálica, texto em `"InterTight"`, destaque `#d97757`, card branco com `border: 1.5px solid #141414`, `border-radius: 0` e sem sombra.
