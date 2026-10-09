# Motion animado (vídeo de verdade dentro da edição)

Às vezes um card não basta: a ideia do vídeo é uma **cena** (100 Claudinhos brigando, um mata-mata,
jurados dando nota, uma coisa virando outra). Aí você faz um **motion**: um vídeo animado curto,
escrito em React com o Remotion, que entra na edição como a cena `motion`. É o que deixa a edição
com cara de vídeo animado e não de slide. Os exemplos de verdade estão em `kit/motion-exemplos/`
(arena, matamata, juizes, claude-code e os `vitrine-*`, que se montam com a fala): **leia antes de
escrever o primeiro**.

**A identidade é do estilo, não sua:** o mesmo motion sai diferente em cada estilo (fundo, textura,
cards, letras e o desenho dos personagens: chapado no padrão, adesivo no Gibi, pixel art no
Terminal, massinha na Massinha, line-art no Editorial). Não escreva cor nem fonte: use `useTema()`
e os componentes.

## Quando fazer

- **Sempre** que o pedido (título, roteiro, descrição) falar em motion, animação ou "animado".
- Quando o `kit/ESTILO.md` mandar (o estilo padrão pede 1 a 2 por vídeo, na ideia principal).
- Fora isso, quando a ideia é uma cena com personagem, processo ou metáfora que nenhum componente
  mostra bem. Dado simples (número, lista, logo) continua sendo componente.
- No máximo **3 por vídeo** (a não ser que o `kit/ESTILO.md` peça mais), de **2,5 a 10 s** cada.

## Como fazer (o ciclo)

1. Ache na `dados/transcricao.txt` o trecho e o tempo de cada palavra-chave (`dados/palavras.json`).
   Os tempos do motion começam em 0 no `de` da cena: palavra em 25,00 s numa cena que começa em
   23,46 s = 1,54 s no motion. **Sincronize cada batida com a palavra** (o "100" aparece no "100").
2. Escreva `motions/<id>.tsx` (id em minúsculas, sem espaço: `arena`, `mata-mata`).
3. `node kit/motion.mjs quadros <id>` → abra `motions/quadros/<id>.jpg` (Read) e **olhe**. Use
   `--em 0.5,1.2,2.8` pros instantes que importam. Corrija e olhe de novo (2 ou 3 rodadas).
4. `node kit/motion.mjs render <id>` (15 a 40 s) → `motions/<id>.mp4` e `motions/<id>.json`.
5. No plano: `{ "de": 23.46, "ate": 32.86, "tipo": "motion", "motion": "<id>" }`, com
   `ate - de` igual à `duracao` do motion (o montador avisa se não bater).
6. Confira nos snapshots da edição um instante no meio de cada motion.

## O arquivo

```tsx
import React from "react";
import { Cena, Camera, Claudinho, Titulo, mola, entre, useAnim } from "@motion";

export const config = { duracao: 3.71, area: "tela-cheia" }; // "tela-cheia" | "faixa" | "sobre"; noite: true se a Cena for noite
// opcional: o som de cada batida (a edição toca no lugar certo, no tempo do motion)
export const sons = [{ em: 0.4, som: "pop" }, { em: 2.1, som: "impacto", volume: 0.7 }];

export default function Motion() {
  const { t, fps } = useAnim(); // t = segundos desde o começo do motion
  return (
    <Cena saida="zoom">
      <Camera passos={[{ em: 0, zoom: 2.4 }, { em: 1.2, zoom: 1 }]} tremores={[{ em: 2.1 }]}>
        {/* personagens, efeitos, cards… em position: absolute, com left/top em px */}
      </Camera>
      {/* texto fixo (fora da câmera) */}
    </Cena>
  );
}
```

Só importe de `"@motion"` (e `react`). Cores e fontes vêm do estilo da edição (`useTema()`); nunca
escreva cor, curva ou mola na mão.

## Onde cabe o quê (área)

| area | tamanho | o que acontece | onde pôr as coisas |
|---|---|---|---|
| `tela-cheia` | 1080×1920 | cobre a tela; a legenda dele fica por cima, embaixo | de y=170 a y=1380. **De 1400 a 1750 é da legenda**; acima de 150 é a interface do Instagram |
| `faixa` | 1080×760 | a faixa de cima da tela dividida; ele embaixo | de y=100 a y=680 (embaixo a faixa se funde com o vídeo dele) |
| `sobre` | 1080×1920, transparente | por cima do vídeo dele (sem fundo) | **nunca em cima do rosto** (veja `rosto` no plano): em volta dele, em cima da cabeça ou embaixo do queixo |

Na `tela-cheia` e na `faixa` a `Cena` já põe o fundo do estilo (papel vivo), a correção de cor, o
grão e a vinheta. Na `sobre` não põe nada disso: a cor do vídeo dele não muda.

## As regras (o que separa motion de vídeo de slide)

1. **Nada parado.** A `Camera` sempre deriva; a cada 1 a 1,5 s acontece uma coisa nova (entra,
   muda, bate, sai). Use as falas como relógio.
2. **Nunca movimento linear.** Use `mola()` e `entre()` (já têm curva). `interpolate` cru só em
   coisa mecânica (ponteiro, barra).
3. **Entrada mexe 2 ou 3 coisas juntas** (aparece + sobe + cresce): `<Entrada>`, `mola()` em
   `scale`/`translate`. Fade sozinho é proibido.
4. **Escalone.** Nada entra tudo junto: itens com 0,04 a 0,15 s de diferença; multidão em onda,
   do centro pra fora.
5. **Saídas existem e são mais rápidas** que as entradas (a `Cena` já faz a saída geral; quem cai
   no meio sai sozinho: nocaute, voa, some).
6. **Câmera conta a história:** começa perto e abre pra revelar ("1 → 100"), aproxima no que
   importa, treme no impacto (`tremores`).
7. **Uma cor de destaque por quadro** (o herói). O resto na tinta do estilo.
8. **Momentos de pausa** (0,4 a 0,6 s com quase nada mudando) depois de uma revelação grande:
   contraste é o que dá peso.
9. **Texto curto** e grande: o motion mostra, a legenda dele conta. Título com no máximo 5 palavras.
10. **Olhe os quadros antes de entregar.** Sempre `quadros` antes de `render`.

## A biblioteca (`@motion`)

Tempo e movimento:
- `useAnim()` → `{ t, fps, dur, largura, altura, frame }`
- `mola(t, em, fps, "rapida" | "suave" | "pula")` → 0 antes de `em`, vai a 1 com mola
- `entre(t, [a, b], [v0, v1], curva?)` → valor entre dois instantes, com curva (`CURVA.entra`, `move`, `suave`, `sai`)
- `passos(t, [{ em, v }, …])`, `seno(t, periodo, amp, fase)`, `acaso(i, semente)` (o "aleatório"
  sempre igual: nunca `Math.random`), `degrau(t, periodo)`
- `useTema()` → `{ cores: { fundo, card, borda, tinta, dim, heroi, ok, erro, ouro, claudinho, … }, fontes: { titulo, tituloEstilo, texto, mono, impacto } }`

Estrutura:
- `<Cena saida="zoom" | "sobe" | "nenhuma" transparente?>`: a raiz (fundo vivo, cor, grão, vinheta, saída)
- `<Camera passos={[{ em, zoom, x, y, giro }]} deriva={10} tremores={[{ em, dur, forca }]}>`: o
  ponto (x, y) da tela vai pra `centro + zoom × (ponto − centro) + (x, y)`; pra centralizar o ponto
  P com zoom Z: `x = (540 − P.x) × Z`, `y = (centro_y − P.y) × Z` (centro_y = 960 na tela cheia,
  380 na faixa)

Personagem:
- `<Claudinho tamanho humor="normal" | "feliz" | "bravo" | "nocaute" | "surpreso" | "pensando" olhar={[x, y]} fase estica={{ angulo, quanto }} vivo>`:
  o asterisco do Claude com cara. Pisca, mexe os raios; `estica` alonga o raio daquele ângulo (soco,
  apontar; 0 = direita). Dê uma `fase` diferente pra cada um (senão piscam juntos). O desenho segue
  o estilo sozinho (`desenho="pixel"` força um).
- `<Codinho tamanho humor="normal" | "feliz" | "bravo" | "pensando" | "digitando" | "nocaute" | "surpreso" andando acena fase>`:
  o Claude Code em pessoa (janelinha de terminal com olhos laranja, perninhas e braços). `digitando`
  mostra a linha sendo escrita; `pensando` põe o asterisco girando em cima; `andando` alterna as pernas.
- `<TerminalClaude em pedido pensando linhas={[{ texto, tipo: "ferramenta" | "resultado" | "ok" | "erro" | "texto" }]} passo largura pasta>`:
  a tela do Claude Code: o pedido sendo digitado na caixa, "✻ Pensando…" pelo tempo de `pensando` e
  as linhas chegando (`⏺` ferramenta, `⎿` resultado, `✓` ok). O pedido digita a ~31 letras por
  segundo: pra sincronizar com a fala, `em` = instante em que ele começa a falar o pedido.

Efeitos (x, y = centro, em px):
- `<NuvemDeBriga em ate x y tamanho>` (briga de desenho animado), `<Faiscas em x y n raio>`,
  `<Onda em x y raio>` (anel de impacto), `<Brilho em x y raio>` (só no herói), `<Estrela>`, `<Coroa>`

Texto e interface:
- `<Titulo texto em tamanho destaque={["palavra"]}>` (palavra por palavra), `<Rotulo texto em>`
  (pílula escura), `<Entrada em de="baixo" | "cima" | "esquerda" | "direita" | "zoom" mola>`,
  `<Card destaque?>`, `<Numero de para em dur prefixo sufixo tamanho>` (contando),
  `<Balao texto em cor?>` (balão de fala, letra de gibi)

Coisas de verdade:
- `<Logo arquivo="logos/instagram.svg" tamanho>` (as logos que você baixou com `kit/logo.mjs`),
  `<Imagem arquivo="materiais/m1.png">` (print ou material, sempre com Ken Burns), `<Icone nome="bot">`
  (Lucide, os nomes de `kit/icones/nomes.txt`)
- Também tem `AbsoluteFill`, `Sequence`, `Img` e `staticFile` do Remotion.

## A vitrine (motion que se monta com a fala)

Pro jeito "motion o vídeo inteiro" (o estilo Motion contínuo pede; nos outros, use quando servir):
um motion por assunto que vai ganhando peças, **cada uma na palavra em que ele fala dela**. Exemplos:
`kit/motion-exemplos/vitrine-*.tsx`.

- `<Foco em recua? volta? sai? de="baixo" | "cima" | "esquerda" | "direita" | "perto" | "longe">`: a
  entrada da vitrine (vem desfocada, menor, e assenta). `recua` = vai pro fundo quando outra coisa
  entra na frente; `volta` = volta pra frente; `sai` = some rápido.
- `<Vidro largura inclina? destaque? pad>`: o card de vidro (sombra longa); `inclina` em graus põe
  um 3D que respira.
- `<Etiqueta texto numero={[1, 5]} em>`: a pílula "● 01 / 05 · NOME" (capítulo de lista).
- `<IconeApp tamanho fundo="card" | "escuro" | cor>`: ícone de app com sombra de objeto; dentro,
  `<Img src={staticFile("logos/x.svg")}>` ou `<Icone>`.
- `<Rolo valor="1.000" em dur prefixo="US$" sufixo="mil" tamanho cor>`: número de caça-níquel
  (cada algarismo gira e para). Antes do `em` fica um esqueleto pulsando: o valor é surpresa.
- `<Embaralha texto em dur>`: o texto se decodificando (letras sorteadas na cor de destaque).
- `<Anotacao texto em tipo="erro" | "ok" | "heroi" numero? style={{ left, top }}>`: a pílula de
  revisão apontando um detalhe (posição absoluta).
- `<Carimbo texto em cor? tamanho giro>`: bate de cima, torto, com tremida (ponha `tremores` na
  `Camera` no mesmo instante).
- `<Cursor caminho={[{ em, x, y }]} cliques={[t]} some?>`: o mouse andando e clicando.
- `<Janela url largura altura inclina?>`: navegador com as 3 bolinhas; dentro, `<Imagem>` (print
  real) ou o que precisar.
- `<Barra em dur rotulo>` (instalando 0 → 100%, fica verde) e `<Checklist itens={[{ texto, em }]}>`
  (cada item ganha o check na hora).
- `<Mapa largura altura>` (cidade desenhada) + `<Pinos n em dur x y w h some? duplicados?>` (pinos
  em onda; `pinosAte(t, n, em, dur)` dá quantos já apareceram, pra um contador andar junto) +
  `<Mira em x y w h texto?>` (os cantos de HUD travando no alvo).
- `<Sublinha em>`: o traço que se desenha embaixo da palavra que importa.
- `<Cena noite>` (com `noite: true` no config): a mesma identidade no escuro, pro contraste.
- `TerminalClaude` fica de vidro branco na vitrine clara.

## Nunca

- Emoji como ícone (use `Icone` ou desenhe em SVG).
- Fundo chapado sem vida (a `Cena` resolve), elemento parado mais de 1,5 s sem nada em volta mudando.
- Texto na área da legenda (tela cheia, y 1400 a 1750) ou colado na borda.
- Motion que só repete em texto o que ele fala: mostre a cena.
- Logo desenhada à mão quando existe a oficial; resultado inventado (número de venda, seguidor).
- Entregar sem ter olhado os quadros.

Créditos: as regras e o ciclo vêm da skill `claude-remotion-skill` (MIT, github.com/haidrrrry);
o motor é o Remotion (remotion.dev).
