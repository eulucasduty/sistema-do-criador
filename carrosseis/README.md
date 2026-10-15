# Cópia de carrossel pela estação

Na Esteira, um carrossel de referência (de qualquer idioma) vira o SEU carrossel em português: todos os slides, com a mesma mensagem, as cores, as fotos e a composição do original, e a sua foto + o seu @ em cada slide. Slide em vídeo no original sai em MP4.

Quem faz é a estação no seu PC (a mesma do editor de vídeo), com a IA escolhida em **Editor de vídeo → Quem edita** (Claude, ChatGPT pelo Codex, ou OpenRouter). O painel só põe o pedido na fila.

## Como usar

1. **Esteira → Nova referência**: cole o link do post (com o Facebook conectado, vêm todos os slides, inclusive os de vídeo) ou suba os arquivos em **Slides do carrossel** (fotos e vídeos misturados, até 20, 45 MB cada; a ordem segue o nome: 01, 02, 03…). Os arquivos vão do navegador direto pro Storage.
2. Na página do carrossel, confira os slides (clique pra ampliar), troque a ordem ou tire o que não é do carrossel e salve. Faltou algum? **Subir slides** (entram no fim).
3. Em **Copiar carrossel**: confirme quantos slides o original tem, escreva a headline nova da capa (ou deixe vazio pra traduzir a original), escolha se os outros slides são traduzidos fielmente ou reescritos com a mesma mensagem e clique em **Copiar carrossel**.
4. Com a estação ligada, a página mostra o andamento. No fim: os slides (PNG 1080×1350; os de vídeo em MP4, com o PNG de capa), **Baixar todos**, a legenda e o texto de cada slide. Fazer outra cópia mantém a anterior no ar até a nova ficar pronta.

## Como funciona

- **Fila** (`supabase/migrations/004_carrossel.sql`): tabela `carrossel_trabalho`, um pedido ativo por referência, com a lista dos arquivos congelada na ordem do clique. A estação pega o mais antigo de forma atômica (só quem muda o status primeiro leva) e publica o resultado com `concluir_carrossel()`, que grava `referencia.copia_cli` e fecha o pedido juntos.
- **Estação** (`editor/estacao/carrosseis.mjs`, ligada por `scripts/estacao-edicao.mjs`): roda em paralelo com a edição de vídeo, um carrossel por vez, no mesmo login (RLS, sem chave secreta). Batida em `configuracao.estacao_carrosseis`. `ESTACAO_CARROSSEIS=0` no `.env.local` desliga essa parte. Se a IA bater no limite do plano, o pedido volta pra fila e a estação tenta de novo em 20 min.
- **Oficina** (`carrosseis/produzir.mjs`): `carrosseis/oficina/<pedido>/` com os originais (`referencias/NN.png`; slide em vídeo: `NN.mp4`, um quadro `NN.png` e a folha `NN-quadros.jpg` com 6 momentos), a sua foto, as fontes e o kit. A IA segue `kit/CRIAR.md`: transcreve cada slide, escreve `carrossel.html` (HTML/CSS livre, um layout por slide) e `conteudo.json` (original e PT-BR de cada slide), reaproveita fotos e prints com `kit/recortar.mjs`, cobre texto em fundo com textura com `kit/fundo.mjs` e recorta o motion dos slides em vídeo com `kit/recortar-video.mjs`.
- **Conferência e render** (`kit/renderizar.mjs`): Chrome sem janela (pelo protocolo do DevTools, sem porta aberta e sem dependência extra), com o JS da página desligado e só arquivos da oficina (o que vier de fora é recusado e aparece no erro). Confere quantidade, ordem, tamanho, imagens, texto cortado, o texto da arte igual ao `conteudo.json` e a área da marca. Renderiza em 2x e reduz pra 1080×1350. A marca (foto redonda + @ do Perfil; sem foto, a inicial) é colada por cima de cada PNG pelo renderizador, fora do alcance do HTML. Slide em vídeo: arte + motion na área `data-video` + o que tiver `data-sobre-video` e a marca por cima, em MP4 de até 60 s com o áudio do original (ffmpeg).
- A estação confere e renderiza de novo depois da IA; se algo falhar, a IA recebe o erro e corrige uma vez.
- **Segurança**: a IA roda sem nenhuma chave no ambiente, só dentro da oficina e só com os comandos do kit (Claude Code com a lista de permissões; Codex no sandbox sem internet). A estação só escreve em `esteira/carrosseis/…` no Storage; o resto do bucket continua só pelo servidor. O painel serve os slides pela rota `/esteira/<id>/slide/<n>`, que passa pela sessão e pela RLS.

## Testar no PC

- `npm run carrossel:verificar`: os testes do kit, sem banco e sem IA (precisa do Chrome e do ffmpeg): ordem e contagem, contrato do `conteudo.json`, ambiente da IA sem chaves, marca, texto cortado, arquivo de fora, JS da página desligado e slide em vídeo.
- `npm run carrossel:testar -- <pasta com 01.png, 02.jpg, 03.mp4…> [--motor claude|codex|openrouter] [--headline "…"] [--usuario @seu.perfil] [--foto <arquivo|link>]`: copia um carrossel de uma pasta do PC com a IA, sem painel e sem banco. A oficina fica em `carrosseis/oficina/teste-<hora>`.

As oficinas ficam só no PC (fora do git). Pode apagar `carrosseis/oficina/` quando quiser: a cópia já está no painel.
