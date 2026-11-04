# CAHOS 0.7 · Visor web sin instalaciones por usuario

**Estado:** arquitectura propuesta, no desplegada. El portal público en `https://doctopanda.github.io/CAHOS/` sigue siendo estático y su `public/configuracion-publica.js` tiene `apiBaseUrl: ""`. No declarar conexión web en vivo hasta implementar, asegurar y probar la API.

## Objetivo de producto

Abrir el enlace, seleccionar patología SUIVE, año(s), semana(s), municipio(s), grupo de edad y sexo; mostrar inmediatamente la última extracción autorizada y actualizar una consulta si los datos no existen o han caducado. Sin instalar Python, MSOLAP ni Excel en la computadora de cada usuario. Sin ventanas emergentes de PowerShell. Fuente original siempre de solo lectura.

## Diseño elegido

```
Navegador de usuario
  -> GitHub Pages CAHOS (solo frontend)
  -> API HTTPS autenticada (Supabase Edge Functions u otra API institucional)
       -> autoriza usuario, valida parámetros y busca snapshots con corte
       -> si no está en caché, encola una consulta MDX predefinida
  -> CAHOS Agent Windows, UNA instalación en equipo autorizado
       <- obtiene tareas mediante HTTPS saliente (sin puertos entrantes)
       -> lee cubo SINAVE por MSOLAP usando conexión existente local
       -> valida y normaliza dimensiones, cobertura y coincidencia municipal
       -> envía resultado agregado protegido a la API HTTPS
  -> repositorio analítico seguro (Postgres/RLS y bitácora)
  -> interfaz consulta snapshots o recibe nuevo resultado
```

El trabajador Windows requiere conectividad con SINAVE y con el servicio remoto; para responder permanentemente debe estar activo en una computadora central encendida o una VM Windows institucional. No instalar un runner GitHub Actions del repositorio público en la red del cubo.

## Modos de extracción

**Programada:** cada intervalo autorizado (provisional: seis horas) para patologías favoritas, con consultas anuales y semanales de 6 años previos + año seleccionado. Evitar consultas masivas que saturen cubo; limitar concurrencia y guardar fecha/corte.

**Bajo demanda:** `POST /consultas` recibe únicamente parámetros de catálogo (NO una cadena MDX arbitraria), valida pertenencia y permisos, calcula huella canónica del filtro; si existe caché vigente devuelve resultado; si no, crea solicitud con estados `pendiente / en_ejecucion / disponible / error`. El worker procesa una a la vez, con tiempo máximo y reintentos acotados. `GET /consultas/{id}` consulta progreso. Browser nunca ve la conexión del cubo.

**Lectura inicial:** el portal abre con el último snapshot autorizado, fecha de extracción y cobertura. Si el trabajador está apagado, anuncia “último dato disponible”; no simula actualización ni convierte valores ausentes en cero.

## Componentes mínimos

| Componente | Responsabilidad |
|---|---|
| GitHub Pages `public/` | UI de panoramas, mapa y canales |
| CAHOS Auth | Identidad, rol y ámbito territorial |
| API HTTPS | `status`, `catalog`, `query`, `favorites`, `population`, `geography` |
| Cola interna | Solicitudes MDX validadas y deduplicadas, accesibles solo al worker |
| CAHOS Agent Windows | MSOLAP, periodicidad, ejecución limitada, reintentos y bitácora |
| Resultados agregados | Conteos validados, corte, fecha de extracción, fuente, filtros y cobertura |
| Indicadores | Tasas con año, edad, sexo y municipio compatibles; canal histórico con semanas observables |

## Restricciones de privacidad y seguridad

- Nunca subir `Cubos_2003_Actual*.xlsx`, su cadena de conexión, contraseñas, datos LESP identificables o registros nominales a GitHub, Supabase público ni a scripts del navegador.
- El agente solo hace conexiones de **salida** mediante HTTPS; no exponer `127.0.0.1:8789`, MSOLAP ni puertos Windows.
- RLS activado para tablas expuestas; política por usuario y rol, institución/distrito y propósito. `service_role` solo en entorno protegido. Colas internas sin permisos de lectura directa para usuarios.
- Validación de agregados publicables y supresión de celdas pequeñas cuando aplique; supresión complementaria si pudiera reconstruirse un valor. Los tableros públicos se limitan a datos previamente autorizados. SEED y LESP en módulos privados separados.
- No exponer datos como “2026 completo” cuando son parciales. Registrar `fecha_extraccion`, `ultima_SE_disponible`, `cobertura`, `origen` y `version` en cada resultado.
- Validar alineación municipal por CVEGEO; distinguir `cero notificaciones`, `sin datos` y `sin coincidencia geográfica`.
- Trabajador no ejecuta MDX suministrado por usuarios; solo consultas compuestas internamente desde catálogos permitidos.

## Etapas de construcción y validación

1. **Consolidar extractor central:** convertir CAHOS Windows en un servicio silencioso y único, con log y healthcheck, sin procesos duplicados. Conservar su conexión Excel local existente.
2. **Crear una instancia exclusiva del backend CAHOS:** nuevas tablas de catálogos, resultados y cola. Supabase es opción, no usar proyectos EDITH, BALAM o Nutriendo por conveniencia.
3. **Levantar API/worker con una consulta piloto:** dengue, Sonora, SE seleccionadas, 6 años históricos y año actual; validar contra Excel; verificar correspondencia de 72 municipios.
4. **Migrar el frontend web:** conectar `public/configuracion-publica.js` solamente cuando HTTPS, CORS, autenticación, RLS y pruebas de lectura estén aprobadas. Mantener `apiBaseUrl=""` durante desarrollo.
5. **Activar sincronización escalonada:** patologías programadas + trabajo bajo demanda, límites de volumen, auditoría, avisos de retraso y último corte.

## Alternativa más simple, solo si se autoriza publicación de agregados

Un agente local podría generar archivos JSON no identificables, revisados para publicación, y subirlos a GitHub. El sitio los visualizaría sin backend dinámico. **Limitación:** no responde consultas nuevas fuera del conjunto preextraído y solo se actualiza cuando el agente corre. No aplicar esta alternativa a exportaciones completas del cubo o combinaciones finas de municipio/sexo/edad sin autorización.

## Criterios de aceptación antes de anunciar la conexión web activa

1. El usuario abre el enlace desde otra computadora sin Python.
2. El backend entrega una extracción real autorizada con fecha/corte.
3. Una consulta no precargada se encola, se procesa sin consola en el equipo central y aparece en el visor.
4. Si Windows central está apagado, se muestra el último corte sin inventar datos y la consulta queda pendiente.
5. La revisión de permisos verifica que no pueden consultarse registros, subgrupos o territorios no autorizados.
6. Los canales y tasas conservan el mismo resultado calculado en el extractor validado con Excel.

**No implica autorización de publicación de información del SINAVE.** Se requiere aprobación de políticas de datos, infraestructura, servicio central y acceso web antes del despliegue de datos reales.
