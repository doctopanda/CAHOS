# CAHOS · Convenciones SUIVE y navegación unificada
Fecha: 2026-11-05. Cambio propuesto sobre GitHub Pages y código de la función `cahos-api`.

## 1. Pirámides demográficas
- Hombres a la izquierda, mujeres a la derecha.
- Parte INFERIOR: 0–4 años.
- Parte SUPERIOR: 65 años y más.
- No se alteran las series de datos, solo la posición vertical de las barras.
- La regla aplica al módulo de Población, a la ficha de MAPA CAHOS y al mini visor de Panorama.

## 2. Sidebar único de procesamiento
Panorama SUIVE y Población usan el mismo componente de navegación:
- Navegación por productos CAHOS.
- Paneles de consulta nativos movidos sin perder los identificadores o listeners existentes.
- Filtros del cubo SUIVE en un acordeón; filtros poblacionales en el sidebar del mismo diseño.
- Los controles demográficos y los selectores SUIVE siguen compartiendo el estado `CAHOSSelection`.

## 3. Inicio de sesión y Administración Maestra
`acceso.html` queda únicamente como pantalla de ingreso/registro y verificación.
Una cuenta autorizada no maestra entra a `/CAHOS/` (Panorama).
Una cuenta con `is_master === true` entra a `/CAHOS/admin.html`.
`admin.html` oculta sus controles hasta verificar el perfil autenticado. Muestra gestión de agentes solo al Maestro.
La autorización efectiva debe realizarse también en la Edge Function:
`/admin/create-agent`, `/admin/agents`, `/admin/revoke-agent` requieren `user.isMaster===true`, verificado contra `cahos_members`.
**IMPORTANTÍSIMO**: La modificación de `supabase/functions/cahos-api/index.ts` en GitHub NO despliega automáticamente esa función. No se puede certificar la restricción real en producción hasta desplegar y probar esa versión en el proyecto Supabase CAHOS.

## 4. Ceros SUIVE con procedencia
La base de la norma es distinguir **dato ausente en una extracción válida** de **no existe extracción validada**.

| Condición | Cifra operativa | Color | Etiqueta |
|---|---:|---|---|
| Medida `0` explícita | 0 | Negro | `CERO_OBSERVADO` |
| Medida `null` / vacía en fila válida | 0 | Naranja | `SIN_REGISTRO_IMPUTADO_0` |
| Semana ausente del vector de una extracción válida | 0 | Naranja | Imputación de ausencia |
| Municipio ausente de un desglose municipal **conciliado con su total estatal** | 0 | Naranja | Imputación de ausencia |
| Conteo positivo explícito | Conteo original | Normal | `VALOR_OBSERVADO` |
| Resultado `no_data` completo, extracción fallida, retenida por privacidad, sin autenticación, denominador incompatible | No calculable / sin información disponible | Gris, sin convertir en 0 | Estado de consulta |

Los ceros imputados **participan con valor cero en sumas y tasas operativas**, sin perder la condición de imputación en las etiquetas, estado de exportación y controles de calidad.
Los ceros no se consideran evidencia de notificación efectiva: para un canal endémico se sigue exigiendo la cobertura real y años históricos comparables. Una tasa con imputación **no es por sí sola una tasa oficial certificada**.
No imputar medidas malformadas, valores negativos, cortes sin resultados o salidas retenidas.

## 5. Pruebas necesarias antes de certificar producción
1. Validar en navegador el panel unificado, carga de catálogo y persistencia de filtros en Panorama y Población.
2. Comprobar 0–4 abajo / 65+ arriba en las tres vistas.
3. Con datos de prueba autorizados, distinguir `null`, `0`, `5` y ausencia de semana; comprobar tonos en gráficas y CSV.
4. Probar conciliación municipal parcial contra total estatal y mostrar las celdas imputadas en naranja.
5. Confirmar que un usuario no maestro no pueda abrir el panel ni invocar por HTTP los tres endpoints de agentes.
6. Desplegar en Supabase **la misma** Edge Function versionada y revisar sus logs.
7. Asegurar que las salidas preliminares y sin validación sigan privadas.

No incorporar credenciales ni tokens de agentes a GitHub Pages.