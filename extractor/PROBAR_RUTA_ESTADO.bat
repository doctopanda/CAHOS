@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ==============================================
echo  CAHOS | PROBAR RUTA DE ESTADO SIN REINICIAR
echo ==============================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0PROBAR_RUTA_ESTADO.ps1"
if errorlevel 1 echo [CAHOS] No se completo la prueba; copie solo el error mostrado.
pause
