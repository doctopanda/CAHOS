@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo CAHOS - Servicio local OLAP
if exist "%LOCALAPPDATA%\CAHOS\app\ARRANQUE_AUTOMATICO.ps1" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\CAHOS\app\ARRANQUE_AUTOMATICO.ps1"
  if errorlevel 1 (
    echo CAHOS no pudo iniciar. Si otra version sigue abierta, cierrala y reintenta.
    pause
    exit /b 1
  )
  start "" "http://127.0.0.1:8789"
  exit /b 0
)
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
  echo No se encontro Python 3.10 o posterior.
  echo https://www.python.org/downloads/windows/
  pause
  exit /b 3
)
%PYTHON_EXE% servidor.py
pause
