# Estilo desta edição: Recorte de fundo

A IA **recorta o criador do fundo** e troca o cenário atrás dele várias vezes: **cidade à noite
desfocada, gráfico neon, cor sólida**. Em cada cenário, **uma palavra gigante atrás da cabeça**,
cada uma com um acabamento (degradê, eco de contorno, sombra dura). No alto, uma pílula escura diz
qual é o cenário. No fim, a tela se divide em três tiras, uma de cada fundo. É o estilo pra frase
curta de impacto, uma palavra por cenário.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Abertura (0 a 3 s):** `cenario` com `"fundo": "xadrez"`, `"entrada": "varredura"` e
   `"contorno": "brilho"`: uma linha desce varrendo e o fundo vira o xadrez de "transparente",
   com os chips "SEM FUNDO" e "ORIGINAL". Rótulo: "IA recortando o fundo".
2. **Cenários (3 a 5 s cada):** um `cenario` por palavra forte da fala. Troque `fundo` e
   `palavra_estilo` a cada um.
3. **Fecho (5 a 7 s):** `cenario` com três fundos em tiras e `"contorno": "adesivo"`, com
   `rotulos` e o rótulo "1 gravação · 3 cenários".

Cenários cobrindo **80% do vídeo ou mais**.

## Como editar

- **Palavra de cada cenário:** UMA palavra, de 3 a 6 letras, em caixa alta. Juntas, formam a
  frase ("SEM" / "TELA" / "VERDE"). Com `palavra`, a legenda sai sozinha.
- **Fundos e acabamentos que combinam:**
  - `bokeh` (cidade à noite) + palavra em degradê (padrão; `palavra_cor2` pra cor de baixo);
  - `neon` (anéis e raios violeta) + `"palavra_estilo": "eco"`;
  - `cor` com `"cor": "#fad24a"` + `"palavra_estilo": "sombra"`, `"palavra_cor": "#0d0817"`,
    `"palavra_cor2": "#7c4dff"`;
  - `grade` e `estudio` pra variar. Também aceita uma imagem dele: `"fundo": { "material": "m2" }`.
- **Rótulo:** `"Cenário 1 · cidade à noite"`, frase curta em caixa normal.
- **Trecho bom pra recorte:** ele parado, de frente, bem iluminado, sem a mão passando na frente
  do rosto. Evite trecho em que ele mostra objeto ou sai do quadro.
- **Câmera:** sem `angulos` (o recorte acompanha o enquadramento original).
- **Emendas:** secas. A troca de cenário é corte seco.
- **Sons:** `impacto` leve em cada palavra, `whoosh` na varredura.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 3.25, "tipo": "cenario", "fundo": "xadrez", "entrada": "varredura", "rotulo": "IA recortando o fundo", "contorno": "brilho" },
    { "de": 3.3, "ate": 6.25, "tipo": "cenario", "fundo": "bokeh", "palavra": "SEM", "palavra_cor2": "#ffd9b8", "rotulo": "Cenário 1 · cidade à noite" },
    { "de": 6.3, "ate": 11.5, "tipo": "cenario", "fundo": "neon", "palavra": "TELA", "palavra_estilo": "eco", "rotulo": "Cenário 2 · gráfico neon" },
    { "de": 11.6, "ate": 15.5, "tipo": "cenario", "fundo": "cor", "cor": "#fad24a", "palavra": "VERDE", "palavra_estilo": "sombra", "palavra_cor": "#0d0817", "palavra_cor2": "#7c4dff", "rotulo": "Cenário 3 · cor sólida" },
    { "de": 15.6, "ate": 22.7, "tipo": "cenario", "fundo": ["bokeh", "neon", "cor"], "cor": ["", "", "#fad24a"], "rotulos": ["cidade", "gráfico", "cor sólida"], "rotulo": "1 gravação · 3 cenários", "contorno": "adesivo" }
  ]
}
```

## Nunca

- Palavra com mais de 7 letras (não cabe atrás da cabeça) ou duas palavras no mesmo cenário.
- Card de faixa ou de tela cheia: o recorte precisa do vídeo inteiro.
- O mesmo fundo duas vezes seguidas.

## Identidade visual

### Style Prompt
O criador recortado do fundo, com um fio de luz no contorno. Atrás dele, cenários que trocam em
corte seco: bolas de luz desfocadas laranja, rosa e azul sobre prédios à noite; anéis e raios
neon violeta centrados na cabeça; amarelo chapado. Entre o fundo e ele, uma palavra enorme em
sans larga e pesada, cortada pela cabeça. No alto, uma pílula escura larga com um ponto violeta e
o nome do cenário. Na abertura, o fundo é o xadrez cinza de transparência e uma linha luminosa
desce revelando o recorte.

### Colors
- `#0d0817` tinta, `#f2eafc` texto
- bokeh: `#ff9d5c`, `#ff5fa2`, `#6aa8ff` sobre azul-noite
- neon: `#9153f8` e `#c4a6fa`
- cor sólida: `#fad24a` com palavra `#0d0817` e sombra `#7c4dff`

### Typography
- `Archivo` larga 900: palavra gigante
- `Jakarta` 500: pílula do cenário (caixa normal, 40 px)

### What NOT to Do
- Nada de legenda por cima da palavra gigante
- Nada de fundo com foto de banco genérica
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use: o estilo é o recorte e o cenário.
