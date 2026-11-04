# CAHOS Cloud 0.7 · Primera puesta en marcha

**Estado del desarrollo (4 nov 2026):** base Supabase, RLS, API/cola, sitio con Auth, alta de agente y trabajador Windows implementados. **No se ha probado una extracción real a través del circuito cloud; el proyecto todavía no tiene usuarios ni agentes autorizados.** No confundir la función Edge "ACTIVE" con el cubo conectado desde internet.

## 1. Una vez: activar el primer administrador

La clave `sb_publishable_...` es pública y **no** permite administrarse ni sustituye una sesión JWT.

1. Abra el proyecto [CHAOS (backend CAHOS)](https://supabase.com/dashboard/project/lywrtuibmzzsylfbybqo).
2. Vaya a **Authentication → Users → Add user** y cree su cuenta administrativa con un correo propio. No comparta contraseñas ni use la credencial del cubo SINAVE.
3. En **SQL Editor**, ejecute el siguiente SQL **sustituyendo el correo**, y compruebe que devuelva una fila. Este paso es exclusivamente para quien controla el proyecto:

```sql
insert into public.cahos_members (user_id, role, enabled, entity_code)
select id, 'admin', true, '26' from auth.users
where lower(email) = lower('SU_CORREO_DE_ADMINISTRADOR')
on conflict (user_id) do update
set role = 'admin', enabled = true, entity_code = '26', updated_at = now()
returning user_id, role, enabled;
```

Si no devuelve ninguna fila, la cuenta no existe aún. No habilite cuentas no verificadas. Los usuarios analistas y lectores necesitan membresías explícitas.

4. Abra [CAHOS Acceso Seguro](https://doctopanda.github.io/CAHOS/acceso.html) e inicie sesión.
5. Si eligió registro por correo en vez de "Add user", revise la confirmación de email y configure el Site URL de Supabase Auth a `https://doctopanda.github.io/CAHOS/acceso.html`; la redirección permitida debe estar configurada. El alta no concede automáticamente permisos.

## 2. Una vez: crear y vincular el agente Windows

1. Desde la página de acceso como administrador, pulse **Generar token de agente**. Se muestra exactamente una vez. **No pegue ese token en ChatGPT, GitHub ni chats.**
2. En el único equipo Windows autorizado que ya abre el cubo, descargue el [repositorio CAHOS](https://github.com/doctopanda/CAHOS/archive/refs/heads/main.zip), descomprima y abra `extractor`.
3. Compruebe que la conexión Excel original sigue configurada una sola vez en `%LOCALAPPDATA%\CAHOS\configuracion_local.json`. No copie el Excel a GitHub.
4. Ejecute `INSTALAR_AGENTE_NUBE.bat` y pegue el token cuando lo solicite. El instalador protege el archivo del token con ACL NTFS del usuario, copia solo código de aplicación y programa una única tarea `CAHOS-CLOUD-AGENT` al iniciar sesión. No abre ningún puerto de entrada.
5. `ESTADO_AGENTE_NUBE.bat` muestra únicamente estado no secreto. Espere que muestre `"status":"online"`. El primer inicio consulta los catálogos del cubo; depende de conexión a SINAVE, MSOLAP, disponibilidad de Windows y HTTPS saliente a Supabase.
6. Si se deben desactivar temporalmente las consultas, ejecute `DETENER_AGENTE_NUBE.bat`. El token puede revocarse desde `/admin/revoke-agent` por una cuenta admin; para rotar, generar token nuevo.

Este agente **no es** el servidor HTTP `127.0.0.1:8789`. Lee el mismo Excel por MSOLAP sin necesitar ese puerto y realiza solicitudes salientes HTTPS; así los equipos de los usuarios no necesitan Python ni PowerShell.

## 3. Primera consulta piloto

1. Confirme en Supabase que `cahos_catalog` contiene enfermedades, años, sexo, edad, municipios y entidades; no deben mostrarse resultados ficticios.
2. Inicie sesión en [el visor CAHOS](https://doctopanda.github.io/CAHOS/). Seleccione patología y año principal, entidad **Sonora** y semanas; el visor solicita histórico de hasta seis años anteriores y año seleccionado.
3. La API devuelve un resultado aprobado disponible o una tarea en cola `cahos_jobs`. El agente procesa las tareas, consulta MDX `SELECT` y manda resultados agregados al almacenamiento de `cahos_snapshots` con `publication_status='pending'`.
4. En [Acceso seguro](https://doctopanda.github.io/CAHOS/acceso.html) el administrador abre **Consultar pendientes → Revisar resumen**. Contraste filtros, totales, periodo, cobertura y valores con el cubo y los instrumentos oficiales antes de aprobar. Si hay diferencias, **no aprobar**.
5. Después de aprobar, el visor autenticado puede consultar resultados; nunca se sirve el Excel, la conexión, los datos LESP nominales ni el token de agente.

## Arquitectura

```
Navegador → CAHOS GitHub Pages → Supabase Auth + Edge API
                                       │
                                 Cola protegida
                                       │ (HTTPS saliente, agent token revocable)
                            Windows CAHOS Cloud Agent
                                       │ (MSOLAP SELECT)
                            Excel/SINAVE OLAP original
                                       │
                              agregados pendientes
                                       ↓
                     Revisión epidemiológica humana
                                       ↓
                     Visor autenticado, roles y RLS
```

## Limitaciones y riesgos aún abiertos

- **No es un despliegue institucional aprobado** hasta verificar permisos de uso, protección de celdas pequeñas y autorizaciones de exposición desde internet, aunque sea tras login.
- El **trabajador central** solo funciona mientras Windows está encendido, con sesión compatible y acceso de red al cubo y a Supabase. Para 24/7 se necesitaría equipo/VM institucional siempre activo con operación autorizada.
- El token de agente se guarda en archivo local protegido mediante ACL NTFS. Use un Windows dedicado, disco cifrado, cuentas restringidas y rotación/revocación. Esta fase piloto no usa HSM ni bóveda institucional.
- El estado `online` se conserva como último reporte; hay que comparar `updated_at` para detectar agente desconectado.
- Los canales endémicos requieren cobertura semanal suficiente: no transformar faltantes en ceros.
- El **mapa** puede colorear solo cuando la consulta municipal real está aprobada y empareja claves CVEGEO. Las **tasas cloud** por sexo/edad requieren integrar después los denominadores COESPO/CONAPO en una fuente autorizada; no usar población estimada para estratos no compatibles.
- Sin una cuenta aprobada y un agente instalado, la página mostrará acceso o extracción pendiente, no cifras reales.
- Esta versión encola consultas bajo demanda. La preextracción programada de todas las favoritas sin visitas, el control de cuotas y el mecanismo de publicación por roles más finos siguen siendo etapas posteriores.

## Validación rápida sin secretos

En el SQL Editor del proyecto:
```sql
select
 (select count(*) from public.cahos_members where enabled) as usuarios,
 (select count(*) from public.cahos_agents where enabled) as agentes,
 (select count(*) from public.cahos_catalog) as miembros_catalogo,
 (select count(*) from public.cahos_jobs) as trabajos,
 (select count(*) from public.cahos_snapshots where publication_status='approved') as resultados_aprobados;
```

Para soporte técnico comparta solo los códigos de estado de `ESTADO_AGENTE_NUBE.bat`, **nunca** el token o el Excel de conexión.
