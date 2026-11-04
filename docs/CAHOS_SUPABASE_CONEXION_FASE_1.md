# CAHOS cloud · Supabase conectado (fase 1)

## Estado comprobado el 4 de noviembre de 2026

- **Proyecto Supabase**: `lywrtuibmzzsylfbybqo` (nombre en Supabase: **CHAOS**).
- **Base de datos**: seis tablas `public.cahos_*` creadas y RLS activado: `members`, `catalog`, `snapshots`, `jobs`, `favorites`, `sync_state`.
- **Lectura anónima**: revocada en las seis tablas; ninguna contiene datos reales a esta fecha.
- **Edge Function**: `cahos-api` v2 activa según Supabase, `GET /health` público sin datos epidemiológicos. Cualquier lectura de catálogos/estado requiere sesión Supabase Auth y membresía `cahos_members.enabled=true`.
- **Clave web**: solo `sb_publishable_...`, apta para código visible. Se configuró en `public/configuracion-publica.js`.
- **Frontend Pages**: mantiene `apiBaseUrl: ""` hasta que existan autenticación, control de acceso y agente central probados. No muestra casos simulados.
- **Pruebas**: migración SQL aplicada, tablas consultadas, RLS comprobada y asesor de seguridad Supabase sin alertas. El endpoint HTTPS se desplegó como activo, pero no se pudo comprobar la respuesta final desde el entorno de ChatGPT por una limitación de resolución DNS externa. Comprobar desde el navegador en `/CAHOS/conexion.html`.

## Enlaces

- Portal público: https://doctopanda.github.io/CAHOS/
- Diagnóstico de backend: https://doctopanda.github.io/CAHOS/conexion.html
- Supabase Dashboard: https://supabase.com/dashboard/project/lywrtuibmzzsylfbybqo
- API de salud (sin secretos): https://lywrtuibmzzsylfbybqo.supabase.co/functions/v1/cahos-api/health

## Qué no hace todavía

**No existe extracción SINAVE desde Supabase.** El proveedor MSOLAP y la conexión del libro Excel operan en un Windows que puede acceder al cubo; Supabase no lee el archivo Excel ni consulta el servidor OLAP por sí mismo. Tampoco existe aún un usuario de CAHOS aprobado en `cahos_members` ni una cuenta de agente enlazada.

## Siguiente fase técnica: acoplar CAHOS Agent de forma segura

1. **Identidad**: el administrador entra mediante Supabase Auth y se asigna explícitamente la membresía habilitada a su UUID (no autoconceder permisos al primer visitante).
2. **Servicio central**: designar una sola máquina Windows institucional autorizada para ejecutar el lector MDX, con control de carga, bitácora y conexión de salida HTTPS al backend. La instalación sería una sola vez, no en cada estación.
3. **Vinculación segura**: provisionar credenciales de trabajador mediante la consola de secretos/identidades del backend, evitando copiar `service_role`, `sb_secret_...` o contraseñas por chat o al repositorio público. El agente no abrirá puertos de entrada.
4. **Primera serie piloto**: extraer una patología, seis años históricos y año seleccionado; verificar suma de casos, semanas epidemiológicas, codificación CVEGEO y denominadores COESPO/CONAPO.
5. **Cola de solicitudes**: conectar la API a `cahos_jobs` con validación de parámetros, control de frecuencia y worker único; respuestas del navegador muestran `pendiente / ejecutando / listo / error`, con último corte guardado.
6. **Publicación autorizada**: los `cahos_snapshots` nuevos entran como `pending`; solo los `approved` son consultables por roles habilitados y ámbito territorial. Aplicar supresión estadística cuando corresponda.
7. **Activación del portal**: habilitar `apiBaseUrl` con API HTTPS cuando login, RLS, cola y agente estén probados. El usuario abrirá únicamente la URL de CAHOS y sus consultas correrán en segundo plano.

## Seguridad

- No publicar libros SINAVE con conexión guardada ni credenciales, datos nominales LESP/SEED o exportaciones sin autorización.
- La clave `sb_publishable_` no sustituye un JWT de usuario ni una credencial de servicio. Por sí sola **no** permite leer tablas CAHOS.
- No ejecutar un GitHub Actions runner público dentro de la red del cubo.
- El proyecto figura como CHAOS en Supabase; no renombrar recursos sin coordinación, porque el identificador de proyecto, no el nombre visible, determina la conexión.

**Arquitectura final**: GitHub Pages → API/almacén protegido Supabase → cola → CAHOS Agent Windows → cubo SINAVE (consulta de solo lectura) → snapshots revisados. Todos los navegadores consultan la API, no la computadora del usuario.
