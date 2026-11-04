@echo off
chcp 65001 >nul
echo Estado local del agente CAHOS:
if exist "%LOCALAPPDATA%\CAHOS\cloud_agent_status.json" (
 type "%LOCALAPPDATA%\CAHOS\cloud_agent_status.json"
) else (
 echo El agente todavia no reporta estado. Revise el Programador de tareas.
)
echo.
powershell.exe -NoProfile -Command "Get-ScheduledTask -TaskName 'CAHOS-CLOUD-AGENT' -ErrorAction SilentlyContinue | Select-Object TaskName,State"
pause
