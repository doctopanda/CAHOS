@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo CAHOS 0.6.2 - Reparacion de ventanas automaticas
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0REPARAR_CAHOS.ps1"
if errorlevel 1 echo ERROR: no se completo la reparacion. Copie este mensaje.
pause
