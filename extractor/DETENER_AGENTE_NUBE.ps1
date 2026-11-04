# CAHOS Cloud: deshabilitar solamente el agente programado, conservar su token y bases.
$ErrorActionPreference='Stop'
$name='CAHOS-CLOUD-AGENT'
$task=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if ($task) {
 try { Stop-ScheduledTask -TaskName $name -ErrorAction Stop } catch {}
 Disable-ScheduledTask -TaskName $name -ErrorAction Stop | Out-Null
 Write-Host '[CAHOS] Agente cloud detenido y deshabilitado.' -ForegroundColor Green
} else {
 Write-Host '[CAHOS] No hay tarea de agente cloud registrada.'
}
Write-Host 'Conexión Excel y archivos privados no modificados.'
