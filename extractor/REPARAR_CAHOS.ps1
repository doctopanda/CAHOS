# CAHOS 0.6.2 | aplicar reparacion sin reinstalar Python ni MSOLAP.
# Ejecute desde una copia reciente de GitHub CAHOS/extractor.
$ErrorActionPreference='Stop'
Write-Host '===========================================' -ForegroundColor Cyan
Write-Host ' CAHOS | REPARAR ARRANQUE Y CONSULTAS OLAP ' -ForegroundColor Cyan
Write-Host '===========================================' -ForegroundColor Cyan
$base=Join-Path $env:LOCALAPPDATA 'CAHOS'
$app=Join-Path $base 'app'
$cfg=Join-Path $base 'configuracion_local.json'
if (-not (Test-Path -LiteralPath $cfg -PathType Leaf)) {
  throw 'No se encontró la configuracion local. Instale una sola vez con INSTALAR_CAHOS.bat.'
}
if (-not (Test-Path -LiteralPath $app -PathType Container)) {
  throw 'No existe la app local. Ejecute INSTALAR_CAHOS.bat.'
}
$existing=Get-Content -LiteralPath $cfg -Raw -Encoding UTF8 | ConvertFrom-Json
if ($existing.origen_conexion -ne 'excel' -or -not (Test-Path -LiteralPath ([string]$existing.ruta_archivo_excel) -PathType Leaf)) {
  throw 'No se encuentra el Excel de conexión del cubo. Reconfigúrelo desde SELECCIONAR_EXCEL.bat.'
}
# Desactivar arranques previos para evitar duplicados.
& (Join-Path $PSScriptRoot 'DETENER_CAHOS.ps1')
$allow=@('servidor.py','conector_sinave.ps1','visor_local.html','mapa_sonora.js',
  'geografia_inegi.py','poblacion_sonora.py','configuracion.ejemplo.json',
  'ARRANQUE_AUTOMATICO.ps1','importar_poblacion.py','IMPORTAR_POBLACION.bat',
  'CONFIGURAR_ORIGEN_EXCEL.ps1','SELECCIONAR_EXCEL.bat',
  'ABRIR_CAHOS.bat','comprobar_entorno.ps1','PROBAR_CONEXION.bat','probar_conexion.py')
foreach ($name in $allow) {
  $src=Join-Path $PSScriptRoot $name
  if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { throw ('Falta el archivo '+$name+'. Descargue el ZIP completo desde GitHub.') }
  Copy-Item -LiteralPath $src -Destination (Join-Path $app $name) -Force
}
Write-Host '[CAHOS] Codigo actualizado a version 0.6.2. No se tocó el Excel original.' -ForegroundColor Green
# Primero comprobar que NO queda la versión antigua. Detener por puerto
# ocurre dentro de DETENER_CAHOS.ps1; si el puerto sigue ocupado, se aborta.
Write-Host '[CAHOS] Iniciando ahora el servicio actualizado, una sola vez...'
$script=Join-Path $app 'ARRANQUE_AUTOMATICO.ps1'
& $script
try {
  $status=Invoke-RestMethod -Uri 'http://127.0.0.1:8789/api/status' -TimeoutSec 4 -ErrorAction Stop
} catch {
  throw 'El servicio actualizado no responde. No se programará un arranque defectuoso.'
}
if ([string]$status.version -ne '0.6.2' -or
    [string]$status.servidor -ne 'cubo.sinave.gob.mx') {
  throw ('El puerto 8789 responde con versión '+[string]$status.version+
         ', no con CAHOS 0.6.2. No se programará un arranque duplicado.')
}
Write-Host '[CAHOS] Servicio 0.6.2 validado en puerto 8789.' -ForegroundColor Green
# Registrar el inicio automático sólo después de comprobar el proceso.
$name='CAHOS-SUIVE-Extractor'
$args='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$script+'"'
try {
  $user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  $action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $args -WorkingDirectory $app
  $trigger=New-ScheduledTaskTrigger -AtLogOn -User $user
  $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
  $existingTask=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
  if($existingTask){Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction Stop}
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Description 'CAHOS 0.6.2: lectura OLAP local silenciosa' -ErrorAction Stop | Out-Null
  Write-Host '[CAHOS] Arranque único registrado al iniciar sesión en Windows.' -ForegroundColor Green
} catch {
  Write-Host '[CAHOS] Windows no permitió registrar tarea. Usando solo carpeta Inicio.' -ForegroundColor Yellow
  $startup=[Environment]::GetFolderPath('Startup')
  $path=Join-Path $startup 'CAHOS Extractor.lnk'
  $wsh=New-Object -ComObject WScript.Shell
  $link=$wsh.CreateShortcut($path)
  $link.TargetPath='powershell.exe'
  $link.Arguments=$args
  $link.WorkingDirectory=$app
  $link.WindowStyle=7
  $link.Save()
}
Write-Host '[CAHOS] Reparación terminada. Excel, población y extracciones intactos.' -ForegroundColor Green
Start-Process 'http://127.0.0.1:8789'
