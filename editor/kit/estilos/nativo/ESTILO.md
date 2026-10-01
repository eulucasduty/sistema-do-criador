# Estilo desta edição: Nativo (texto do próprio TikTok)

Parece que foi **gravado e escrito dentro do aplicativo**: o texto usa a fonte do TikTok e as
**caixas arredondadas grudadas, uma por linha**, sem cor, sem efeito, sem nada de "editado". Tem o
**balão de "respondendo ao comentário"** no alto e a frase de gancho numa caixa branca. É o estilo
pra não ter cara de anúncio.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **0 s:** `manchete` no alto, de um dos dois jeitos:
   - **balão de comentário** (`usuario` + `comentario`): o vídeo é a resposta a uma pergunta;
   - **texto de gancho** (`texto`), 1 ou 2 linhas em caixa baixa, numa caixa branca.
   Fica o vídeo inteiro ou troca uma vez (do balão pro gancho).
2. **Corpo:** só ele falando e a legenda de caixas. Nada mais.

## Como editar

- **Legenda `caixa`** (padrão): frase normal em até 2 linhas, cada linha com a própria caixa preta
  arredondada, texto branco. A frase inteira aparece de uma vez e fica parada.
  - `branca`: caixa branca com texto preto. `contorno`: sem caixa, texto branco com contorno preto.
  - Sem `destaques`, sem `emojis` presos (emoji pode ir no texto da manchete).
- **Texto do gancho:** como a pessoa escreveria no app: minúsculo, direto, sem ponto final
  (`"manychat de graça | sim, existe"`).
- **Balão:** `usuario` genérico (`joao.silva`, `ana_`) e uma pergunta real que o vídeo responde.
  Nunca invente comentário elogiando.
- **Zona segura do app:** nada nos 240 px de cima nem nos 660 px de baixo; o montador já respeita.
- **Câmera:** parada. Sem `angulos`.
- **Emendas:** secas.
- **Sons:** nenhum.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 6.2, "tipo": "manchete", "usuario": "joao.silva", "comentario": "tem como fazer isso de graça?" },
    { "de": 6.3, "ate": 28, "tipo": "manchete", "texto": "manychat de graça | sim, existe" }
  ]
}
```

## Nunca

- Qualquer card, cor de marca, logo, fonte bonita, animação.
- Filtro de cor, grão, barras.
- Caixa alta em frase inteira.
- Som de efeito.

## Identidade visual

### Style Prompt
Vídeo de celular sem tratamento. Por cima, texto na fonte do TikTok em frase normal, com caixas
pretas de cantos arredondados que abraçam cada linha e se conectam (a linha mais curta tem a caixa
mais estreita). No alto à esquerda, um balão branco com rabinho embaixo, a foto redonda de quem
comentou, a linha cinza "Respondendo ao comentário de…" e o comentário em preto. Texto de gancho
numa caixa branca com letra preta.

### Colors
- caixa `#000000` com texto `#FFFFFF`; caixa `#FFFFFF` com texto `#000000`
- balão `#FFFFFF`, linha de cima `#909092`
- cores de caixa do app, se o pedido citar: `#EA4040`, `#FF923D`, `#F2CE46`, `#77C25D`, `#3496EF`

### Typography
- `TikTok` (TikTok Sans) peso 539 com caixa, 606 sem caixa; 60 a 66 px; entrelinha 1,208
- caixa: `padding` 0,437 em na horizontal e 0,1335 em na vertical; raio 0,23 em

### What NOT to Do
- Tipografia de design, sombra projetada, degradê
- Qualquer coisa com cara de motion
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use.
