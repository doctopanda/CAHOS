@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo CAHOS - Comprobacion de acceso de solo lectura
py -3 probar_conexion.py
if errorlevel 1 python probar_conexion.py
pause
