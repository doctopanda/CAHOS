@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo CAHOS - Importar una sola vez los denominadores municipales COESPO/CONAPO
where python >nul 2>&1
if errorlevel 1 (
 echo Python no encontrado; use el instalador de Windows.
 pause
 exit /b 3
)
python importar_poblacion.py
pause
