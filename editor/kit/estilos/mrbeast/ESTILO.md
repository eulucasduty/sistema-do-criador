# Estilo desta edição: Desafio (inspirado em MrBeast)

Energia de desafio e de número grande: **legenda de gibi inclinada**, branca com **contorno preto
grosso**, de 1 a 3 palavras, com o bloco inteiro virando **amarelo ou vermelho** na hora do grito.
**Etiqueta de preço** presa num ponto da tela, **placar** contando no alto, seta vermelha, a tela
piscando de verde ou vermelho, e um **corte a cada segundo e pouco**. Tudo claro, saturado e alto.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 3 s):** o número ou a promessa na primeira frase, com a `etiqueta` de preço
   aparecendo junto e um flash de `tinta` na cor dela.
2. **Corpo:** troca de enquadramento a cada 1,6 a 3,2 s (o estilo já alterna aberto, médio e
   fechado). A cada trecho de 5 a 8 s, um elemento: `placar` quando conta algo, `etiqueta` quando
   fala valor, seta quando mostra algo.
3. **Revelação:** `riser` terminando nela (em `sons`, com `ate`) e `impacto` na palavra.
4. **Último 1 a 2 s:** `carimbo` com a chamada ("COMENTA!").

## Como editar

- **Legenda `gibi`** (padrão): caixa alta, até 3 palavras, no meio do quadro (sobre o tronco). O
  bloco aparece inteiro, com mola.
  - `destaques`: o bloco que tem a palavra fica **amarelo**. Use em 1 a cada 5 blocos.
  - `{ "palavra": "…", "cor": "vermelho" }` na palavra mais forte do vídeo (1 ou 2 vezes);
    `"cor": "verde"` em valor em dinheiro.
  - Sem emoji.
- **`etiqueta`:** o valor (`"R$ 1.200"`, `"R$ 0"`), `cor` `verde` (caro, ganho) ou `vermelho`
  (barato, perda), posicionada com `x`,`y` num canto livre, nunca no rosto. 2 a 3 s.
- **`placar`:** `de_valor` → `para_valor`, com `icone` e `rotulo` curto. 4 a 6 s.
- **`tinta`:** 0,4 s, junto de uma etiqueta ou da revelação.
- **Seta** (`anotacao`, `"forma": "seta"`, `"cor": "erro"`) sem texto ou com 1 palavra.
- **Câmera:** automática e rápida. Só escreva `angulos` pra segurar um plano na revelação.
- **Emendas:** secas com `whoosh` (já é o padrão do estilo).
- **Sons:** altos e presentes: `whoosh` nos cortes, `pop` nas entradas, `riser` de ~2 s antes da
  revelação, `impacto` nela.

## Exemplo de plano

```json
{
  "legenda": { "destaques": ["R$1.200", "ManyChat", { "palavra": "gratuito", "cor": "vermelho" }] },
  "cenas": [
    { "de": 0.7, "ate": 3.2, "tipo": "etiqueta", "texto": "R$ 1.200", "cor": "verde", "x": 0.5, "y": 0.2 },
    { "de": 0.7, "ate": 1.2, "tipo": "tinta", "cor": "verde" },
    { "de": 6.3, "ate": 11.5, "tipo": "placar", "icone": "users", "de_valor": 0, "para_valor": 1200, "rotulo": "pessoas na DM" },
    { "de": 12.4, "ate": 15.4, "tipo": "anotacao", "forma": "seta", "de_ponto": { "x": 0.18, "y": 0.4 }, "para": { "x": 0.38, "y": 0.52 }, "cor": "erro" },
    { "de": 19.4, "ate": 22.6, "tipo": "etiqueta", "texto": "R$ 0", "cor": "vermelho", "x": 0.74, "y": 0.3 },
    { "de": 25.4, "ate": 28, "tipo": "carimbo", "texto": "COMENTA!", "cor": "erro", "tinta": "branco", "y": 0.5 }
  ],
  "sons": [{ "ate": 19.4, "som": "riser" }]
}
```

## Nunca

- Legenda em caixa baixa, fina ou sem contorno. Mais de 3 palavras por bloco.
- Take parado por mais de 3,5 s.
- Card escuro, lista, texto pequeno pra ler. Imagem de banco.
- Número inventado: placar e etiqueta só com valor que ele falou.

## Identidade visual

### Style Prompt
Vídeo de desafio, claro e saturado. Legenda em letra de gibi caixa alta levemente deitada, branca
com contorno preto grosso de canto redondo e uma sombrinha dura embaixo; alguns blocos inteiros em
amarelo, a palavra mais forte em vermelho, valores em verde com brilho. Etiquetas de preço grandes
com contorno preto e brilho da própria cor. No alto, uma caixa clara arredondada com um ícone e um
número contando. Setas vermelhas grossas. A tela pisca de verde ou vermelho por um instante.

### Colors
- `#FFFFFF` legenda, contorno `#000000` de 10 px
- `#FFFF00` amarelo, `#EA0003` vermelho, `#12FF0B` verde dinheiro

### Typography
- `Bangers` em tudo: legenda (100 px), etiqueta, carimbo, título

### What NOT to Do
- Cor apagada, grão, vinheta, barras
- Letra fina ou serifada
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Evite. Se precisar: texto em `"Bangers"` caixa alta, `#ffffff` com `-webkit-text-stroke: 10px #000`
e `paint-order: stroke fill`.
