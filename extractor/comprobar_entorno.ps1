# CAHOS: diagnostico local SINAVE, sin extraer casos ni mostrar credenciales.
$ErrorActionPreference = 'Continue'
Write-Host '--- Comprobacion previa del entorno (sin modificar el cubo) ---'
$localCfg = Join-Path (Join-Path $env:LOCALAPPDATA 'CAHOS') 'configuracion_local.json'
$rootCfg = Join-Path $PSScriptRoot 'configuracion.json'
$exampleCfg = Join-Path $PSScriptRoot 'configuracion.ejemplo.json'
$cfgFile = if (Test-Path -LiteralPath $localCfg) { $localCfg } elseif (Test-Path -LiteralPath $rootCfg) { $rootCfg } else { $exampleCfg }
try {
  $cfg = Get-Content -LiteralPath $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json
  $server = [string]$cfg.servidor
  if ($server -notmatch '^[A-Za-z0-9.-]+$') { throw 'servidor no valido' }
  if ([string]::IsNullOrWhiteSpace([string]$cfg.catalogo) -or [string]::IsNullOrWhiteSpace([string]$cfg.cubo)) { throw 'catalogo o cubo vacio' }
  $mode = if ($cfg.origen_conexion -eq 'excel') { 'Excel original (conexión guardada)' } else { 'Autenticacion de Windows/configuración de origen' }
  Write-Host ('[CONFIGURACION] Modo: ' + $mode)
  if ($cfg.origen_conexion -eq 'excel') {
    if (Test-Path -LiteralPath ([string]$cfg.ruta_archivo_excel)) {
      Write-Host '[EXCEL] Archivo seleccionado disponible; se abrira en modo de lectura.'
    } else {
      Write-Host '[EXCEL] Libro no encontrado. Ejecute SELECCIONAR_EXCEL.bat.' -ForegroundColor Yellow
    }
  }
  Write-Host "[CONFIGURACION] Servidor: $server; cubo y catalogo definidos: SI"
} catch {
  Write-Host '[CONFIGURACION] JSON incorrecto; ejecute SELECCIONAR_EXCEL.bat.' -ForegroundColor Red
  exit 2
}
Write-Host ('[WINDOWS] PowerShell: ' + $PSVersionTable.PSVersion.ToString() + '; Proceso 64 bits: ' + [Environment]::Is64BitProcess)
$provider = [string]$cfg.proveedor
$names = @('MSOLAP', 'MSOLAP.5', 'MSOLAP.6', 'MSOLAP.7', 'MSOLAP.8')
$found = @($names | Where-Object { Test-Path -LiteralPath ("Registry::HKEY_CLASSES_ROOT\" + $_) })
if ($found.Count -eq 0) {
  Write-Host '[MSOLAP] No se detecto proveedor OLAP en el registro de esta arquitectura de PowerShell.' -ForegroundColor Yellow
  Write-Host '[MSOLAP] Instale o repare el proveedor OLE DB para Analysis Services autorizado por TI.'
} else {
  Write-Host ('[MSOLAP] Proveedores registrados: ' + ($found -join ', '))
  if ($cfg.origen_conexion -ne 'excel' -and $provider -notin $found) { Write-Host '[MSOLAP] El proveedor elegido no aparece registrado; revise su version con TI.' -ForegroundColor Yellow }
}
try {
  $ado = New-Object -ComObject ADODB.Connection
  Write-Host '[ADO] ADODB.Connection: disponible'
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($ado) | Out-Null
} catch {
  Write-Host '[ADO] ADODB.Connection: no disponible. Revisar componentes Windows con TI.' -ForegroundColor Yellow
}
try {
  [void][System.Net.Dns]::GetHostAddresses($server)
  Write-Host '[RED] El nombre del servidor se resuelve por DNS.'
} catch {
  Write-Host '[RED] No se resuelve el servidor por DNS. Compruebe red/VPN institucional.' -ForegroundColor Yellow
}
$credPath = Join-Path $env:LOCALAPPDATA 'CAHOS\acceso_sinave.xml'
Write-Host ('[ACCESO] En modo Excel se reutilizan parametros de conexion locales. Credencial CAHOS adicional: ' + $(if(Test-Path -LiteralPath $credPath){'SI'}else{'NO (no es requisito)'}))
Write-Host '--- Fin de comprobaciones locales ---'
if ($cfg.origen_conexion -ne 'excel') {
  Write-Host '[ACCION] No se ha seleccionado el modo Excel. Seleccione su libro de cubos original.' -ForegroundColor Yellow
  exit 7
}
if (-not (Test-Path -LiteralPath ([string]$cfg.ruta_archivo_excel) -PathType Leaf)) {
  Write-Host '[ACCION] El libro guardado ya no se encuentra; vuelva a seleccionarlo.' -ForegroundColor Yellow
  exit 8
}
Write-Host ('[ORIGEN CONFIRMADO] Libro local: ' + [IO.Path]::GetFileName([string]$cfg.ruta_archivo_excel)) -ForegroundColor Green
exit 0
