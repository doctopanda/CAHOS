# Desactivar inicio automático sin borrar datos ni credenciales locales.
$ErrorActionPreference = 'Stop'
Unregister-ScheduledTask -TaskName 'CAHOS-SUIVE-Extractor' -Confirm:$false -ErrorAction SilentlyContinue
$lnk=Join-Path ([Environment]::GetFolderPath('Startup')) 'CAHOS Extractor.lnk'
if (Test-Path -LiteralPath $lnk) { Remove-Item -LiteralPath $lnk -Force }
Write-Host 'CAHOS ya no iniciará automáticamente con Windows. Las bases privadas locales quedan intactas.'
