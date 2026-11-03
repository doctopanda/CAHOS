# CAHOS: extracción automática sin ventanas, y ruta hacia acceso sin instalación

## Reparación de ventanas repetitivas (v0.6.1)

En versiones previas, `pythonw.exe` iniciaba consultas OLAP con `powershell.exe`, pero los procesos secundarios no especificaban `CREATE_NO_WINDOW` en Windows. Es una causa probable de ventanas de consola intermitentes, sobre todo al consultar varios catálogos o padecimientos.

Desde v0.6.1 se pasa `creationflags=subprocess.CREATE_NO_WINDOW` en Windows para que las consultas OLAP de PowerShell no abran una ventana visible. No cambia el modo de autenticación ni modifica el Excel.

**Recuperación:**
1. Si aparecen ventanas repetidas, ejecutar `extractor/DETENER_CAHOS.bat` desde el nuevo ZIP del repositorio. Este script deshabilita la tarea del usuario y quita un posible acceso duplicado de Inicio; intenta detener únicamente instancias Python relacionadas con CAHOS.
2. En la misma carpeta, ejecutar `extractor/REPARAR_CAHOS.bat`. Copia los archivos actualizados a `%LOCALAPPDATA%\CAHOS\app`, conserva `configuracion_local.json`, el XLSX, `poblacion_sonora.json` y extracciones locales, registra un solo arranque y prueba el servicio.
3. Abrir `http://127.0.0.1:8789`. Si la reparación falla, la ventana permanece abierta con un error. La conexión al cubo puede necesitar que la computadora tenga red autorizada, pero esto es independiente de la reparación de ventanas.

Los scripts de inicio o reparación son para el equipo Windows que tiene acceso al cubo; GitHub Pages no ejecuta Python, PowerShell ni el proveedor MSOLAP.

## ¿Y si queremos que cualquier usuario abra solo https://doctopanda.github.io/CAHOS/?

La solución sostenible es centralizar las extracciones, no instalar CAHOS en cada estación:

1. **Una máquina o servicio institucional de confianza**, conectado legalmente al cubo OLAP, ejecuta las consultas programadas de solo lectura y crea resultados agregados con fecha de extracción, periodo y fuente.
2. El módulo de validación revisa claves municipales, totales, series, denominadores y confidencialidad de celdas pequeñas; ninguna ausencia se convierte en cero sin comprobación.
3. **API HTTPS con autenticación y autorizaciones**: entrega datos agregados a los roles correspondientes. Datos públicos solo cuando hayan sido expresamente aprobados.
4. GitHub Pages aloja el frontend CAHOS; cada usuario abre la web y navega sin instalar el extractor ni manejar claves.

**Variante limitada:** publicar archivos JSON estáticos con agregados expresamente autorizados en GitHub Pages. La web puede consultarlos con `fetch`, pero no estarán en tiempo real y **nunca** deben contener el XLSX con su conexión, credenciales, datos nominales ni tablas que permitan identificación. Se actualizan mediante una tarea programada en el servidor institucional, no desde un GitHub Actions público conectado al cubo.

> **Precaución:** GitHub recomienda no asociar ejecutores `self-hosted` con repositorios públicos cuando tengan acceso a sistemas privados o secretos. Si se usa un ejecutor de GitHub Actions, ubicarlo en un repositorio *privado* y sujeto a la política de TI, nunca en `doctopanda/CAHOS` público.

## Aún por validar en el equipo real

No se ha probado esta corrección en el Windows del usuario. La reparación del código y las validaciones estáticas no garantizan que ninguna otra aplicación esté abriendo ventanas, ni que todos los consultas MDX municipales respondan correctamente. No afirmamos que el sitio público tenga acceso al cubo.
