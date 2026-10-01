# Estilo desta edição: Tech rápido (inspirado em Fireship)

**Rápido, seco e sem rosto na tela cheia.** Fundo quase preto chapado, **títulos gordos em caixa
alta**, **janela de código colorida** com os três pontinhos, logos, terminal, e depois de cada
explicação **um meme ou uma palavra carimbada num retângulo torto**. O criador fica numa
**bolinha no canto de baixo**. **Sem legenda.** Nenhuma tela dura mais de cinco segundos.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

A tela está **sempre ocupada** (90% do vídeo ou mais), uma cena atrás da outra:

1. **0 a 3 s:** `palavra` com o tema em duas linhas (`"MANYCHAT | DE GRAÇA"`).
2. **Depois, a cada 2 a 5 s, uma cena em tela cheia** (`"area": "tela-cheia"`):
   `logos` (a pilha de ferramentas, com `"ligacao": "+"`) → `codigo` → `terminal` →
   `comparacao` ou `grafico` → `material`/`print` (a prova ou o meme).
3. **Por cima, o carimbo:** em 2 ou 3 cenas, um `carimbo` de 1 a 2 s com a palavra-chave daquele
   trecho, torto.
4. **Seção nova (vídeo longo):** um cartão `palavra` com o número ("1. O WEBHOOK").
5. **Fim:** `cta` ou `palavra`.

## Como editar

- **Sem legenda** (padrão `nenhuma`). Se o pedido quiser legenda, use `"legenda": { "estilo": "mono" }`.
- **`codigo`:** `titulo` é o nome do arquivo (`webhook.ts`); 4 a 7 `linhas` curtas (até 38
  letras), código de verdade e simples, na linguagem de que ele fala; `destacar` nas 1 ou 2 linhas
  que importam. As linhas aparecem em ordem.
- **`terminal`:** o comando de verdade e 2 saídas com `✓`.
- **`logos`:** logos oficiais (`node kit/logo.mjs …`), 2 a 4.
- **`carimbo`:** 1 a 2 palavras em caixa alta, `"cor"` variando entre `acento` (amarelo),
  `acento2` (azul), `acento3` (rosa), `ok` (verde); `"tinta": "preto"`; `"inclinar"` entre -10 e 10.
- **Meme / prova:** material dele ou print real em tela cheia, 1,5 a 3 s. Não invente meme.
- **Títulos:** caixa alta, 1 a 3 palavras.
- **A bolinha:** ele aparece sozinho em toda cena de tela cheia (menos na `palavra`). Pra tirar
  numa cena: `"pip": "nao"`.
- **Câmera:** sem `angulos`.
- **Emendas:** secas.
- **Sons:** `teclado` no código, `click` e `pop` nas entradas. Sem `riser` nem `impacto`.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 3.25, "tipo": "palavra", "texto": "MANYCHAT | DE GRAÇA", "legenda": false },
    { "de": 3.3, "ate": 6.25, "tipo": "logos", "area": "tela-cheia", "titulo": "A PILHA", "logos": [{ "arquivo": "logos/instagram.svg", "nome": "Instagram" }, { "arquivo": "logos/claude.svg", "nome": "Claude" }], "ligacao": "+" },
    { "de": 6.3, "ate": 11.5, "tipo": "codigo", "area": "tela-cheia", "titulo": "webhook.ts", "linhas": ["// responde quem comentou", "export async function receber(ev) {", "  if (ev.texto.includes(\"MANYCHAT\")) {", "    await mandarDM(ev.usuario);", "  }", "}"], "destacar": [3, 4] },
    { "de": 9.0, "ate": 11.4, "tipo": "carimbo", "texto": "AUTOMÁTICO", "cor": "acento2", "tinta": "preto", "y": 0.5, "inclinar": -7 },
    { "de": 11.6, "ate": 15.5, "tipo": "terminal", "area": "tela-cheia", "titulo": "deploy", "linhas": ["$ npx wrangler deploy", "✓ publicado em 4 s", "✓ webhook verificado"] },
    { "de": 15.6, "ate": 18.8, "tipo": "comparacao", "area": "tela-cheia", "titulo": "POR MÊS", "antes": { "rotulo": "ManyChat Pro", "valor": "R$ 100" }, "depois": { "rotulo": "O teu", "valor": "R$ 0" } }
  ]
}
```

## Nunca

- Tela parada por mais de 5 s. Rosto em tela cheia por mais de 3 s seguidos.
- Degradê, sombra projetada, vidro, textura.
- Código inventado que não faz o que ele diz, ou longo demais pra ler.
- Card na faixa de cima (tela dividida). Legenda grande.

## Identidade visual

### Style Prompt
Fundo grafite quase preto, chapado. Títulos em letra gorda e redonda, caixa alta, brancos, com a
linha de destaque em amarelo. Janela de código com fundo cinza-azulado, três bolinhas (vermelha,
amarela, verde), nome do arquivo em mono, números de linha e sintaxe colorida no tema One Dark.
Terminal preto com comando e checks verdes. Logos em quadrados claros arredondados com um "+"
amarelo entre eles. Palavras-chave carimbadas em retângulos de cor chapada (azul, amarelo, rosa,
verde), tortos, com letra preta. O criador numa bolinha com fio amarelo no canto de baixo.

### Colors
- `#16181D` fundo, `#23292F` cartões, `#282C34` janela de código (texto `#ABB2BF`)
- `#FCBA28` amarelo, `#12B5E5` azul, `#F38BA3` rosa, `#0BA95B` verde, `#ED203D` vermelho
- bolinhas da janela: `#FF5E57`, `#FFBC30`, `#29C93F`
- sintaxe: comentário `#5C6370`, palavra-chave `#C678DD`, texto `#98C379`, função `#61AFEF`,
  número `#D19A66`

### Typography
- `Lilita` (Lilita One): títulos e carimbos, caixa alta
- `Mono` (JetBrains Mono): código, terminal, rótulos

### What NOT to Do
- Serifa, letra fina, caixa baixa em título
- Qualquer degradê ou sombra
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `#16181D` chapado, cartão `#23292F` com `border-radius: 20px`, título em `"Lilita"` caixa
alta, acentos chapados. Entradas com `power3.out`, sem overshoot.
