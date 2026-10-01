# Componentes do editor (as cenas do `plano.json`)

Cada item de `cenas` é um componente: `{ "de": 3.2, "ate": 6.1, "tipo": "…", … }`. O montador
(`node kit/montar.mjs`) desenha, anima e põe o som; a cor e a fonte vêm do estilo. Você escolhe
**qual**, **quando** e **com que texto**. O `kit/ESTILO.md` diz quais combinam com o estilo desta
edição. Não use componente que o estilo manda evitar.

## Onde a cena aparece (zona)

| zona | o que acontece com o vídeo do criador | como pedir |
|---|---|---|
| **faixa** | o motion fica em cima (~40% da tela) e ele embaixo (tela dividida) | padrão dos cards |
| **faixa de baixo** | o contrário: ele numa janela em cima, o motion embaixo | `"faixa": "baixo"` |
| **tela cheia** | o motion cobre tudo; ele some, ou vira uma janelinha no canto | `"area": "tela-cheia"` (+ `"pip": "direita"` ou `"esquerda"`; `"pip": "nao"` tira a janelinha nos estilos que põem sozinhos) |
| **por cima** | o motion fica por cima do vídeo, sem mexer no enquadramento | `"area": "sobre"` (nos cards) ou componentes "por cima" |
| **palco** | a cena mexe no próprio vídeo: cartão em 3D, celular, camadas | só os componentes de palco |
| **fundo** | troca o que está atrás dele (precisa do recorte da pessoa) | `cenario` |

Duas cenas da mesma zona não se sobrepõem no tempo (o montador corta a primeira). Cena por cima
pode conviver com outra por cima.

**O rosto nunca fica coberto.** O que vai por cima do vídeo (fotos, prompt, lista, manchete) se
encaixa sozinho embaixo do queixo ou em cima da cabeça. Se o rosto ocupa a tela (selfie de perto),
não cabe: aí as fotos vão pra faixa de cima e o montador avisa do resto. Por isso **meça o rosto
com cuidado** (`rosto`/`rostos` no plano).

## Campos que valem em todas

- `de`, `ate`: segundos do vídeo. Mínimo 0,3 s; pra dar tempo de ler, 1,5 s ou mais.
- `"sons": false`: desliga os sons automáticos da cena. `"legenda": false`: esconde a legenda nela.
- **Sincronia com a fala:** itens, linhas e etapas aceitam `"i": 24` (entra quando a palavra de
  índice 24 de `dados/palavras.json` é falada) ou `"t": 8.06` (segundo exato). Sem nenhum dos dois,
  o montador distribui no tempo da cena. Use `i` sempre que o item corresponde a uma palavra dita.
- **Trecho em destaque dentro de um texto:** `*assim*` (título de card, cabeçalho, manchete,
  palavra, letreiro). Sai na segunda cor do estilo.
- **Quebra de linha:** `"LINHA 1 | LINHA 2"`.
- **Ícones:** nomes do Lucide (`kit/icones/nomes.txt`, ~2.100: `message-circle`, `send`, `wallet`,
  `zap`, `check`, `target`, `layers`…). Ícone que não existe vira um círculo e o montador avisa.
- **Imagens:** `"material": "m1"` (o que o criador subiu) ou `"arquivo": "prints/x.png"`.
- **Cores nos campos `cor`:** `acento`, `acento2`, `acento3`, `texto`, `branco`, `preto`, `ok`,
  `erro`, ou `#rrggbb`.

## Cards (faixa, faixa de baixo, tela cheia)

Todos aceitam `"area": "tela-cheia"`, `"faixa": "baixo"`, `"titulo"` e `"olho"` (linha pequena em
cima do título). Limites que cabem: os do montador (ele avisa quando passa).

- **material** / **print**: imagem ou gravação de tela numa moldura.
  `{ "tipo": "material", "material": "m1", "foco": {x,y,w,h}, "destaque": {x,y,w,h}, "rotulo": "SISTEMA", "url": "site.com", "inicio": 0 }`
  - `foco` (0 a 1): a parte que interessa, entra com zoom. Sempre dê foco, fechado o bastante pra ler no celular.
  - `destaque`: caixa em volta de um botão ou número (com clique). `url`: barra de navegador.
  - `titulo`/`olho`: texto em cima da moldura. `"regua": true` + `"chip": "NO FRAME EXATO"`: régua de quadros embaixo; a imagem espera lavada e ganha cor no instante `i`/`t` da cena.
  - Na tela cheia, `"sangrar": true` faz a imagem cobrir a tela inteira (corte seco, 1 a 2 s).
- **logos**: `{ "tipo": "logos", "titulo": "…", "logos": [{ "arquivo": "logos/x.svg", "nome": "X", "fundo": "escuro"? }], "ligacao": "+" }`
- **fluxo** (A → B → C): `{ "tipo": "fluxo", "titulo": "…", "nos": [{ "nome": "Comentário", "sub": "alguém comenta", "icone": "message-circle" | "logo": "logos/x.svg", "i": 19 }], "rotulo": "AUTOMÁTICO" }` (até 4 nós; na tela cheia desce na vertical)
- **comparacao** (antes → depois): `{ "tipo": "comparacao", "titulo": "…", "antes": { "rotulo", "valor", "detalhe", "logo" | "icone" }, "depois": { … } }`
- **contador**: `{ "tipo": "contador", "rotulo": "…", "de_valor": 0, "para_valor": 128, "prefixo": "R$ ", "sufixo": "", "casas": 0, "cor": "verde|vermelho|dourado|branco", "barra": 0.86, "detalhe": "…", "icone" | "logo" }`
- **chat**: `{ "tipo": "chat", "app": "instagram|whatsapp", "nome": "Ana", "avatar": "perfil"?, "mensagens": [{ "lado": "ela|eu", "texto": "…", "i": 30 }] }`
- **comentarios**: `{ "tipo": "comentarios", "itens": [{ "usuario": "joao", "texto": "QUERO" }], "resposta": "te mandei na dm" }`
- **notificacao**: `{ "tipo": "notificacao", "itens": [{ "app": "Instagram", "logo" | "icone", "titulo": "…", "texto": "…", "hora": "agora" }] }`
- **lista**: `{ "tipo": "lista", "titulo": "Em 3 passos", "rotulo": "…", "itens": ["texto" | { "texto", "sub", "icone", "imagem", "ok": true|false, "i" }], "numerar": true|false|"00" }`
  - `"modo": "foco"`: todos aparecem apagados e o da vez acende quando ele fala (dê `i` em cada item). Com `"area": "tela-cheia"` e `"pip"`, aceita `"rodape": { "linhas": ["UM PASSO", "DE CADA VEZ."], "icone": "footprints" }` ao lado da janelinha.
  - `"ok": true/false` em cada item: placar de certo e errado.
  - `"area": "sobre"`: por cima do vídeo (até 4 itens), embaixo do queixo ou em cima da cabeça.
- **terminal**: `{ "tipo": "terminal", "titulo": "claude", "linhas": ["> comando", "saída…", "✓ feito"] }` (`>` comando, `✓` sucesso)
- **codigo**: `{ "tipo": "codigo", "titulo": "arquivo.ts", "linhas": ["…"], "destacar": [3, 4] }` (colorido; as linhas aparecem em ordem)
- **ficha**: `{ "tipo": "ficha", "titulo": "…", "icone": "…", "itens": [{ "rotulo": "Preço", "valor": "R$ 0" }], "nota": 8.5, "nota_rotulo": "Nota" }` (até 4 linhas na faixa)
- **grafico**: `{ "tipo": "grafico", "rotulo": "…", "titulo": "…", "prefixo": "R$ ", "barras": [{ "rotulo": "A", "valor": 1200, "destaque": true, "texto": "R$ 1.200" }], "fonte": "de onde veio o dado" }`
- **grade**: `{ "tipo": "grade", "rotulo": "…", "titulo": "O que isso abre pra | você", "itens": [{ "material" | "arquivo", "icone", "texto": "Teu sistema" }] }` (2 colunas; 4 na faixa, 6 na tela cheia; uma logo em `arquivo` aparece inteira, sem cortar)
- **carrossel**: `{ "tipo": "carrossel", "itens": ["m1", "m2", { "arquivo": "prints/a.png" }], "titulo": "…", "velocidade": 14 }` (roda de imagens girando; só imagem)
- **documento**: `{ "tipo": "documento", "cabecalho": "Nome do jornal", "data": "12 de março", "titulo": "…", "texto": "Texto com ==trecho marcado de marca-texto== no meio.", "fonte": "de onde saiu", "marcas": [{ "i": 40 }] }`

## Por cima do vídeo

- **cabecalho**: fica no alto. Três formas, conforme os campos:
  - capítulo: `{ "tipo": "cabecalho", "selo": "IDEIA 01", "progresso": [1, 3], "linhas": ["MOSTRE O", "RESULTADO"] }`
  - passo: `{ "tipo": "cabecalho", "numero": "01", "icone": "target", "linhas": ["ESCOLHA", "UMA ENTREGA"] }`
  - título: `{ "tipo": "cabecalho", "rotulo": "ALIMENTAÇÃO · VIDA REAL", "linhas": ["TRÊS PONTOS", "PARA SUA ROTINA."] }`
  - Cabeçalhos colados no tempo (um acaba quando o outro começa) rolam de um pro outro. Opções: `alinhar` (`esquerda`, `centro`), `fonte`, `tamanho`, `regua` (`false` tira o traço; `"mao"` desenha dois riscos à mão embaixo da última linha), `entrada: "letras"` (as letras crescem uma a uma) e `saida: "borra"` (sobe e some desfocado). O estilo já escolhe; só mude se o `kit/ESTILO.md` pedir.
  - Não ponha cabeçalho junto de card da faixa ou de tela cheia (os dois querem o alto); só as `fotos` sabem se encaixar embaixo dele.
- **lettering** (tipografia no ritmo da fala; esconde a legenda): `{ "tipo": "lettering", "area": "topo|meio|base|atras|tela-cheia", "regua": true, "linhas": [{ "texto": "QUANDO", "fonte": "larga-media", "i": 0, "efeito": "digita", "cursor": true }, { "texto": "TUDO", "fonte": "larga", "cor": "acento", "eco": true, "i": 1 }] }`
  - por linha: `fonte` (papel de fonte, ver abaixo), `cor`, `tamanho` (teto em px), `efeito` (`sobe`, `desce`, `pop`, `borra`, `digita`, `cresce`, `espaca`, `glitch`, `zoom`, `pisca`, `letras`), `palavras: true` (cada palavra entra quando é falada; precisa do `i` da 1ª), e os enfeites `contorno`, `extrusao`, `eco`, `pilula`, `colchetes`, `gradiente`, `dupla`, `sangrar` (passa das bordas), `inclinar` (graus).
  - `"area": "atras"`: as letras ficam atrás da pessoa (usa o recorte dela).
  - `"regua": true`: barra de segmentos que enche a cada linha.
- **letreiro** (faixas de texto correndo): `{ "tipo": "letreiro", "linhas": ["EDIÇÃO QUE PRENDE", { "texto": "SEM ENROLAR", "contorno": true }], "atras": true, "tamanho": 96 }`
- **fotos**: `{ "tipo": "fotos", "modo": "polaroid|card|janela|solta", "itens": [{ "material": "m1", "legenda": "o esboço", "rotulo": "etiqueta", "i": 12 }] }` (até 3)
  - `polaroid`: com fita e legenda. `card`: uma por vez, com brilho e etiqueta. `janela`: janela de navegador inclinada (`url`, `destaque` com cursor). `solta`: a imagem como ela é, sem moldura.
- **prompt** (barra de comando sendo digitado): `{ "tipo": "prompt", "rotulo": "VOCÊ PEDE · A IA FAZ", "texto": "Cria um sistema que…", "realces": ["sistema"] }`
- **anotacao** (traço à mão): `{ "tipo": "anotacao", "forma": "seta|circulo|sublinhado|x|colchetes", … }`
  - seta: `"de_ponto": {x,y}, "para": {x,y}, "texto": "olha isso"`. As outras: `"em": {x,y,w,h}` (ou `"em": "rosto"` pra enquadrar o rosto). `sublinhado` aceita `"duplo": true`. `cor`.
- **emoji**: `{ "tipo": "emoji", "emoji": "🔥", "x": 0.8, "y": 0.3, "tamanho": 170 }`
- **carimbo** (1 a 3 palavras num retângulo torto; fica por cima de tudo, até de card em tela cheia): `{ "tipo": "carimbo", "texto": "DE GRAÇA", "cor": "acento", "tinta": "preto", "x": 0.5, "y": 0.28, "inclinar": -5 }`
- **etiqueta** (preço ou número preso num ponto, com brilho): `{ "tipo": "etiqueta", "texto": "R$ 1.200", "cor": "verde|vermelho|amarelo|branco", "x": 0.5, "y": 0.2 }`
- **placar** (contador numa caixa no alto): `{ "tipo": "placar", "icone": "users", "de_valor": 0, "para_valor": 1200, "rotulo": "pessoas na DM" }`
- **tinta** (a tela pisca de uma cor): `{ "tipo": "tinta", "cor": "verde|vermelho" }` (0,3 a 0,6 s)
- **tarja** (nome e cargo): `{ "tipo": "tarja", "nome": "Fulano", "cargo": "o que ele é", "lado": "esquerda|direita" }` (3 a 6 s). Sem `nome`, sai o do criador (`dados/perfil.json`). Se cair em cima do rosto, o montador sobe ela pra cima da cabeça.
- **manchete** (o título do vídeo na tela; também `plano.manchete` pra ficar o vídeo todo): `{ "tipo": "manchete", "texto": "Linha 1 | *frase-chave*", "selo": "URGENTE", "sub": "linha de apoio" }`
  - balão de resposta a comentário: `"usuario": "joao.silva", "comentario": "tem como fazer de graça?"`
- **faixa-noticias** (letreiro de telejornal): `{ "tipo": "faixa-noticias", "selo": "AGORA", "itens": ["notícia um", "notícia dois"] }`
- **bug** (selo de canto): `{ "tipo": "bug", "texto": "AO VIVO", "hora": "09:42", "canal": "NOME" }`
- **local** (lugar e hora datilografados): `{ "tipo": "local", "linhas": ["SÃO PAULO, BRASIL", "14 DE MARÇO · 09:42"] }`
- **moldura** (fio em volta do vídeo, com pílula embaixo): `{ "tipo": "moldura", "pilula": "AGORA NO SEU CONTEÚDO", "icone": "circle-play" }`
- **chamadas** (etiquetas apontando pra um ponto): `{ "tipo": "chamadas", "itens": [{ "texto": "Título animado", "x": 0.25, "y": 0.4, "alvo": { "x": 0.5, "y": 0.5 }, "icone": "sparkles", "i": 40 }] }`
- **visor** (visor de câmera gravando; o vídeo fica cru, sem cor e sem legenda): `{ "tipo": "visor", "rotulo": "BRUTO · SEM EDIÇÃO" }` (`"legenda": true` mantém a legenda)
- **titulo** (chip): `{ "tipo": "titulo", "texto": "DICA", "cor": "verde|vermelho|branco", "posicao": "topo|base", "icone": "…", "som": "ding|nenhum" }`
- **cta**: `{ "tipo": "cta", "palavra": "MANYCHAT", "frase": "comenta" }` (o comentário digitando em cima e o card do perfil embaixo; não use junto com cena da faixa)

## Tela cheia (sempre)

- **palavra** (esconde a legenda): `{ "tipo": "palavra", "texto": "MUITO | SIMPLES", "ouro": [1] }` (`ouro` = linhas na cor de destaque). No máximo 2 por vídeo.
  - `"atras": true`: a palavra fica **atrás da pessoa**, gigante (usa o recorte dela).
- **citacao**: `{ "tipo": "citacao", "texto": "A frase.", "autor": "Quem disse" }`
- **janela-ia** (passo de tutorial numa janela em 3D):
  `{ "tipo": "janela-ia", "numero": "01", "rotulo": "EM PORTUGUÊS", "titulo": "Você pede | a edição.", "janela": "Editor IA", "prompt": "Corta as pausas e põe legenda", "realces": ["pausas", "legenda"], "anexo": "take-01.mp4", "tira": "cortes" }`
  - no passo seguinte, o comando já escrito e a lista marcando: `"digitado": true, "itens": [{ "texto": "Pausas cortadas", "i": 21 }], "progresso": "Exportando vídeo…", "tira": "montada"`
- **isometrico** (uma ideia desmontada em andares): `{ "tipo": "isometrico", "rotulo": "COMO FUNCIONA", "titulo": "TRÊS CAMADAS.", "camadas": [{ "nome": "ENTRADA", "sub": "O QUE CHEGA", "icone": "inbox", "desenho": "caminho|luz|blocos|grade", "i": 20 }] }` (de baixo pra cima, até 4)
- **celular** com imagem: `{ "tipo": "celular", "material": "m1", "itens": [{ "texto": "Título animado", "lado": "esquerda", "y": 0.2, "icone": "sparkles" }] }`

## No palco (mexem no próprio vídeo)

- **camadas** (o vídeo num cartão; a edição entra em camadas de vidro):
  `{ "tipo": "camadas", "etapas": [{ "selo": "CAMADA 01 · CRUA", "nome": "Gravação" }, { "selo": "CAMADA 02", "nome": "Trilha", "elemento": "onda", "t": 2.2 }, { "nome": "Legendas", "elemento": "legenda", "t": 4.4 }, { "nome": "Ícones", "elemento": "icones", "icones": ["scissors", "zap"], "t": 7 }, { "nome": "Título", "elemento": "titulo", "texto": "LINHA 1 | LINHA 2", "t": 9.6 }], "final": { "selo": "RESULTADO", "nome": "Vídeo pronto", "t": 12 } }`
  - elementos: `onda`, `legenda` (a legenda de verdade, dentro do cartão), `icones`, `titulo`, `imagem`, `texto`. Mínimo 3 s; fica melhor com 8 s ou mais.
- **celular** (sem imagem: o vídeo dele dentro do aparelho): `{ "tipo": "celular", "numero": "03", "rotulo": "O RESULTADO", "titulo": "Pronto pra | postar.", "itens": [{ "texto": "Legenda automática", "lado": "direita", "y": 0.8 }] }`
- **profundidade** (fundo, texto, pessoa, ícones e moldura em planos separados, girando; usa o recorte): `{ "tipo": "profundidade", "palavra": "PROFUNDIDADE | 3D", "camadas": ["FUNDO", "TEXTO", "APRESENTADOR", "ÍCONES", "MOLDURA"], "icones": ["image", "layers", "captions"] }`
- **cenario** (troca o fundo atrás dele; usa o recorte):
  `{ "tipo": "cenario", "fundo": "bokeh|neon|cor|grade|xadrez|estudio", "cor": "#fad24a", "palavra": "SEM", "palavra_estilo": "gradiente|sombra|eco|contorno", "palavra_cor": "#0d0817", "palavra_cor2": "#7c4dff", "rotulo": "Cenário 1 · cidade à noite", "contorno": "brilho|adesivo|nenhum", "entrada": "corte|varredura" }`
  - `fundo` também aceita uma imagem (`{ "material": "m2" }`) ou três fundos em tiras (`["bokeh", "neon", "cor"]`, com `"rotulos": ["cidade", "gráfico", "cor sólida"]`).
  - com `palavra`, a legenda sai (a palavra gigante é a mensagem).
- **`"saltar": true`** em qualquer card da faixa: a pessoa "sai" da janela (a cabeça passa da borda de cima). Usa o recorte.

**Recorte da pessoa:** `palavra` com `atras`, `lettering`/`letreiro` atrás, `cenario`, `profundidade`
e `saltar` precisam da pessoa recortada do fundo. A estação gera o recorte depois do plano pronto,
só dos trechos que pedem (leva uns 15 s de processamento por segundo de vídeo). Nos seus snapshots
o recorte ainda não existe: o que deveria ficar "atrás" dele aparece na frente. Está certo; no
render final fica atrás. Use esses componentes em trechos curtos (2 a 6 s), em que ele esteja
parado e bem iluminado, a não ser que o estilo seja feito disso.

## Cena livre

Só quando nenhum componente serve: `{ "tipo": "livre", "arquivo": "cenas/nome.html", "area": "topo|tela-cheia|sobre" }`.
É uma sub-composição HyperFrames em `cenas/<nome>.html`; o tempo dentro dela começa em 0. Na faixa
de cima, desenhe só de `top: 0` a `760px`. Regras: um timeline pausado em
`window.__timelines["<id>"]`, sem `Math.random`/`Date`, sem `repeat: -1`, sem `<br>`, ids com o
prefixo da cena, só `x`, `y`, `scale`, `rotation` e `opacity` nos tweens.

```html
<template id="grafico-template">
  <div data-composition-id="grafico" data-width="1080" data-height="1920">
    <div class="grafico-palco"><div class="grafico-titulo" id="grafico-t">Seguidores</div></div>
    <style>
      [data-composition-id="grafico"] .grafico-palco { position: absolute; left: 0; top: 0; width: 1080px; height: 760px; display: flex; align-items: center; justify-content: center; }
      [data-composition-id="grafico"] .grafico-titulo { font-family: var(--f-titulo); font-size: 64px; color: var(--texto); }
    </style>
    <script>
      (() => {
        const tl = gsap.timeline({ paused: true });
        tl.from("#grafico-t", { y: -40, opacity: 0, duration: 0.35, ease: "back.out(2)" }, 0.1);
        window.__timelines["grafico"] = tl;
      })();
    </script>
  </div>
</template>
```

Use as variáveis do estilo (`var(--void)`, `var(--card)`, `var(--texto)`, `var(--dim)`,
`var(--acento)`, `var(--acento2)`, `var(--f-titulo)`, `var(--f-texto)`, `var(--f-mono)`): assim a
cena livre sai na cara do estilo.

## Papéis de fonte (campo `fonte`)

`texto`, `texto-medio` (Jakarta) · `inter`, `inter-leve`, `inter-semi`, `inter-preta` · `apertada`,
`apertada-forte` (Inter Tight) · `mono` · `display`, `display-leve` (Unbounded, larga e redonda) ·
`larga`, `larga-media`, `larga-leve`, `preta`, `condensada`, `condensada-media` (Archivo em três
larguras) · `montserrat`, `montserrat-media`, `montserrat-leve` · `impacto` (Anton) · `bebas` ·
`bangers` · `lilita` · `poppins`, `poppins-media`, `poppins-leve` · `din`, `din-forte`, `din-preta`,
`din-condensada`, `din-condensada-italica` (Barlow) · `franklin`, `franklin-forte` · `roboto` ·
`tiktok`, `tiktok-forte`, `tiktok-preta` · `serifa` (itálica), `serifa-reta` (Instrument Serif) ·
`editorial`, `editorial-italica` (Playfair) · `garamond`, `garamond-italica` · `fraunces` ·
`manuscrita` (Caveat) · `marcador` · `maquina` (máquina de escrever) · `assinatura`.

O estilo já escolhe a fonte de cada coisa. Só passe `fonte` quando o `kit/ESTILO.md` pedir.
