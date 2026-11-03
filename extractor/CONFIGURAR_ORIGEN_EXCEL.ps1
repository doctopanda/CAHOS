# CAHOS: seleccionar libro XLSX local sin copiarlo ni modificarlo.
# Solo guarda la RUTA del archivo en %LOCALAPPDATA%\CAHOS\configuracion_local.json.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'CAHOS: seleccionar el Excel que ya conecta al cubo'
$dialog.Filter = 'Libros Excel con conexion OLAP (*.xlsx)|*.xlsx'
$dialog.Multiselect = $false
$dialog.CheckFileExists = $true
if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
  Write-Host 'No se selecciono ningun archivo.' -ForegroundColor Yellow
  exit 1
}
$basePath = Join-Path $PSScriptRoot 'configuracion.ejemplo.json'
if (-not (Test-Path $basePath)) { throw 'Falta configuracion.ejemplo.json' }
$base = Get-Content -LiteralPath $basePath -Raw -Encoding UTF8 | ConvertFrom-Json
$values = @{}
foreach ($p in $base.PSObject.Properties) { $values[$p.Name] = $p.Value }
$destDir = Join-Path $env:LOCALAPPDATA 'CAHOS'
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
$dest = Join-Path $destDir 'configuracion_local.json'
if (Test-Path -LiteralPath $dest) {
  $previous = Get-Content -LiteralPath $dest -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($p in $previous.PSObject.Properties) { $values[$p.Name] = $p.Value }
}
$values['origen_conexion'] = 'excel'
$values['ruta_archivo_excel'] = $dialog.FileName
$json = $values | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($dest, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ''
Write-Host 'CAHOS: modo Excel original seleccionado.' -ForegroundColor Green
Write-Host 'El archivo no se copia ni modifica. La conexion se lee en memoria.'
Write-Host 'Las contrasenas existentes en el libro NO se mostraran ni se subiran a GitHub.'
Write-Host 'Ahora ejecute PROBAR_CONEXION.bat. Si funciona, use INICIAR_EXTRACTOR.bat.'
