# Puente local, consultas OLAP de solo lectura. Ningún comando de escritura está expuesto.
# ENTRADA: JSON por stdin. SALIDA: JSON por stdout.
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$connection = $null
$recordset = $null
try {
  $inputJson = [Console]::In.ReadToEnd()
  $request = $inputJson | ConvertFrom-Json
  $cfg = $request.config
  if ($cfg.servidor -notmatch '^[a-zA-Z0-9.-]+$' -or $cfg.catalogo -notmatch '^[\w .-]+$' -or $cfg.cubo -notmatch '^[\w .-]+$') { throw 'Configuración del servidor no válida' }
  if ($cfg.proveedor -notin @('MSOLAP','MSOLAP.5','MSOLAP.6','MSOLAP.7','MSOLAP.8')) { throw 'Proveedor no permitido' }
  # MODO EXCEL: la conexión original se lee de la copia LOCAL del XLSX, solo en memoria.
  # Las credenciales que Excel pudiera tener guardadas nunca se imprimen, exportan ni
  # pasan al navegador. El archivo original NO se modifica.
  if ([string]$cfg.origen_conexion -eq 'excel') {
    $workbook = [string]$cfg.ruta_archivo_excel
    if ([string]::IsNullOrWhiteSpace($workbook) -or -not (Test-Path -LiteralPath $workbook -PathType Leaf) -or [IO.Path]::GetExtension($workbook).ToLowerInvariant() -ne '.xlsx') {
      throw 'ARCHIVO_EXCEL_NO_DISPONIBLE'
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [System.IO.Compression.ZipFile]::OpenRead($workbook)
    try {
      $entry = $zip.GetEntry('xl/connections.xml')
      if (-not $entry) { throw 'LIBRO_SIN_CONEXIONES_OLAP' }
      $stream = $entry.Open()
      $reader = New-Object System.IO.StreamReader($stream)
      try { [xml]$connXml = $reader.ReadToEnd() } finally { $reader.Dispose() }
      $connNode = $connXml.SelectSingleNode("//*[local-name()='connection' and @name='Cubo_2003_Actual']/*[local-name()='dbPr']")
      if (-not $connNode) {
        $connNode = $connXml.SelectSingleNode("//*[local-name()='connection']/*[local-name()='dbPr']")
      }
      if (-not $connNode) { throw 'LIBRO_SIN_CONEXION_OLAP_UTILIZABLE' }
      $savedConnection = [string]$connNode.GetAttribute('connection')
      if ($savedConnection -notmatch '(?i)(^|;)\s*Provider=MSOLAP(?:\.[0-9]+)?\s*;') { throw 'LA_CONEXION_NO_ES_MSOLAP' }
      if ($savedConnection -notmatch '(?i)(^|;)\s*Initial Catalog=') { throw 'CONEXION_INCOMPLETA' }
      # Mantener todos los parámetros de acceso guardados en Excel; evitar persistirlos
      # dentro del objeto COM luego de iniciar sesión.
      $savedConnection = [regex]::Replace($savedConnection, '(?i)Persist Security Info=True', 'Persist Security Info=False')
      $connectionString = $savedConnection + ';Connect Timeout=20'
      $savedConnection = $null
    } finally { $zip.Dispose() }
  } else {
  $parts = @(
    ('Provider=' + $cfg.proveedor),
    ('Data Source=' + $cfg.servidor),
    ('Initial Catalog=' + $cfg.catalogo),
    'Persist Security Info=False',
    'Connect Timeout=20',
    'MDX Compatibility=1',
    'MDX Missing Member Mode=Error'
  )
  # Orden de autenticacion: credencial cifrada Windows DPAPI; variables de entorno; Windows SSPI.
  # Nunca se lee la contrasena almacenada en el Excel original.
  $saved = Join-Path $env:LOCALAPPDATA 'CAHOS\acceso_sinave.xml'
  if (Test-Path -LiteralPath $saved) {
    $cred = Import-Clixml -LiteralPath $saved
    $user = $cred.UserName
    $secret = $cred.GetNetworkCredential().Password
    $parts += ('User ID="' + $user.Replace('"','""') + '"')
    $parts += ('Password="' + $secret.Replace('"','""') + '"')
    $secret = $null
  } elseif ($env:SUIVE_USER -and $env:SUIVE_PASSWORD) {
    $parts += ('User ID="' + $env:SUIVE_USER.Replace('"','""') + '"')
    $parts += ('Password="' + $env:SUIVE_PASSWORD.Replace('"','""') + '"')
  } else {
    $parts += 'Integrated Security=SSPI'
  }
  $connectionString = $parts -join ';'
  }
  $connection = New-Object -ComObject ADODB.Connection
  $connection.ConnectionTimeout = 20
  $connection.CommandTimeout = 75
  try {
    $connection.Open($connectionString)
  } catch {
    # Algunos libros antiguos usan MSOLAP.5, ya retirado de soporte.
    # Si falta esa versión, probar el proveedor MSOLAP instalado sin cambiar
    # los demás parámetros de la conexión guardada.
    $reason = [string]$_.Exception.Message
    if ([string]$cfg.origen_conexion -eq 'excel' -and
        $connectionString -match '(?i)Provider=MSOLAP\.[0-9]+' -and
        $reason -match '(?i)provider cannot be found|proveedor.*no se encuentra|class not registered|clase no registrada|REGDB_E_CLASSNOTREG') {
      $modern = [regex]::Replace($connectionString, '(?i)Provider=MSOLAP\.[0-9]+', 'Provider=MSOLAP')
      $connection.Open($modern)
      $modern = $null
    } else { throw }
  }
  $connectionString = $null
  $rows = New-Object System.Collections.ArrayList
  $columns = @()
  if ($request.action -eq 'probe') {
    [Console]::Out.Write((@{ok=$true; connected=$true; provider=[string]$cfg.proveedor; catalog=[string]$cfg.catalogo} | ConvertTo-Json -Compress))
    exit 0
  } elseif ($request.action -eq 'catalog') {
    $dim = [string]$request.hierarchy
    if ($dim -notin @('[Padecimientos].[Padecimiento]', '[Años].[Año]', '[Semanas epidemiológicas].[Semana]', '[Municipios].[Municipio]', '[Entidades].[Entidad]', '[Sexo].[Sexo]', '[Grupos de edades].[Grupo de edad]', '[Instituciones].[Institución]')) { throw 'Jerarquía no autorizada' }
    # MDSCHEMA_MEMBERS, restricciones: catálogo, esquema, cubo, dimensión, jerarquía.
    # Algunos proveedores antiguos requieren VARIANT Empty para las posiciones sin restricción.
    $restrictions = New-Object 'object[]' 5
    $restrictions[2] = [string]$cfg.cubo
    $restrictions[4] = $dim
    try {
      $recordset = $connection.OpenSchema(38, $restrictions)
    } catch {
      # DMV de solo lectura, disponible en numerosas versiones de Analysis Services.
      $cmd = New-Object -ComObject ADODB.Command
      $cmd.ActiveConnection = $connection
      $cmd.CommandTimeout = 75
      $escapedCube = ([string]$cfg.cubo).Replace("'", "''")
      $escapedDim = $dim.Replace("'", "''")
      $cmd.CommandText = "SELECT MEMBER_UNIQUE_NAME, MEMBER_CAPTION, MEMBER_TYPE, HIERARCHY_UNIQUE_NAME FROM `$SYSTEM.MDSCHEMA_MEMBERS WHERE CUBE_NAME = '$escapedCube' AND HIERARCHY_UNIQUE_NAME = '$escapedDim'"
      $recordset = $cmd.Execute()
    }
  } elseif ($request.action -eq 'query') {
    $mdx = [string]$request.mdx
    # Defensa en profundidad: el Python genera exclusivamente SELECT con miembros del catálogo.
    if ($mdx.Length -gt 30000 -or $mdx -notmatch '^SELECT\s' -or $mdx -match '(?i)\b(CREATE|ALTER|DROP|DELETE|UPDATE|INSERT|PROCESS|BACKUP|RESTORE|ASSL)\b') { throw 'Solo se autorizan consultas MDX SELECT' }
    $cmd = New-Object -ComObject ADODB.Command
    $cmd.ActiveConnection = $connection
    $cmd.CommandTimeout = 75
    $cmd.CommandText = $mdx
    $recordset = $cmd.Execute()
  } else { throw 'Acción no autorizada' }
  for ($j=0; $j -lt $recordset.Fields.Count; $j++) { $columns += [string]$recordset.Fields.Item($j).Name }
  $maxRows = 7500
  while (-not $recordset.EOF) {
    if ($rows.Count -ge $maxRows) { throw 'Resultado demasiado grande: reduzca años, semanas o territorio' }
    $v = @()
    for ($j=0; $j -lt $recordset.Fields.Count; $j++) {
      $item = $recordset.Fields.Item($j).Value
      if ($null -eq $item -or $item -is [DBNull]) { $v += $null }
      elseif ($item -is [string]) { $v += $item }
      elseif ($item -is [bool]) { $v += $item }
      elseif ($item -is [ValueType]) { $v += $item }
      else { $v += [string]$item }
    }
    [void]$rows.Add($v)
    $recordset.MoveNext()
  }
  $output = @{ ok=$true; columns=@($columns); rows=@($rows) }
  [Console]::Out.Write(($output | ConvertTo-Json -Depth 8 -Compress))
} catch {
  # Diagnóstico por categoría; NUNCA mostrar el mensaje bruto del proveedor,
  # porque puede incluir detalles de conexión y credenciales del libro.
  $raw = [string]$_.Exception.Message
  $code = 'CONEXION_OLAP_NO_VALIDADA'
  $safe = 'No fue posible conectar al cubo. Verifique que Excel pueda actualizar el libro original en este equipo.'
  if ($raw -match 'ARCHIVO_EXCEL_NO_DISPONIBLE|LIBRO_SIN_|CONEXION_INCOMPLETA|LA_CONEXION_NO_ES_MSOLAP') {
    $code = 'ORIGEN_EXCEL'; $safe = 'No se pudo usar la conexión del Excel seleccionado. Compruebe que es el libro de cubos SINAVE.'
  } elseif ($raw -match '(?i)provider cannot be found|proveedor.*no se encuentra|class not registered|clase no registrada|REGDB_E_CLASSNOTREG|MSOLAP.*not registered') {
    $code = 'PROVEEDOR_MSOLAP'; $safe = 'El proveedor MSOLAP del libro no está disponible en esta arquitectura de Windows. Revise la versión con TI.'
  } elseif ($raw -match '(?i)login failed|authentication|credenciales|logon failure|access denied|acceso denegado|unauthorized|usuario.*contrase') {
    $code = 'ACCESO_ORIGINAL'; $safe = 'La conexión del libro no pudo autenticarse. Pruebe actualizar ese mismo libro directamente en Excel.'
  } elseif ($raw -match '(?i)timeout|timed out|tiempo de espera|network|red.*no disponible|host.*not found|servidor.*no encontrado|could not connect') {
    $code = 'RED_O_VPN'; $safe = 'No se localizó o respondió el servidor del cubo. Verifique la conectividad del equipo.'
  }
  [Console]::Out.Write((@{ok=$false; error=$safe; tipo=$code} | ConvertTo-Json -Compress))
  exit 1
} finally {
  if ($null -ne $recordset) { try { $recordset.Close() } catch {} }
  if ($null -ne $connection) { try { $connection.Close() } catch {} }
}
