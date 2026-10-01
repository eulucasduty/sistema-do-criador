# Estilo desta edição: Profissional

Vídeo **sóbrio, pra falar com empresa e com cliente**: proposta, caso de uso, depoimento,
apresentação de serviço. Passa confiança: informação clara, nada pulando na tela. Fundo grafite
azulado, cards retos de borda fina e **um azul só** como destaque.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Abertura:** ele falando, com a `tarja` (nome e o que faz) de 0,6 a 5,6 s.
2. **Corpo:** motions de dado e de prova, em trechos de 2,5 a 5 s (mais longos que o normal, pra
   dar tempo de ler): o problema, como resolve, o resultado.
3. **O número principal:** 1 ou 2 momentos em tela cheia (`comparacao` ou `contador`).
4. **Fim:** se ele não pedir comentário, feche com um `titulo` discreto ou com a logo. Sem `cta`
   de "comenta X" por conta própria.

Motion em **40 a 55%** do vídeo.

## Como editar

- **Legenda `padrao`:** caixa normal, com a caixinha azul acompanhando a palavra. `destaques` só
  em número e nome próprio.
- **Componentes:**
  - `comparacao` e `contador` pra resultado, prazo e economia;
  - `lista` pro passo a passo e pros entregáveis (frases curtas, sem gíria);
  - `fluxo` com as logos pra mostrar a integração;
  - `material` e `print` com `url`, focando o que ele cita;
  - `titulo` em caixa normal pra nomear a parte ("O problema", "Como resolvemos"), com
    `"som": "nenhum"`.
- **Texto dos cards:** frase completa e curta, com a primeira letra maiúscula, sem caixa alta e
  sem ponto de exclamação. Número sempre com a unidade ("R$ 3.000 por mês", "2 dias").
- **Palavra em tela cheia:** no máximo 1, e só se for a tese do vídeo.
- **Câmera:** `aberto` e `medio`. `fechado` só na frase mais importante. Sem `inclinar`;
  `empurrar` pode, bem de leve.
- **Emendas:** secas.
- **Sons:** discretos: `click` ou `pop` baixo na entrada de um card importante. O estilo já
  limita; na maioria das cenas ponha `"sons": false`.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0.6, "ate": 5.6, "tipo": "tarja", "cargo": "Sistemas com IA" },
    { "de": 6.3, "ate": 11.5, "tipo": "lista", "titulo": "O que o sistema faz", "itens": ["Responde os comentários", "Chama na DM", "Conversa com quem comenta"] },
    { "de": 11.6, "ate": 15.5, "tipo": "comparacao", "titulo": "Custo por ano", "antes": { "rotulo": "Plano pago", "valor": "R$ 1.200" }, "depois": { "rotulo": "Sistema próprio", "valor": "R$ 0" } }
  ]
}
```

## Nunca

- Meme, imitação de rede social (`comentarios`, `chat`), a não ser que o assunto seja atendimento.
- Caixa alta em frase inteira, ponto de exclamação, gíria, emoji.
- Efeito nas emendas, som em toda entrada de card.
- Dourado, sombra dura de tinta, fonte de gibi.

## Identidade visual

### Style Prompt
Vídeo vertical institucional de empresa de tecnologia. Fundo grafite azulado com uma luz fria
vindo do canto. Cards retos, de canto pouco arredondado e borda fina, sem sombra dura. Um azul
claro só como destaque. Tipografia sans pesada e apertada nos títulos, texto leve, rótulos em
mono. Movimento curto e preciso, sem mola exagerada. Tudo alinhado, com respiro.

### Colors
- `#0d1117` fundo, com luz radial `#6cb0ff` bem fraca
- `#161b22` card, borda `#2b3440`
- `#e9eef5` texto, `#9aa7b6` rótulos
- `#6cb0ff` azul (único destaque)
- `#56d39b` verde (resultado), `#ff7a7a` vermelho (antes, problema)

### Typography
- `Jakarta` (Plus Jakarta Sans 800): títulos e números
- `Jakarta` 500: texto
- `Mono` (JetBrains Mono 500): rótulos

### What NOT to Do
- Nada de dourado, de sombra dura de tinta ou de fonte de gibi
- Nada de caixa alta em frase inteira nem de ponto de exclamação
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo transparente, texto `#e9eef5`, título em `"Jakarta"` 800 com `letter-spacing: -0.02em`,
destaque `#6cb0ff`, card `#161b22` com `border: 1px solid #2b3440` e `border-radius: 18px`.
