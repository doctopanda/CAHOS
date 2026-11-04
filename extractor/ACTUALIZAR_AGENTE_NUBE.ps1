# CAHOS Cloud | Actualiza el agente y el lector OLAP locales, sin reinstalar ni cambiar token.
# Cerrar tarea antigua, copiar Python corregido y reiniciar la misma tarea.
$ErrorActionPreference='Stop'
$taskName='CAHOS-CLOUD-AGENT'
$task=Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
$app=Join-Path (Join-Path $env:LOCALAPPDATA 'CAHOS') 'cloud'
$src=Join-Path $PSScriptRoot 'agente_nube.py'
$dest=Join-Path $app 'agente_nube.py'
$serverSource=Join-Path $PSScriptRoot 'servidor.py'
$serverTarget=Join-Path $app 'servidor.py'
$bridgeSource=Join-Path $PSScriptRoot 'puente_agente_nube.py'
$bridgeTarget=Join-Path $app 'puente_agente_nube.py'
$token=Join-Path (Split-Path -Parent $app) 'cloud_agent_token.txt'
$state=Join-Path (Split-Path -Parent $app) 'cloud_agent_status.json'
# The Microsoft Store Python package may virtualize files written under LocalAppData.
$storePath=Join-Path $env:LOCALAPPDATA 'Packages\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\LocalCache\Local\CAHOS\cloud_agent_status.json'
if(-not(Test-Path -LiteralPath $src -PathType Leaf)){throw 'Falta agente_nube.py en la carpeta descargada.'}
if(-not(Test-Path -LiteralPath $dest -PathType Leaf)){throw 'No hay agente instalado en LOCALAPPDATA. No se realizo ningun cambio.'}
if(-not(Test-Path -LiteralPath $serverSource -PathType Leaf)){throw 'Falta servidor.py en la descarga.'}
if(-not(Test-Path -LiteralPath $serverTarget -PathType Leaf)){throw 'No hay modulo OLAP instalado.'}
if(-not(Test-Path -LiteralPath $bridgeSource -PathType Leaf)){throw 'Falta puente_agente_nube.py en la descarga.'}
if(-not(Test-Path -LiteralPath $bridgeTarget -PathType Leaf)){throw 'No existe el puente local instalado.'}
if(-not(Test-Path -LiteralPath $token -PathType Leaf)){throw 'No existe un token local. No se modifico la configuracion.'}
$action=@($task.Actions)|Select-Object -First 1
if(-not([string]$action.Arguments -match 'agente_nube\.py') -or
   -not([string]$action.WorkingDirectory -ieq $app)){
  throw 'La tarea no coincide con la instalacion esperada. No se modificaran procesos.'
}
Write-Host '[CAHOS] Actualizacion segura del agente. Token y Excel intactos.' -ForegroundColor Cyan
if($task.State -eq 'Running'){
 Stop-ScheduledTask -TaskName $taskName -ErrorAction Stop
 for($i=0;$i -lt 25;$i++){
  Start-Sleep -Milliseconds 250
  $task=Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
  if($task.State -ne 'Running'){break}
 }
 if($task.State -eq 'Running'){throw 'La tarea no se detuvo. No se reemplazo ningun archivo.'}
}
$backup=Join-Path $app 'agente_nube.py.previous'
$serverBackup=Join-Path $app 'servidor.py.previous'
$bridgeBackup=Join-Path $app 'puente_agente_nube.py.previous'
Copy-Item -LiteralPath $dest -Destination $backup -Force
Copy-Item -LiteralPath $serverTarget -Destination $serverBackup -Force
Copy-Item -LiteralPath $bridgeTarget -Destination $bridgeBackup -Force
Copy-Item -LiteralPath $src -Destination $dest -Force
Copy-Item -LiteralPath $serverSource -Destination $serverTarget -Force
Copy-Item -LiteralPath $bridgeSource -Destination $bridgeTarget -Force
try{
 Start-ScheduledTask -TaskName $taskName -ErrorAction Stop
} catch {
 Copy-Item -LiteralPath $backup -Destination $dest -Force
 Copy-Item -LiteralPath $serverBackup -Destination $serverTarget -Force
 Copy-Item -LiteralPath $bridgeBackup -Destination $bridgeTarget -Force
 throw 'El reinicio fallo. Se restauraron las versiones anteriores; revise el Programador.'
}
$ready=$false
for($i=0;$i -lt 20;$i++){
 Start-Sleep -Milliseconds 500
 if(Test-Path -LiteralPath $state -PathType Leaf){$ready=$true;break}
 if(Test-Path -LiteralPath $storePath -PathType Leaf){$state=$storePath;$ready=$true;break}
}
if($ready){
 try{
  $current=Get-Content -LiteralPath $state -Raw -Encoding UTF8|ConvertFrom-Json
  Write-Host ('[CAHOS] Estado local: '+[string]$current.status+' / '+[string]$current.detail) -ForegroundColor Green
 } catch {Write-Host '[CAHOS] Estado creado, pero no se pudo leer.' -ForegroundColor Yellow}
}else{
 Write-Host '[CAHOS] La tarea reinició, pero aun no se registra archivo de estado. Use DIAGNOSTICAR_AGENTE_NUBE.bat.' -ForegroundColor Yellow
}
Write-Host '[CAHOS] La actualización no tocó claves, archivos Excel ni credenciales.'
