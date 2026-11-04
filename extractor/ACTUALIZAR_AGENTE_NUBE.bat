@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ==============================================
echo  CAHOS CLOUD - ACTUALIZAR AGENTE SIN REINSTALAR
echo ==============================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ACTUALIZAR_AGENTE_NUBE.ps1"
if errorlevel 1 echo [CAHOS] No se pudo completar. Revise el error mostrado.
pause
