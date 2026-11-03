@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo CAHOS - Servicio local de extraccion OLAP
py -3 servidor.py
if errorlevel 1 python servidor.py
pause
