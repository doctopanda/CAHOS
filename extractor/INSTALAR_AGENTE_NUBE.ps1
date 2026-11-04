# CAHOS Cloud | Una sola instalacion en Windows con acceso autorizado al cubo.
# No sube Excel ni credenciales MSOLAP. Solo transmite agregados sujetos a revision.
$ErrorActionPreference='Stop'
$base=Join-Path $env:LOCALAPPDATA 'CAHOS'
$app=Join-Path $base 'cloud'
$config=Join-Path $base 'configuracion_local.json'
if (-not (Test-Path -LiteralPath $config)) { throw 'Primero configure el origen Excel local con SELECCIONAR_EXCEL.bat.' }
$settings=Get-Content -LiteralPath $config -Raw -Encoding UTF8 | ConvertFrom-Json
if ($settings.origen_conexion -ne 'excel' -or -not (Test-Path -LiteralPath ([string]$settings.ruta_archivo_excel))) {
 throw 'No se encontro la conexion Excel SINAVE ya configurada.'
}
$py=Get-Command python -ErrorAction Stop
$pyPath=$py.Source
& $pyPath -c 'import sys;sys.exit(0 if sys.version_info >= (3,10) else 1)'
if ($LASTEXITCODE -ne 0) { throw 'Python 3.10+ es necesario.' }
$pyDir=Split-Path -Parent $pyPath
$pythonw=Join-Path $pyDir 'pythonw.exe'
if (-not (Test-Path -LiteralPath $pythonw)) {
 $alt='pythonw'+(($pyPath | Split-Path -Leaf) -replace '^python|\.exe$','')+'.exe'
 $pythonw=Join-Path $pyDir $alt
}
if (-not (Test-Path -LiteralPath $pythonw)) { $pythonw=$pyPath }
New-Item -ItemType Directory -Force -Path $app | Out-Null
$tokenFile=Join-Path $base 'cloud_agent_token.txt'
$existingToken=''
if (Test-Path -LiteralPath $tokenFile) {
 $existingToken=(Get-Content -LiteralPath $tokenFile -Raw -Encoding UTF8).Trim()
}
if ($existingToken -notmatch '^[0-9a-fA-F]{64}$') {
 Write-Host 'Abra CAHOS > Acceso > Vincular agente. Se mostrara un token UNA SOLA VEZ.' -ForegroundColor Cyan
 $agentToken=Read-Host 'Pegue el token de agente generado en CAHOS (64 caracteres)'
 if ($agentToken -notmatch '^[0-9a-fA-F]{64}$') { throw 'El token de agente no es valido. Debe tener 64 caracteres hexadecimales.' }
 [IO.File]::WriteAllText($tokenFile,$agentToken,(New-Object System.Text.UTF8Encoding($false)))
 $agentToken=$null
 try {
  $me=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  $acl=Get-Acl -LiteralPath $tokenFile
  $acl.SetAccessRuleProtection($true,$false)
  $rule=New-Object Security.AccessControl.FileSystemAccessRule($me,'FullControl','Allow')
  $acl.AddAccessRule($rule)
  Set-Acl -LiteralPath $tokenFile -AclObject $acl
 } catch {
  Remove-Item -LiteralPath $tokenFile -Force -ErrorAction SilentlyContinue
  throw 'No se pudo proteger el token de agente con permisos NTFS. Instalacion cancelada.'
 }
}
$files=@('agente_nube.py','puente_agente_nube.py','servidor.py','conector_sinave.ps1',
  'geografia_inegi.py','poblacion_sonora.py','configuracion.ejemplo.json')
foreach($name in $files){
 $source=Join-Path $PSScriptRoot $name
 if(-not(Test-Path -LiteralPath $source -PathType Leaf)){throw ('Falta '+$name+'. Descargue el repositorio completo.')}
 Copy-Item -LiteralPath $source -Destination (Join-Path $app $name) -Force
}
# El agente cloud no abre puerto 8789. Deshabilitar inicio anterior para reducir duplicaciones.
$old=Get-ScheduledTask -TaskName 'CAHOS-SUIVE-Extractor' -ErrorAction SilentlyContinue
if($old){
 try{Stop-ScheduledTask -TaskName 'CAHOS-SUIVE-Extractor' -ErrorAction SilentlyContinue}catch{}
 Disable-ScheduledTask -TaskName 'CAHOS-SUIVE-Extractor' -ErrorAction SilentlyContinue | Out-Null
}
$name='CAHOS-CLOUD-AGENT'
$user=[Security.Principal.WindowsIdentity]::GetCurrent().Name
$action=New-ScheduledTaskAction -Execute $pythonw -Argument ('"'+(Join-Path $app 'agente_nube.py')+'"') -WorkingDirectory $app
$trigger=New-ScheduledTaskTrigger -AtLogOn -User $user
$principal=New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$previous=Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
if($previous){
 try{Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue}catch{}
 Unregister-ScheduledTask -TaskName $name -Confirm:$false
}
# Proceso de larga duracion: no finalizar por limite, bateria, inactividad o cambios de red.
$settings=New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'CAHOS Cloud: extraccion OLAP local y envio de agregados pendientes de autorizacion' | Out-Null
Start-ScheduledTask -TaskName $name
Write-Host '[CAHOS] Agente cloud instalado y programado al iniciar sesion.' -ForegroundColor Green
Write-Host '[CAHOS] No requiere abrir el navegador, servicios locales ni Windows PowerShell manualmente.'
Write-Host ('[CAHOS] Estado local (sin secretos): '+(Join-Path $base 'cloud_agent_status.json'))
