@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0DETENER_CAHOS.ps1"
echo.
echo CAHOS detenido. Los datos originales quedan intactos.
pause
