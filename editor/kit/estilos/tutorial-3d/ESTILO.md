# Estilo desta edição: Tutorial em 3D

Tutorial em **tela cheia, sem o rosto na maior parte do tempo**: um céu violeta com estrelas e um
chão de grade, e no centro **uma janela de aplicativo em 3D** que recebe o comando, marca a lista
de tarefas e mostra o resultado **dentro de um celular**. Cada parte tem um passo numerado no alto
("01 EM PORTUGUÊS"). É o estilo pra "você pede, a IA faz, olha o resultado".
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

Três passos, um atrás do outro, cobrindo o vídeo quase todo:

1. **Passo 01 (você pede):** `janela-ia` com o `prompt` sendo digitado e as palavras-chave
   realçadas (`realces`). Embaixo, a tira de cortes do vídeo (`"tira": "cortes"`).
2. **Passo 02 (a IA trabalha):** outra `janela-ia`, com `"digitado": true` (o comando já escrito),
   os `itens` marcando um a um (dê `i`) e a barra de `progresso`. Tira `"montada"`.
3. **Passo 03 (o resultado):** `celular` sem imagem: o vídeo do criador aparece dentro do
   aparelho, com etiquetas apontando o que foi feito (`itens` com `lado` e `y`).

Cada passo dura de 5 a 9 s. O título de cada um tem duas linhas, a segunda em lilás, terminando
com ponto: `"Você pede | a edição."`.

## Como editar

- **Legenda:** `frase` (caixa escura, duas linhas), que aparece no celular e nos trechos de rosto.
  Nas cenas `janela-ia` ela some sozinha.
- **Texto do prompt:** uma frase de verdade, como ele pediria, de 6 a 12 palavras. `realces` em 2
  ou 3 palavras. `anexo` com o nome de um arquivo que faça sentido (`take-01.mp4`, `print.png`).
- **Itens da lista:** 3, cada um de 2 a 3 palavras, no particípio ("Pausas cortadas").
- **Etiquetas do celular:** até 3, curtas, com ícone (`sparkles`, `captions`, `badge-check`).
- **Câmera:** nada de `angulos`.
- **Emendas:** secas. Entre os passos, o próprio componente faz a passagem.
- **Sons:** `teclado` enquanto digita, `click` no enviar, `pop` em cada item, `ding` no fim.

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 6.2, "tipo": "janela-ia", "numero": "01", "rotulo": "EM PORTUGUÊS", "titulo": "Você pede | o sistema.", "janela": "Claude", "prompt": "Cria um ManyChat gratuito dentro do meu Instagram", "realces": ["manychat", "gratuito", "instagram"], "anexo": "print-do-painel.png", "tira": "cortes" },
    { "de": 6.3, "ate": 15.5, "tipo": "janela-ia", "numero": "02", "rotulo": "A IA TRABALHA", "titulo": "A IA monta | pra você.", "prompt": "Cria um ManyChat gratuito dentro do meu Instagram", "realces": ["manychat", "gratuito", "instagram"], "digitado": true, "itens": [{ "texto": "Responde os comentários", "i": 21 }, { "texto": "Chama na DM", "i": 24 }, { "texto": "Conversa com quem comenta", "i": 28 }], "progresso": "Publicando o sistema…", "tira": "montada" },
    { "de": 15.6, "ate": 22.7, "tipo": "celular", "numero": "03", "rotulo": "O RESULTADO", "titulo": "Pronto pra | usar.", "itens": [{ "texto": "Resposta automática", "lado": "esquerda", "y": 0.1 }, { "texto": "Sem pagar nada", "lado": "direita", "y": 0.86, "icone": "badge-check" }] }
  ]
}
```

## Nunca

- Mais de 3 passos, ou passo sem número.
- Prompt inventado que ele não diria; item de lista que o sistema não faz.
- Card de faixa (tela dividida) ou cabeçalho solto: o passo já tem o seu.

## Identidade visual

### Style Prompt
Espaço violeta escuro com estrelinhas e um chão de grade em perspectiva sumindo no horizonte. No
alto, o número do passo num selo lilás, um rótulo em caixa alta e um título em letra larga e
redonda de duas linhas. No centro, uma janela de aplicativo de vidro, inclinada em 3D, com os três
pontinhos de janela, o nome do app, um campo com o comando sendo digitado (palavras-chave com
fundo lilás), um chip de anexo e o botão redondo de enviar. Depois a lista com bolinhas de check
violeta e uma barra de progresso. Embaixo, uma tira de miniaturas do vídeo com a onda de áudio.
No último passo, um celular com o vídeo dentro e pílulas violeta apontando os detalhes.

### Colors
- `#0a0616` fundo com estrelas brancas e grade `rgba(167,139,250,.4)`
- vidro `rgba(24,14,48,.88)`, borda `rgba(196,166,250,.42)`
- `#9153f8` botões e checks, `#c4a6fa` segunda linha do título e realces
- `#f2eafc` texto

### Typography
- `Unbounded` 800: título do passo
- `Jakarta` 500 com `letter-spacing: 0.14em`: rótulo do passo
- `Jakarta` 500/800: texto da janela e da lista

### What NOT to Do
- Nada de janela chapada de frente: ela é sempre inclinada, com profundidade
- Nada de interface inventada de produto real: a janela é genérica ("Editor IA", "Claude")
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `var(--void)` com a grade, painel `var(--vidro)` com borda `var(--vidro-borda)` e
`border-radius: 28px`, título em `"Unbounded"` 800, destaque `var(--acento2)`.
