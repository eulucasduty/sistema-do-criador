# Estilo desta edição: Vlog

Vídeo de dia a dia: o criador contando ou mostrando algo, **com cara de gravado e postado**. A
edição quase não aparece. Quase tudo é o rosto dele e as imagens que ele gravou, com corte seco,
troca de enquadramento, uma **etiqueta de lugar e hora** e **polaroides** quando ele mostra algo.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Abertura:** `titulo` no alto situando a cena ("dia 12 · o sistema", "bastidores", o lugar e a
   hora), em caixa normal, sem som.
2. **Corpo:** ele falando, com o enquadramento variando nas emendas. O material dele entra como
   b-roll em tela cheia (1,5 a 3 s) ou como `fotos` em polaroid, enquanto ele continua falando.
3. **Fim:** `cta` normal, se ele pedir comentário.

Motion em **no máximo 25%** do vídeo. Na dúvida entre pôr um card ou deixar ele falando, deixe
ele falando.

## Como editar

- **Legenda `padrao`:** caixa normal, pequena, com uma caixinha branca acompanhando a palavra
  falada. `destaques` em no máximo 2 palavras.
- **Material dele é b-roll:** `material` com `"area": "tela-cheia"` e `"sangrar": true`. Print de
  sistema pode ir na faixa de cima com `foco`.
- **`fotos`** (polaroid): 1 a 3, com `legenda` curta manuscrita.
- **Sem card de enfeite.** `lista`, `contador` e `comparacao` só quando ele fala um número ou um
  passo a passo de verdade, no máximo 1 ou 2 no vídeo.
- **Sem palavra em tela cheia**, a não ser no gancho, e só se a frase pedir.
- **Câmera:** varie bastante entre `aberto`, `medio` e `fechado` nas emendas e use `empurrar` nos
  trechos longos. É o que dá ritmo aqui, no lugar dos cards.
- **Emendas:** secas. Numa troca de lugar ou de assunto pode usar `zoom`, no máximo 2 no vídeo.
- **Sons:** nenhum automático. Se quiser, um `whoosh` baixo (`"volume": 0.5`) quando entra um
  b-roll, em `sons`.

## Exemplo de plano

```json
{
  "legenda": { "destaques": ["gratuito"] },
  "angulos": [{ "de": 3.27, "ate": 5.53, "plano": "medio" }, { "de": 11.57, "ate": 15.57, "plano": "fechado", "empurrar": true }],
  "cenas": [
    { "de": 0.4, "ate": 3.2, "tipo": "titulo", "texto": "dia 12 · o sistema", "posicao": "topo", "som": "nenhum" },
    { "de": 6.6, "ate": 11.4, "tipo": "fotos", "modo": "polaroid", "itens": [{ "material": "m1", "legenda": "o painel" }, { "material": "m2", "legenda": "o código" }] }
  ]
}
```

## Nunca

- Efeito nas emendas (onda, flash, glitch), som em toda entrada de card.
- Card atrás de card cobrindo o vídeo: aqui o conteúdo é a imagem dele.
- Dourado, sombra dura de tinta, fonte de gibi.
- `terminal`, `fluxo` ou `notificacao`, a não ser que seja o assunto.

## Identidade visual

### Style Prompt
Vlog vertical, natural e próximo. Quase tudo é o rosto do criador e as imagens que ele gravou, com
corte seco e mudança de enquadramento. Texto branco em sans pesada, com sombra suave, direto sobre
o vídeo. Etiquetas brancas pequenas dizendo lugar e hora. Polaroides brancas com fita. Quando
aparece um card, ele é grafite, discreto, de borda fina. Nada brilha, nada pisca.

### Colors
- `#0b0b0c` fundo das telas cheias
- `#17171a` card, borda branca translúcida
- `#ffffff` texto e destaque, `#b8b8bd` rótulos
- `#86efac` verde, `#fca5a5` vermelho (só quando o assunto pedir)

### Typography
- `Jakarta` (Plus Jakarta Sans 800): títulos, etiquetas, legenda e números
- `Jakarta` 500: texto
- `Mono` (JetBrains Mono 500): rótulos

### What NOT to Do
- Nada de dourado, de sombra dura de tinta nem de fonte de gibi
- Nada de efeito nas emendas nem de som em toda entrada de card
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo transparente, texto `#ffffff` em `"Jakarta"` 800 com `text-shadow: 0 2px 18px rgba(0,0,0,.6)`,
card `#17171a` com `border: 1px solid rgba(255,255,255,.14)` e `border-radius: 22px`.
