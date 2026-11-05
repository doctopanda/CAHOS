# CAHOS · LESP protegido en Supabase: versión vigente y reemplazo

Estado: **desplegado en Supabase del proyecto CAHOS**, 5 de noviembre de 2026.
Proyecto verificado por la URL pública que usa CAHOS; la cuenta conectada lo muestra con el nombre de proyecto **CHAOS**.

## Base inicial migrada
- Año: **2026** · 690 celdas agregadas (año, SE, municipio, patología).
- 3,489 resultados positivos candidatos en el extracto · 14 municipios · 12 categorías · SE 1–43.
- Fuente: `LESP Sonora · Alerta temprana 2026`.
- Tipo: positivo clasificado a partir del resultado reportado, **NO casos confirmados de vigilancia**, **NO pacientes únicos**.
- Temporalidad: semana de emisión del informe.
- Geografía: procedencia consignada en el informe, no necesariamente residencia.
- Registros sin procedencia municipal conciliable: 941 en la calidad del extractor; no fueron asignados a un municipio.
- Hash SHA-256 del contenido canónico agregado: `70375809ba3821a0b72f50a3b976e06112491a7103ebdafcfebc312ba03de1b4`.
- Resultado SQL verificado tras activar: 690 filas, suma 3,489, sin duplicados de clave.
- No se subieron ni almacenaron los Excel nominales, nombres de pacientes, CURP, domicilio, ni folios individuales.

## Modelo de datos
| Tabla | Contenido |
|---|---|
| `public.cahos_lesp_versions` | Identificador de carga, año, hash, fecha, cobertura positiva observada, calidad, estado |
| `public.cahos_lesp_counts` | Conteos agregados por año, semana, municipio y patología, asociados a la versión |
| `public.cahos_lesp_active` | Un puntero a la versión activa por año |
| `public.cahos_lesp_audit` | Bitácora compacta de cargas, publicaciones y sustituciones |

La versión entrante se prepara **sin tocar** la vigente. El servicio valida filas, claves, límites y suma; solo entonces conmuta el puntero activo. Tras activar, elimina las filas operativas anteriores; conserva hashes y metadatos pequeños para auditoría.

El servicio incluye protección contra reenvío de versiones idénticas (sin duplicar filas) y rechazo de versiones cuyo último registro positivo esté en una semana anterior a la activa. **Esta protección no reemplaza la verificación de que el nuevo Excel sea un corte acumulado íntegro.** No usar un archivo parcial sin reconstruir el agregado anual completo.

## Seguridad
- RLS habilitado en las cuatro tablas, sin políticas de lectura directa para `anon` ni `authenticated`.
- `REVOKE ALL` explícito sobre tablas privadas a `PUBLIC`, `anon`, `authenticated`; solo `service_role` posee privilegios necesarios.
- El endpoint dedicado `cahos-lesp` valida el token con Supabase Auth y comprueba `cahos_members.enabled=true` e `is_master=true` en la base, antes de consultar o actualizar.
- El secret key está disponible solo del lado servidor. No está en el repositorio público ni en el navegador.
- Las lecturas actuales están restringidas al Maestro hasta aprobar formalmente el acceso agregado para otros roles, supresión de celdas pequeñas y nivel distrital cuando aplique.
- `verify_jwt=false` en el gateway de esta función **porque el cuerpo del servicio efectúa autenticación y autorización propias en cada ruta protegida**. Nunca retirar esas verificaciones sin rediseñar la configuración.

## Endpoints protegidos
- `GET /functions/v1/cahos-lesp/health`: solo estado del servicio (sin información).
- `GET /functions/v1/cahos-lesp/snapshot?year=2026`: versión activa, solo Maestro.
- `POST /functions/v1/cahos-lesp/import`: corte anual acumulado completo, solo Maestro y confirmación de publicación; sin archivo nominal.

## Operación ante un nuevo corte LESP
1. Recibir Excel XLSX en el equipo institucional; **no enviar el XLSX a GitHub Pages**.
2. Producir un **único JSON agregado y depurado** para ese año, con clasificación y calidad revisadas.
3. Abrir MAPA CAHOS como Administrador Maestro. El archivo vigente se consulta automáticamente desde Supabase.
4. Importar el nuevo JSON en **vista previa local** y revisar sumas, municipio, patología y SE.
5. Pulsar **Publicar versión protegida** y confirmar que el corte es acumulado completo.
6. La función inserta la nueva versión de forma escalonada, verifica integridad, actualiza el puntero activo y elimina las filas previas.
7. Los futuros accesos a CAHOS ya leen la versión vigente sin volver a importar el archivo.

## Precauciones epidemiológicas y futuras fases
- No inferir 0 casos confirmados en un municipio ausente del extracto.
- No sumar SUIVE y LESP como si fueran fuentes intercambiables.
- Aún se requiere validación oficial de casos por patología y deduplicación longitudinal de pacientes/muestras si se desea hablar de casos confirmados.
- Para refrescar desde XLSX automáticamente, desarrollar un extractor local institucional que identifique claves estables y transforme el corte anual antes de publicar. La primera fase permite enviar nuevas versiones de Excel en ChatGPT y generar un JSON compatible sin acumular archivos en Supabase.
- Para ampliar permisos a analistas, establecer reglas de acceso por distrito y supresión de cifras pequeñas; no exponer esta función a perfiles generales por defecto.
- La bitácora no sustituye respaldos institucionales externos ni la política de retención y protección de información sanitaria.
