@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
if exist "%~dp0DIAGNOSTICAR_AGENTE_NUBE.ps1" (
 powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0DIAGNOSTICAR_AGENTE_NUBE.ps1"
) else (
 echo Estado local del agente CAHOS:
 if exist "%LOCALAPPDATA%\CAHOS\cloud_agent_status.json" (
  type "%LOCALAPPDATA%\CAHOS\cloud_agent_status.json"
 ) else (
  echo No hay archivo de estado en este perfil Windows.
 )
 powershell.exe -NoProfile -Command "Get-ScheduledTask -TaskName 'CAHOS-CLOUD-AGENT' -ErrorAction SilentlyContinue | Select-Object TaskName,State"
)
pause
