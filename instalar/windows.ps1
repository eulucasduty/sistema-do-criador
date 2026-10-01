# Instalador da estação de edição do Creator System (Windows 10 e 11).
#
# Abra o PowerShell (menu Iniciar, digite PowerShell) e cole esta linha:
#   irm https://raw.githubusercontent.com/eulucasduty/sistema-do-criador/main/instalar/windows.ps1 | iex
#
# Ele instala o que falta (Node.js, ffmpeg completo, whisper.cpp e o modelo de transcrição, Git
# quando precisa), baixa o sistema em %USERPROFILE%\CreatorSystem (sem precisar de Git),
# pergunta quem edita os vídeos (Claude, ChatGPT ou OpenRouter), instala e abre o login dessa IA,
# cria o atalho "Estação de edição" na Área de Trabalho e liga a estação.
# Rodar de novo = atualizar: baixa a versão nova e mantém o seu login, as edições e o .env.local.
#
# Teste sem instalar nada (só mostra o que faria):
#   & ([scriptblock]::Create((irm <o endereço acima>))) -Simular -Motor claude
# Opções: -Motor claude|codex|openrouter (não pergunta) · -Pasta <onde instalar> · -NaoLigar
#          -PastaAtalho <onde pôr o atalho> (padrão: Área de Trabalho) · -ZipLocal <.zip do sistema> (testes)
param(
  [switch]$Simular,
  [string]$Motor = '',
  [string]$Pasta = '',
  [switch]$NaoLigar,
  [string]$PastaAtalho = '',
  [string]$ZipLocal = ''
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # o Invoke-WebRequest fica muito mais rápido sem a barra
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force } catch {}
if ($env:SIMULAR -eq '1') { $Simular = $true }
if (-not $Pasta) { $Pasta = Join-Path $HOME 'CreatorSystem' }

$REPO = 'eulucasduty/sistema-do-criador'
$RAMO = 'main'
$ZIP_SISTEMA = "https://github.com/$REPO/archive/refs/heads/$RAMO.zip"
$MODELO = 'ggml-large-v3-turbo-q5_0.bin'
$URL_MODELO = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODELO"
$WHISPER_RESERVA = 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.9.2/whisper-bin-x64.zip'
$FFMPEG_RESERVA = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
$PASTA_WHISPER = Join-Path $HOME 'whisper-cpp'
$TEMP = Join-Path $env:TEMP ("sistema-do-criador-" + [guid]::NewGuid().ToString('N').Substring(0, 8))

# ── jeito de falar ──────────────────────────────────────────────────
function Titulo([string]$t) { Write-Host ''; Write-Host "==> $t" -ForegroundColor Yellow }
function Ok([string]$t) { Write-Host "    ok: $t" -ForegroundColor Green }
function Info([string]$t) { Write-Host "    $t" }
function Aviso([string]$t) { Write-Host "    atenção: $t" -ForegroundColor DarkYellow }
function Pare([string]$t) { throw $t }
# Tudo que muda alguma coisa no PC passa por aqui (no -Simular só mostra)
function Faz([string]$descricao, [scriptblock]$acao) {
  if ($Simular) { Write-Host "    [simulação] $descricao" -ForegroundColor Cyan; return }
  Write-Host "    $descricao..."
  & $acao
}

function AtualizarPath {
  $partes = @(
    [Environment]::GetEnvironmentVariable('Path', 'Machine'),
    [Environment]::GetEnvironmentVariable('Path', 'User'),
    "$env:ProgramFiles\nodejs",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
    "$HOME\.local\bin",
    "$env:APPDATA\npm",
    "$env:ProgramFiles\Git\cmd",
    "$HOME\ffmpeg\bin",
    $env:Path
  ) | Where-Object { $_ }
  $env:Path = ($partes -join ';')
}
function Tem([string]$cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
# No PowerShell 5.1, programa que escreve no stderr vira erro quando o Stop está ligado: aqui não
function Nativo([scriptblock]$bloco) {
  $ErrorActionPreference = 'Continue'
  & $bloco
}

function Baixar([string]$url, [string]$destino) {
  New-Item -ItemType Directory -Force -Path (Split-Path $destino) | Out-Null
  if (Tem 'curl.exe') {
    & curl.exe -L --fail --retry 3 --progress-bar -o $destino $url
    if ($LASTEXITCODE -ne 0) { throw "não consegui baixar $url" }
  } else {
    Invoke-WebRequest -Uri $url -OutFile $destino -UseBasicParsing
  }
}

# winget (vem no Windows 10/11 atualizado). Devolve $true se instalou ou já tinha.
function Winget([string]$id) {
  if (-not (Tem 'winget')) { return $false }
  Nativo { & winget install --id $id -e --silent --accept-source-agreements --accept-package-agreements --disable-interactivity | Out-Host }
  # 0 = instalou; -1978335189 = já estava instalado e atualizado
  return ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq -1978335189)
}

function VersaoNode {
  if (-not (Tem 'node')) { return 0 }
  $v = Nativo { & node --version 2>$null }
  if ($v -match '^v(\d+)') { return [int]$Matches[1] }
  return 0
}

function FfmpegCompleto {
  if (-not (Tem 'ffmpeg')) { return $false }
  $filtros = (Nativo { & ffmpeg -hide_banner -filters 2>$null }) -join "`n"
  return ($filtros -match '\szscale\s' -and $filtros -match '\sdrawtext\s')
}

function AcharWhisper {
  foreach ($p in @("$PASTA_WHISPER\Release\whisper-cli.exe", "$PASTA_WHISPER\whisper-cli.exe", "$PASTA_WHISPER\build\bin\Release\whisper-cli.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function AcharClaude {
  foreach ($p in @("$HOME\.local\bin\claude.exe", "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe")) {
    if (Test-Path $p) { return $p }
  }
  $c = Get-Command claude.exe -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  return $null
}

# O Codex do npm é um .js (roda no node); o instalador oficial é um .exe
function AcharCodex {
  $js = "$env:APPDATA\npm\node_modules\@openai\codex\bin\codex.js"
  if (Test-Path $js) { return , @('node', $js) }
  $exe = "$env:LOCALAPPDATA\Programs\OpenAI\Codex\bin\codex.exe"
  if (Test-Path $exe) { return , @($exe) }
  return $null
}
function Codex([string[]]$argumentos) {
  $c = AcharCodex
  if ($c.Count -eq 2) { & $c[0] $c[1] @argumentos } else { & $c[0] @argumentos }
}

# O .env.local (modo avançado, com a chave secreta) só entra se existir
function ArgsEnv { if (Test-Path (Join-Path $Pasta ".env.local")) { "--env-file=.env.local" } }

function TemGitBash {
  return ((Test-Path "$env:ProgramFiles\Git\bin\bash.exe") -or (Test-Path "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"))
}

# ── começo ─────────────────────────────────────────────────────────
Write-Host ''
Write-Host 'Estação de edição do Creator System: instalação' -ForegroundColor Yellow
if ($Simular) { Write-Host '(modo simulação: nada vai ser instalado nem baixado)' -ForegroundColor Cyan }
Write-Host "Pasta do sistema: $Pasta"

if ([Environment]::OSVersion.Version.Major -lt 10) { Pare 'precisa do Windows 10 ou 11.' }
if (-not [Environment]::Is64BitOperatingSystem) { Pare 'precisa do Windows de 64 bits.' }
AtualizarPath
if (-not (Tem 'winget')) { Aviso 'o winget (instalador do Windows) não está aqui: vou baixar os programas direto do site de cada um.' }

try {
  New-Item -ItemType Directory -Force -Path $TEMP | Out-Null

  # ── 1. Node.js ─────────────────────────────────────────────────
  Titulo 'Node.js (roda a estação)'
  if ((VersaoNode) -ge 22) { Ok "Node.js $((& node --version))" }
  else {
    Faz 'instalando o Node.js (pode aparecer um pedido de permissão do Windows: clique em Sim)' {
      if (-not (Winget 'OpenJS.NodeJS.LTS')) {
        $versoes = Invoke-RestMethod 'https://nodejs.org/dist/index.json' -UseBasicParsing
        $lts = $versoes | Where-Object { $_.lts -and ([int]($_.version -replace '^v(\d+).*', '$1')) -ge 22 } | Select-Object -First 1
        if (-not $lts) { throw 'não achei a versão do Node.js pra baixar' }
        $msi = Join-Path $TEMP "node-$($lts.version)-x64.msi"
        Baixar "https://nodejs.org/dist/$($lts.version)/node-$($lts.version)-x64.msi" $msi
        Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /passive /norestart" -Wait
      }
      AtualizarPath
      if ((VersaoNode) -lt 22) { throw 'o Node.js não ficou instalado' }
    }
    if (-not $Simular) { Ok "Node.js $((& node --version))" }
  }

  # ── 2. ffmpeg completo ─────────────────────────────────────────
  Titulo 'ffmpeg completo (cor, som, cortes)'
  if (FfmpegCompleto) { Ok 'ffmpeg completo' }
  else {
    Faz 'instalando o ffmpeg completo' {
      $foi = Winget 'Gyan.FFmpeg'
      AtualizarPath
      if (-not $foi -or -not (FfmpegCompleto)) {
        $zip = Join-Path $TEMP 'ffmpeg.zip'
        Baixar $FFMPEG_RESERVA $zip
        $tmp = Join-Path $TEMP 'ffmpeg'
        Expand-Archive -Path $zip -DestinationPath $tmp -Force
        $bin = Get-ChildItem -Path $tmp -Recurse -Filter ffmpeg.exe | Select-Object -First 1
        if (-not $bin) { throw 'o zip do ffmpeg veio sem o ffmpeg.exe' }
        New-Item -ItemType Directory -Force -Path "$HOME\ffmpeg\bin" | Out-Null
        Copy-Item -Path (Join-Path $bin.DirectoryName '*') -Destination "$HOME\ffmpeg\bin" -Recurse -Force
        AtualizarPath
      }
      if (-not (FfmpegCompleto)) { throw 'o ffmpeg não ficou completo (sem zscale/drawtext)' }
    }
    if (-not $Simular) { Ok 'ffmpeg completo' }
  }

  # ── 3. whisper.cpp + modelo ────────────────────────────────────
  Titulo 'whisper.cpp (transcreve a sua fala, no seu PC)'
  if (-not (Test-Path "$env:SystemRoot\System32\vcruntime140.dll")) {
    Faz 'instalando o Visual C++ do Windows (o whisper precisa)' {
      if (-not (Winget 'Microsoft.VCRedist.2015+.x64')) {
        $vc = Join-Path $TEMP 'vc_redist.x64.exe'
        Baixar 'https://aka.ms/vs/17/release/vc_redist.x64.exe' $vc
        Start-Process $vc -ArgumentList '/install /passive /norestart' -Wait
      }
    }
  }
  if (AcharWhisper) { Ok "whisper em $(AcharWhisper)" }
  else {
    Faz "baixando o whisper.cpp pra $PASTA_WHISPER" {
      # A versão mais nova que tenha o pacote pro Windows (algumas saem sem)
      $url = $WHISPER_RESERVA
      try {
        $rels = Invoke-RestMethod 'https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=20' -UseBasicParsing
        foreach ($r in $rels) {
          $a = $r.assets | Where-Object { $_.name -eq 'whisper-bin-x64.zip' } | Select-Object -First 1
          if ($a) { $url = $a.browser_download_url; break }
        }
      } catch { Info 'não consegui ver a versão mais nova: usando uma conhecida' }
      $zip = Join-Path $TEMP 'whisper.zip'
      Baixar $url $zip
      $tmp = Join-Path $TEMP 'whisper'
      Expand-Archive -Path $zip -DestinationPath $tmp -Force
      $cli = Get-ChildItem -Path $tmp -Recurse -Filter whisper-cli.exe | Select-Object -First 1
      if (-not $cli) { throw 'o zip do whisper veio sem o whisper-cli.exe' }
      New-Item -ItemType Directory -Force -Path "$PASTA_WHISPER\Release" | Out-Null
      Copy-Item -Path (Join-Path $cli.DirectoryName '*') -Destination "$PASTA_WHISPER\Release" -Recurse -Force
    }
    if (-not $Simular) { Ok "whisper em $(AcharWhisper)" }
  }
  $arquivoModelo = Join-Path $PASTA_WHISPER "models\$MODELO"
  if ((Test-Path $arquivoModelo) -and ((Get-Item $arquivoModelo).Length -gt 500MB)) { Ok 'modelo de transcrição' }
  else {
    Faz 'baixando o modelo de transcrição (uns 550 MB, uma vez só)' {
      $parcial = "$arquivoModelo.baixando"
      Baixar $URL_MODELO $parcial
      if ((Get-Item $parcial).Length -lt 500MB) { throw 'o modelo veio incompleto: rode o instalador de novo' }
      Move-Item -Force $parcial $arquivoModelo
    }
  }

  # ── 4. Chrome (prints de página) ───────────────────────────────
  Titulo 'Navegador (prints de página)'
  $chrome = @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($chrome) { Ok 'Google Chrome' } else { Ok 'sem Chrome: a estação usa o Edge ou o Chrome do HyperFrames (tudo bem)' }

  # ── 5. O sistema (sem Git: baixa o zip do GitHub) ─────────────
  Titulo "O sistema em $Pasta"
  $pacote = Join-Path $Pasta 'package.json'
  if ((Test-Path $Pasta) -and (Get-ChildItem -Force $Pasta | Select-Object -First 1) -and -not ((Test-Path $pacote) -and ((Get-Content $pacote -Raw) -match '"name":\s*"sistema-do-criador"'))) {
    Pare "a pasta $Pasta já existe e não é do Creator System. Apague ou escolha outra (-Pasta)."
  }
  Faz 'baixando a versão mais nova do sistema' {
    $zip = Join-Path $TEMP 'sistema.zip'
    if ($ZipLocal) { Copy-Item $ZipLocal $zip } else { Baixar $ZIP_SISTEMA $zip }
    $tmp = Join-Path $TEMP 'sistema'
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $origem = Get-ChildItem -Path $tmp -Directory | Select-Object -First 1
    New-Item -ItemType Directory -Force -Path $Pasta | Out-Null
    # Espelha o código novo e mantém: as oficinas (ajustes precisam delas), as ferramentas já
    # instaladas, o node_modules e o .env.local
    & robocopy.exe $origem.FullName $Pasta /MIR /XD oficina ferramentas node_modules .git /XF .env.local /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "não consegui copiar o sistema pra $Pasta (robocopy $LASTEXITCODE)" }
  }
  Faz 'instalando o que a estação usa do npm (só o cliente do Supabase)' {
    $versao = (Get-Content $pacote -Raw | ConvertFrom-Json).dependencies.'@supabase/supabase-js'
    $dep = Join-Path $TEMP 'deps'
    New-Item -ItemType Directory -Force -Path $dep | Out-Null
    Set-Content -Path (Join-Path $dep 'package.json') -Value '{"private":true}' -Encoding Ascii
    Push-Location $dep
    try { & npm.cmd install --no-audit --no-fund --loglevel=error "@supabase/supabase-js@$versao" } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw 'o npm não conseguiu instalar o @supabase/supabase-js' }
    & robocopy.exe (Join-Path $dep 'node_modules') (Join-Path $Pasta 'node_modules') /E /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw 'não consegui copiar as dependências' }
  }
  Faz 'preparando o kit de edição (HyperFrames, GSAP e o Chrome dele: uns 300 MB, uma vez só)' {
    Push-Location $Pasta
    try { $envf = @(ArgsEnv); & node @envf scripts\estacao-edicao.mjs --preparar } finally { Pop-Location }
  }

  # ── 6. Quem edita ──────────────────────────────────────────────
  Titulo 'Quem vai editar os seus vídeos?'
  $Motor = $Motor.Trim().ToLower()
  if (@('claude', 'codex', 'openrouter') -notcontains $Motor) {
    Write-Host '    1) Claude      você tem assinatura do Claude Pro ou Max (não paga nada a mais por vídeo)'
    Write-Host '    2) ChatGPT     você tem ChatGPT Plus ou Pro (não paga nada a mais por vídeo)'
    Write-Host '    3) OpenRouter  não tem nenhum dos dois (paga por vídeo, uns R$ 10)'
    do { $r = (Read-Host '    Digite 1, 2 ou 3 e aperte Enter').Trim() } while (@('1', '2', '3') -notcontains $r)
    $Motor = @{ '1' = 'claude'; '2' = 'codex'; '3' = 'openrouter' }[$r]
  }
  Ok "quem edita: $Motor (dá pra trocar depois no painel, Editor de vídeo)"

  if ($Motor -eq 'claude' -or $Motor -eq 'openrouter') {
    # O Claude Code roda os comandos do kit pelo Git Bash
    if (TemGitBash) { Ok 'Git for Windows' }
    else {
      Faz 'instalando o Git for Windows (o Claude usa o terminal dele)' {
        if (-not (Winget 'Git.Git')) {
          $rel = Invoke-RestMethod 'https://api.github.com/repos/git-for-windows/git/releases/latest' -UseBasicParsing
          $a = $rel.assets | Where-Object { $_.name -match '^Git-.*-64-bit\.exe$' } | Select-Object -First 1
          $exe = Join-Path $TEMP $a.name
          Baixar $a.browser_download_url $exe
          Start-Process $exe -ArgumentList '/VERYSILENT /NORESTART /NOCANCEL /SP- /SUPPRESSMSGBOXES' -Wait
        }
        AtualizarPath
      }
    }
    if (AcharClaude) { Ok "Claude Code em $(AcharClaude)" }
    else {
      Faz 'instalando o Claude Code (instalador oficial da Anthropic)' {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -Command 'irm https://claude.ai/install.ps1 | iex'
        AtualizarPath
        if (-not (AcharClaude)) { throw 'o Claude Code não ficou instalado' }
      }
    }
    if ($Motor -eq 'claude') {
      $claude = AcharClaude
      $logado = $false
      if ($claude) {
        try { $st = (Nativo { & $claude auth status --json 2>$null }) -join '' | ConvertFrom-Json; $logado = [bool]$st.loggedIn -and ($st.authMethod -notmatch 'console|api') } catch {}
      }
      if ($logado) { Ok 'Claude Code logado no seu plano' }
      else {
        Info 'Agora o login: vai abrir o navegador. Entre com a conta do Claude da sua assinatura (Pro ou Max).'
        Faz 'abrindo o login do Claude' { & $claude auth login --claudeai }
      }
    } else {
      Info 'A OpenRouter não precisa de login aqui: a estação usa a chave que você colou no painel (Início, passo 2).'
    }
  }

  if ($Motor -eq 'codex') {
    if (AcharCodex) { Ok 'Codex (OpenAI)' }
    else {
      Faz 'instalando o Codex da OpenAI' {
        & npm.cmd install -g --no-audit --no-fund --loglevel=error '@openai/codex@latest'
        if (-not (AcharCodex)) { throw 'o Codex não ficou instalado' }
      }
    }
    $logado = $false
    if (AcharCodex) {
      $saida = Nativo { Codex @('login', 'status') 2>&1 | Out-String }
      $logado = ($LASTEXITCODE -eq 0 -and $saida -notmatch 'API key')
    }
    if ($logado) { Ok 'Codex logado no ChatGPT' }
    else {
      Info 'Agora o login: vai abrir o navegador. Entre com a conta do ChatGPT da sua assinatura (Plus ou Pro).'
      Faz 'abrindo o login do Codex' { Codex @('login') }
    }
    # O sandbox "elevated" (bloqueia a internet de verdade e deixa a IA tirar as fotos de conferência)
    # precisa de uma preparação com administrador, uma vez
    if (Test-Path "$HOME\.codex\.sandbox\setup_marker.json") { Ok 'sandbox do Codex preparado' }
    else {
      Info 'O Codex vai preparar o sandbox dele: se o Windows pedir permissão de administrador, clique em Sim.'
      Faz 'preparando o sandbox do Codex' {
        $vazia = Join-Path $TEMP 'sandbox'
        New-Item -ItemType Directory -Force -Path $vazia | Out-Null
        Nativo { Codex @('sandbox', '-C', $vazia, '-P', ':workspace', '-c', 'windows.sandbox=elevated', '--', 'cmd.exe', '/d', '/c', 'echo ok') | Out-Host }
        if (-not (Test-Path "$HOME\.codex\.sandbox\setup_marker.json")) { Aviso 'o sandbox ficou no modo simples: a IA edita, mas sem as fotos de conferência. Dá pra tentar de novo rodando este instalador.' }
      }
    }
  }

  # ── 7. Atalho na Área de Trabalho ─────────────────────────────
  Titulo 'Atalho "Estação de edição"'
  $mesa = if ($PastaAtalho) { $PastaAtalho } else { [Environment]::GetFolderPath('Desktop') }
  $atalho = Join-Path $mesa 'Estação de edição.lnk'
  Faz "criando o atalho em $mesa" {
    $ws = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut($atalho)
    $lnk.TargetPath = Join-Path $Pasta 'instalar\ligar-estacao.cmd'
    $lnk.WorkingDirectory = $Pasta
    $lnk.Description = 'Liga a estação de edição do Creator System'
    $lnk.IconLocation = "$env:SystemRoot\System32\imageres.dll,18"
    $lnk.Save()
  }

  # ── 8. Ligar ───────────────────────────────────────────────────
  Titulo 'Pronto!'
  Info 'Daqui pra frente, é só abrir o atalho "Estação de edição" na Área de Trabalho.'
  Info 'Pra atualizar, rode este mesmo comando de novo (o seu login continua).'
  if ($Simular) { Write-Host "    [simulação] ligaria a estação: node scripts\estacao-edicao.mjs --motor $Motor" -ForegroundColor Cyan }
  elseif (-not $NaoLigar) {
    Write-Host ''
    Info 'Ligando a estação. Na primeira vez ela pergunta o endereço do seu sistema, o seu e-mail e a senha (os mesmos do painel).'
    Push-Location $Pasta
    try { $envf = @(ArgsEnv); & node @envf scripts\estacao-edicao.mjs --motor $Motor } finally { Pop-Location }
  }
} catch {
  Write-Host ''
  Write-Host "Deu erro: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Rode o mesmo comando de novo (ele continua de onde parou). Se o erro voltar, o passo a passo manual está em editor/INSTALAR.md.'
} finally {
  if (Test-Path $TEMP) { Remove-Item -Recurse -Force $TEMP -ErrorAction SilentlyContinue }
}
