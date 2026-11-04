# CAHOS Cloud: read-only diagnostic, with NO tokens or credentials in output.
$ErrorActionPreference='Continue'
$taskName='CAHOS-CLOUD-AGENT'
$base=Join-Path $env:LOCALAPPDATA 'CAHOS'
$statusPath=Join-Path $base 'cloud_agent_status.json'
$tokenPath=Join-Path $base 'cloud_agent_token.txt'
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' CAHOS CLOUD | DIAGNOSTICO LOCAL Y REMOTO' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ('[EQUIPO] Usuario Windows: '+[Security.Principal.WindowsIdentity]::GetCurrent().Name)
Write-Host ('[RUTA] Carpeta de estado: '+$base)
$taskWorkingDir=$null
$taskUserShort=$null
$currentUserShort=([Security.Principal.WindowsIdentity]::GetCurrent().Name -split '\\')[-1]
$task=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($null -eq $task){
 Write-Host '[TAREA] No se encontro CAHOS-CLOUD-AGENT.' -ForegroundColor Yellow
}else{
 Write-Host ('[TAREA] '+[string]$task.State+'; usuario: '+[string]$task.Principal.UserId)
 try{
  $info=Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction Stop
  Write-Host ('[TAREA] Ultimo resultado: '+$info.LastTaskResult+'; ultimo arranque: '+$info.LastRunTime)
  if($info.LastTaskResult -eq 267009){
   Write-Host '[TAREA] Codigo 267009 = 0x41301: tarea actualmente en ejecucion.'
  }
 }catch{Write-Host '[TAREA] Informacion del Programador no accesible.' -ForegroundColor Yellow}
 if($task.Actions.Count -gt 0){
  Write-Host ('[TAREA] Ejecutable: '+[IO.Path]::GetFileName([string]$task.Actions[0].Execute))
  Write-Host ('[TAREA] Carpeta de trabajo: '+[string]$task.Actions[0].WorkingDirectory)
  $taskWorkingDir=[string]$task.Actions[0].WorkingDirectory
  if([string]$task.Actions[0].Arguments -match '(?i)agente_nube\.py'){
   Write-Host '[TAREA] Script cloud identificado: agente_nube.py'
  } else {
   Write-Host '[TAREA] La accion no identifica agente_nube.py: revisar instalacion.' -ForegroundColor Yellow
  }
 }
}
Write-Host ('[VINCULACION] Token local: '+$(if(Test-Path -LiteralPath $tokenPath){'archivo presente (contenido oculto)'}else{'archivo ausente'}))
# Examine only the expected CAHOS folders (no recursive disk search).
$candidates=@($statusPath)
if($taskWorkingDir -and (Split-Path -Leaf $taskWorkingDir) -eq 'cloud'){
 $candidates+=Join-Path (Split-Path -Parent $taskWorkingDir) 'cloud_agent_status.json'
}
$candidates+=Join-Path (Join-Path $HOME 'CAHOS') 'cloud_agent_status.json'
$foundStatus=$null
foreach($candidate in ($candidates | Select-Object -Unique)){
 if(Test-Path -LiteralPath $candidate -PathType Leaf){$foundStatus=$candidate;break}
}
if($foundStatus){
 try {
  $obj=Get-Content -LiteralPath $foundStatus -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
  Write-Host ('[ESTADO LOCAL] '+[string]$obj.status+'; '+[string]$obj.detail)
  if($foundStatus -ne $statusPath){Write-Host '[ESTADO LOCAL] Ubicado en la ruta alternativa del agente.' -ForegroundColor Yellow}
  Write-Host ('[ACTUALIZADO] '+[string]$obj.at)
 }catch{Write-Host '[ESTADO LOCAL] Archivo presente pero no valido.' -ForegroundColor Yellow}
}else{
 Write-Host '[ESTADO LOCAL] Archivo no encontrado en la cuenta actual.' -ForegroundColor Yellow
 if($task){
  $taskUserShort=([string]$task.Principal.UserId -split '\\')[-1]
  if($taskUserShort -ine $currentUserShort){
   Write-Host '[PISTA] La tarea usa una cuenta Windows diferente. Su LOCALAPPDATA puede variar.' -ForegroundColor Yellow
  } else {
   Write-Host '[PISTA] Es la misma cuenta de Windows (con o sin prefijo del equipo).' -ForegroundColor Green
   Write-Host '[PISTA] Sin archivo local no significa desconexion: verificar estado remoto.' -ForegroundColor Yellow
  }
 }
}

Write-Host '[PROCESO] Comprobando versiones y ejecutables activos sin mostrar argumentos sensibles...'
$installedScript=$null
if($taskWorkingDir){
  $installedScript=Join-Path $taskWorkingDir 'agente_nube.py'
  if(Test-Path -LiteralPath $installedScript -PathType Leaf){
    $content=Get-Content -LiteralPath $installedScript -Raw -Encoding UTF8
    $newCode=$content.Contains('PRIVATE = APP.parent')
    Write-Host ('[PROCESO] Version instalada con ruta corregida: '+$(if($newCode){'SI'}else{'NO'}))
    Write-Host ('[PROCESO] Codigo instalado modificado: '+(Get-Item -LiteralPath $installedScript).LastWriteTime)
    $latestSource=Join-Path $PSScriptRoot 'agente_nube.py'
    if(Test-Path -LiteralPath $latestSource -PathType Leaf) {
      $hashInstalled=(Get-FileHash -LiteralPath $installedScript -Algorithm SHA256).Hash
      $hashSource=(Get-FileHash -LiteralPath $latestSource -Algorithm SHA256).Hash
      Write-Host ('[PROCESO] Codigo instalado coincide con descarga: '+$(if($hashInstalled -eq $hashSource){'SI'}else{'NO'}))
    }
  } else {
    Write-Host '[PROCESO] El script no existe en el directorio declarado por la tarea.' -ForegroundColor Yellow
  }
}
try {
  $running=@(Get-CimInstance Win32_Process -Filter "Name LIKE 'python%'" -ErrorAction Stop |
      Where-Object { [string]$_.CommandLine -match '(?i)agente_nube\.py' })
  Write-Host ('[PROCESO] Procesos Python que ejecutan agente_nube.py: '+$running.Count)
  foreach($p in $running){
    $exeName=[IO.Path]::GetFileName([string]$p.ExecutablePath)
    Write-Host ('[PROCESO] PID '+$p.ProcessId+'; ejecutable '+$exeName+'; iniciado '+$p.CreationDate)
  }
  if($running.Count -eq 0 -and $task -and $task.State -eq 'Running'){
    Write-Host '[PROCESO] La tarea Running no corresponde a un agente Python visible. Revisar accion real de Windows.' -ForegroundColor Yellow
  }
  if($running.Count -gt 1){
    Write-Host '[PROCESO] Hay mas de un agente Python. No se detendra ninguno sin verificar su origen.' -ForegroundColor Yellow
  }
}catch{
  Write-Host '[PROCESO] No fue posible enumerar procesos Python (sin modificar nada).' -ForegroundColor Yellow
}

Write-Host '[NUBE] Consultando solo el estado publico del backend (sin autenticacion)...'
try {
 $endpoint='https://lywrtuibmzzsylfbybqo.supabase.co/functions/v1/cahos-api/health'
 $response=Invoke-RestMethod -Uri $endpoint -Method Get -TimeoutSec 15 -ErrorAction Stop
 if($response.service -eq 'CAHOS cloud API') {
  Write-Host ('[NUBE] API disponible; al menos un agente figura: '+[string]$response.worker) -ForegroundColor Green
  if(-not $foundStatus -and [string]$response.worker -eq 'online'){
   Write-Host '[CONCLUSION] Supabase recibe un agente, pero falta confirmar que es esta instancia Windows.' -ForegroundColor Yellow
  }
  Write-Host ('[NUBE] Datos epidemiologicos aprobados: '+[string]$response.epidemiological_data_available)
 }else{Write-Host '[NUBE] Respuesta inesperada, no confirma agente.' -ForegroundColor Yellow}
}catch{
 Write-Host '[NUBE] No se pudo consultar health. Revise red HTTPS, DNS y firewall.' -ForegroundColor Yellow
}
Write-Host '[SEGURIDAD] No se mostraron tokens, contrasenas ni cadenas OLAP.'
