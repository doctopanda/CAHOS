# Registra el extractor para que se inicie al entrar el mismo usuario a Windows.
# El servicio escuchara SOLAMENTE en 127.0.0.1:8789; no habilita acceso externo.
$ErrorActionPreference='Stop'
$python = (Get-Command python -ErrorAction Stop).Source
$script = Join-Path $PSScriptRoot 'servidor.py'
$action = New-ScheduledTaskAction -Execute $python -Argument ('"' + $script + '"') -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'CAHOS-SUIVE-Extractor' -Action $action -Trigger $trigger -Principal $principal -Description 'Lectura SINAVE para CAHOS, solo equipo local' -Force | Out-Null
Write-Host 'Tarea creada: CAHOS-SUIVE-Extractor (al iniciar sesion).' -ForegroundColor Green
Write-Host 'Para iniciar ya: ejecute INICIAR_EXTRACTOR.bat.'
