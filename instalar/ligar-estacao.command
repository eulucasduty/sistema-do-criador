#!/bin/bash
# Liga a estação de edição do Sistema do Criador (Mac).
# O atalho "Estação de edição" da Mesa (criado pelo instalar/mac.sh) abre este arquivo.
cd "$(dirname "$0")/.." || exit 1
# Homebrew (Apple Silicon ou Intel) e o Claude Code do instalador oficial
if [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"; elif [ -x /usr/local/bin/brew ]; then eval "$(/usr/local/bin/brew shellenv)"; fi
export PATH="$HOME/.local/bin:$PATH"
# O .env.local (modo avançado) só entra se existir
if [ -f .env.local ]; then node --env-file=.env.local scripts/estacao-edicao.mjs "$@"; else node scripts/estacao-edicao.mjs "$@"; fi
echo
echo "A estação parou. Se foi erro, a mensagem está logo acima. Pode fechar esta janela."
