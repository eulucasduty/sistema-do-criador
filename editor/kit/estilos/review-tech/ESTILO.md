# Estilo desta edição: Review tech (inspirado em MKBHD)

**Limpo, de canto reto, vermelho sobre grafite.** Quase sem texto na tela: **uma ficha branca de
especificações** que aparece uma vez, um **placar de certo e errado** na hora do "mas tem um
porém", um **gráfico de barras em tela cheia** quando compara número, e o nome com uma barra
vermelha. A câmera faz uma **aproximação lenta e contínua**. **Sem legenda, sem som de efeito.**
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **0 a 6 s:** ele falando, com a `tarja` (nome em caixa alta itálica, barra vermelha).
2. **Uma vez, cedo:** a `ficha` com até 4 linhas ("O QUE ELE FAZ"), na faixa de cima, por 5 a 6 s.
   Ela não volta.
3. **O porém:** `lista` em tela cheia com `ok: true/false` em cada item ("VALE A PENA?").
4. **O número:** `grafico` em tela cheia, com a barra de destaque em vermelho e a `fonte` do dado.
5. **Fim:** ele falando. `cta` se pedir.

Motion em **35 a 50%**. Entre um gráfico e outro, deixe ele falando 4 a 8 s.

## Como editar

- **Sem legenda** (padrão `nenhuma`). Se o pedido quiser, `"legenda": { "estilo": "tecnica" }`.
- **`ficha`:** `titulo` em caixa alta, `itens` com `rotulo` e `valor` curtos. Dado real.
- **`lista` com placar:** 3 a 4 itens, frases curtas, pelo menos um `"ok": false` (é o que dá
  credibilidade).
- **`grafico`:** 2 a 4 barras, `rotulo` em cima em caixa alta ("CUSTO POR ANO"), `destaque: true`
  na dele, `fonte` sempre. Número que ele falou ou que está no material; se for exemplo, a fonte
  diz "valores de exemplo".
- **`comparacao`** pra antes e depois de um valor só.
- **Imagem emprestada** (print de outro lugar): `material`/`print` com `rotulo` dizendo de onde é.
- **Câmera:** automática: `aberto` empurrando devagar. Sem punch-in, sem inclinar.
- **Emendas:** secas.
- **Sons:** nenhum.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0.6, "ate": 5.8, "tipo": "tarja", "cargo": "ManyChat feito em casa" },
    { "de": 6.3, "ate": 11.5, "tipo": "ficha", "titulo": "O QUE ELE FAZ", "itens": [{ "rotulo": "Comentários", "valor": "responde" }, { "rotulo": "Direct", "valor": "chama na hora" }, { "rotulo": "Conversa", "valor": "com todo mundo" }, { "rotulo": "Preço", "valor": "R$ 0" }] },
    { "de": 11.6, "ate": 15.5, "tipo": "lista", "area": "tela-cheia", "titulo": "VALE A PENA?", "itens": [{ "texto": "Não paga mensalidade", "ok": true }, { "texto": "API oficial da Meta", "ok": true }, { "texto": "Precisa de 40 minutos", "ok": false }] },
    { "de": 15.6, "ate": 22.7, "tipo": "grafico", "area": "tela-cheia", "rotulo": "CUSTO POR ANO", "titulo": "QUANTO SAI", "prefixo": "R$ ", "barras": [{ "rotulo": "ManyChat Pro", "valor": 1200 }, { "rotulo": "Agência", "valor": 800 }, { "rotulo": "O teu sistema", "valor": 0, "destaque": true, "texto": "R$ 0" }], "fonte": "valores de exemplo" }
  ]
}
```

## Nunca

- Canto arredondado, degradê, sombra colorida.
- Ficha repetida. Tela dividida o tempo todo.
- Legenda queimada (no padrão). Emoji. Efeito sonoro.
- Dado sem fonte.

## Identidade visual

### Style Prompt
Review de tecnologia: imagem limpa, o criador de frente com aproximação lenta. Cartões brancos de
canto reto com título em sans técnica pesada, itálica, caixa alta, e linhas de dado separadas por
fio cinza. Placar com quadrados verdes de check e vermelhos de x. Gráfico de barras horizontais
grafite sobre trilho cinza-claro, com a barra de destaque em vermelho e os valores à direita.
Nome em caixa alta itálica branca com uma barra vermelha vertical à esquerda. Fundo das telas
cheias em preto fosco.

### Colors
- `#E5202B` vermelho (único acento), `#27292A` grafite
- `#FFFFFF` cartões, `#E9EAED` trilhos e fios, `#111111` fundo
- `#2bb673` verde do check

### Typography
- `Din` (Barlow) 900 itálica em caixa alta: títulos e nome
- `Din` 500 / 700: texto e valores
- `Mono`: rótulo e fonte do dado

### What NOT to Do
- Raio diferente de zero
- Segundo acento de cor
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `#111`, cartão `#fff` com `border-radius: 0`, título em `"Din"` 900 itálico caixa alta,
texto `#27292A`, acento `#E5202B`.
