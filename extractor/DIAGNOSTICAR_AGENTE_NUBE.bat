@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0DIAGNOSTICAR_AGENTE_NUBE.ps1"
echo.
echo CAHOS: copie solo los estados del diagnostico, nunca tokens o contrasenas.
pause
