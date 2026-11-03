# CAHOS: desactivar SOLO las tareas/procesos de este proyecto, conservar datos.
$ErrorActionPreference = 'Stop'
$name='CAHOS-SUIVE-Extractor'
$task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if ($task) {
  try { Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue } catch {}
  Disable-ScheduledTask -TaskName $name -ErrorAction Stop | Out-Null
  Write-Host '[CAHOS] Tarea automatica detenida y deshabilitada.' -ForegroundColor Green
}
$startup=Join-Path ([Environment]::GetFolderPath('Startup')) 'CAHOS Extractor.lnk'
if (Test-Path -LiteralPath $startup) {
  Remove-Item -LiteralPath $startup -Force
  Write-Host '[CAHOS] Se elimino el arranque duplicado de la carpeta Inicio.'
}
# Detener solamente el servidor de CAHOS. NO detener todos los Python/PowerShell.
try {
  $processes=Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='pythonw.exe'" -ErrorAction Stop
  foreach ($item in $processes) {
    $cmd=[string]$item.CommandLine
    if ($cmd -match '(?i)(?:^|[\\/"\s])(?:[^"\s]*[\\/])?servidor\.py(?:["\s]|$)' -and $cmd -match '(?i)cahos') {
      try {
        Stop-Process -Id $item.ProcessId -Force -ErrorAction Stop
        Write-Host ('[CAHOS] Servicio anterior detenido (PID '+$item.ProcessId+').')
      } catch {
        Write-Host '[CAHOS] No se pudo detener una instancia. Cierre su ventana anterior.' -ForegroundColor Yellow
      }
    }
  }
} catch {
  Write-Host '[CAHOS] No se pudo consultar la lista de procesos. Si sigue abierto, cierre el extractor anterior.' -ForegroundColor Yellow
}
Write-Host '[CAHOS] No se borraron configuraciones, Excel, datos ni credenciales.' -ForegroundColor Green
