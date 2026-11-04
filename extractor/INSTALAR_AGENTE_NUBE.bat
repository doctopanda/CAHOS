@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo CAHOS CLOUD - Instalacion de agente unico
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0INSTALAR_AGENTE_NUBE.ps1"
if errorlevel 1 echo [CAHOS] Instalacion no completada. Revise el mensaje anterior.
pause
