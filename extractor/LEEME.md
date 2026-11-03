# CAHOS | Modo cubo desde Excel (sin escribir credenciales nuevas)

**Nuevo: origen de conexión `excel`.** El libro `Cubos_2003_Actual.xlsx` incluye una conexión OLAP guardada. El extractor puede reutilizarla directamente desde el archivo local, sin modificar el libro, sin exportaciones manuales y sin copiar contraseñas al repositorio.

## Puesta en marcha con la conexión que ya utiliza Excel

1. Descargue el proyecto desde GitHub: **Code > Download ZIP**. Extraiga todo y abra la carpeta `extractor`.
2. Ejecute **`SELECCIONAR_EXCEL.bat`**. Elija su libro original de cubos SINAVE, ubicado donde lo guarde normalmente. Esto solo almacena su ruta en `%LOCALAPPDATA%\\CAHOS\\configuracion_local.json`; **no lo modifica ni lo copia**.
3. Ejecute **`PROBAR_CONEXION.bat`**. El sistema intentará abrir la conexión guardada y enumerar catálogos autorizados. Si el proveedor de Excel está disponible y la conexión sigue vigente, el resultado será `Conexion OLAP: OK`.
4. Ejecute **`INICIAR_EXTRACTOR.bat`** y abra **http://127.0.0.1:8789**. En **Programación**, elija patologías; en **Panorama**, cambie año, semana, entidad, municipio, sexo y edad. Los cambios generan consultas MDX `SELECT` al cubo.
5. Configure patologías favoritas y actualización periódica, que funcionará mientras el equipo y el servicio estén encendidos.

**Importante:** abrir el libro como «solo lectura» impide modificar el archivo, pero no sustituye los permisos del servidor. Aunque no te pida usuario/contraseña, el libro puede incorporar datos de autenticación guardados; CAHOS solo los usa temporalmente en memoria. No envíe a GitHub ni comparta por chat ese libro ni los archivos guardados en `%LOCALAPPDATA%\\CAHOS`.

Los datos quedan en el equipo local. **GitHub Pages no puede consultar el servidor local** ni divulgará datos automáticamente. Para publicar datos reales habrá que autorizar un mecanismo de API segura o agregados aprobados.

---

# CAHOS · Extractor automático SUIVE v0.4 (Windows)

**Propósito.** Leer el cubo OLAP del SINAVE con la cuenta institucional autorizada, en modo de solo lectura. Ofrece un servicio local con consultas MDX parametrizadas por enfermedad, año, semana, entidad, municipio, sexo y grupo de edad. Una lista configurable de patologías se consulta automáticamente cada seis horas mientras el servicio esté activo.

**No es un backend público.** El proceso escucha exclusivamente en `127.0.0.1:8789` y almacena resultados privados en `%LOCALAPPDATA%\CAHOS\extracciones_privadas`. GitHub Pages es solo la interfaz y **no puede alcanzar `localhost` del equipo institucional** ni ejecutar el conector. Conectar CAHOS público requerirá una API institucional HTTPS con autenticación, autorización de datos y aprobación de publicación.

## Primera prueba (sin contraseñas en el chat ni en GitHub)

1. En una computadora Windows con acceso institucional o VPN, compruebe que el Excel original **pueda actualizar su tabla dinámica**. En caso contrario, verifique el acceso con sistemas antes de diagnosticar el código.
2. Instale Python 3 si no está disponible y el proveedor MSOLAP que corresponda a Windows/Office (el Excel original usa un proveedor legado; puede requerir actualización). Información oficial de Microsoft: https://learn.microsoft.com/analysis-services/client-libraries
3. Descomprima este paquete en una carpeta local. Ejecute `PROBAR_CONEXION.bat`. Primero probará autenticación integrada con su usuario de Windows.
4. Si el equipo requiere credencial institucional adicional, ejecute `CONFIGURAR_ACCESO.ps1` desde PowerShell para guardarla cifrada localmente con DPAPI. **No reutilice claves incluidas en libros Excel antiguos sin validación de autorización**. Repita `PROBAR_CONEXION.bat`.
5. Si la lectura funciona, ejecute `INICIAR_EXTRACTOR.bat`, abra http://127.0.0.1:8789 y seleccione patologías en **Programación**. Elija guardar la lista; el proceso sincronizará resultados periódicamente mientras esté encendido.
6. Opcional: ejecute `INSTALAR_INICIO_WINDOWS.ps1` bajo el mismo usuario para arranque automático al iniciar sesión. No es necesario ejecutar como administrador si la política local lo permite.

## Validaciones importantes

- Los metadatos de dimensiones y medidas se extrajeron del Excel original, pero **no hemos validado todavía consultas reales al servidor** desde este entorno.
- El código no extrae credenciales del archivo `.xlsx` ni permite comandos MDX de escritura.
- El catálogo real puede necesitar ajustes si el servidor cambió jerarquías desde que se guardó el archivo original.
- Los campos agregados del cubo pueden representar notificaciones y deben validarse frente a un corte oficial.
- No suba `configuracion.json` con preferencias institucionales, la carpeta `%LOCALAPPDATA%\CAHOS` ni resultados del cubo a GitHub.
- Un canal endémico exige años semanales comparables, vigilancia homogénea y reglas epidemiológicas documentadas; no se debe calcular tratando ausentes como ceros.

## Arquitectura de integración posterior

`SINAVE (OLAP) -> Conector local CAHOS -> Motor analítico institucional (acceso protegido) -> API HTTPS autenticada -> GitHub Pages (solo UI)`

Una alternativa, **solo con autorización institucional explícita**, sería publicar agregados previamente aprobados. Nunca activar publicación automática de conteos por municipios/edad/sexo hasta aprobar políticas de divulgación y supresión de celdas pequeñas.
