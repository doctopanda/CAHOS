@echo off
setlocal
chcp 65001 >nul
set "CAHOSAPP=%LOCALAPPDATA%\CAHOS\app"
if not exist "%CAHOSAPP%\ARRANQUE_AUTOMATICO.ps1" (
  echo No esta instalado CAHOS. Ejecute INSTALAR_CAHOS.bat una sola vez.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CAHOSAPP%\ARRANQUE_AUTOMATICO.ps1"
if errorlevel 1 (
  echo CAHOS no pudo iniciar. Revise Python o un servicio previo en el puerto 8789.
  pause
  exit /b 2
)
start "" "http://127.0.0.1:8789"
