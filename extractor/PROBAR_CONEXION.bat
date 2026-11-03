@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ===================================================
echo CAHOS - Diagnostico de lectura SINAVE
echo ===================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0comprobar_entorno.ps1"
set "CHECK_CODE=%ERRORLEVEL%"
if "%CHECK_CODE%"=="7" goto ELEGIR_EXCEL
if "%CHECK_CODE%"=="8" goto ELEGIR_EXCEL
if not "%CHECK_CODE%"=="0" goto ERROR_ENTORNO
goto CONTINUAR

:ELEGIR_EXCEL
echo.
echo [CAHOS] No esta seleccionada la conexion original. Abriremos el selector de Excel.
call "%~dp0SELECCIONAR_EXCEL.bat"
if errorlevel 1 goto ERROR_ENTORNO
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0comprobar_entorno.ps1"
if errorlevel 1 goto ERROR_ENTORNO
goto CONTINUAR

:ERROR_ENTORNO
echo [CAHOS] No podemos probar el cubo hasta configurar el libro original.
pause
exit /b 4

:CONTINUAR
echo.
set "PYTHON_EXE="
where python >nul 2>&1
if not errorlevel 1 (
  python -c "import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
  if not errorlevel 1 set "PYTHON_EXE=python"
)
if not defined PYTHON_EXE (
  where py >nul 2>&1
  if not errorlevel 1 (
    py -3 -c "import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)" >nul 2>&1
    if not errorlevel 1 set "PYTHON_EXE=py -3"
  )
)
if not defined PYTHON_EXE (
  echo [PYTHON] No se encontro Python 3.10 o posterior.
  echo Instale Python para Windows y reabra esta ventana.
  echo https://www.python.org/downloads/windows/
  pause
  exit /b 3
)
echo [PYTHON] Disponible: %PYTHON_EXE%
%PYTHON_EXE% probar_conexion.py
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo [CAHOS] La conexion NO esta validada. Revise mensajes anteriores.
pause
exit /b %EXIT_CODE%
