# Estilo desta edição: Documentário de autor (inspirado em Johnny Harris)

**O criador como repórter.** Abre com **lugar e data datilografados**, um **capítulo em serifa
fina**, e a prova entra como **foto presa na parede, que cai em foco com um estalo**. Papel creme,
etiquetas em letra de máquina, âmbar e vermelho, **grão em tudo** e uma **queima de filme entre os
cortes**. A câmera dá aproximações firmes. Primeiro a imagem forte, depois o contexto.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **0 a 3 s:** `local` com o lugar e a data/hora (duas linhas em caixa alta), sobre ele falando.
2. **3 a 6 s:** `cabecalho` de capítulo: `rotulo` "CAPÍTULO 01" e duas linhas em serifa, a segunda
   em âmbar.
3. **Provas:** `fotos` (modo `card`) com `rotulo` em cada uma ("PROVA Nº 1", "O CÓDIGO"), depois
   um `documento` com o trecho marcado em âmbar.
4. **Respiro e virada:** ele falando, com punch-in; uma `palavra` curta em serifa ("Sem gastar |
   nada.") na frase de peso.
5. **Fim:** `cta` ou um último `cabecalho`.

Motion em **50 a 70%**.

## Como editar

- **Legenda `editorial`** (padrão): frase normal, clara, até 4 palavras. A palavra de `destaques`
  vira serifa itálica âmbar, um pouco maior. Dê 5 a 8.
- **`local`:** caixa alta, estilo máquina: `["SÃO PAULO, BRASIL", "1 DE OUTUBRO · 09:42"]`. Só use
  lugar e data que ele disse ou que estão no pedido; sem isso, pule.
- **`cabecalho`:** capítulos numerados ("CAPÍTULO 01", "02"). Frase normal em serifa.
- **`fotos`:** 1 a 3 por vez, com `rotulo` curto. Elas entram desfocadas e assentam.
- **`documento`:** igual ao do documentário explicativo, com marca em âmbar.
- **`anotacao`:** seta e círculo âmbar, grossos, à mão.
- **Câmera:** automática (`aberto`, `medio`, `aberto`, `fechado` a cada 2,5 a 5 s). Punch-in
  seco, sem deslizar.
- **Emendas:** `queima` com `obturador` (padrão do estilo). Em até 1 de cada 4, troque por `seco`.
- **Sons:** `obturador` em foto e corte, `tecla` no `local`, `click` nas etiquetas, `whoosh` leve.

## Exemplo de plano

```json
{
  "legenda": { "destaques": ["R$1.200", "gratuito", "comentários", "simples", "nada", "ManyChat"] },
  "cenas": [
    { "de": 0.2, "ate": 3.2, "tipo": "local", "linhas": ["SÃO PAULO, BRASIL", "1 DE OUTUBRO · 09:42"] },
    { "de": 3.3, "ate": 6.2, "tipo": "cabecalho", "rotulo": "CAPÍTULO 01", "linhas": ["O ManyChat", "que não custa nada"] },
    { "de": 6.3, "ate": 11.5, "tipo": "fotos", "modo": "card", "itens": [{ "material": "m1", "rotulo": "prova nº 1" }, { "material": "m2", "rotulo": "o código" }] },
    { "de": 11.6, "ate": 15.5, "tipo": "documento", "cabecalho": "Meta for Developers", "data": "docs", "titulo": "Webhooks do Instagram", "texto": "Quando alguém comenta, a plataforma avisa o seu sistema. ==O aviso chega em menos de um segundo== e o sistema responde.", "fonte": "resumo da documentação" },
    { "de": 18.9, "ate": 20.6, "tipo": "palavra", "texto": "Sem gastar | nada." }
  ]
}
```

## Nunca

- Superfície lisa sem textura. Cor chapada alegre.
- Dissolve suave. Movimento liso nos gráficos.
- Explicar o contexto antes de mostrar a imagem forte.
- Lugar, data ou documento inventados.

## Identidade visual

### Style Prompt
Documentário de autor: imagem quente com vinheta e grão de filme. Texto de lugar e data em letra
de máquina branca, digitado letra a letra com cursor. Título de capítulo em serifa fina grande,
com um rótulo vermelho em mono espaçado em cima e um traço vermelho embaixo. Fotos com borda creme
larga, levemente tortas, com etiqueta preta em mono caixa alta, sobre papel creme texturizado.
Recorte de documento com marca-texto âmbar. Entre os cortes, um clarão de queima de filme laranja.
Gráficos em 12 quadros por segundo.

### Colors
- `#F4F2E6` creme (papel), `#121118` tinta
- `#FFBF00` âmbar (destaque), `#DD2C1E` vermelho (rótulo, traço)
- `#004CFF` azul (raro), `#0D5921` verde

### Typography
- `SerifaReta` (Instrument Serif): títulos (100 px), palavra
- `Serifa` itálica: palavra de destaque da legenda, citação
- `Mono` (JetBrains Mono) em caixa alta espaçada: rótulos, etiquetas, lugar e data
- `InterTight` 600: legenda

### What NOT to Do
- Sans pesada em caixa alta nos títulos
- Neon, vidro, canto arredondado
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Fundo `var(--void)` (papel creme), título em `"SerifaReta"`, rótulo em `var(--f-mono)` caixa alta
vermelho, moldura creme de 14 px sem raio. Tweens com `ease: "steps(n)"`.
