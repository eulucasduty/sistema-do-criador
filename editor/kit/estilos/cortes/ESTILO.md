# Estilo desta edição: Corte de podcast

O formato dos canais de cortes: **manchete numa caixa branca arredondada em cima**, **o vídeo num
clipe no meio** e, atrás de tudo, **o próprio vídeo desfocado** enchendo a tela. A legenda é
**amarela com contorno preto grosso**, dentro do clipe. É o jeito mais reconhecível de dizer "isso
é um corte de conversa".
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

A tela é fixa do começo ao fim: manchete em cima (`plano.manchete`), clipe no meio, legenda dentro
dele. Sem cards. No máximo um `carimbo` na frase mais forte.

## Como editar

- **Manchete:** conta o que acontece no corte, em terceira pessoa, com gancho:
  `"ELE CRIOU UM MANYCHAT | *SEM PAGAR NADA*"`. Duas linhas de até 4 palavras, caixa alta; a parte
  marcada sai vermelha.
- **Legenda `amarela`** (padrão): frase normal, até 4 palavras, amarela com contorno preto. Quem
  fala é sempre amarelo. Sem destaque palavra a palavra.
  - Variante `caps` (`"legenda": { "estilo": "caps" }`): caixa alta condensada, maior.
- **Câmera:** parada. Sem `angulos`.
- **Emendas:** secas.
- **Sons:** quase nada (`pop` baixo no carimbo).

## Exemplo de plano

```json
{
  "manchete": "ELE CRIOU UM MANYCHAT | *SEM PAGAR NADA*",
  "cenas": []
}
```

## Nunca

- Card, lista, gráfico, cabeçalho, tela dividida.
- Legenda branca fina ou sem contorno.
- Manchete em primeira pessoa ou sem gancho.

## Identidade visual

### Style Prompt
Fundo: o próprio vídeo ampliado e bem desfocado, escurecido. Em cima, uma caixa branca de cantos
arredondados com duas linhas pretas pesadas em caixa alta e um trecho em vermelho. No meio, o
vídeo num retângulo de largura total. Dentro dele, embaixo, a legenda em sans redonda pesada,
amarela, com contorno preto grosso e uma sombrinha dura.

### Colors
- `#FFFFFF` caixa da manchete, `#0b0b0b` texto dela, `#e5332e` trecho marcado
- `#F7D70A` legenda, contorno `#000000` de 9 px

### Typography
- `Inter` 900: manchete (62 px, caixa alta)
- `Poppins` 800: legenda (62 px)
- variante: `Bebas Neue` (92 px)

### What NOT to Do
- Fundo liso (preto ou cor): o fundo é o vídeo desfocado
- Mais de duas linhas de manchete
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use.
