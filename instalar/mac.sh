#!/bin/bash
# Instalador da estação de edição do Creator System (macOS, Apple Silicon ou Intel).
#
# Abra o Terminal (⌘ + espaço, digite Terminal) e cole esta linha:
#   curl -fsSL https://raw.githubusercontent.com/eulucasduty/sistema-do-criador/main/instalar/mac.sh | bash
#
# Ele instala o que falta (Homebrew, Node.js, ffmpeg-full, whisper.cpp e o modelo de transcrição),
# baixa o sistema em ~/CreatorSystem (sem precisar de Git), pergunta quem edita os vídeos
# (Claude, ChatGPT ou OpenRouter), instala e abre o login dessa IA, cria o atalho
# "Estação de edição" na Mesa e liga a estação.
# Rodar de novo = atualizar: baixa a versão nova e mantém o seu login, as edições e o .env.local.
#
# Teste sem instalar nada (só mostra o que faria):
#   curl -fsSL <o endereço acima> | SIMULAR=1 bash      ou      bash mac.sh --simular
# Opções: --motor claude|codex|openrouter (não pergunta) · --pasta <onde instalar> · --nao-ligar

set -uo pipefail

REPO="eulucasduty/sistema-do-criador"
RAMO="main"
ZIP_SISTEMA="https://github.com/$REPO/archive/refs/heads/$RAMO.zip"
MODELO="ggml-large-v3-turbo-q5_0.bin"
URL_MODELO="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODELO"
PASTA="$HOME/CreatorSystem"
MOTOR=""
LIGAR=1
SIMULAR="${SIMULAR:-0}"
ZIP_LOCAL=""

# ── jeito de falar ──────────────────────────────────────────────────
titulo() { printf '\n\033[33m==> %s\033[0m\n' "$1"; }
ok() { printf '    \033[32mok:\033[0m %s\n' "$1"; }
info() { printf '    %s\n' "$1"; }
aviso() { printf '    \033[33matenção:\033[0m %s\n' "$1"; }
pare() {
  printf '\n\033[31mParei: %s\033[0m\n' "$1"
  echo "Rode o mesmo comando de novo (ele continua de onde parou). Se o erro voltar, o passo a passo manual está em editor/INSTALAR.md."
  exit 1
}
# Tudo que muda alguma coisa no Mac passa por aqui (no modo simulação só mostra)
faz() {
  local descricao="$1"
  shift
  if [ "$SIMULAR" = "1" ]; then
    printf '    \033[36m[simulação]\033[0m %s\n' "$descricao"
    return 0
  fi
  info "$descricao..."
  "$@" || pare "$descricao: deu erro"
}
# Pergunta no teclado mesmo com o script vindo pelo "curl | bash" (a entrada normal é o próprio script)
perguntar() {
  local resposta=""
  if [ -r /dev/tty ]; then read -r -p "$1" resposta </dev/tty || true; else read -r -p "$1" resposta || true; fi
  printf '%s' "$resposta"
}
tem() { command -v "$1" >/dev/null 2>&1; }
tamanho() { wc -c <"$1" 2>/dev/null | tr -d ' ' || echo 0; }
entrada_do_teclado() { if [ -r /dev/tty ]; then echo /dev/tty; else echo /dev/null; fi; }

# ── Homebrew (Apple Silicon: /opt/homebrew · Intel: /usr/local) ─────
achar_brew() {
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && { echo "$b"; return 0; }; done
  return 1
}
carregar_brew() {
  local b
  b="$(achar_brew)" || return 0
  eval "$("$b" shellenv)"
  # Terminais novos também acham o brew
  if ! grep -qs "brew shellenv" "$HOME/.zprofile"; then echo "eval \"\$($b shellenv)\"" >>"$HOME/.zprofile"; fi
}
instalar_brew() {
  NONINTERACTIVE="" /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" <"$(entrada_do_teclado)"
}

versao_node() { tem node && node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }
ffmpeg_full() { for f in /opt/homebrew/opt/ffmpeg-full/bin/ffmpeg /usr/local/opt/ffmpeg-full/bin/ffmpeg; do [ -x "$f" ] && { echo "$f"; return 0; }; done; return 1; }
achar_whisper() {
  for w in /opt/homebrew/bin/whisper-cli /usr/local/bin/whisper-cli; do [ -x "$w" ] && { echo "$w"; return 0; }; done
  command -v whisper-cli 2>/dev/null
}
achar_claude() {
  for c in "$HOME/.local/bin/claude" /opt/homebrew/bin/claude /usr/local/bin/claude; do [ -x "$c" ] && { echo "$c"; return 0; }; done
  command -v claude 2>/dev/null
}
achar_codex() {
  for c in /opt/homebrew/bin/codex /usr/local/bin/codex "$HOME/.local/bin/codex"; do [ -x "$c" ] && { echo "$c"; return 0; }; done
  command -v codex 2>/dev/null
}

baixar_modelo() {
  mkdir -p "$HOME/whisper-cpp/models"
  local destino="$HOME/whisper-cpp/models/$MODELO"
  curl -L --fail --retry 3 --progress-bar -o "$destino.baixando" "$URL_MODELO" || return 1
  [ "$(tamanho "$destino.baixando")" -gt 500000000 ] || { echo "o modelo veio incompleto"; return 1; }
  mv -f "$destino.baixando" "$destino"
}

baixar_sistema() {
  local tmp zip origem
  tmp="$(mktemp -d)"
  zip="$tmp/sistema.zip"
  if [ -n "$ZIP_LOCAL" ]; then cp "$ZIP_LOCAL" "$zip"; else curl -L --fail --retry 3 -o "$zip" "$ZIP_SISTEMA" || return 1; fi
  unzip -q "$zip" -d "$tmp/x" || return 1
  origem="$(find "$tmp/x" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  [ -f "$origem/package.json" ] || { echo "o zip do sistema veio estranho"; return 1; }
  mkdir -p "$PASTA"
  # Espelha o código novo e mantém: as oficinas (os ajustes precisam delas), as ferramentas já
  # instaladas, o node_modules e o .env.local
  rsync -a --delete --exclude 'editor/oficina/' --exclude 'editor/ferramentas/' --exclude 'node_modules/' --exclude '.env.local' "$origem/" "$PASTA/" || return 1
  rm -rf "$tmp"
}

instalar_dependencias() {
  local versao tmp
  versao="$(node -p "require('$PASTA/package.json').dependencies['@supabase/supabase-js']")" || return 1
  tmp="$(mktemp -d)"
  echo '{"private":true}' >"$tmp/package.json"
  (cd "$tmp" && npm install --no-audit --no-fund --loglevel=error "@supabase/supabase-js@$versao") || return 1
  mkdir -p "$PASTA/node_modules"
  rsync -a "$tmp/node_modules/" "$PASTA/node_modules/" || return 1
  rm -rf "$tmp"
}

# Os logins abrem o navegador e esperam: a entrada vem do teclado (não do "curl | bash")
login_claude() { "$(achar_claude)" auth login --claudeai <"$(entrada_do_teclado)"; }
login_codex() { "$(achar_codex)" login <"$(entrada_do_teclado)"; }
instalar_claude() { curl -fsSL https://claude.ai/install.sh | bash; }
claude_logado() {
  local c
  c="$(achar_claude)" || return 1
  "$c" auth status --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",(d)=>(s+=d)).on("end",()=>{try{const j=JSON.parse(s);process.exit(j.loggedIn&&!/console|api/i.test(j.authMethod||"")?0:1)}catch{process.exit(1)}})'
}
codex_logado() {
  local c saida
  c="$(achar_codex)" || return 1
  saida="$("$c" login status 2>&1)" || return 1
  ! printf '%s' "$saida" | grep -qi "api key"
}

args_env() { [ -f "$PASTA/.env.local" ] && echo "--env-file=.env.local"; return 0; }
preparar_kit() { (cd "$PASTA" && node $(args_env) scripts/estacao-edicao.mjs --preparar); }

criar_atalho() {
  local mesa="$HOME/Desktop"
  mkdir -p "$mesa"
  local atalho="$mesa/Estação de edição.command"
  cat >"$atalho" <<EOF
#!/bin/bash
# Liga a estação de edição do Creator System (criado pelo instalar/mac.sh)
exec bash "$PASTA/instalar/ligar-estacao.command"
EOF
  chmod +x "$atalho"
}

main() {
  while [ $# -gt 0 ]; do
    case "$1" in
      --simular) SIMULAR=1 ;;
      --motor) MOTOR="${2:-}"; shift ;;
      --pasta) PASTA="${2:-}"; shift ;;
      --nao-ligar) LIGAR=0 ;;
      --zip-local) ZIP_LOCAL="${2:-}"; shift ;;
    esac
    shift
  done

  echo
  printf '\033[33mEstação de edição do Creator System: instalação\033[0m\n'
  [ "$SIMULAR" = "1" ] && printf '\033[36m(modo simulação: nada vai ser instalado nem baixado)\033[0m\n'
  echo "Pasta do sistema: $PASTA"
  if [ "$(uname -s)" != "Darwin" ]; then
    if [ "$SIMULAR" = "1" ]; then aviso "isto não é um Mac: seguindo só porque é simulação"; else pare "este instalador é pro Mac (no Windows, use o windows.ps1)."; fi
  fi

  # ── 1. Homebrew ─────────────────────────────────────────────────
  titulo "Homebrew (o instalador de programas do Mac)"
  carregar_brew
  if achar_brew >/dev/null; then ok "Homebrew"
  else
    info "Vai pedir a senha do seu Mac (a de entrar no computador) e pra apertar Enter. É normal."
    faz "instalando o Homebrew" instalar_brew
    [ "$SIMULAR" = "1" ] || carregar_brew
  fi

  # ── 2. Node.js ─────────────────────────────────────────────────
  titulo "Node.js (roda a estação)"
  if [ "$(versao_node)" -ge 22 ]; then ok "Node.js $(node -v)"
  else faz "instalando o Node.js" brew install node; fi

  # ── 3. ffmpeg-full ─────────────────────────────────────────────
  titulo "ffmpeg completo (cor, HDR do iPhone, som, cortes)"
  if ffmpeg_full >/dev/null; then ok "ffmpeg-full"
  else faz "instalando o ffmpeg-full (o ffmpeg comum vem sem partes que a estação usa)" brew install ffmpeg-full; fi

  # ── 4. whisper.cpp + modelo ────────────────────────────────────
  titulo "whisper.cpp (transcreve a sua fala, no seu Mac)"
  if achar_whisper >/dev/null; then ok "whisper em $(achar_whisper)"
  else faz "instalando o whisper.cpp" brew install whisper.cpp; fi
  if [ -f "$HOME/whisper-cpp/models/$MODELO" ] && [ "$(tamanho "$HOME/whisper-cpp/models/$MODELO")" -gt 500000000 ]; then ok "modelo de transcrição"
  else faz "baixando o modelo de transcrição (uns 550 MB, uma vez só)" baixar_modelo; fi

  # ── 5. Chrome ──────────────────────────────────────────────────
  titulo "Navegador (prints de página)"
  if [ -d "/Applications/Google Chrome.app" ] || [ -d "$HOME/Applications/Google Chrome.app" ]; then ok "Google Chrome"
  else ok "sem Chrome: a estação usa o Chrome do HyperFrames (tudo bem)"; fi

  # ── 6. O sistema (sem Git: baixa o zip do GitHub) ─────────────
  titulo "O sistema em $PASTA"
  if [ -d "$PASTA" ] && [ -n "$(ls -A "$PASTA" 2>/dev/null)" ] && ! grep -qs '"name": *"sistema-do-criador"' "$PASTA/package.json"; then
    pare "a pasta $PASTA já existe e não é do Creator System. Apague ou escolha outra (--pasta)."
  fi
  faz "baixando a versão mais nova do sistema" baixar_sistema
  faz "instalando o que a estação usa do npm (só o cliente do Supabase)" instalar_dependencias
  faz "preparando o kit de edição (HyperFrames, GSAP e o Chrome dele: uns 300 MB, uma vez só)" preparar_kit

  # ── 7. Quem edita ──────────────────────────────────────────────
  titulo "Quem vai editar os seus vídeos?"
  MOTOR="$(echo "$MOTOR" | tr '[:upper:]' '[:lower:]')"
  if [ "$MOTOR" != "claude" ] && [ "$MOTOR" != "codex" ] && [ "$MOTOR" != "openrouter" ]; then
    info "1) Claude      você tem assinatura do Claude Pro ou Max (não paga nada a mais por vídeo)"
    info "2) ChatGPT     você tem ChatGPT Plus ou Pro (não paga nada a mais por vídeo)"
    info "3) OpenRouter  não tem nenhum dos dois (paga por vídeo, uns R\$ 10)"
    local r=""
    while [ "$r" != "1" ] && [ "$r" != "2" ] && [ "$r" != "3" ]; do r="$(perguntar "    Digite 1, 2 ou 3 e aperte Enter: ")"; done
    case "$r" in 1) MOTOR=claude ;; 2) MOTOR=codex ;; 3) MOTOR=openrouter ;; esac
  fi
  ok "quem edita: $MOTOR (dá pra trocar depois no painel, Editor de vídeo)"

  if [ "$MOTOR" = "claude" ] || [ "$MOTOR" = "openrouter" ]; then
    if achar_claude >/dev/null; then ok "Claude Code em $(achar_claude)"
    else
      faz "instalando o Claude Code (instalador oficial da Anthropic)" instalar_claude
      export PATH="$HOME/.local/bin:$PATH"
    fi
    if [ "$MOTOR" = "claude" ]; then
      if claude_logado; then ok "Claude Code logado no seu plano"
      else
        info "Agora o login: vai abrir o navegador. Entre com a conta do Claude da sua assinatura (Pro ou Max)."
        faz "abrindo o login do Claude" login_claude
      fi
    else
      info "A OpenRouter não precisa de login aqui: a estação usa a chave que você colou no painel (Início, passo 2)."
    fi
  fi

  if [ "$MOTOR" = "codex" ]; then
    if achar_codex >/dev/null; then ok "Codex (OpenAI)"
    else faz "instalando o Codex da OpenAI" npm install -g --no-audit --no-fund --loglevel=error @openai/codex@latest; fi
    if codex_logado; then ok "Codex logado no ChatGPT"
    else
      info "Agora o login: vai abrir o navegador. Entre com a conta do ChatGPT da sua assinatura (Plus ou Pro)."
      faz "abrindo o login do Codex" login_codex
    fi
  fi

  # ── 8. Atalho na Mesa ──────────────────────────────────────────
  titulo "Atalho \"Estação de edição\""
  faz "criando o atalho na Mesa (Desktop)" criar_atalho

  # ── 9. Ligar ───────────────────────────────────────────────────
  titulo "Pronto!"
  info "Daqui pra frente, é só abrir \"Estação de edição\" na Mesa (dois cliques)."
  info "Pra atualizar, rode este mesmo comando de novo (o seu login continua)."
  if [ "$SIMULAR" = "1" ]; then
    printf '    \033[36m[simulação]\033[0m ligaria a estação: node scripts/estacao-edicao.mjs --motor %s\n' "$MOTOR"
  elif [ "$LIGAR" = "1" ]; then
    echo
    info "Ligando a estação. Na primeira vez ela pergunta o endereço do seu sistema, o seu e-mail e a senha (os mesmos do painel)."
    cd "$PASTA" && node $(args_env) scripts/estacao-edicao.mjs --motor "$MOTOR" <"$(entrada_do_teclado)"
  fi
}

# Tudo dentro de main: o bash lê o script inteiro antes de começar (importante no "curl | bash")
main "$@"
