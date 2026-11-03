# CAHOS v0.6 | Instalación automática y mapa municipal

**La versión recomendada ya no requiere ejecutar PROBAR_CONEXION ni INICIAR_EXTRACTOR diariamente.**

1. Cierre por única vez la antigua ventana del extractor que esté ocupando el puerto 8789.
2. Descargue el repositorio CAHOS como ZIP y extráigalo en una carpeta temporal.
3. Abra \`extractor\INSTALAR_CAHOS.bat\` una sola vez. Use la conexión del Excel ya configurada (no se pide contraseña nueva); si falta, el instalador abre el selector.
4. Si todavía no hay población local, seleccione el libro oficial de proyecciones municipales Sonora 2015–2030 una sola vez; su importación se conserva en \`%LOCALAPPDATA%\CAHOS\poblacion_sonora.json\`. Se puede omitir y agregar después, en cuyo caso no habrá tasas.
5. Windows inicia el extractor local de forma automática al iniciar sesión, usando el Programador de tareas (o la carpeta Inicio del usuario si la política lo restringe). El servicio sigue actualizando favoritas según el intervalo configurado mientras esté encendido y haya acceso al cubo.
6. Para abrir CAHOS sin usar terminal: guarde un acceso directo a \`http://127.0.0.1:8789\`, o haga doble clic en \`extractor\ABRIR_CAHOS.bat\`. En el primer arranque, el instalador ya abre el navegador.

**Fuentes:** casos del cubo SINAVE consultado por MSOLAP; polígonos de los 72 municipios descargados de los servicios oficiales de INEGI; denominadores de proyecciones COESPO/CONAPO, importados al equipo desde su libro de trabajo. **INEGI no es el origen de la población proyectada** y los casos no se descargan de INEGI.

**Mapa:** la aplicación usa \`CVEGEO\` cuando puede extraerse del identificador MDX municipal; si no, intenta comparar denominaciones normalizadas y muestra cuántas filas quedaron sin asociación. Los polígonos sin casos asociados se presentan como *sin dato*, nunca como cero.

**Control epidemiológico:** el panel no inventa semanas faltantes; los canales P25/P50/P75 se marcan exploratorios y solo incluyen semanas con al menos cinco observaciones históricas de los seis años anteriores.

**Nota de arquitectura:** GitHub Pages solo publica código HTML/JS y cartografía pública. No puede conectarse a \`127.0.0.1:8789\` desde otro equipo ni consultar el cubo SINAVE por sí solo. El servicio local nunca se expone a internet. Una versión institucional en la nube necesita despliegue y permisos expresos de su API privada.

---

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
