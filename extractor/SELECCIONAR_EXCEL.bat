@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -STA -ExecutionPolicy Bypass -File "%~dp0CONFIGURAR_ORIGEN_EXCEL.ps1"
if errorlevel 1 (
  echo No se configuro el libro de Excel.
  pause
  exit /b 1
)
echo.
echo Ruta del libro configurada. Ejecuta PROBAR_CONEXION.bat.
pause
