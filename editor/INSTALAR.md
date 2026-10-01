# Como instalar a estação de edição no seu computador

A **estação** é o programa que edita os vídeos que você manda pelo painel. Ela roda no seu
computador (Windows ou Mac): trata a cor e o som, transcreve a fala, chama a IA pra montar a
edição e renderiza o vídeo final. Enquanto ela estiver aberta, o painel mostra "estação ligada"
e os pedidos saem sozinhos. Fechou a janela ou desligou o computador, os pedidos esperam na fila.

## Quem edita: escolha uma das três

| opção | pra quem | quanto custa |
|---|---|---|
| **Claude** | você assina o **Claude Pro ou Max** | nada a mais: usa o seu plano |
| **ChatGPT** | você assina o **ChatGPT Plus ou Pro** | nada a mais: usa o seu plano (pelo Codex, da OpenAI) |
| **OpenRouter** | não tem nenhum dos dois | paga por vídeo, **uns R$ 10** (de R$ 5 a R$ 15, conforme o tamanho) |

O instalador pergunta qual você quer. Depois dá pra trocar quando quiser no painel:
**Editor de vídeo → Quem edita os seus vídeos** (a estação pega a troca sozinha, sem reiniciar).

Na OpenRouter, a estação usa a mesma chave que você colou no painel (Início, passo 2) e o modelo
Claude Sonnet. Você coloca crédito em [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits)
(US$ 10 dão pra uns 5 vídeos) e vê quanto cada vídeo custou na página dele no painel.

---

## Instalar (um comando só)

Precisa de um computador com **Windows 10/11** ou **macOS**, uns **15 GB livres** e internet.
A primeira instalação baixa uns 2 GB e leva de 10 a 30 minutos.

### Windows

1. Abra o menu Iniciar, digite **PowerShell** e abra (não precisa ser como administrador).
2. Cole esta linha e aperte Enter:
   ```
   irm https://raw.githubusercontent.com/eulucasduty/sistema-do-criador/main/instalar/windows.ps1 | iex
   ```

### Mac

1. Abra o **Terminal** (⌘ + espaço, digite Terminal, Enter).
2. Cole esta linha e aperte Enter:
   ```
   curl -fsSL https://raw.githubusercontent.com/eulucasduty/sistema-do-criador/main/instalar/mac.sh | bash
   ```

### O que ele faz

1. Instala o que faltar: **Node.js**, **ffmpeg completo**, **whisper.cpp** e o modelo de transcrição
   (roda no seu PC, grátis). No Mac, instala antes o Homebrew (o instalador de programas do Mac).
   No Windows, com o Claude ou a OpenRouter, instala também o **Git for Windows** (o Claude usa o
   terminal dele).
2. Baixa o sistema na pasta **CreatorSystem** (dentro da sua pasta de usuário). Não precisa de Git.
3. Prepara o kit de edição (HyperFrames e o Chrome dele).
4. Pergunta **quem edita** e instala essa IA:
   - **Claude**: instala o Claude Code e abre o login no navegador. Entre com a conta da sua assinatura.
   - **ChatGPT**: instala o Codex e abre o login no navegador. Entre com a conta do ChatGPT da sua
     assinatura. No Windows, o Codex prepara o sandbox dele: se o Windows pedir permissão de
     administrador, clique em **Sim** (sem isso a IA edita, mas não consegue tirar as fotos de
     conferência do vídeo).
   - **OpenRouter**: instala o Claude Code. Não tem login: a estação usa a chave do painel.
5. Cria o atalho **Estação de edição** na Área de Trabalho (no Mac, na Mesa).
6. Liga a estação.

Pode aparecer pedido de permissão do Windows (clique em **Sim**) ou da senha do Mac: é normal.

### Na primeira vez, a estação pergunta 3 coisas

```
Endereço do seu sistema (ex.: https://meu-sistema.vercel.app): https://o-seu-sistema.vercel.app
E-mail (o do login do painel): voce@email.com
Senha: ********
```

- **Endereço**: o mesmo que você abre no navegador pra ver o painel (o passo da estação no Início
  mostra ele pronto pra copiar).
- **E-mail e senha**: os mesmos do login do painel.

A estação entra no sistema **como você**, com as mesmas permissões do painel: não precisa de chave
secreta nenhuma no computador. A senha **não fica guardada**: fica só a sessão (um código que se
renova sozinho), num arquivo que só o seu usuário do computador abre
(`.sistema-do-criador/sessao.json` na sua pasta de usuário).

Em até 30 segundos o painel mostra a estação ligada. **Deixe a janela aberta** enquanto quiser que
as edições saiam.

### Depois

- **Ligar a estação**: dois cliques no atalho **Estação de edição**.
- **Desligar**: feche a janela (ou aperte Ctrl+C nela).
- **Atualizar**: rode o mesmo comando da instalação de novo. Ele baixa a versão nova e mantém o seu
  login, as edições anteriores (os ajustes precisam delas) e o que já estava instalado.
- **Entrar com outra conta**: abra o terminal na pasta CreatorSystem e rode
  `npm run estacao -- --sair` (na próxima vez a estação pergunta de novo).
- **Conferir se a IA está pronta**: `npm run estacao -- --testar-motor` (na mesma pasta). O painel
  também mostra isso em **Editor de vídeo → Quem edita os seus vídeos**.

Cada vídeo pronto sobe pro painel e fica também numa cópia no seu PC (`Vídeos/Creator System`).

---

## Problemas comuns

- **"Deu erro" ou "Parei" no instalador**: rode o mesmo comando de novo; ele continua de onde parou.
- **O painel diz que a estação "não consegue editar"**: a mensagem diz o que falta. Os casos comuns:
  - *não está logado*: rode o instalador de novo (ele abre o login) ou, no terminal,
    `claude auth login` (Claude) ou `codex login` (ChatGPT);
  - *logado com chave de API*: saia (`claude auth logout` ou `codex logout`) e entre de novo com a
    conta da assinatura (senão cobra por uso);
  - *falta a chave da OpenRouter* ou *sem crédito*: cole a chave no painel (Início, passo 2) ou
    coloque crédito na OpenRouter.

  Os vídeos esperam na fila até resolver; não precisa mandar de novo.
- **Bateu no limite do plano** (Claude ou ChatGPT): o pedido vai pra "Erro" com o horário em que o
  limite volta. Espere e clique em **Tentar de novo**, ou troque quem edita no painel.
- **O painel mostra a estação desligada**: a janela foi fechada, o computador dormiu ou caiu a
  internet. Abra o atalho de novo; o pedido que estava no meio volta pra fila sozinho.
- **Demora**: é normal levar vários minutos por vídeo; o render é a parte mais pesada. Deixe o
  computador na tomada e configurado pra não dormir enquanto edita.
- **A foto do perfil não aparece no fim do vídeo**: o link da foto do Instagram vence de tempos em
  tempos. Atualize o perfil no painel. Sem foto, o vídeo sai com a inicial do seu nome.

---

## Apêndice: instalar na mão

Pra quem prefere fazer cada passo. Os comandos são pra colar no terminal (PowerShell no Windows,
Terminal no Mac). Depois de instalar um programa, feche e abra o terminal de novo.

| programa | Windows | Mac |
|---|---|---|
| Node.js 22 ou mais novo | `winget install OpenJS.NodeJS.LTS` | `brew install node` |
| ffmpeg completo | `winget install Gyan.FFmpeg` | `brew install ffmpeg-full` (o `ffmpeg` comum não serve) |
| whisper.cpp | baixe o `whisper-bin-x64.zip` em github.com/ggml-org/whisper.cpp/releases (a versão mais nova que tiver esse arquivo) e extraia de forma que fique `C:\Users\<você>\whisper-cpp\Release\whisper-cli.exe` | `brew install whisper.cpp` |
| modelo do whisper | `curl.exe -L --create-dirs -o "$HOME\whisper-cpp\models\ggml-large-v3-turbo-q5_0.bin" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin` | `curl -L --create-dirs -o ~/whisper-cpp/models/ggml-large-v3-turbo-q5_0.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin` |
| Git for Windows (só Claude e OpenRouter) | `winget install Git.Git` | não precisa |

A IA:

- **Claude** ou **OpenRouter**: Claude Code. Windows: `irm https://claude.ai/install.ps1 | iex` ·
  Mac: `curl -fsSL https://claude.ai/install.sh | bash`. No Claude, faça o login com
  `claude auth login` (conta da assinatura). Na OpenRouter não precisa de login.
- **ChatGPT**: Codex. `npm install -g @openai/codex`, depois `codex login` (conta do ChatGPT). No
  Windows, pra preparar o sandbox (aceite o pedido de administrador):
  `codex sandbox -P :workspace -c windows.sandbox=elevated -- cmd /c echo ok`

O sistema: baixe o zip em github.com/eulucasduty/sistema-do-criador (botão **Code → Download
ZIP**), extraia numa pasta e, nela, rode `npm install` e depois `npm run estacao`. Na primeira vez
ela pergunta o endereço, o e-mail e a senha. Escolha quem edita no painel.

### Modo avançado (chave secreta)

Se você preferir, a estação também aceita a chave secreta do Supabase em vez do login: crie o
arquivo `.env.local` na pasta do sistema com `NEXT_PUBLIC_SUPABASE_URL=...` e
`SUPABASE_SECRET_KEY=sb_secret_...`. Com as duas, ela não pergunta nada. A chave dá acesso total ao
seu banco: não mande pra ninguém.

### Opcionais (no `.env.local`, uma por linha, sem aspas)

| variável | pra quê | padrão |
|---|---|---|
| `EDITOR_SAIDA` | pasta onde a cópia do vídeo pronto fica no seu PC | `Vídeos/Creator System` |
| `EDITOR_ESFORCO` | quanto a IA pensa (`low`, `medium`, `high`) | `high` (OpenRouter: `medium`) |
| `OPENROUTER_API_KEY` | chave da OpenRouter só neste PC (vale por cima da do painel) | a do painel |
| `FFMPEG_BIN` | caminho do ffmpeg (o ffprobe tem que estar na mesma pasta) | procura sozinha |
| `WHISPER_BIN` / `WHISPER_MODEL` | caminho do `whisper-cli` e do modelo | procura sozinha |
| `CLAUDE_BIN` / `CODEX_BIN` | caminho do Claude Code / do Codex | procura sozinha |
| `CHROME_BIN` | caminho do Chrome (ou Edge/Chromium) | procura sozinha |

O modelo de cada IA se escolhe no painel (Quem edita → Avançado). O padrão: Opus no Claude, o da
sua conta no ChatGPT e `anthropic/claude-sonnet-5.5` na OpenRouter.

### Testar sem o painel

Pra ver o editor funcionando com um vídeo do seu computador, sem mandar pelo painel:

```
npm run editor:testar -- "caminho/do/video.mp4" --motor claude --usuario @seuperfil --cor natural --estilo classico
```

`--estilo` é o estilo de edição (o nome da pasta em `editor/kit/estilos`; `npm run editor:catalogo`
mostra a lista com as legendas de cada um). Sem ele, vale o estilo padrão.

(`--motor codex` ou `--motor openrouter` também valem; na OpenRouter, com `OPENROUTER_API_KEY` no
`.env.local`.) O resultado fica em `editor/oficina/teste-<data>/renders/final.mp4`.

### Segurança

A IA só trabalha dentro da pasta da edição e só roda os comandos do kit. Ela nunca recebe chave
nenhuma (nem a do Supabase, nem a sessão da estação) e print de página só sai dos links que você
mandou no pedido.

- **Claude e OpenRouter**: ler ou escrever arquivo fora da pasta da edição é bloqueado.
- **ChatGPT (Codex)**: os comandos rodam num sandbox sem internet (quem busca a logo oficial é a
  estação). Ele ainda consegue ler arquivos do seu usuário, mas não tem como mandar nada pra fora;
  no Windows, a sessão da estação fica trancada só pro seu usuário (o sandbox não abre).
