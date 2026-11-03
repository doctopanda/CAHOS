# CAHOS | Acceso SINAVE cifrado para el usuario actual de Windows.
# No copia ni utiliza las credenciales incrustadas en un Excel.
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:LOCALAPPDATA 'CAHOS'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$destino = Join-Path $dir 'acceso_sinave.xml'
Write-Host 'CAHOS: indique SOLO su cuenta institucional autorizada de consulta.' -ForegroundColor Cyan
$cuenta = Get-Credential -Message 'Acceso de solo lectura al cubo SINAVE'
if (-not $cuenta) { throw 'Se cancelo el ingreso de credenciales.' }
$cuenta | Export-Clixml -LiteralPath $destino
Write-Host 'Acceso cifrado con DPAPI del usuario actual de Windows.' -ForegroundColor Green
Write-Host 'No suba el archivo de acceso a GitHub ni lo comparta.'
