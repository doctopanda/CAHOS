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
$task=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($null -eq $task){
 Write-Host '[TAREA] No se encontro CAHOS-CLOUD-AGENT.' -ForegroundColor Yellow
}else{
 Write-Host ('[TAREA] '+[string]$task.State+'; usuario: '+[string]$task.Principal.UserId)
 try{
  $info=Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction Stop
  Write-Host ('[TAREA] Ultimo resultado: '+$info.LastTaskResult+'; ultimo arranque: '+$info.LastRunTime)
 }catch{Write-Host '[TAREA] Informacion del Programador no accesible.' -ForegroundColor Yellow}
 if($task.Actions.Count -gt 0){
  Write-Host ('[TAREA] Ejecutable: '+[IO.Path]::GetFileName([string]$task.Actions[0].Execute))
  Write-Host ('[TAREA] Carpeta de trabajo: '+[string]$task.Actions[0].WorkingDirectory)
 }
}
Write-Host ('[VINCULACION] Token local: '+$(if(Test-Path -LiteralPath $tokenPath){'archivo presente (contenido oculto)'}else{'archivo ausente'}))
if(Test-Path -LiteralPath $statusPath){
 try {
  $obj=Get-Content -LiteralPath $statusPath -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
  Write-Host ('[ESTADO LOCAL] '+[string]$obj.status+'; '+[string]$obj.detail)
  Write-Host ('[ACTUALIZADO] '+[string]$obj.at)
 }catch{Write-Host '[ESTADO LOCAL] Archivo presente pero no valido.' -ForegroundColor Yellow}
}else{
 Write-Host '[ESTADO LOCAL] Archivo no encontrado en la cuenta actual.' -ForegroundColor Yellow
 if($task -and [string]$task.Principal.UserId -ne [string][Security.Principal.WindowsIdentity]::GetCurrent().Name){
  Write-Host '[PISTA] La tarea se ejecuta bajo otro usuario de Windows. Su LOCALAPPDATA puede ser diferente.' -ForegroundColor Yellow
 }
}
Write-Host '[NUBE] Consultando solo el estado publico del backend (sin autenticacion)...'
try {
 $endpoint='https://lywrtuibmzzsylfbybqo.supabase.co/functions/v1/cahos-api/health'
 $response=Invoke-RestMethod -Uri $endpoint -Method Get -TimeoutSec 15 -ErrorAction Stop
 if($response.service -eq 'CAHOS cloud API') {
  Write-Host ('[NUBE] API disponible; estado del agente: '+[string]$response.worker) -ForegroundColor Green
  Write-Host ('[NUBE] Datos epidemiologicos aprobados: '+[string]$response.epidemiological_data_available)
 }else{Write-Host '[NUBE] Respuesta inesperada, no confirma agente.' -ForegroundColor Yellow}
}catch{
 Write-Host '[NUBE] No se pudo consultar health. Revise red HTTPS, DNS y firewall.' -ForegroundColor Yellow
}
Write-Host '[SEGURIDAD] No se mostraron tokens, contrasenas ni cadenas OLAP.'
