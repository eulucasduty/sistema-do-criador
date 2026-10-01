# Estilo desta edição: Montagem em camadas 3D

O vídeo do criador vira **um cartão em pé no meio da tela** e a edição vai entrando **em camadas
de vidro** que flutuam na frente dele, em perspectiva: a trilha, a legenda, os ícones, o título.
No fim as camadas se juntam e o cartão vem pra frente como "vídeo pronto". É o estilo pra mostrar
um processo que se monta em etapas.
Vale por cima do `kit/EDITOR.md` onde disser diferente.

## Como o vídeo se organiza

1. **0 s:** o cabeçalho centralizado já está no alto (rótulo pequeno em caixa alta + título em
   letra larga e redonda, com uma palavra em lilás) e o cartão com o vídeo aparece cru.
2. **A cada 2 a 3 s** entra uma camada nova. Cada etapa tem um `selo` ("CAMADA 02") e um `nome`
   ("Trilha") que aparecem embaixo, com a barrinha de progresso enchendo.
3. **Penúltimo passo:** as camadas se abrem todas ("5 camadas", "tudo junto").
4. **Final:** `final` junta tudo, o cartão cresce e fica como resultado por 2 a 4 s.
5. Depois, se sobrar vídeo: ele em tela cheia com a legenda normal e o `cta`.

A cena `camadas` deve durar **10 a 16 s** e ser o corpo do vídeo. Uma só por vídeo.

## Como editar

- **Componentes:** `cabecalho` (título, centralizado) + `camadas`, os dois no mesmo intervalo.
- **Etapas:** 4 a 5. A 1ª é a gravação crua (sem `elemento`). As outras:
  - `"elemento": "onda"` pra som, trilha, áudio;
  - `"elemento": "legenda"` mostra a legenda de verdade dentro do cartão;
  - `"elemento": "icones"` com `"icones": ["scissors", "zap", "captions"]` (até 6);
  - `"elemento": "titulo"` com `"texto": "LINHA 1 | LINHA 2"` (2 linhas, 2 a 3 palavras cada);
  - `"elemento": "imagem"` com `material` ou `arquivo`; `"elemento": "texto"`.
  Dê `t` (ou `i`) em cada etapa, na hora em que ele fala daquilo.
- **Legenda:** `destaque`. Durante a cena `camadas` ela aparece dentro do cartão, pequena.
- **Câmera:** não use `angulos` dentro da cena. O cartão já enquadra o rosto.
- **Emendas:** secas.
- **Sons:** `whoosh` em cada camada e `ding` no resultado (automáticos).

## Exemplo de plano

```json
{
  "cenas": [
    { "de": 0, "ate": 15.5, "tipo": "cabecalho", "rotulo": "A IA MONTA A EDIÇÃO", "linhas": ["em *camadas*"] },
    { "de": 0, "ate": 15.5, "tipo": "camadas",
      "etapas": [
        { "selo": "CAMADA 01 · CRUA", "nome": "Gravação" },
        { "selo": "CAMADA 02", "nome": "Trilha", "elemento": "onda", "t": 2.2 },
        { "selo": "CAMADA 03", "nome": "Legendas", "elemento": "legenda", "t": 4.4 },
        { "selo": "CAMADA 04", "nome": "Ícones", "elemento": "icones", "icones": ["scissors", "zap", "captions", "sparkles"], "t": 7.2 },
        { "selo": "CAMADA 05", "nome": "Título", "elemento": "titulo", "texto": "EDITE VÍDEOS | COM IA", "t": 9.6 }
      ],
      "final": { "selo": "RESULTADO", "nome": "Vídeo pronto", "t": 12.2 } }
  ]
}
```

## Nunca

- Mais de 5 etapas, ou etapa com menos de 1,8 s.
- Card de faixa ou de tela cheia junto da cena `camadas`.
- Título de camada com mais de 2 linhas.

## Identidade visual

### Style Prompt
Palco violeta com bolas de luz desfocadas nas bordas. No centro, um cartão vertical de canto
arredondado com o vídeo do criador. Na frente dele flutuam placas de vidro translúcidas com borda
clara, cada uma com um elemento da edição: barrinhas de onda sonora, legenda em pílula, botões
redondos com ícone, título em letra larga. As placas chegam de frente, em perspectiva, e depois
se alinham. No alto, título centralizado em letra larga e redonda; embaixo, o nome da camada em
letra larga com um selo pequeno em caixa alta e tracinhos de progresso.

### Colors
- `#140b2c` fundo, com círculos de luz lilás e violeta
- vidro `rgba(24,14,48,.88)` com borda `rgba(196,166,250,.42)`
- cores das camadas, em ordem: `#f2eafc`, `#7f95ff`, `#a78bfa`, `#9153f8`, `#f0a6d8`, `#7df0a8`
- `#f2eafc` texto, `#c4a6fa` destaque

### Typography
- `Unbounded` 800: título do alto e nome da camada (caixa baixa, larga e redonda)
- `Jakarta` 500 com `letter-spacing: 0.2em`: rótulo e selo em caixa alta

### What NOT to Do
- Nada de cantos retos nem de painel opaco: aqui tudo é vidro
- Nada de texto longo dentro do cartão
- Nunca desenhar logo à mão nem imitar interface quando existe a de verdade

## Cena livre neste estilo
Evite. Se precisar: fundo transparente, placa `var(--vidro)` com `border: 2px solid var(--vidro-borda)`
e `border-radius: 30px`, título em `"Unbounded"` 800.
