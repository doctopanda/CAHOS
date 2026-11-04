@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0DETENER_AGENTE_NUBE.ps1"
pause
