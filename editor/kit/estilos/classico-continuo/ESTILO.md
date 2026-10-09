# Estilo desta edição: Clássico · Motion contínuo

**Motion o vídeo inteiro**. Quase nada do vídeo é só o rosto: em cima dele
(tela dividida) ou no lugar dele (tela cheia) roda o tempo todo um **motion animado que se monta com
a fala**. Cada coisa que ele cita aparece **na palavra em que é falada**: ele diz "Claude" e a logo
entra; diz "um ano" e o "12 meses" estoura; diz "de graça" e o preço rola até zero. É isso que prende:
o olho sempre tem uma coisa nova chegando, a cada meio segundo a um segundo. Estúdio cinza claro com
luz de janela, cards de vidro brancos com sombra longa, Inter pesada, mono nos rótulos e o coral do
Claude só no que importa; de vez em quando uma cena **noite** pra dar contraste. Vale por cima do
`kit/EDITOR.md` e do `kit/MOTION.md` onde disser diferente.

## A regra de ouro

**Um motion por assunto, que evolui com a fala** (um "mundo"), e não um card por frase. O mundo
nasce, vai ganhando peças (cada peça na palavra dela), as velhas vão pro fundo (`recua`) quando a
nova chega, e ele termina quando o assunto muda. 4 a 10 s cada. Escreva cada um em
`motions/<id>.tsx` (leia `kit/MOTION.md` e **os exemplos `kit/motion-exemplos/vitrine-*.tsx`**
antes do primeiro: são trechos de verdade desse jeito de editar).

## Como o vídeo se organiza

1. **Gancho (0 s):** o primeiro mundo já começa no quadro 0, na `faixa` (ele embaixo), com a coisa
   de que ele fala na primeira frase (a logo, o número, a tela). Nada de começar no rosto limpo.
2. **Corpo:** os mundos em sequência, quase sem buraco entre eles. Alterne as áreas:
   - `faixa` (motion em cima, ele embaixo): a maioria, quando ele está explicando;
   - `tela-cheia` clara: quando a coisa precisa de espaço (mapa, lista grande, tela inteira);
   - `tela-cheia` **noite** (`<Cena noite>` e `noite: true` no config): 1 ou 2 por vídeo, no
     contraste (o problema, o "antes", o erro, a revelação).
3. **Respiro:** entre um mundo e outro, 0,6 a 2 s **só o rosto**, em plano `fechado` (o punch-in),
   com a **legenda serifada** na frase de efeito ("DE GRAÇA", "DOIS MINUTOS", "SEU COMPUTADOR").
   3 a 6 respiros por vídeo. É o contraste que faz o motion bater.
4. **Lista ("cinco plugins", "três passos"):** cada item abre com o **capítulo**: `Etiqueta` com
   `numero={[n, total]}` + `IconeApp` (logo oficial ou `Icone`) + o nome com `Embaralha`; depois o
   mundo daquele item. O número volta em todo item (01 / 05, 02 / 05…).
5. **Fecho:** o `cta` do kit, com o `de` bem no começo do "comenta…", e o rosto cheio.

Motion em **80 a 92%** do vídeo. Num reel de 45 s isso dá **6 a 9 motions** (vale mais que o teto
de 3 do `kit/MOTION.md`). Se faltar tempo, prefira menos mundos e mais longos a cortar as batidas.

## Como montar cada mundo

- **Batidas na fala:** liste as palavras-chave do trecho em `dados/palavras.json` e ponha uma peça
  em cada (o `em` = início da palavra − `de` da cena). Uma batida a cada **0,5 a 1,2 s**; nada fica
  parado mais de 1,5 s.
- **Entrada é sempre `Foco`** (vem desfocada e assenta). O que sai de cena: `recua` quando outra
  coisa entra na frente, `sai` quando acabou.
- **A câmera conta:** começa perto da primeira peça e abre conforme o mundo cresce; aproxima no
  número que importa; treme no carimbo.
- **Peças da vitrine** (`kit/MOTION.md`, "A vitrine"): `Vidro` (card), `IconeApp`, `Etiqueta`,
  `Rolo` (número de caça-níquel: preço, estrelas, seguidores), `Embaralha` (nome se decodificando),
  `Anotacao` (o defeito ou o detalhe apontado), `Carimbo` (o veredito), `Cursor` (clique),
  `Janela` (o site), `TerminalClaude` (o pedido pro Claude Code), `Barra`, `Checklist`, `Mira` +
  `Mapa` + `Pinos` (lugar, cidade, "o mapa inteiro"), `Sublinha`.
- **Coisa de verdade:** logo oficial (`kit/logo.mjs`) dentro do `IconeApp`, print real dentro da
  `Janela` (`Imagem`), o número que ele falou. Interface desenhada só quando é o exemplo genérico
  ("um site com cara de IA") ou não existe print público.
- **Sons:** declare `export const sons` em cada motion, uma batida por peça: `pop` (entra),
  `whoosh` (troca grande), `click` (cursor, mira), `ding` (número final, check), `teclado`
  (digitando), `impacto` (carimbo), `riser` terminando na revelação. A edição toca sozinha.
- **Área da faixa:** 1080×760, ponha as coisas de y=70 a y=660 (embaixo ela se funde com o rosto).
  **Tela cheia:** de y=170 a y=1380 (de 1400 a 1750 é da legenda).

## Legenda `vitrine` (padrão)

A frase **se constrói palavra por palavra** (cada uma entra quando é falada), em Inter, e a palavra
da vez fica pesada. Nas frases de efeito ela vira **serifada itálica em caixa alta**, com as
palavrinhas menores ("O CLAUDE RASPAR", "DE GRAÇA"): marque esses trechos no plano em
`legenda.alternativa` (`[[de, ate], …]`, 4 a 8 trechos: o gancho, os números ditos, os respiros no
rosto e as viradas). Em cima de motion claro em tela cheia ela fica preta sozinha. `limpa` é a
opção mais sóbria.

## Cor do vídeo

O criador já grava com o filtro e o brilho dele. **Nada mexe na cor do vídeo neste estilo**: sem
escurecido, grão, vinheta ou banho de cor por cima dele.

## Como editar

- **Componentes do kit** (cards HTML) ainda valem pra completar, mas o protagonista é o motion. Use
  `material` (gravação de tela dele) quando ele mandou vídeo da tela, e o `cta` no fim.
- **Câmera:** `fechado` nos respiros, `medio` com `empurrar` debaixo da faixa.
- **Emendas:** desfoque rápido, sem som (os sons são das batidas dos motions).

## Exemplo de plano

```json
{
  "legenda": {
    "destaques": ["grátis", "startup"],
    "alternativa": [[0, 1.4], [5.2, 6.6], [21.8, 23.1]]
  },
  "angulos": [{ "de": 5.2, "ate": 6.6, "plano": "fechado" }],
  "cenas": [
    { "de": 0, "ate": 4.6, "tipo": "motion", "motion": "plano-gratis" },
    { "de": 6.6, "ate": 12.6, "tipo": "motion", "motion": "mapa-leads" },
    { "de": 12.6, "ate": 17.0, "tipo": "motion", "motion": "cara-de-ia" },
    { "de": 38.2, "ate": 42.5, "tipo": "cta", "palavra": "STARTUP", "frase": "comenta" }
  ]
}
```

## Nunca

- Card parado esperando a fala acabar: se ele citou três coisas, são três batidas.
- Começar no rosto limpo, ou passar mais de 2 s seguidos só no rosto (fora o `cta`).
- Mais de uma cor de destaque no quadro; neon; gradiente colorido de fundo (a não ser no exemplo
  de "o que não fazer").
- Logo desenhada à mão de marca que existe; resultado inventado (número de venda, seguidor).
- Texto do motion repetindo a legenda: o motion **mostra**, a legenda conta.
- Filtro, escurecido ou mudança de cor no vídeo dele; legenda em cima dos olhos ou da boca.

## Identidade visual

### Style Prompt
Reel vertical de tecnologia em que o motion não para. Em cima (ou no lugar) do rosto, um estúdio
cinza claro com a luz de uma janela entrando na diagonal; cards de vidro brancos de canto grande com
sombra longa e macia, entrando desfocados e assentando; ícones de app com sombra de objeto;
contadores que rolam como caça-níquel; anotações vermelhas em pílula branca; carimbos tortos; um
cursor que clica. Títulos em Inter pesada e apertada, rótulos em mono espaçado dentro de pílulas
brancas com uma bolinha coral. De vez em quando, a mesma vitrine no escuro. A legenda se constrói
palavra por palavra e, nas frases de efeito, vira serifada itálica em caixa alta.

### Colors
- `#e7e5e0` estúdio (fundo), `#f7f6f3` luz
- `#ffffff` vidro (cards), sombra `rgba(46, 36, 24, 0.16)`
- `#121212` tinta, `#8b867d` rótulos
- `#d97757` coral do Claude (destaque, uma coisa por quadro)
- `#1f9d55` verde (pronto, R$ 0, check), `#e0473c` vermelho (anotação, carimbo, erro)
- noite: `#0c0c0e` fundo, `#17171a` card, `#e8876a` destaque

### Typography
- `Inter` 500 a 800: títulos (750, apertada), números (800), texto e legenda
- `Serifa` (Instrument Serif itálica): a legenda nas frases de efeito e a `palavra`
- `Mono`: rótulos, etiquetas, terminal

## Cena livre neste estilo
Fundo `#e7e5e0`, texto `#121212`, título em `"Inter"` 750 com `letter-spacing: -0.03em`, destaque
`#d97757`, card `#ffffff` com `border-radius: 30px` e
`box-shadow: 0 18px 40px rgba(46,36,24,0.16), 0 50px 110px rgba(46,36,24,0.14)`.
