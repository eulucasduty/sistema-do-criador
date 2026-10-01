# Estilo desta edição: Texto atrás de você (inspirado em Daniel Dalen)

**Micro-montagem.** O vídeo fica num **quadro arredondado sobre preto** e a frase-chave vira
**letras enormes atrás da cabeça**, da largura do quadro, amarelas. A legenda é **minúscula, vai
somando palavra por palavra numa linha de borda esquerda fixa**, na altura do rosto, e a
palavra-chave cai pra uma segunda linha, maior e amarela. Cortes de enquadramento a cada um ou
dois segundos, no ritmo.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **Gancho (0 a 3 s):** legenda acumulando, enquadramento trocando rápido.
2. **A cada 8 a 12 s, um título atrás:** `palavra` com `"atras": true`, 1 palavra (ou 2 linhas
   curtas), por 2,5 a 4 s, num trecho em que ele esteja parado e de frente.
3. **Corpo:** só a fala, a legenda e a troca de plano. Sem cards.
4. **Fim:** último título atrás com a palavra de ação, ou o `cta`.

## Como editar

- **Legenda `acumula`** (padrão): tudo minúsculo, até 3 palavras por linha; as palavras vão
  aparecendo e ficando. Dê `destaques` em 6 a 10 palavras: cada uma cai sozinha pra linha de
  baixo, 1,6x maior e amarela.
- **Título atrás:** caixa alta condensada. Uma palavra de 5 a 9 letras enche o quadro; com duas
  linhas, use `"ouro": [1]` pra segunda ficar branca. Com `atras`, a legenda sai sozinha.
- **Recorte:** o título precisa da pessoa recortada. Escolha trecho com ele parado, de frente,
  sem a mão na frente do rosto.
- **Câmera:** automática e rápida (`aberto`, `medio`, `fechado`, `medio` a cada 1 a 2,2 s). Só
  escreva `angulos` pra segurar o plano durante um título atrás.
- **Emendas:** secas.
- **Sons:** só `obturador` nos títulos.

## Exemplo de plano

```json
{
  "legenda": { "destaques": ["R$1.200", "gratuito", "comentários", "simples", "nada", "ManyChat"] },
  "angulos": [{ "de": 3.3, "ate": 6.25, "plano": "aberto" }, { "de": 18.9, "ate": 22.7, "plano": "aberto" }],
  "cenas": [
    { "de": 3.3, "ate": 6.25, "tipo": "palavra", "atras": true, "texto": "MANYCHAT", "ouro": [] },
    { "de": 18.9, "ate": 22.7, "tipo": "palavra", "atras": true, "texto": "DE | GRAÇA", "ouro": [1] }
  ]
}
```

## Nunca

- Legenda no terço de baixo, com caixa ou contorno.
- Emoji, card, lista.
- Take parado por mais de 3 s (fora dos títulos atrás).
- Título atrás com frase longa.

## Identidade visual

### Style Prompt
Fundo preto. O vídeo dentro de um quadro de cantos bem arredondados, quase quadrado, com cor
quente, contrastada e um grão sutil. Atrás da cabeça do criador, letras condensadas pesadas em
caixa alta, amarelas, da largura do quadro, levemente desfocadas, com o cabelo passando na frente.
Legenda em neo-grotesca pesada minúscula de letras juntas, branca, alinhada à esquerda numa
margem fixa, na altura do rosto; a palavra-chave embaixo, maior e amarela.

### Colors
- `#000000` fundo
- `#F6CB0A` amarelo (título atrás, palavra-chave)
- `#FFFFFF` legenda

### Typography
- `Anton`: título atrás (até 440 px)
- `InterTight` 800, `letter-spacing: -0.03em`: legenda (62 px; destaque 1,6x)

### What NOT to Do
- Quadro de canto reto ou vídeo em tela cheia
- Título atrás colorido de outra cor
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use.
