# CAHOS: diagnostico local SINAVE, sin extraer casos ni mostrar credenciales.
$ErrorActionPreference = 'Continue'
Write-Host '--- Comprobacion previa del entorno (sin modificar el cubo) ---'
$cfgFile = Join-Path $PSScriptRoot 'configuracion.json'
if (-not (Test-Path -LiteralPath $cfgFile)) {
  Write-Host '[CONFIGURACION] Falta configuracion.json. Copie configuracion.ejemplo.json, renombre y ajuste solo si tiene autorizacion.' -ForegroundColor Yellow
  exit 2
}
try {
  $cfg = Get-Content -LiteralPath $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json
  $server = [string]$cfg.servidor
  if ($server -notmatch '^[A-Za-z0-9.-]+$') { throw 'servidor invalido' }
  if ([string]::IsNullOrWhiteSpace([string]$cfg.catalogo) -or [string]::IsNullOrWhiteSpace([string]$cfg.cubo)) { throw 'catalogo o cubo vacio' }
  Write-Host "[CONFIGURACION] Servidor: $server; catalogo y cubo indicados: SI"
} catch {
  Write-Host '[CONFIGURACION] Archivo JSON incorrecto. Revise configuracion.json.' -ForegroundColor Red
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
  if ($provider -notin $found) { Write-Host '[MSOLAP] El proveedor de configuracion.json no aparece registrado. Ajuste la version con TI.' -ForegroundColor Yellow }
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
Write-Host ('[ACCESO] Credencial cifrada CAHOS guardada: ' + $(if(Test-Path -LiteralPath $credPath){'SI'}else{'NO (usara autenticacion de Windows si no hay variables de entorno)'}))
Write-Host '--- Fin de comprobaciones locales ---'
