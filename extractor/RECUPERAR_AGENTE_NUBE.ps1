# CAHOS Cloud: recuperacion segura de un agente Windows que se ha detenido.
# PowerShell 5.1. Sin lectura ni visualizacion de credenciales.
$ErrorActionPreference='Stop'
$name='CAHOS-CLOUD-AGENT'
$base=Join-Path $env:LOCALAPPDATA 'CAHOS'
$app=Join-Path $base 'cloud'
$source=Join-Path $PSScriptRoot 'agente_nube.py'
$installed=Join-Path $app 'agente_nube.py'
$token=Join-Path $base 'cloud_agent_token.txt'
$status=Join-Path $base 'cloud_agent_status.json'
$log=Join-Path $base 'cloud_agent_diagnostic.log'

Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' CAHOS CLOUD | RECUPERAR AGENTE DETENIDO' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
$task=Get-ScheduledTask -TaskName $name -ErrorAction Stop
$info=Get-ScheduledTaskInfo -TaskName $name -ErrorAction Stop
Write-Host ('[ANTES] Tarea: '+$task.State+'; resultado: '+$info.LastTaskResult+
 (' (0x{0:X8})' -f ([uint32]$info.LastTaskResult)))
Write-Host ('[ANTES] Limite: '+[string]$task.Settings.ExecutionTimeLimit)
Write-Host ('[ANTES] Detener con bateria: '+[string]$task.Settings.StopIfGoingOnBatteries)
Write-Host ('[ANTES] Requiere red: '+[string]$task.Settings.RunOnlyIfNetworkAvailable)
Write-Host ('[ANTES] Requiere inactividad: '+[string]$task.Settings.RunOnlyIfIdle)
Write-Host ('[ANTES] Reinicios: '+[string]$task.Settings.RestartCount)

# Last Task Scheduler events may identify power/idle/network stops.
try {
 $events=@(Get-WinEvent -FilterHashtable @{
   LogName='Microsoft-Windows-TaskScheduler/Operational'
   StartTime=(Get-Date).AddHours(-4)
 } -MaxEvents 250 -ErrorAction Stop | Where-Object {
   [string]$_.Message -like '*CAHOS-CLOUD-AGENT*'
 } | Select-Object -First 6)
 if($events.Count -gt 0){
  foreach($event in $events){
   $summary=([string]$event.Message -replace '[\r\n]+',' ')
   if($summary.Length -gt 260){$summary=$summary.Substring(0,260)}
   Write-Host ('[HISTORIAL] '+$event.TimeCreated+' ID '+$event.Id+': '+$summary)
  }
 }else{Write-Host '[HISTORIAL] Sin eventos recientes asociados al agente.'}
}catch{
 Write-Host '[HISTORIAL] No disponible. Puede habilitarse desde Programador de tareas.' -ForegroundColor Yellow
}

if(-not(Test-Path -LiteralPath $source -PathType Leaf)){throw 'Falta agente_nube.py en esta descarga.'}
if(-not(Test-Path -LiteralPath $installed -PathType Leaf)){throw 'No se encontro el agente instalado.'}
if(-not(Test-Path -LiteralPath $token -PathType Leaf)){throw 'No se encontro vinculacion local. El token no se modificara.'}
$action=@($task.Actions)|Select-Object -First 1
if(-not $action -or [string]$action.WorkingDirectory -ine $app -or
 [string]$action.Arguments -notmatch 'agente_nube\.py'){
 throw 'La tarea no corresponde al agente esperado. Sin cambios.'
}
if($task.State -eq 'Running'){
 Write-Host '[CAHOS] La tarea esta activa. No se interrumpira ni modificara.' -ForegroundColor Yellow
 return
}
# Copia segura del codigo y configuracion de tarea (sin el token).
$xml=Join-Path $app 'CAHOS-CLOUD-AGENT.before-repair.xml'
$oldAgent=Join-Path $app 'agente_nube.py.before-repair'
Export-ScheduledTask -TaskName $name -ErrorAction Stop |
 Set-Content -LiteralPath $xml -Encoding UTF8
Copy-Item -LiteralPath $installed -Destination $oldAgent -Force
Copy-Item -LiteralPath $source -Destination $installed -Force
try {
 # Es un proceso permanente. Evitar detenciones por cambio de red, bateria o inactividad.
 $settingsArgs=@{
   ExecutionTimeLimit=[TimeSpan]::Zero
   MultipleInstances='IgnoreNew'
   StartWhenAvailable=$true
   RestartCount=3
   RestartInterval=(New-TimeSpan -Minutes 1)
   AllowStartIfOnBatteries=$true
   DontStopIfGoingOnBatteries=$true
   DontStopOnIdleEnd=$true
 }
 $settings=New-ScheduledTaskSettingsSet @settingsArgs
 Set-ScheduledTask -TaskName $name -Settings $settings -ErrorAction Stop | Out-Null
 Start-ScheduledTask -TaskName $name -ErrorAction Stop
} catch {
 Copy-Item -LiteralPath $oldAgent -Destination $installed -Force
 Write-Host '[CAHOS] Error al recuperar. Codigo Python anterior restaurado.' -ForegroundColor Red
 Write-Host ('[CAHOS] Copia de tarea anterior: '+$xml)
 throw
}
Start-Sleep -Seconds 3
$task=Get-ScheduledTask -TaskName $name -ErrorAction Stop
Write-Host ('[DESPUES] Estado: '+$task.State) -ForegroundColor Green
Write-Host ('[DESPUES] Reinicios: '+$task.Settings.RestartCount)
Write-Host ('[DESPUES] Limite: '+$task.Settings.ExecutionTimeLimit)
if(Test-Path -LiteralPath $status){
 try{
  $obj=Get-Content -LiteralPath $status -Raw -Encoding UTF8|ConvertFrom-Json
  Write-Host ('[ESTADO LOCAL] '+[string]$obj.status+'; UTC: '+[string]$obj.at)
 }catch{Write-Host '[ESTADO LOCAL] JSON ilegible' -ForegroundColor Yellow}
}else{Write-Host '[ESTADO LOCAL] Aun no disponible' -ForegroundColor Yellow}
if(Test-Path -LiteralPath $log){
 Write-Host '[LOG LOCAL] Ultimos eventos (sin secretos):'
 Get-Content -LiteralPath $log -Tail 5 -ErrorAction SilentlyContinue |
  ForEach-Object {Write-Host ('  '+$_)}
}else{Write-Host '[LOG LOCAL] Aun no creado'}
Write-Host '[SEGURIDAD] Token, Excel y credenciales intactos.' -ForegroundColor Green
