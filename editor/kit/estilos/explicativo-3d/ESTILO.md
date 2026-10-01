# Estilo desta edição: Explicativo 3D

Uma ideia **desmontada em andares, como uma maquete vista de cima em ângulo**: cada camada é uma
placa que cai no lugar, ganha uma etiqueta com uma linha apontando e um desenho simples em cima
(um caminho, uma luz, blocos). O criador explica de uma **janelinha de cantos chanfrados** embaixo
à esquerda, com o texto do andar da vez ao lado. Fundo verde-petróleo escuro, creme e laranja,
letra condensada técnica. É o estilo pra "isso tem três partes" e pra explicar como um sistema
funciona por dentro.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (3 a 6 s):** rosto em tela cheia + `cabecalho` (rótulo laranja pequeno + título
   condensado creme terminando com ponto: `"TRÊS CAMADAS."`).
2. **Maquete (10 a 14 s):** `isometrico` com o mesmo `rotulo` e `titulo`, de 2 a 4 `camadas`, de
   baixo pra cima. Cada camada entra quando ele fala dela (dê `t` ou `i`); a etiqueta das de
   baixo fica apagada e o bloco de texto ao lado da janelinha troca (`sub`).
3. **Volta (3 a 4 s):** rosto em tela cheia + `cabecalho` com a conclusão.

## Como editar

- **Camadas:** `nome` em 1 palavra (caixa alta), `sub` em 2 a 4 palavras (caixa alta), `icone` de
  traço e `desenho`: `caminho` (percurso), `luz` (feixe), `blocos` (volumes), `grade`.
- **Legenda:** `caixa` (padrão): letra fina branca numa caixinha preta, colada na base da
  janelinha. Sem destaque.
- **Câmera:** sem `angulos`.
- **Emendas:** secas.
- **Sons:** `pop` quando cada andar cai, `click` na etiqueta.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 6.2, "tipo": "cabecalho", "rotulo": "PENSE O SISTEMA", "linhas": ["TRÊS CAMADAS."] },
    { "de": 6.3, "ate": 18.8, "tipo": "isometrico", "rotulo": "PENSE O SISTEMA", "titulo": "TRÊS CAMADAS.",
      "camadas": [
        { "nome": "COMENTÁRIO", "sub": "ALGUÉM COMENTA", "icone": "message-circle", "desenho": "caminho", "t": 6.6 },
        { "nome": "SISTEMA", "sub": "O WEBHOOK RECEBE", "icone": "webhook", "desenho": "luz", "t": 11.6 },
        { "nome": "RESPOSTA", "sub": "A DM SAI SOZINHA", "icone": "send", "desenho": "blocos", "t": 15.6 }
      ] },
    { "de": 18.9, "ate": 22.7, "tipo": "cabecalho", "rotulo": "SEM GASTAR", "linhas": ["É SÓ SEGUIR."] }
  ]
}
```

## Nunca

- Mais de 4 andares, ou andar com frase longa.
- Violeta, neon ou brilho: este estilo é fosco.
- Cards de vidro e cantos arredondados.

## Identidade visual

### Style Prompt
Fundo verde-petróleo bem escuro, chapado. Placas quadradas vistas em ângulo isométrico, cor de
areia com a lateral mais escura, empilhadas com espaço entre elas. Em cima de cada placa, um
desenho simples: um traço laranja fazendo um percurso, um feixe de luz, volumes creme. À direita
de cada placa, uma linha fina e uma etiqueta escura com o nome em letra condensada. No alto, um
olho laranja pequeno com letras espaçadas e um título creme condensado em caixa alta. Embaixo à
esquerda, o criador numa janela retangular de cantos chanfrados com um fio creme; ao lado, três
ícones de traço e uma frase condensada. Legenda fina numa caixinha preta.

### Colors
- `#202727` fundo, `#161b1b` etiquetas
- `#e9d9b4`, `#dccaa2`, `#f3ead2` placas
- `#c27344` laranja queimado (traços), `#e58a55` laranja claro (olho)
- `#efe6d2` texto, `#d2b98e` fios e ícones

### Typography
- `DinCondensada` (Barlow Condensed 700): títulos, etiquetas, texto do andar (caixa alta)
- `Jakarta` 500 com `letter-spacing: 0.26em`: olho
- `Inter` 500: legenda

### What NOT to Do
- Nada de degradê, brilho ou sombra projetada
- Nada de canto arredondado: tudo é reto ou chanfrado
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `var(--void)`, traços `var(--acento)` de 4 px, texto `var(--texto)` em `"DinCondensada"` 700
caixa alta, etiquetas com fundo `#161b1b`.
