# CAHOS · Población municipal y denominadores epidemiológicos

**Implementación:** 4 de noviembre de 2026.

## Datos cargados
- Origen: archivo previamente aportado por el usuario `Sonora.ProyeccionesPoblacionMunicipales2015-2030(20261103-201018).xlsx`, serie COESPO/CONAPO 2015–2030.
- Integridad: SHA-256 del libro original `957f88231e1de7d4aa194931660029a5a862e4506858d43c2e9641be6c307b14`.
- 72 municipios, años 2015–2030, ambos sexos y 14 grupos de edad (00–04, ..., 60–64, 65+).
- 32,256 celdas originales sexo×edad×municipio×año normalizadas a 1,152 filas municipio-año con arreglos JSON de sexo y edad.
- Todas las filas importadas a `public.cahos_population` en Supabase, **RLS activa** y consulta restringida a miembros CAHOS habilitados.
- Controles automáticos de consistencia: 16 años, 72 claves por año, una fuente por año, cada sexo exactamente 14 bandas, sumas idénticas a los totales municipales. Errores observados: 0.
- Población proyectada 2026: **3,283,941** (mujeres 1,652,962; hombres 1,630,979; 0–14 años 759,509; 65 años y más 301,834).

## Producto CAHOS
- `public/poblacion.html`: módulo independiente de población y denominadores; selección de año, municipio, pirámide de sexos, curva por grupos de edad, tendencia histórica municipal/estatal, KPIs y tabla por edad.
- `public/index.html`: franja poblacional y tasa bruta de notificación del año seleccionado en el Panorama, únicamente si el numerador anual SUIVE corresponde al territorio estatal sin filtros incompatibles de edad y sexo.
- `public/mapa_sonora.js`: mapa-resumen existente, sin reemplazar su cartografía; ahora consulta los denominadores municipales de Supabase para tasas y curvas, preservando las reglas de compatibilidad.
- API `cahos-api`: `GET /api/population/status`, `GET /api/population?year=YYYY`, `GET /api/population/trend?municipality=26XXX`; importación maestra mediante `POST /admin/population/import`, año completo de 72 municipios por lote.
- Los datos fueron **cargados directamente en Supabase**, por lo que el usuario no necesita utilizar el instalador local de población.

## Fórmula y precauciones
```
Tasa de notificación por 100,000 = casos del cubo / población proyectada compatible × 100,000
```
- Para 2026, el numerador del cubo puede reflejar un **corte parcial**, mientras que la población proyectada es anual. Mostrar ambos conceptos sin presentar tasas como incidencia oficial anual.
- La medida `Casos` de SINAVE no demuestra personas únicas por sí sola.
- Grupos etarios de SUIVE y quinquenios poblacionales deben concordar. Para edad exacta o bandas diferentes se requiere metodología de aproximación documentada; en ausencia de tal método se oculta la tasa.
- La categoría 65+ es abierta y **no debe interpretarse como un grupo quinquenal**.
- Las proyecciones 2015–2030 pertenecen a una versión histórica; no deben mezclarse automáticamente con series CONAPO 1990–2040 sin documentar cambio de fuente.
- No se almacenan casos nominales ni credenciales del cubo en tablas poblacionales.

## Separación de mapas
El mapa coloreado actual se mantiene como **mapa-resumen de CAHOS Panorama**. El futuro **MAPA CAHOS** será un producto geoespacial independiente con arquitectura inspirada en BALAM (capas coloreadas por casos/tasas, filtros temporales, tarjetas municipales, pirámides, curvas y controles públicos/internos). No se ha creado ni publicado aún ese nuevo visor avanzado.
