# Compatibilidad: CAHOS se instala con una sola acción, incluyendo origen Excel,
# importación opcional de población y arranque automático.
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'INSTALAR_CAHOS.ps1')
