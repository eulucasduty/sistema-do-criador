# Estilo desta edição: Inserção de imagens

O criador fica **em tela cheia o vídeo inteiro**. No alto, um **cabeçalho de capítulo** (selo
"IDEIA 01", tracinhos de progresso e duas linhas em caixa alta larga, a segunda em lilás). Por
cima do vídeo, **as imagens entram no lugar que sobra**: um card com brilho e etiqueta, três
polaroides com fita, uma janela de navegador inclinada. No fim, um resumo em lista com miniaturas.
É o estilo pra "3 ideias", "3 provas", "olha esses exemplos".
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

O vídeo é dividido em **capítulos** (2 a 4). Em cada um:

1. um `cabecalho` com `selo`, `progresso: [n, total]` e 2 `linhas` (o capítulo inteiro);
2. meio segundo depois, um `fotos` (a prova daquele capítulo), até pouco antes do fim.

Os cabeçalhos são **colados** no tempo (um termina onde o outro começa): assim rolam de um pro
outro. No último capítulo (`"selo": "RESUMO"`), use `anotacao` com `"forma": "colchetes"` e
`"em": "rosto"`, ou uma `lista` com `"area": "sobre"` e `imagem` em cada item.

## Como editar

- **Fotos, um modo por capítulo** (varie):
  - `card`: uma imagem com borda lilás, brilho passando e `rotulo` em etiqueta violeta;
  - `polaroid`: 2 ou 3 imagens com fita e `legenda` manuscrita curta em cada (`"o esboço"`);
  - `janela`: um print de site numa janela de navegador inclinada, com `url` e `destaque` (o
    cursor vai até lá).
- **Onde as fotos ficam:** o montador encaixa embaixo do queixo ou em cima da cabeça. Com selfie
  de perto não cabe: aí elas sobem pra faixa de cima, embaixo do cabeçalho, e ele vai pra janela.
  Está certo. Meça o rosto com cuidado.
- **Legenda:** `simples` (pequena, branca, com sombra). Sem destaque colorido.
- **Linhas do cabeçalho:** 2 palavras cada, em caixa alta: `["MOSTRE O", "RESULTADO"]`.
- **Câmera:** `medio` no capítulo do meio pra variar. Sem inclinar.
- **Emendas:** secas.
- **Sons:** `obturador` ou `pop` quando cada foto entra; `click` no destaque da janela.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 6.2, "tipo": "cabecalho", "selo": "IDEIA 01", "progresso": [1, 3], "linhas": ["MOSTRE O", "RESULTADO"] },
    { "de": 0.6, "ate": 6.1, "tipo": "fotos", "modo": "card", "itens": [{ "material": "m1" }], "rotulo": "meu sistema" },
    { "de": 6.2, "ate": 11.5, "tipo": "cabecalho", "selo": "IDEIA 02", "progresso": [2, 3], "linhas": ["CONTE OS", "BASTIDORES"] },
    { "de": 6.8, "ate": 11.4, "tipo": "fotos", "modo": "polaroid", "itens": [{ "material": "m1", "legenda": "o painel" }, { "material": "m2", "legenda": "o código" }] },
    { "de": 11.5, "ate": 18.8, "tipo": "cabecalho", "selo": "IDEIA 03", "progresso": [3, 3], "linhas": ["PROVE NA", "TELA"] },
    { "de": 12.4, "ate": 18.7, "tipo": "fotos", "modo": "janela", "itens": [{ "material": "m2" }], "url": "github.com/anthropics/claude-code", "destaque": { "x": 0.03, "y": 0.1, "w": 0.4, "h": 0.12 } },
    { "de": 18.8, "ate": 22.7, "tipo": "cabecalho", "selo": "RESUMO", "progresso": [3, 3], "linhas": ["SALVE ESSAS", "3 IDEIAS"] },
    { "de": 19.3, "ate": 22.7, "tipo": "anotacao", "forma": "colchetes", "em": "rosto", "cor": "acento2" }
  ]
}
```

## Nunca

- Capítulo sem imagem, ou imagem que ele não citou.
- Card de faixa (`lista`, `fluxo`) junto do cabeçalho: os dois querem o alto.
- Mais de 4 capítulos.

## Identidade visual

### Style Prompt
O criador em tela cheia, com o alto escurecido em violeta. No topo à esquerda, um selo de
contorno com um ponto ("IDEIA 01") e ao lado tracinhos de progresso; embaixo, duas linhas em sans
larga, caixa alta, a primeira branca e a segunda lilás. Por cima do vídeo: um card de imagem com
borda lilás e um brilho que passa; polaroides brancas levemente giradas, com fita e legenda
manuscrita; uma janela de navegador escura inclinada, com os três pontinhos e a barra de endereço.
No resumo, colchetes brancos em volta do rosto e linhas escuras com miniatura, número e nome.

### Colors
- `#0b0716` escurecido do alto
- `#f2eafc` primeira linha, `#c4a6fa` segunda linha e selo
- `#9153f8` etiqueta da foto, `#ffffff` polaroid

### Typography
- `Archivo` larga 600: linhas do cabeçalho (caixa alta, 92 px)
- `Mono` 500 com `letter-spacing: 0.18em`: selo
- `Manuscrita` (Caveat): legenda da polaroid

### What NOT to Do
- Nada de imagem solta sem moldura
- Nada de cabeçalho centralizado
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo transparente, por cima do vídeo; moldura com `border: 2px solid var(--acento2)` e
`border-radius: 22px`; texto em `"Archivo"` com `font-stretch: 125%`.
