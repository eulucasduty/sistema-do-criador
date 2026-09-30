# Como instalar a estação de edição no seu computador

A **estação** é o programa que edita os vídeos que você manda pelo painel. Ela roda no seu
computador (Windows ou Mac): trata a cor e o som, transcreve a fala, chama o Claude Code pra
montar a edição e renderiza o vídeo final. O Claude usa a **sua assinatura do Claude**: a edição
não gera cobrança de API.

Enquanto a estação estiver ligada, o painel mostra "estação ligada" e os pedidos saem sozinhos.
Desligou o computador ou fechou a janela, os pedidos ficam esperando na fila.

---

## Do que você precisa

- Um computador com **Windows 10/11** ou **macOS** (Apple Silicon ou Intel), com uns **10 GB
  livres** (programas + modelo de transcrição + vídeos). 16 GB de memória ajudam: o render é pesado.
- Uma **assinatura do Claude que inclua o Claude Code** (Pro ou Max). O editor usa o modelo Opus
  por padrão. Se o seu plano não tiver Opus ou bater no limite, use o Sonnet (veja
  `EDITOR_MODELO` lá embaixo).
- Os dados do seu projeto no **Supabase** (o mesmo do painel).
- Internet (pra baixar os vídeos do painel e devolver o vídeo pronto).

Os programas que a estação usa (o passo a passo de cada um vem logo abaixo):

| programa | pra quê |
|---|---|
| Node.js 22 ou mais novo | roda a estação |
| ffmpeg (versão completa) | cor, HDR do iPhone, som, cortes, folhas de quadros |
| whisper.cpp + modelo `ggml-large-v3-turbo-q5_0.bin` | transcrição da fala (roda no seu PC, grátis) |
| Claude Code, logado na sua conta | o editor que monta o vídeo |
| Google Chrome | prints de sites que aparecem no vídeo |

> **Como abrir o terminal**
> - **Windows:** menu Iniciar → digite **Terminal** (ou **PowerShell**) → abrir.
> - **Mac:** Spotlight (⌘ + espaço) → digite **Terminal** → abrir.
>
> Os comandos abaixo são pra copiar, colar no terminal e apertar Enter. Depois de instalar
> um programa, **feche e abra o terminal de novo** pra ele aparecer.

---

## 1. Node.js

- **Windows:** `winget install OpenJS.NodeJS.LTS`
- **Mac:** primeiro o Homebrew, se ainda não tiver (é o instalador de programas do Mac):
  `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
  (no fim ele mostra 2 ou 3 comandos pra colar; cole). Depois: `brew install node`

Confira: `node --version` tem que mostrar **v22** ou maior.

## 2. ffmpeg (versão completa)

- **Windows:** `winget install Gyan.FFmpeg`
- **Mac:** `brew install ffmpeg-full`
  (o `ffmpeg` comum do Homebrew **não serve**: vem sem as partes de HDR e de texto que a estação
  usa. A estação acha o `ffmpeg-full` sozinha.)

## 3. whisper.cpp e o modelo de transcrição

**O programa**

- **Windows:** abra https://github.com/ggml-org/whisper.cpp/releases, procure a versão mais nova
  que tenha o arquivo **`whisper-bin-x64.zip`**, baixe e extraia numa pasta chamada `whisper-cpp`
  dentro da sua pasta de usuário. Tem que ficar assim:
  `C:\Users\<seu usuário>\whisper-cpp\Release\whisper-cli.exe`
- **Mac:** `brew install whisper.cpp`

**O modelo** (`ggml-large-v3-turbo-q5_0.bin`, uns 575 MB; é ele que entende o português):

- **Windows (PowerShell):**
  ```
  New-Item -ItemType Directory -Force "$HOME\whisper-cpp\models"
  curl.exe -L -o "$HOME\whisper-cpp\models\ggml-large-v3-turbo-q5_0.bin" https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
  ```
- **Mac:**
  ```
  mkdir -p ~/whisper-cpp/models
  curl -L -o ~/whisper-cpp/models/ggml-large-v3-turbo-q5_0.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
  ```

Se preferir baixar pelo navegador, o link é o mesmo; salve o arquivo em `whisper-cpp/models`
dentro da sua pasta de usuário.

## 4. Claude Code (logado no seu plano)

- **Windows (PowerShell):** `irm https://claude.ai/install.ps1 | iex`
- **Mac:** `curl -fsSL https://claude.ai/install.sh | bash`

Depois, no terminal, digite `claude`, faça login com **a sua conta do Claude** (a da assinatura)
e saia com `/exit`. Não precisa de chave de API: a estação até apaga qualquer `ANTHROPIC_API_KEY`
antes de chamar o Claude, justamente pra usar o plano e nunca cobrar por uso.

## 5. Google Chrome

Instale o Chrome normal (google.com/chrome), se ainda não tiver. É com ele que o editor tira
print de sites.

O render usa um Chrome próprio do HyperFrames, que ele baixa sozinho na primeira vez. Pra adiantar
isso (opcional), rode na pasta do sistema: `npx --yes hyperframes@0.8.92 browser ensure`

---

## 6. O sistema no seu computador

1. Baixe o projeto (o mesmo repositório do painel) numa pasta do seu computador.
2. Abra o terminal **nessa pasta**:
   - **Windows:** no Explorador de Arquivos, entre na pasta, clique com o botão direito num espaço
     vazio → **Abrir no Terminal**.
   - **Mac:** no Terminal, digite `cd ` (com espaço), arraste a pasta pra janela e aperte Enter.
3. Instale as dependências: `npm install`

## 7. O arquivo `.env.local`

Na pasta do projeto, crie um arquivo chamado exatamente **`.env.local`** (com o ponto na frente)
com estas duas linhas:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Onde achar no Supabase (painel do seu projeto):
- **`NEXT_PUBLIC_SUPABASE_URL`**: Project Settings → Data API → **Project URL**.
- **`SUPABASE_SECRET_KEY`**: Project Settings → API Keys → **Secret keys** (começa com `sb_secret_`).

Se você já tem um `.env.local` do painel nessa pasta, é o mesmo arquivo: só confira que essas duas
linhas estão lá.

> A chave secreta dá acesso total ao seu banco. Não mande pra ninguém, não poste print dela e não
> coloque em lugar público.

**Opcionais** (só se precisar; uma por linha no mesmo `.env.local`, sem aspas):

| variável | pra quê | padrão |
|---|---|---|
| `EDITOR_SAIDA` | pasta onde a cópia do vídeo pronto fica no seu PC | `Vídeos/Sistema do Criador` |
| `EDITOR_MODELO` | modelo do Claude na edição (`opus` ou `sonnet`) | `opus` |
| `EDITOR_ESFORCO` | quanto o Claude pensa (`low`, `medium`, `high`) | `high` |
| `FFMPEG_BIN` | caminho do ffmpeg, se a estação não achar (o ffprobe tem que estar na mesma pasta) | procura sozinha |
| `WHISPER_BIN` | caminho do `whisper-cli` | `~/whisper-cpp/Release/whisper-cli.exe` (Windows), Homebrew (Mac) |
| `WHISPER_MODEL` | caminho do modelo `ggml-large-v3-turbo-q5_0.bin` | `~/whisper-cpp/models/` |
| `CLAUDE_BIN` | caminho do Claude Code | `~/.local/bin/claude`, depois o PATH |
| `CHROME_BIN` | caminho do Chrome (ou Edge/Chromium) | procura sozinha |

Exemplo no Windows: `WHISPER_BIN=D:\programas\whisper\whisper-cli.exe`

---

## 8. Ligar a estação

Na pasta do projeto:

```
npm run estacao
```

Se estiver tudo certo, aparece algo assim:

```
Programas: ffmpeg … · whisper … · Claude …
Estação de edição ligada em MEU-PC. Vídeos prontos também vão pra: …
Esperando pedidos do painel (Ctrl+C pra parar)…
```

Em até 30 segundos o painel mostra a estação ligada. **Deixe essa janela aberta** enquanto quiser
que as edições saiam. Pra desligar: clique na janela e aperte **Ctrl+C**.

Se faltar alguma coisa, a estação não liga e mostra a lista do que falta, com o comando pra
instalar cada item. Instale, feche e abra o terminal, e rode `npm run estacao` de novo.

Cada vídeo pronto sobe pro painel e também fica numa cópia no seu PC (`Vídeos/Sistema do Criador`,
ou a pasta do `EDITOR_SAIDA`).

## Testar sem o painel (opcional)

Pra ver o editor funcionando com um vídeo do seu computador, sem mandar pelo painel:

```
npm run editor:testar -- "caminho/do/video.mp4" --usuario @seuperfil --cor natural --legenda bangers
```

O resultado fica em `editor/oficina/teste-<data>/renders/final.mp4`.

---

## Problemas comuns

- **"Falta instalar no PC"**: siga a lista que aparece; cada linha diz o que instalar.
- **"o ffmpeg deste PC veio sem zscale, drawtext…"** (Mac): instale o `ffmpeg-full`
  (`brew install ffmpeg-full`). No Windows, reinstale com `winget install Gyan.FFmpeg`.
- **O Claude pede login ou dá erro de autenticação**: rode `claude` no terminal, faça login de novo
  e saia com `/exit`.
- **O painel mostra a estação desligada**: a janela foi fechada, o computador dormiu ou caiu a
  internet. Rode `npm run estacao` de novo; o pedido que estava no meio volta pra fila sozinho.
- **Demora**: é normal levar vários minutos por vídeo, e o render é a parte mais pesada. Deixe o
  computador na tomada e configurado pra não dormir enquanto edita.
- **A foto do perfil não aparece no fim do vídeo**: o link da foto do Instagram vence de tempos em
  tempos. Atualize o perfil no painel (ou reconecte o Instagram). Sem foto, o vídeo sai com a
  inicial do seu nome num círculo.
