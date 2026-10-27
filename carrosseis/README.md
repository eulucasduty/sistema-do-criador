# Carrosséis no Creaty

A estação local recebe todos os slides da referência e produz a sequência completa em português, com a assinatura do seu perfil. O servidor gerencia arquivos, fila e publicação.

1. Configure nome, @ e foto em Meu perfil / conexão do Instagram.
2. Em Esteira → Carrosséis, envie todos os slides (até 20, imagens ou vídeos, 45 MB por arquivo) ou importe pelo link usando a conexão do Facebook.
3. Confira a ordem e a quantidade total; escolha tradução ou reformulação, headline e CLI.
4. Abra `npm run carrossel:estacao` em um terminal próprio. A estação reutiliza o login salvo por `npm run estacao`.
5. Acompanhe a produção, revise todos os slides e baixe os resultados. Se quiser publicar pelo sistema, preencha a legenda e o horário na página do carrossel.

Instalação: aplique a migração `002_producao.sql`, execute `npm ci` e `npx playwright install chromium`. A CLI escolhida precisa estar instalada e autenticada. `CODEX_BIN` e `CLAUDE_BIN` permitem apontar os executáveis.

Slides em vídeo exigem FFmpeg e FFprobe no PATH (`FFMPEG` e `FFPROBE` permitem outro caminho). A estação recebe o original e quadros de referência, compõe o texto e a marca sobre a área de vídeo e entrega MP4 com PNG de capa.

As oficinas ficam em `carrosseis/oficina/<trabalho>/`, fora do Git. Guarde-as para ajustes posteriores. Os resultados vão para o bucket privado `esteira`.

`npm run carrossel:verificar` testa contagem, ordem, idioma, isolamento da oficina e renderização. Requer Chromium; o caso MP4 requer FFmpeg. A variável opcional `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` aponta um Chrome existente.
