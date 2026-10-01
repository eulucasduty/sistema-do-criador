# Estilo desta edição: Clássico

O padrão do criador: **rosto em tela cheia com as emendas marcadas** (onda de calor e clique de
câmera), **legenda de gibi com a palavra acendendo em dourado** e, quando ele mostra algo, **a
tela divide**: em cima um "papel" creme onde entram as coisas de verdade (print real, gravação de
tela, logo oficial) em cards brancos, com destaque laranja. Rápido, com mola, feito pra reter.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 3 s):** a frase dele com a legenda, plano `medio` ou `fechado`, e o motion mais
   forte já em cima: o número (`contador`, `comparacao`) ou a tela de que ele fala (`material`).
2. **Corpo:** um motion a cada 3 a 6 s, no **padrão 2x1**: a cada 2 motions na faixa de cima, 1 em
   tela cheia (`"area": "tela-cheia"`). O montador avisa quando o padrão quebra.
3. **Frase de efeito:** uma `palavra` em tela cheia (no máximo 2 por vídeo), no gancho ou na
   virada.
4. **Fim:** `cta` (o comentário sendo digitado e o card do perfil).

Motion em **50 a 70%** do vídeo.

## Como editar

- **Legenda `bangers`** (padrão): caixa alta, até 3 palavras, branca com contorno preto; a
  palavra falada acende em dourado e as de `destaques` ficam maiores. Dê 4 a 8 destaques.
  - `limpa`: caixa normal, com uma caixinha acompanhando a palavra falada. Mais sóbria.
- **Motions com cara de coisa de verdade** (é o que faz o estilo funcionar):
  - `terminal` quando ele fala de prompt ou de "mandei a IA fazer";
  - `material` e `print` numa janela (com `url`), com `foco` e `destaque` no que importa;
  - `logos` oficiais, grandes, uma por vez ou ligadas com "+";
  - `contador` e `comparacao` quando tem número ou dinheiro;
  - `comentarios` e `chat` quando ele fala de comentário e direct;
  - `lista` e `fluxo` pro passo a passo; `notificacao` pro resultado chegando.
- **Card nunca vazio:** cada um mostra nome, número, logo ou a frase que ele falou.
- **Câmera:** varie `aberto`, `medio` e `fechado` nas emendas; `empurrar` nos trechos longos.
- **Emendas:** onda de calor (0,5 s) com clique de câmera em toda troca de tomada. Troque o
  estilo (`zoom`, `flash`, `glitch`) em no máximo 1 de cada 4.
- **Sons:** os automáticos dos componentes (`pop`, `ding`, `teclado`, `whoosh`) e, na revelação,
  `riser` terminando nela + `impacto`.

## Exemplo de plano

```json
{
  "legenda": { "destaques": ["R$1.200", "ManyChat", "gratuito", "Instagram"] },
  "angulos": [{ "de": 0, "ate": 3.27, "plano": "medio", "empurrar": true }],
  "cenas": [
    { "de": 0.6, "ate": 3.2, "tipo": "contador", "rotulo": "todo mês", "prefixo": "R$ ", "de_valor": 0, "para_valor": 1200, "cor": "verde" },
    { "de": 6.3, "ate": 11.5, "tipo": "lista", "titulo": "O que ele faz", "itens": [{ "texto": "Responde os comentários", "i": 21 }, { "texto": "Chama na DM", "i": 24 }, { "texto": "Conversa com todo mundo", "i": 28 }] },
    { "de": 11.6, "ate": 15.5, "tipo": "fluxo", "area": "tela-cheia", "titulo": "Como liga", "nos": [{ "nome": "App na BM", "icone": "app-window" }, { "nome": "Instagram", "logo": "logos/instagram.svg" }, { "nome": "Sistema", "icone": "bot" }] },
    { "de": 22.8, "ate": 28, "tipo": "cta", "palavra": "MANYCHAT", "frase": "comenta" }
  ]
}
```

## Nunca

- Card escuro com sombra dura de tinta preta, ou dourado nos cards.
- Logo desenhada à mão ou interface imitada quando existe a de verdade.
- Gradiente linear em tela cheia, neon.
- Legenda em cima dos olhos ou da boca.

## Identidade visual

### Style Prompt
Reel vertical de criador de tecnologia. O rosto em tela cheia, com as emendas marcadas por onda de
calor e clique de câmera. Quando ele mostra algo, a tela divide: em cima, um "papel" creme com luz
de janela, onde entram as coisas de verdade (print real numa janela, gravação de tela, logo
oficial) e cards brancos de canto arredondado com sombra macia. Destaque em laranja queimado.
Títulos e frases de efeito em serifada itálica, números e texto em sans geométrica, rótulos em
mono espaçado dentro de pílulas escuras. Movimento rápido e com mola. A costura entre o papel e o
rosto é um degradê suave.

### Colors
- `#f4f1ea` papel (fundo da faixa e das telas cheias)
- `#ffffff` card, borda `#e6e0d4`, sombra macia marrom
- `#1a1a1a` tinta (texto), `#7a7368` rótulos
- `#d97757` laranja (destaque, número da lista, caixa de destaque, seta)
- `#1fa35c` verde (sucesso, "R$ 0"), `#e5533d` vermelho (preço riscado, erro)
- legenda (fica por cima do vídeo, não do papel): branca com a palavra em `#ffc93c`

### Typography
- `Serifa` (Instrument Serif itálica): títulos dos cards, palavra em tela cheia, chip de título
- `Jakarta` (Plus Jakarta Sans 500/800): texto, itens e números grandes
- `Mono` (JetBrains Mono 500): rótulos pequenos espaçados
- `Bangers`: legenda

### What NOT to Do
- Nada de card escuro com sombra dura nem de dourado nos cards
- Chat, comentários e terminal continuam escuros de propósito: imitam o aplicativo de verdade
- Logo branca na caixa clara some: use `"fundo": "escuro"` nela
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo transparente ou `#f4f1ea`, texto `#1a1a1a`, título em `"Serifa"` itálica, destaque
`#d97757`, card branco com `border: 2px solid #e6e0d4` e `border-radius: 28px`.
