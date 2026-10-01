# Estilo desta edição: Perspectiva 3D

Três truques de profundidade num vídeo só: **a imagem que entra no quadro exato** (uma régua de
quadros com a agulha parando na hora certa), **o criador saindo da moldura** (a cabeça passa por
cima da borda da janela enquanto o card explica) e **o vídeo desmontado em camadas** que giram no
espaço (fundo, texto, apresentador, ícones, moldura). É o estilo pra impressionar e pra explicar
"como isso é feito".
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 6 s):** `material` na faixa de cima com `titulo`, `"regua": true` e `chip`. A
   imagem espera lavada e ganha cor no instante da palavra (dê `i`).
2. **Explicação (5 a 6 s):** `fluxo` na faixa de cima com `"saltar": true`. Título com `olho`
   ("MOLDURA") e a última palavra em lilás.
3. **Inversão (4 s):** outro `fluxo` com `"faixa": "baixo"` e `"saltar": true`: ele sobe, o card
   desce.
4. **Clímax (6 a 8 s):** `profundidade` com a `palavra` de duas linhas.

Depois, o `cta` se couber.

## Como editar

- **Legenda:** `destaque`. Na `profundidade` ela some (a palavra gigante é a mensagem).
- **`saltar`:** só funciona bem com ele parado, de frente e com a cabeça inteira no quadro. Meça
  o rosto com cuidado; a janela é reposicionada pra cabeça passar da borda.
- **`material` com régua:** escolha a imagem que prova o que ele diz e o `i` da palavra em que ela
  tem que "bater".
- **`profundidade`:** `palavra` de 1 a 2 linhas em caixa alta; `camadas` com 5 nomes curtos;
  `icones` com 3 ícones.
- **Título dos cards:** caixa normal, alinhado à esquerda, com brilho: `"Abre espaço para *explicar*"`.
- **Câmera:** sem `angulos`.
- **Emendas:** secas.
- **Sons:** `ding` curto quando a régua para, `click` nos nós do fluxo, `whoosh` na profundidade.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 6.2, "tipo": "material", "material": "m1", "titulo": "o print no momento *certo*", "regua": true, "chip": "NO FRAME EXATO", "i": 12 },
    { "de": 6.3, "ate": 11.5, "tipo": "fluxo", "saltar": true, "olho": "MOLDURA", "titulo": "Abre espaço para *explicar*", "nos": [{ "nome": "Você pede", "sub": "um comando claro", "icone": "message-square-more", "i": 19 }, { "nome": "A IA monta", "sub": "moldura e cards", "icone": "layers", "i": 24 }, { "nome": "Você revisa", "sub": "e aprova", "icone": "circle-check", "i": 28 }] },
    { "de": 11.6, "ate": 15.5, "tipo": "fluxo", "faixa": "baixo", "saltar": true, "olho": "MOLDURA", "titulo": "Em cima ou *embaixo*", "nos": [{ "nome": "Cria o app", "icone": "app-window", "i": 42 }, { "nome": "Conecta", "icone": "link", "i": 50 }] },
    { "de": 15.6, "ate": 22.7, "tipo": "profundidade", "palavra": "PROFUNDIDADE | 3D" }
  ]
}
```

## Nunca

- `saltar` em trecho em que ele se mexe muito ou sai do quadro.
- Mais de uma `profundidade` por vídeo.
- Título em caixa alta nos cards (aqui é caixa normal).

## Identidade visual

### Style Prompt
Palco violeta escuro com brilho. Em cima, uma imagem numa moldura de borda lilás luminosa e,
embaixo dela, uma linha de régua com uma agulha de quatro pontas e um chip. O criador numa janela
de cantos arredondados com cantoneiras, e a cabeça dele ultrapassando a borda de cima. Cards de
fluxo com três ícones em quadrados violeta ligados por setas. No clímax, o vídeo se abre em
placas paralelas de borda fina, inclinadas no espaço, cada uma com uma etiqueta pequena; a palavra
gigante fica numa placa atrás do criador; no rodapé, uma linha em mono ("5 CAMADAS · PROFUNDIDADE REAL").

### Colors
- `#0b0716` fundo, `#191030` painel
- `#c4a6fa` moldura, última palavra do título e etiquetas
- `#9153f8` ícones e brilho, `#f2eafc` texto

### Typography
- `Jakarta` 800 em caixa normal: título dos cards (60 px, à esquerda)
- `Archivo` larga 900: palavra da profundidade
- `Jakarta` 800 com `letter-spacing: 0.26em`: olho do card

### What NOT to Do
- Nada de título centralizado nos cards
- Nada de imagem sem moldura
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo transparente, moldura com `border: 2px solid rgba(196,166,250,.6)` e
`box-shadow: 0 0 50px rgba(145,83,248,.45)`, título em `"Jakarta"` 800 caixa normal.
