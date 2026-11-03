# CAHOS | Instalación inicial de una sola vez (no pide contraseña SINAVE).
# Datos y configuración permanecen en %LOCALAPPDATA%\CAHOS, fuera de GitHub.
$ErrorActionPreference='Stop'
Write-Host '=================================================' -ForegroundColor Cyan
Write-Host ' CAHOS | Instalación local y arranque automático' -ForegroundColor Cyan
Write-Host '=================================================' -ForegroundColor Cyan
$base=Join-Path $env:LOCALAPPDATA 'CAHOS'
$app=Join-Path $base 'app'
New-Item -ItemType Directory -Force -Path $app | Out-Null
$config=Join-Path $base 'configuracion_local.json'
$checkConfig = $false
if (Test-Path -LiteralPath $config) {
  try {
    $obj=Get-Content -LiteralPath $config -Raw -Encoding UTF8 | ConvertFrom-Json
    $checkConfig=($obj.origen_conexion -eq 'excel' -and (Test-Path -LiteralPath ([string]$obj.ruta_archivo_excel) -PathType Leaf))
  } catch {}
}
if (-not $checkConfig) {
  Write-Host '[ORIGEN] Seleccione una sola vez el archivo de Excel que ya utiliza para el cubo.' -ForegroundColor Yellow
  & (Join-Path $PSScriptRoot 'CONFIGURAR_ORIGEN_EXCEL.ps1')
  if ($LASTEXITCODE -ne 0) { throw 'Debe seleccionar el Excel original para iniciar CAHOS.' }
}
$pythonCmd=Get-Command python -ErrorAction SilentlyContinue
if (-not $pythonCmd) { throw 'No se encuentra Python. Instale Python 3.10+ y vuelva a ejecutar.' }
$python=$pythonCmd.Source
& $python -c 'import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>$null
if ($LASTEXITCODE -ne 0) { throw 'CAHOS necesita Python 3.10 o posterior.' }
[IO.File]::WriteAllText((Join-Path $base 'python_ejecutable.txt'),$python,(New-Object Text.UTF8Encoding($false)))
# Copiar solo código de aplicación, no libros de Excel, credenciales ni bases.
$allow=@('servidor.py','conector_sinave.ps1','visor_local.html','mapa_sonora.js',
  'geografia_inegi.py','poblacion_sonora.py','configuracion.ejemplo.json',
  'ARRANQUE_AUTOMATICO.ps1')
foreach ($name in $allow) {
  $src=Join-Path $PSScriptRoot $name
  if (-not (Test-Path -LiteralPath $src -PathType Leaf)) { throw ('Falta archivo: '+$name) }
  Copy-Item -LiteralPath $src -Destination (Join-Path $app $name) -Force
}
Write-Host '[INSTALACION] App privada en carpeta local del usuario.' -ForegroundColor Green
# Proyecciones: solicitar el archivo solo si no hay denominadores guardados.
$popDest=Join-Path $base 'poblacion_sonora.json'
if (-not (Test-Path -LiteralPath $popDest)) {
  Write-Host '[POBLACION] No hay denominadores. Puede seleccionar ahora el Excel COESPO/CONAPO (una sola vez).' -ForegroundColor Yellow
  Add-Type -AssemblyName System.Windows.Forms
  $d=New-Object System.Windows.Forms.OpenFileDialog
  $d.Title='CAHOS: seleccionar Excel de proyecciones municipales Sonora 2015-2030 (opcional)'
  $d.Filter='Excel (*.xlsx)|*.xlsx'
  if ($d.ShowDialog() -eq [Windows.Forms.DialogResult]::OK) {
    $importer=Join-Path $PSScriptRoot 'importar_poblacion.py'
    & $python $importer $d.FileName
    if ($LASTEXITCODE -ne 0) { Write-Host '[POBLACION] No se pudo validar el archivo; las tasas permanecerán deshabilitadas.' -ForegroundColor Yellow }
  } else {
    Write-Host '[POBLACION] Se omitió por ahora; se podrán incorporar después.' -ForegroundColor Yellow
  }
}
# No es necesario administrador. Si la política impide tareas, usar carpeta Inicio del usuario.
$name='CAHOS-SUIVE-Extractor'
$ps='powershell.exe'
$script=Join-Path $app 'ARRANQUE_AUTOMATICO.ps1'
$args='-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$script+'"'
$scheduled=$false
try {
  $user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  $action=New-ScheduledTaskAction -Execute $ps -Argument $args -WorkingDirectory $app
  $trigger=New-ScheduledTaskTrigger -AtLogOn -User $user
  $principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Description 'CAHOS cubo SINAVE, proceso privado del usuario' -Force -ErrorAction Stop | Out-Null
  $scheduled=$true
  Write-Host '[ARRANQUE] Registrado al iniciar sesión en Windows.' -ForegroundColor Green
} catch {
  Write-Host '[ARRANQUE] El Programador de tareas no permitió el registro. Intentando carpeta Inicio.' -ForegroundColor Yellow
  $startup=[Environment]::GetFolderPath('Startup')
  $shortcut=Join-Path $startup 'CAHOS Extractor.lnk'
  $wshell=New-Object -ComObject WScript.Shell
  $link=$wshell.CreateShortcut($shortcut)
  $link.TargetPath=$ps
  $link.Arguments=$args
  $link.WorkingDirectory=$app
  $link.WindowStyle=7
  $link.Description='Iniciar CAHOS en este equipo sin credenciales adicionales'
  $link.Save()
  Write-Host '[ARRANQUE] Registrado en la carpeta Inicio del usuario.' -ForegroundColor Green
}
& (Join-Path $app 'ARRANQUE_AUTOMATICO.ps1')
Write-Host '[SERVICIO] Responde en http://127.0.0.1:8789' -ForegroundColor Green
Write-Host '[TERMINADO] No necesitará iniciar Python, comprobar OLAP ni importar datos en cada sesión.' -ForegroundColor Green
Start-Process 'http://127.0.0.1:8789'
