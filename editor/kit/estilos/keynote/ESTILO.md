# Estilo desta edição: Keynote (inspirado em Apple)

**Preto, uma frase por vez.** Letra limpa de peso médio, frase normal, letras juntas, que aparece
**palavra por palavra em fade**. Cartões cinza-escuros de cantos bem arredondados numa grade
("bento"), cada um com um ícone ou imagem e duas a quatro palavras. A linha de destaque ganha um
**degradê furta-cor**. Uma barrinha branca fina de progresso no rodapé. Movimento rápido e macio,
corte seco, nenhum contorno, nenhuma sombra dura.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Abertura (2 a 3 s):** ele falando, legenda revelando.
2. **Título de capítulo (2,5 a 3,5 s):** `palavra` em tela preta, duas frases curtas com ponto:
   `"ManyChat. | De graça."`, a segunda em furta-cor (`"ouro": [1]`).
3. **Recursos (5 a 6 s):** `grade` em tela cheia com 4 cartões.
4. **Fala** com `cabecalho` centralizado numa frase de impacto e a `tarja` discreta.
5. **Fim:** outra `palavra` ou o `cta`.

## Como editar

- **Legenda `titulo`** (padrão): frase normal, 2 linhas, até 4 palavras por linha; as palavras
  aparecem uma a uma conforme são ditas. Sem `destaques`.
- **`palavra`:** frases de 1 a 3 palavras, com ponto final, primeira letra maiúscula. Nunca caixa
  alta.
- **`grade`:** `titulo` de até 4 palavras com ponto ("Tudo no automático."), itens com `icone` ou
  `material` e `texto` de 1 a 3 palavras.
- **`cabecalho`:** duas linhas centralizadas, a segunda em furta-cor. Sem rótulo.
- **`tarja`:** duas linhas pequenas brancas, sem caixa.
- **Câmera:** `aberto` com aproximação lenta (automática). Sem inclinar.
- **Emendas:** secas.
- **Sons:** só um `whoosh` baixo na entrada das telas pretas.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 3.3, "ate": 6.25, "tipo": "palavra", "texto": "ManyChat. | De graça.", "ouro": [1] },
    { "de": 6.3, "ate": 11.5, "tipo": "grade", "area": "tela-cheia", "titulo": "Tudo no automático.", "itens": [{ "icone": "message-circle", "texto": "Responde" }, { "icone": "send", "texto": "Chama na DM" }, { "icone": "messages-square", "texto": "Conversa" }, { "material": "m1", "texto": "Painel" }] },
    { "de": 12.2, "ate": 15.4, "tipo": "tarja", "cargo": "Criador" },
    { "de": 18.9, "ate": 22.7, "tipo": "cabecalho", "linhas": ["Sem gastar", "absolutamente nada."] }
  ]
}
```

## Nunca

- Título em CAIXA ALTA, contorno, sombra dura, caixa atrás do texto.
- Emoji, letra à mão, grão, tremor.
- Mais de 2 linhas de título. Mais de uma ideia por tela.
- Som de pop, ding ou impacto.

## Identidade visual

### Style Prompt
Vazio preto. Uma frase em sans neo-grotesca semibold, frase normal, centralizada, de entrelinha
justa; a linha de destaque com um degradê iridescente (do rosado ao dourado, ao verde e ao azul).
Grade de cartões cinza-escuros de raio 28 px, cada um com um ícone de traço branco ou uma imagem e
um rótulo pequeno embaixo. Sobre o vídeo, a legenda é a mesma letra, branca, revelando palavra por
palavra. Uma barra branca finíssima de progresso no rodapé.

### Colors
- `#000000` fundo, `#1d1d1f` cartões
- `#f5f5f7` texto, `#86868b` texto de apoio
- `#2997ff` azul (links, raro)
- furta-cor: `rgb(203,156,145)` → `rgb(194,141,109)` → `rgb(182,151,90)` → `rgb(138,161,105)` → `rgb(111,160,197)` → `rgb(148,158,195)`

### Typography
- `Inter` 600, `letter-spacing: -0.015em`, entrelinha 1.05 a 1.08: tudo
- tamanhos: título de capítulo até 150 px; cabeçalho 80 px; legenda 62 px

### What NOT to Do
- Qualquer coisa ruidosa: textura, grão, brilho neon
- Cor viva chapada
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `#000`, cartão `#1d1d1f` com `border-radius: 28px`, texto `#f5f5f7` em `"Inter"` 600,
entradas em `opacity` + `y: 20` com `ease: "power2.out"`.
