# CAHOS: inicia silenciosamente el servicio privado local al entrar en Windows.
# La interfaz publica de GitHub Pages no recibe credenciales ni acceso al puerto.
$ErrorActionPreference = 'Stop'
$appDir = $PSScriptRoot
$pythonFile = Join-Path (Join-Path $env:LOCALAPPDATA 'CAHOS') 'python_ejecutable.txt'
$uri = 'http://127.0.0.1:8789/api/status'
function Get-CahosLocal {
  try {
    $r = Invoke-WebRequest -Uri $uri -TimeoutSec 3 -UseBasicParsing
    if ($r.StatusCode -eq 200) { return ($r.Content | ConvertFrom-Json) }
  } catch {}
  return $null
}
$active = Get-CahosLocal
if ($null -ne $active) {
  if ([string]$active.version -eq '0.6.1') { exit 0 }
  throw 'Otra versión de CAHOS está ejecutándose en 127.0.0.1:8789. Cierre el extractor anterior y abra CAHOS otra vez.'
}
if (Test-Path -LiteralPath $pythonFile) {
  $python = (Get-Content -LiteralPath $pythonFile -Raw -Encoding UTF8).Trim()
} else {
  $cmd = Get-Command python -ErrorAction SilentlyContinue
  if (-not $cmd) { throw 'CAHOS: no se encontró Python. Ejecute INSTALAR_CAHOS.bat.' }
  $python = $cmd.Source
}
if (-not (Test-Path -LiteralPath $python -PathType Leaf)) {
  throw 'CAHOS: la ruta de Python ya no existe. Ejecute INSTALAR_CAHOS.bat.'
}
$pythonw = Join-Path (Split-Path $python) 'pythonw.exe'
$executable = if (Test-Path -LiteralPath $pythonw -PathType Leaf) {$pythonw} else {$python}
$main = Join-Path $appDir 'servidor.py'
if (-not (Test-Path -LiteralPath $main)) { throw 'CAHOS: falta servidor.py en la instalación local.' }
Start-Process -FilePath $executable -ArgumentList ('"' + $main + '"') -WorkingDirectory $appDir -WindowStyle Hidden
$ready=$false
for ($n=0; $n -lt 12; $n++) {
  Start-Sleep -Milliseconds 650
  $active = Get-CahosLocal
  if ($null -ne $active -and [string]$active.version -eq '0.6.1') { $ready=$true; break }
}
if (-not $ready) {
  throw 'CAHOS: el servicio no respondió en localhost:8789. Verifique si hay otra instancia o problemas de Python.'
}
