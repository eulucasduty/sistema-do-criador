# Estilo desta edição: Cinema escuro (inspirado em Iman Gadzhi)

**Caro e contido.** Sala escura e quente, grão de filme em tudo, vinheta forte. A legenda é
**pequena, branca, de letras juntas**, de 1 a 3 palavras, e só fica **amarela na frase de ênfase**.
Intercalado com a fala, **animações em fundo quase preto com grade**, cartões de vidro e um
detalhe neon, sempre andando em 12 quadros por segundo (como animação de cinema). Nada pula, nada
grita.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 3 s):** rosto, plano `medio`, a legenda entrando borrada. Sem título.
2. **Corpo:** blocos de fala de 5 a 8 s intercalados com **uma animação em tela cheia** de 3 a 5 s
   (uns 30% do vídeo é animação). O enquadramento alterna entre `aberto` e `medio` a cada 2,7 a
   4,2 s sozinho.
3. **Frase de peso:** uma `palavra` em tela cheia, minúscula, com a parte-chave em letra de
   assinatura.
4. **Fim:** rosto. `cta` só se ele pedir.

## Como editar

- **Legenda `apertada`** (padrão): frase normal com pontuação, até 3 palavras, embaixo do rosto
  (em selfie de perto, em cima da cabeça). Entra deslizando borrada.
  - `destaques` em 3 a 6 palavras: o bloco inteiro delas fica amarelo. O resto é branco.
  - Variante `leve-forte` (`"legenda": { "estilo": "leve-forte" }`): tudo minúsculo, a frase
    aparece em letra fina e a palavra falada engrossa. É a versão de 2023.
- **Animações** (sempre `"area": "tela-cheia"`):
  - `lista` com `icone: "sparkle"` em cada item (a estrelinha de 4 pontas é a marca do estilo) e
    título minúsculo com a última palavra marcada: `"o que ele *faz*"`;
  - `contador` pra número (o estilo é de dinheiro: use sempre que houver valor);
  - `logos` empilhando quando ele cita ferramentas;
  - `comparacao` e `grafico` com parcimônia.
- **Texto das animações:** minúsculo, curto. A parte `*marcada*` sai em letra de assinatura branca
  com contorno azul deslocado. Use em 1 ou 2 palavras por tela.
- **Rabisco:** `anotacao` com `"forma": "sublinhado"` e `"cor": "erro"` embaixo de um número.
- **Câmera:** automática. `"empurrar": true` num trecho longo esconde corte.
- **Emendas:** secas. Sem dissolve.
- **Sons:** quase nada: `whoosh` na entrada da animação e `ding` no número. O estilo já limita.

## Exemplo de plano

```json
{
  "legenda": { "destaques": ["R$1.200", "gratuito"] },
  "cenas": [
    { "de": 6.3, "ate": 11.5, "tipo": "lista", "area": "tela-cheia", "rotulo": "o sistema", "titulo": "o que ele *faz*", "itens": [{ "texto": "Responde os comentários", "icone": "sparkle", "i": 21 }, { "texto": "Chama na DM", "icone": "sparkle", "i": 24 }, { "texto": "Conversa com todo mundo", "icone": "sparkle", "i": 28 }] },
    { "de": 11.6, "ate": 15.5, "tipo": "contador", "area": "tela-cheia", "rotulo": "custo por mês", "prefixo": "R$ ", "de_valor": 1200, "para_valor": 0, "cor": "verde" },
    { "de": 18.9, "ate": 20.6, "tipo": "palavra", "texto": "sem gastar | *nada*" }
  ]
}
```

## Nunca

- Emoji, legenda com caixa ou contorno, cor viva fora do amarelo.
- Animação com mola, pulo ou zoom rápido.
- Imagem de banco. Card na faixa de cima (tela dividida).
- Som em toda entrada.

## Identidade visual

### Style Prompt
Talking head em sala escura de tons quentes, pretos fundos, vinheta forte e grão de filme. Legenda
pequena em neo-grotesca de letras bem juntas, branca com sombra macia; o bloco de ênfase em
amarelo. As animações acontecem num fundo quase preto azulado com uma grade fina e um brilho azul
no alto: cartões de vidro escuro com borda sutil, marcadores de estrela de quatro pontas em verde
neon, números grandes em sans geométrica pesada, uma palavra em letra de assinatura branca com
contorno azul. Tudo se move em 12 quadros por segundo.

### Colors
- `#07080c` fundo das animações, com grade fina e um brilho azul no alto
- `#FFFFFF` legenda e texto, `#FCFF02` ênfase
- `#4dff9a` verde neon (marcador, valor); `#45d9ff` ciano e `#9a6bff` roxo em detalhe
- `#5b6dff` contorno da letra de assinatura

### Typography
- `InterTight` 600 com `letter-spacing: -0.03em`: legenda (56 px)
- `Montserrat` 800: títulos e números; 300 na variante leve
- `Assinatura` (Mrs Saint Delafield): a palavra marcada

### What NOT to Do
- Fundo claro, cor chapada alegre
- Caixa alta em frase inteira
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `var(--void)`, cartão `var(--card)` com `border: var(--card-borda)`, título em `"Montserrat"`
800 minúsculo, um único acento `#4dff9a`. Tweens com `ease: "steps(n)"` pra manter os 12 quadros.
