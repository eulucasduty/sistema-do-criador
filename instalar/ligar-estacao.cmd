@echo off
rem Liga a estacao de edicao do Creator System.
rem O atalho "Estacao de edicao" da Area de Trabalho (criado pelo instalar\windows.ps1) abre este arquivo.
title Estacao de edicao
chcp 65001 >nul
cd /d "%~dp0.."
rem Onde os instaladores costumam por o Node, o ffmpeg, o Git, o Claude Code e o Codex
set "PATH=%PATH%;%ProgramFiles%\nodejs;%LOCALAPPDATA%\Microsoft\WinGet\Links;%USERPROFILE%\.local\bin;%APPDATA%\npm;%ProgramFiles%\Git\cmd;%USERPROFILE%\ffmpeg\bin"
rem O .env.local (modo avancado) so entra se existir
set "ARQENV="
if exist ".env.local" set "ARQENV=--env-file=.env.local"
node %ARQENV% scripts\estacao-edicao.mjs %*
echo.
echo A estacao parou. Se foi erro, a mensagem esta logo acima.
pause
