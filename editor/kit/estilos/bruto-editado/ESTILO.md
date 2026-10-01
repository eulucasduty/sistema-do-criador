# Estilo desta edição: Do bruto ao editado

O vídeo **começa cru**, sem cor, com um **visor de câmera gravando** ("REC", cantoneiras, "BRUTO ·
SEM EDIÇÃO"). Um **glitch de barras** vira a chave e a edição aparece: cor, **palavra gigante
atrás da cabeça**, um **carrossel de referências girando em 3D** em cima com o criador numa janela
embaixo, e no fim uma **moldura luminosa** em volta dele com uma pílula. É o estilo pra "antes e
depois" e pra "olha a diferença".
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Bruto (0 a 3 s):** `visor`. O vídeo fica lavado, sem legenda. Ele fala o problema.
2. **A virada:** na emenda logo depois, troque o estilo pra `barras` (com `whoosh`). É o único
   efeito de emenda do vídeo.
3. **Palavra atrás (2 a 3 s):** `palavra` com `"atras": true`, 1 ou 2 palavras em caixa alta,
   brancas, com brilho. A cabeça dele passa na frente das letras.
4. **Carrossel (5 a 9 s):** `carrossel` com 2 a 6 imagens (materiais dele ou prints). Ele vai pra
   janela de baixo.
5. **Fecho (3 a 5 s):** `moldura` com a pílula ("AGORA NO SEU CONTEÚDO") e o `cta`.

## Como editar

- **Legenda:** `destaque`. Some no `visor` e na palavra atrás; volta no resto.
- **Palavra atrás:** escolha a expressão que resume a virada ("NOVA | ERA", "DE | GRAÇA"). Duas
  linhas de até 7 letras cada rendem mais. Use num trecho em que ele esteja parado e de frente.
- **Carrossel:** só imagem. Se ele subiu poucos materiais, complete com prints reais
  (`node kit/print.mjs …`).
- **Câmera:** aberto no bruto; `medio` depois da virada.
- **Emendas:** secas, menos a virada (`cortes.trocar` com `"estilo": "barras"`).
- **Sons:** `obturador` no visor, `whoosh` na virada, `impacto` na palavra. Sem mais nada.

## Exemplo de plano

```json
{
  "cortes": { "trocar": [{ "t": 3.27, "estilo": "barras", "som": "whoosh" }] },
  "cenas": [
    { "de": 0, "ate": 3.25, "tipo": "visor", "rotulo": "BRUTO · SEM EDIÇÃO" },
    { "de": 3.3, "ate": 6.2, "tipo": "palavra", "atras": true, "texto": "DE | GRAÇA", "ouro": [] },
    { "de": 6.3, "ate": 15.5, "tipo": "carrossel", "itens": ["m1", "m2", { "arquivo": "prints/painel.png" }] },
    { "de": 18.9, "ate": 22.7, "tipo": "moldura", "pilula": "AGORA NO SEU INSTAGRAM", "icone": "circle-play" }
  ]
}
```

## Nunca

- Visor depois da virada, ou mais de uma virada.
- Palavra atrás com frase longa (mais de 2 linhas).
- Card de lista ou de número no meio: aqui a prova é visual.

## Identidade visual

### Style Prompt
Começa como gravação crua: imagem lavada, visor de câmera com cantoneiras brancas, ponto vermelho
de REC, contador de tempo e a etiqueta "BRUTO · SEM EDIÇÃO". Barras horizontais ciano e violeta
riscam a tela e o vídeo ganha cor. Atrás da cabeça do criador, letras brancas enormes em sans
larga com brilho branco e violeta. Depois a tela divide: em cima, uma roda de cartões verticais
girando em perspectiva; embaixo, o criador numa janela de borda luminosa com cantoneiras. No fim,
um fio violeta contorna a tela inteira e uma pílula violeta aparece embaixo à esquerda.

### Colors
- bruto: imagem dessaturada, visor branco, REC `#ff3b3b`
- barras da virada: `rgba(80,220,255,.72)` e `rgba(150,90,255,.72)`
- palavra atrás: `#ffffff` com brilho `rgba(145,83,248,.6)`
- moldura e pílula: `#9153f8`

### Typography
- `Archivo` larga 900: palavra atrás (caixa alta)
- `Mono` 500: textos do visor
- `Jakarta` 800: pílula

### What NOT to Do
- Nada de texto colorido na palavra atrás: ela é branca
- Nada de card escuro com lista: quebra a ideia de "antes e depois"
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Evite. Se precisar: fundo transparente, texto branco em `"Archivo"` com `font-stretch: 125%`,
peso 900, `text-shadow: 0 0 40px rgba(255,255,255,.55)`.
