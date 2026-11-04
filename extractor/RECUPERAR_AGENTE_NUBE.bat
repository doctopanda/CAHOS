@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo CAHOS Cloud - recuperacion de tarea detenida
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RECUPERAR_AGENTE_NUBE.ps1"
if errorlevel 1 echo [CAHOS] Error. Revise el mensaje antes de reintentar.
echo.
pause
