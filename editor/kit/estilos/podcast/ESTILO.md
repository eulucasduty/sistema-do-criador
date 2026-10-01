# Estilo desta edição: Podcast cinematográfico (inspirado em The Diary of a CEO)

Clipe de conversa com **cara de cinema**: imagem escura e quente, preto subindo de baixo, corte em
quem fala. A legenda é em **caixa alta, com a linha forte maior e dourada**. Nos primeiros
segundos, **uma caixa branca arredondada com o gancho** em letras pretas pesadas. O nome de quem
fala aparece pequeno, em caixa alta dourada. **Sem música e sem efeito sonoro**: clipe seco.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 5 s):** `manchete` com a pergunta ou a frase mais forte do clipe, duas linhas em
   caixa alta, a parte-chave em vermelho. Some sozinha por volta de 5 s.
2. **Logo depois (por 4 a 5 s):** `tarja` com o nome e quem a pessoa é.
3. **Corpo:** só a fala e a legenda. O enquadramento alterna entre `aberto` e `medio` a cada 3,6 a
   6 s (automático).
4. **A frase que fica:** uma `citacao` em tela cheia (fundo branco, serifa itálica) na frase de
   maior peso, por 3 a 4 s. Uma só.

## Como editar

- **Legenda `podcast`** (padrão): 2 linhas, até 3 palavras cada, caixa alta. A linha com a
  palavra-chave sai 1,5x maior e dourada; a outra, branca e menor. Dê `destaques` em 8 a 14
  palavras de peso (verbos e substantivos fortes), não em artigo.
  - `{ "palavra": "…", "cor": "vermelho" }` em 1 palavra do vídeo, a de maior choque.
  - Variante `baixa`: pedaços de 1 a 2 palavras em caixa baixa, pra clipe mais íntimo.
- **Manchete:** `"O MANYCHAT QUE | *NÃO CUSTA NADA*"`. Até 4 palavras por linha.
- **Tarja:** `nome` e `cargo` curto ("Criador de sistemas com IA").
- **Sem cards.** Se ele citar um dado, no máximo uma `palavra` em tela cheia com o número.
- **Câmera:** automática, lenta. Pode pôr `"empurrar": true` no trecho da frase mais forte.
- **Emendas:** secas.
- **Sons:** nenhum. O estilo desliga os automáticos; não escreva `sons`.

## Exemplo de plano

```json
{
  "legenda": { "destaques": ["R$1.200", "ManyChat", "gratuito", "comentários", "simples", "nada"] },
  "cenas": [
    { "de": 0, "ate": 5.5, "tipo": "manchete", "texto": "O MANYCHAT QUE | *NÃO CUSTA NADA*" },
    { "de": 6.3, "ate": 10.5, "tipo": "tarja", "cargo": "Criador de sistemas com IA" },
    { "de": 18.9, "ate": 22.7, "tipo": "citacao", "texto": "É só seguir o que eu estou fazendo.", "autor": "Nome do criador" }
  ]
}
```

## Nunca

- Música, whoosh, ding, pop.
- Emoji, sticker, legenda colorida demais (só branco, dourado e 1 vermelho).
- Contorno preto na legenda (é sombra macia).
- Card de lista, gráfico, tela dividida.

## Identidade visual

### Style Prompt
Clipe de podcast baixo-chave: imagem escurecida nas bordas e um degradê preto subindo do rodapé.
Legenda centralizada em sans pesada caixa alta, branca com sombra macia, em duas linhas de tamanhos
diferentes, a maior em dourado. No começo, uma caixa branca de cantos bem arredondados com duas
linhas pretas pesadas e a frase-chave em vermelho. Nome de quem fala em caixa alta dourada pequena
com letras espaçadas e a descrição branca embaixo. Uma citação em tela branca com serifa itálica.

### Colors
- `#FFFFFF` legenda e caixa do gancho
- `#F6C046` dourado (linha forte, nome)
- `#E90003` vermelho (frase-chave do gancho, 1 palavra)
- `#000000` degradê de baixo e texto do gancho

### Typography
- `Inter` 900: legenda (62 px; linha forte 1,5x), gancho (60 px)
- `Inter` 800 com `letter-spacing: 0.06em`: nome
- `Editorial` itálica (Playfair): citação

### What NOT to Do
- Cor viva, neon, degradê colorido
- Animação com mola ou zoom rápido
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use.
