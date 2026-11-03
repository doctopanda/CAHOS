@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo CAHOS - Configuracion inicial y arranque automatico
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0INSTALAR_CAHOS.ps1"
if errorlevel 1 echo [CAHOS] No se completo la instalacion. Revise el mensaje anterior.
pause
