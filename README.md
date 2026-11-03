# CAHOS v0.6 · Inicio automático y mapa municipal

**Instalación local recomendada (Windows):** descargue este repositorio como ZIP, abra la carpeta \`extractor\` y ejecute \`INSTALAR_CAHOS.bat\` **una sola vez**. El instalador conserva la conexión OLAP original del Excel, permite importar una vez las proyecciones demográficas, copia el motor a \`%LOCALAPPDATA%\CAHOS\app\`, registra arranque con Windows y abre el visor en \`http://127.0.0.1:8789\`.

A partir de ahí, no es necesario ejecutar cada día \`PROBAR_CONEXION.bat\`, abrir Python ni consultar manualmente todas las fuentes. El visor intenta la consulta al abrir el panorama, actualiza el mapa cuando se selecciona y sincroniza las patologías programadas en el intervalo configurado mientras el equipo y la conexión estén disponibles.

**Fuentes y limitaciones:** conteos SUIVE del cubo SINAVE (conexión guardada en el Excel, solo lectura); polígonos de INEGI, 72 municipios; denominadores de proyecciones COESPO/CONAPO del Excel local, no del INEGI. La relación municipal intenta la clave \`CVEGEO\` antes de usar nombres, y avisa cuando el cubo no devuelve filas o no hay correspondencia cartográfica. Gris no equivale a cero. El canal endémico no imputa semanas sin dato.

**GitHub Pages** es el portal estático y no comparte las credenciales ni las extracciones locales. Para consulta institucional remota se necesita una API HTTPS protegida y autorización específica de publicación.

---

# CAHOS | Plataforma de análisis epidemiológico

CAHOS retoma su desarrollo como una plataforma modular. Su **primer módulo es el Visor SUIVE**, orientado a lectura y consulta parametrizada de cubos del SINAVE: padecimiento, años, semanas epidemiológicas, entidad/municipio, sexo y edad.

## Módulo 01: Visor SUIVE

- Tablero de patologías preseleccionadas, filtros territoriales y temporales.
- Comparativos de años, series semanales, distribución por edad/sexo y canal endémico exploratorio cuando existan series comparables suficientes.
- Programación de patologías favoritas y consultas automáticas a través de un **servicio institucional protegido**, una vez conectado.
- Exportación de resultados agregados solo según los permisos de la API.

## Estado

**Vista web disponible para publicación. Datos reales: pendientes.** La versión GitHub Pages no accede al cubo directamente, no almacena ni publica contraseñas, no ejecuta Python/PowerShell y no muestra datos sintéticos como oficiales. La conexión SINAVE deberá realizarse mediante acceso institucional autorizado de solo lectura, en un backend aislado que autentique usuarios, audite consultas y autorice únicamente salidas publicables.

## Despliegue

Repositorio: [doctopanda/CAHOS](https://github.com/doctopanda/CAHOS).Página esperada si el despliegue está habilitado: `https://doctopanda.github.io/CAHOS/`.

La carpeta `public/` es la única publicada por el flujo de GitHub Actions `.github/workflows/pages.yml`. En GitHub: **Settings → Pages → Build and deployment → GitHub Actions**. No incluir en el repositorio archivos Excel originales con conexiones MSOLAP, datos nominales, credenciales, exportaciones o servicios internos.

`public/configuracion-publica.js` contiene solo parámetros de visualización públicos. Mantener `apiBaseUrl: ""` mientras no exista una API segura validada. No colocar tokens ni claves en JavaScript público.

## Próximas etapas

1. Validar consultas MDX contra el cubo en equipo autorizado y permisos institucionales.
2. Preparar API autenticada que presente exclusivamente agregados autorizados a CAHOS.
3. Activar actualización automática de patologías programadas, trazabilidad y corte SE.
4. Validar casos/tasas y cálculos de canales endémicos frente a fuentes oficiales.
5. Incorporar nuevos módulos de CAHOS sin alterar la lectura SUIVE.

## Fase siguiente: extractor automatizado v0.4 (Windows)

El código del extractor de solo lectura está en [extractor/](extractor/) y su [manual de conexión y validación](extractor/LEEME.md).

En un equipo Windows autorizado, copie `extractor/configuracion.ejemplo.json` a `extractor/configuracion.json`, compruebe la conectividad con `PROBAR_CONEXION.bat`, y luego ejecute `INICIAR_EXTRACTOR.bat`. Si la cuenta requiere credenciales adicionales, utilice `CONFIGURAR_ACCESO.ps1` para cifrarlas localmente con DPAPI, nunca para publicarlas.

**Estado real:** el conector MDX está implementado y probado de forma local con respuestas simuladas, pero el acceso al servidor SINAVE y la exactitud de los resultados todavía están pendientes de validación en una red institucional. No se publican cifras SUIVE sin permiso ni controles de acceso. GitHub Pages no puede consultar el puerto 127.0.0.1 del equipo de extracción; la API HTTPS autenticada es una etapa distinta.
