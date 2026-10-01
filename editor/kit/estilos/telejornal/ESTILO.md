# Estilo desta edição: Telejornal (plantão)

**Cara de plantão de TV.** O vídeo fica num quadro em cima e, embaixo, a **tarja de notícia**: a
bandeira vermelha de **URGENTE**, a **manchete numa faixa branca** em letra preta pesada com a
frase-chave em vermelho, a **linha de apoio numa faixa preta** e o **letreiro correndo** em faixa
vermelha. No canto de cima, o selo **AO VIVO** com a hora. O nome do entrevistado entra numa
tarja branca. Nada pula: tudo desliza.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

A tela é a mesma do começo ao fim:

- **manchete** (`plano.manchete`, como objeto com `selo`, `texto` e `sub`): fica o vídeo todo;
- **letreiro** (`faixa-noticias` de 0 até o fim), com 2 ou 3 notícias curtas;
- **selo AO VIVO**: o estilo põe sozinho. Pra pôr hora e nome do "canal", escreva a cena `bug`;
- **tarja** com o nome dele por 4 a 5 s, a partir de ~6 s;
- **legenda** pequena dentro do quadro do vídeo.

Opcional: abrir com uma `palavra` de 1,2 s ("PLANTÃO") com `impacto`.

## Como editar

- **Manchete:** `texto` em duas linhas de até 4 palavras, caixa alta, a segunda marcada:
  `"MANYCHAT DE GRAÇA | *CRIADO COM IA*"`. `sub`: uma frase de até 9 palavras em frase normal.
  `selo`: "URGENTE", "AGORA", "EXCLUSIVO".
- **Letreiro:** `selo` "AGORA" e `itens` com 2 ou 3 frases de até 60 letras, no tom de notícia.
  Só fatos do próprio vídeo.
- **Legenda `simples`** (padrão): branca, até 4 palavras, sem destaque.
- **Tom:** terceira pessoa, jornalístico ("Criador monta…"). Nada de promessa exagerada.
- **Câmera:** parada.
- **Emendas:** secas.
- **Sons:** só `impacto` na abertura.

## Exemplo de plano

```json
{
  "manchete": { "selo": "URGENTE", "texto": "MANYCHAT DE GRAÇA | *CRIADO COM IA*", "sub": "Sistema responde comentários e chama na DM sozinho" },
  "cenas": [
    { "de": 0, "ate": 28.2, "tipo": "faixa-noticias", "selo": "AGORA", "itens": ["Criador monta o próprio ManyChat sem pagar mensalidade", "Passo a passo sai pra quem comentar a palavra"] },
    { "de": 0, "ate": 28.2, "tipo": "bug", "texto": "AO VIVO", "hora": "09:42", "canal": "NOME NEWS" },
    { "de": 6.4, "ate": 11.4, "tipo": "tarja", "cargo": "Criador do sistema" }
  ]
}
```

## Nunca

- Mola, pulo, elástico. Emoji.
- Letra fina ou de baixo contraste.
- Marca ou logo de emissora de verdade. O nome do "canal" é inventado a partir do nome do criador.
- Notícia falsa sobre terceiros: a manchete é sobre o próprio vídeo.

## Identidade visual

### Style Prompt
Tela de telejornal em pé. Em cima, o vídeo num quadro de largura total com o selo vermelho
"AO VIVO" de ponto piscando, a hora numa caixinha branca e o nome do canal numa caixinha preta.
Embaixo: uma bandeira vermelha pequena ("URGENTE"), uma faixa branca com borda vermelha à
esquerda e manchete preta pesada em caixa alta com um trecho em vermelho, uma faixa preta com a
linha de apoio branca, e uma faixa vermelha com texto branco condensado correndo pra esquerda,
com um selo vermelho-escuro ("AGORA"). Fundo preto com um leve vermelho no alto.

### Colors
- `#CC0000` vermelho de plantão, `#7a0000` selo do letreiro
- `#FFFFFF` faixa da manchete, `#111111` texto e faixa de apoio
- `#0C0C0C` fundo

### Typography
- `Inter` 900 em caixa alta: manchete (62 px), selos, nome
- `Inter` 500: linha de apoio (32 px)
- `Archivo` condensada 700 em caixa alta: letreiro

### What NOT to Do
- Cantos arredondados, degradê colorido
- Animação com overshoot
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Não use.
