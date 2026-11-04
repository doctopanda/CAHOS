# CAHOS: comparar la consulta anual de dos miembros de conjuntivitis.
# Powershell 5.1, solo lectura: NO cambia tarea, token, Excel ni credenciales.
$ErrorActionPreference='Stop'
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' CAHOS | DIAGNOSTICO ESPECIFICO CONJUNTIVITIS' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
$base=Join-Path $env:LOCALAPPDATA 'CAHOS'
$app=Join-Path $base 'cloud'
$script=Join-Path $PSScriptRoot 'diagnosticar_conjuntivitis.py'
if(-not (Test-Path -LiteralPath $script -PathType Leaf)){
 throw 'Falta diagnosticar_conjuntivitis.py junto a este PS1.'
}
if(-not (Test-Path -LiteralPath (Join-Path $app 'servidor.py') -PathType Leaf)){
 throw 'No se encuentra el extractor local instalado de CAHOS.'
}
$task=Get-ScheduledTask -TaskName 'CAHOS-CLOUD-AGENT' -ErrorAction Stop
$python=[string]$task.Actions[0].Execute -replace '(?i)pythonw(?=[0-9.]*\.exe$)', 'python'
if(-not (Test-Path -LiteralPath $python -PathType Leaf)){
 throw 'El Python de la tarea no esta disponible.'
}
Write-Host ('[AGENTE] Tarea: '+$task.State) -ForegroundColor Yellow
Write-Host '[PLAN] Hasta tres SELECT MDX de solo lectura; sin solicitudes a Supabase.'
Write-Host '[PRIVACIDAD] No se imprimen cifras, rutas de origen, MDX ni credenciales.'
Write-Host ''
& $python -B $script $app
if($LASTEXITCODE -ne 0){
 Write-Host '[CAHOS] El diagnostico no pudo completarse.' -ForegroundColor Red
 exit $LASTEXITCODE
}
Write-Host ''
Write-Host 'El diagnostico no cambia la configuracion ni reinicia el agente.' -ForegroundColor Green
