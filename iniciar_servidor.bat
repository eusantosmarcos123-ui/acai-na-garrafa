@echo off
title Servidor Acai na Garrafa - SQLite
cd /d "%~dp0"
echo ===================================================
echo   INICIANDO SERVIDOR ACAI NA GARRAFA (SQLITE)
echo ===================================================
echo.
echo Abrindo em http://localhost:3000 ...
start http://localhost:3000
node server.js
pause
