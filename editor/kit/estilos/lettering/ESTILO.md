# Estilo desta edição: Lettering

**A fala vira tipografia.** No alto, por cima do vídeo, as palavras entram **na hora em que são
ditas**, cada linha com uma fonte, um tamanho e uma cor: larga fina, larga pesada, preta,
condensada gigante. Efeitos de digitação com cursor, palavra com eco de contorno, pílula lima
inclinada, colchetes, uma régua de segmentos que enche. E, nas frases de impacto, **a palavra
gigante atrás da cabeça**, com extrusão violeta. Não tem legenda: o letreiro é a legenda.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

O vídeo é uma sequência de **blocos de letreiro**, um por frase (2 a 5 s cada), alternando três
formatos:

1. **Bloco no alto** (`"area": "topo"`): 2 a 4 linhas empilhadas, cada uma uma parte da frase.
2. **Palavra atrás** (`"area": "atras"`): 1 linha condensada com `extrusao` e `sangrar`, passando
   das bordas, atrás da cabeça. Junto pode entrar uma pílula na base (`"area": "base"`, `pilula`,
   `inclinar`).
3. **Bloco com régua** (`"area": "topo"`, `"regua": true`): cada linha enche um segmento.

Entre um bloco e outro pode sobrar 1 a 2 s só com o rosto e a legenda `simples`.

## Como editar

- **Texto:** só o que ele fala, em caixa alta, 1 a 3 palavras por linha. Tire artigo e preposição
  quando não fizer falta ("A IDEIA / GANHA / ESPAÇO").
- **`i` em toda linha** (o índice da 1ª palavra dela): é o que faz o texto entrar com a fala.
- **Mistura de fontes num bloco:** comece com `larga-media` (leve), ponha a palavra forte em
  `larga` ou `preta` com `cor` e feche com `larga-media`. Uma `condensada` gigante por vídeo.
- **Um enfeite por bloco, no máximo:** `eco`, `extrusao`, `pilula`, `colchetes`, `contorno`,
  `cursor` (com `"efeito": "digita"`).
- **Efeitos de entrada:** `digita` na 1ª linha de um bloco; `sobe` (padrão) nas outras; `pop` em
  pílula e colchetes; `borra` na palavra atrás; `espaca` numa palavra curta.
- **Cores:** branco, `acento` (violeta), `acento2` (lilás), `acento3` (lima, só em pílula ou num
  trecho `*marcado*`).
- **Legenda:** `simples`, só fora dos blocos. O letreiro esconde a legenda sozinho.
- **Câmera:** aberto. Na palavra atrás, ele precisa estar parado e de frente.
- **Emendas:** secas.
- **Sons:** `tecla` em cada linha, `pop` na pílula. Já são automáticos.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 3.25, "tipo": "lettering", "area": "topo", "linhas": [
      { "texto": "O CLAUDE", "fonte": "larga-media", "i": 0, "efeito": "digita", "cursor": true },
      { "texto": "ME DÁ", "fonte": "preta", "i": 2, "efeito": "espaca" },
      { "texto": "R$ 1.200", "fonte": "larga", "cor": "acento", "eco": true, "i": 4, "tamanho": 190 },
      { "texto": "TODO *MÊS*", "fonte": "larga-media", "cor": "acento2", "i": 5 } ] },
    { "de": 3.3, "ate": 6.25, "tipo": "lettering", "area": "atras", "linhas": [
      { "texto": "MANYCHAT", "fonte": "condensada", "extrusao": true, "sangrar": true, "i": 12, "efeito": "borra" } ] },
    { "de": 4.9, "ate": 6.25, "tipo": "lettering", "area": "base", "legenda": false, "linhas": [
      { "texto": "DE GRAÇA", "fonte": "preta", "pilula": true, "inclinar": -6, "i": 13, "efeito": "pop" } ] },
    { "de": 6.3, "ate": 11.5, "tipo": "lettering", "area": "topo", "regua": true, "linhas": [
      { "texto": "RESPONDE", "fonte": "preta", "i": 21 },
      { "texto": "NA HORA", "fonte": "larga-media", "i": 24 },
      { "texto": "CERTA", "fonte": "larga", "cor": "acento3", "colchetes": true, "i": 28, "efeito": "pop" } ] }
  ]
}
```

## Nunca

- Linha sem `i`, ou texto que ele não falou.
- Mais de 4 linhas num bloco, ou mais de 3 palavras por linha.
- Dois enfeites na mesma linha. Lima fora de pílula ou de trecho marcado.
- Card, lista ou tela dividida.

## Identidade visual

### Style Prompt
O criador em tela cheia; a metade de cima escurecida em violeta. Sobre ela, tipografia grande em
caixa alta, linhas empilhadas e centralizadas com fontes de larguras diferentes: uma linha fina e
larga branca, uma linha larga e pesada violeta com um eco de contorno lilás deslocado, uma linha
preta branca, uma linha lilás. Um cursor de digitação pisca. Uma régua de segmentos arredondados
enche com um cursor branco. Atrás da cabeça, uma palavra condensada enorme que passa das bordas,
branca com extrusão violeta. Uma pílula lima inclinada com texto escuro.

### Colors
- `#f2eafc` texto, `#9153f8` violeta, `#c4a6fa` lilás
- `#d4f83a` lima (pílula e trecho marcado), tinta `#150a2b`
- extrusão `#9153f8`, eco `#c4a6fa`

### Typography
- `Archivo` larga 600 (`larga-media`): linhas de apoio, teto 120 px
- `Archivo` larga 900 (`larga`): palavra forte, teto 210 px
- `Archivo` 900 (`preta`): teto 190 px
- `Archivo` condensada 900 (`condensada`): palavra atrás, teto 320 px

### What NOT to Do
- Nada de caixa baixa
- Nada de sombra pesada ou contorno preto nas letras
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use: o `lettering` cobre o que o estilo precisa.
