# Créditos e licenças do kit

## Sons (`sons/`, catálogo em `sons/sons.json`)
Todos os sons do kit foram **gerados pelo próprio projeto** por síntese no ffmpeg (senos, ruído e
envelopes): nenhum arquivo de terceiros, nenhuma licença externa. Vão junto com o código, na
mesma licença dele.
- `teclado-kit`, `riser-kit`, `click-kit`, `impacto-kit`, `notificacao-kit`, `brilho`, `glitch`,
  `erro`: feitos pelo `scripts/gerar-sons.mjs` (rode `npm run sons:gerar` pra refazer os arquivos
  e o catálogo).
- `obturador-seco`, `ding-claro`, `pop-curto`, `whoosh-rapido`, `tick-curto`: também sintetizados
  no ffmpeg; já vêm prontos no kit.

Todos nivelados do mesmo jeito que a biblioteca do painel: sem silêncio no começo e o mesmo pico
de base. A biblioteca que vale nas edições é a "Meus sons" do painel (`criador.edicao_som`); este
catálogo é a reserva quando o criador ainda não montou a dele (ou a estação não alcança o banco).
Os sons que o criador sobe no painel são dele: ele responde pela licença de cada um.

## Fontes (`fontes/`, com a licença de cada uma em `fontes/licencas/`)
Todas de licença aberta: podem ser usadas em vídeo comercial e redistribuídas junto com o projeto.
- SIL Open Font License 1.1: Anton, Archivo, Bangers, Barlow e Barlow Condensed, Bebas Neue,
  Caveat, EB Garamond, Fraunces, Instrument Serif, Inter, Inter Tight, JetBrains Mono, Libre
  Franklin, Lilita One, Montserrat, Mrs Saint Delafield, Playfair Display, Plus Jakarta Sans,
  Poppins, Roboto, TikTok Sans e Unbounded.
- Apache License 2.0: Permanent Marker e Special Elite.
- `fontes/metricas.json`: as larguras de cada letra, medidas a partir desses arquivos (é com elas
  que o montador calcula o tamanho em que um texto cabe).

Os estilos "inspirados em" um criador ou canal usam essas fontes abertas no lugar das fontes
comerciais de cada um (que não podem ser redistribuídas). Os nomes citados são só referência do
jeito de editar: nenhum deles tem ligação com este projeto.

## Ícones (`icones/`)
Lucide (lucide.dev), licença ISC (`icones/LICENSE`).

## Texturas (`texturas/`)
`grao.png` (grão de filme) e `papel.jpg` (papel) foram geradas por este projeto no ffmpeg (ruído),
sem arquivo de terceiros.

## Logos
Buscadas na hora pelo media-use do HyperFrames (theSVG → avatar do GitHub → favicon) ou o ícone
do próprio site: são marcas dos donos, usadas só pra identificar a plataforma de que o criador
fala no vídeo. Não vêm no kit.

## GSAP e HyperFrames
Não vêm no kit: a estação baixa na primeira vez (editor/ferramentas, fora do git) o HyperFrames
(npm) e o `gsap.min.js` da CDN jsDelivr, e põe uma cópia do GSAP em cada oficina pra edição e o
render funcionarem sem internet. GSAP: licença própria da GreenSock/Webflow, gratuita.
