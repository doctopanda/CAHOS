# CAHOS Cloud: independent, read-only probe for the real installed Python state path.
# Never prints token, entire command line, Excel connection strings or private data.
$ErrorActionPreference='Stop'
$task=Get-ScheduledTask -TaskName 'CAHOS-CLOUD-AGENT' -ErrorAction Stop
$action=@($task.Actions) | Select-Object -First 1
$dir=[string]$action.WorkingDirectory
if(-not $dir -or -not (Test-Path -LiteralPath $dir -PathType Container)){
 throw 'No se encontro carpeta del agente en la tarea programada.'
}
$installed=Join-Path $dir 'agente_nube.py'
$probe=Join-Path $PSScriptRoot 'PROBAR_RUTA_ESTADO.py'
if(-not (Test-Path -LiteralPath $installed -PathType Leaf)){throw 'No se encontro agente_nube.py instalado.'}
if(-not (Test-Path -LiteralPath $probe -PathType Leaf)){throw 'Descargue la carpeta extractor completa.'}
$command=Get-Command python -ErrorAction SilentlyContinue
if($command -and $command.Source -and (Test-Path -LiteralPath $command.Source -PathType Leaf)){
 $consolePython=[string]$command.Source
} else {
 $program=[string]$action.Execute
 if(-not $program){throw 'No hay intérprete Python en la tarea'}
 $candidate=$program -replace 'pythonw(\d*(?:\.\d+)?)\.exe$','python$1.exe'
 if(-not (Test-Path -LiteralPath $candidate -PathType Leaf)){
  throw 'No se encontro python.exe de consola para la prueba.'
 }
 $consolePython=$candidate
}
Write-Host '[CAHOS] Prueba de archivo de estado sin detener el agente.' -ForegroundColor Cyan
& $consolePython -B $probe $installed
if($LASTEXITCODE -ne 0){throw 'La prueba Python devolvio un error. Comparta solo los codigos de la salida.'}
Write-Host '[CAHOS] Agente activo sin cambios; Excel y token intactos.' -ForegroundColor Green
