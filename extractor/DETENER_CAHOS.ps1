# CAHOS | Detener solo el servidor de CAHOS y deshabilitar arranques duplicados.
# Ninguna operación elimina Excel, credenciales, configuración o extracciones locales.
$ErrorActionPreference = 'Stop'
$taskName = 'CAHOS-SUIVE-Extractor'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -ne $task) {
  try { Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue } catch {}
  Disable-ScheduledTask -TaskName $taskName -ErrorAction Stop | Out-Null
  Write-Host '[CAHOS] Arranque programado detenido y deshabilitado.' -ForegroundColor Green
}
$shortcut=Join-Path ([Environment]::GetFolderPath('Startup')) 'CAHOS Extractor.lnk'
if (Test-Path -LiteralPath $shortcut) {
  Remove-Item -LiteralPath $shortcut -Force
  Write-Host '[CAHOS] Eliminado el acceso redundante de Inicio.'
}
# Identificar el servidor HTTP de CAHOS antes de detener proceso alguno.
$confirmed=$false
try {
  $status=Invoke-RestMethod -Uri 'http://127.0.0.1:8789/api/status' -TimeoutSec 3 -ErrorAction Stop
  $confirmed=([string]$status.servidor -eq 'cubo.sinave.gob.mx' -and
              [string]$status.catalogo -eq 'Cubo_2003_Actual')
  if ($confirmed) {
    Write-Host ('[CAHOS] Instancia detectada; version: '+$(if($status.version){$status.version}else{'anterior'}))
  }
} catch {
  Write-Host '[CAHOS] El servicio no responde a /api/status; no se detendran procesos sin identificarlos.'
}
try {
  $listeners=@(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction Stop |
    Where-Object { $_.LocalAddress -in @('127.0.0.1','::1') })
} catch {
  $listeners=@()
  Write-Host '[CAHOS] No se pudo inspeccionar el puerto TCP. Revise manualmente si sigue ocupado.' -ForegroundColor Yellow
}
$owners=@($listeners | Select-Object -ExpandProperty OwningProcess -Unique)
foreach($pidToCheck in $owners) {
  $proc=Get-CimInstance Win32_Process -Filter "ProcessId = $pidToCheck" -ErrorAction SilentlyContinue
  $name=if($proc){[string]$proc.Name}else{'desconocido'}
  $cmd=if($proc){[string]$proc.CommandLine}else{''}
  # Solo detener una instancia CAHOS confirmada, dueña del puerto y ejecutando servidor.py.
  # Windows puede nombrar el intérprete pythonw3.12.exe, python3.12.exe, etc.
  # No se detienen otros procesos Python ni PowerShell.
  if($confirmed -and $name -match '(?i)^pythonw?(?:\d+(?:\.\d+)*)?\.exe$' -and
     $cmd -match '(?i)(?:^|[\\/"\s])(?:[^"\s]*[\\/])?servidor\.py(?:["\s]|$)') {
    Stop-Process -Id $pidToCheck -Force -ErrorAction Stop
    Write-Host ("[CAHOS] Instancia anterior detenida en puerto 8789 (PID $pidToCheck).") -ForegroundColor Green
  } else {
    Write-Host ("[CAHOS] Puerto ocupado por proceso PID $pidToCheck ($name); no se detuvo por seguridad.") -ForegroundColor Yellow
  }
}
for($n=0; $n -lt 16; $n++){
  $still=@(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -in @('127.0.0.1','::1') })
  if($still.Count -eq 0){break}
  Start-Sleep -Milliseconds 250
}
$remaining=@(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalAddress -in @('127.0.0.1','::1') })
if($remaining.Count -gt 0){
  $remainingPid=($remaining | Select-Object -First 1).OwningProcess
  throw "El puerto 8789 sigue ocupado (PID $remainingPid). No se reiniciara CAHOS hasta verificar que proceso es."
}
Write-Host '[CAHOS] Puerto 8789 libre. Datos y conexión original conservados.' -ForegroundColor Green
 -and
     $cmd -match '(?i)(?:^|[\\/"\s])(?:[^"\s]*[\\/])?servidor\.py(?:["\s]|$)') {
    Stop-Process -Id $pidToCheck -Force -ErrorAction Stop
    Write-Host ("[CAHOS] Instancia anterior detenida en puerto 8789 (PID $pidToCheck).") -ForegroundColor Green
  } else {
    Write-Host ("[CAHOS] Puerto ocupado por proceso PID $pidToCheck ($name); no se detuvo por seguridad.") -ForegroundColor Yellow
  }
}
for($n=0; $n -lt 16; $n++){
  $still=@(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -in @('127.0.0.1','::1') })
  if($still.Count -eq 0){break}
  Start-Sleep -Milliseconds 250
}
$remaining=@(Get-NetTCPConnection -State Listen -LocalPort 8789 -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalAddress -in @('127.0.0.1','::1') })
if($remaining.Count -gt 0){
  $remainingPid=($remaining | Select-Object -First 1).OwningProcess
  throw "El puerto 8789 sigue ocupado (PID $remainingPid). No se reiniciara CAHOS hasta verificar que proceso es."
}
Write-Host '[CAHOS] Puerto 8789 libre. Datos y conexión original conservados.' -ForegroundColor Green
