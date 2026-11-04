# MAPA CAHOS · Regionalización territorial de Sonora (v1)

Fecha: **4 de noviembre de 2026**. Cobertura cartográfica: **72 municipios INEGI**, clave `26xxx`.
Producto: **[MAPA CAHOS](https://doctopanda.github.io/CAHOS/mapa-cahos/)**. No reemplaza el mapa-resumen del Panorama.

## Cuatro esquemas que nunca se confunden

| Esquema | Naturaleza | Cobertura | Representación |
|---|---|---|---|
| Zonas operativas CAHOS | Agrupación **propuesta por el usuario**, no oficial | 6 zonas con 72 asignaciones; 65 municipios únicos | Un municipio puede pertenecer a dos zonas |
| Distritos de Salud Sonora | Delimitación administrativa oficial **2025** | 6 distritos, 72 municipios, uno por municipio | Polígonos de unión municipal |
| Regiones COESPO | Información por Región actual (10 regiones) | 10 regiones, 72 municipios, una por municipio | Polígonos de unión municipal |
| IMSS Bienestar | 10 sedes operativas verificadas | **No se dispone todavía** de padrón completo municipio→región | Marcadores en municipios sede, **sin inventar polígonos regionales** |

## Zonas operativas CAHOS proporcionadas por el usuario

- Sierra Alta y Baja: 29 asignaciones
- Frontera: 12
- Desierto y Noroeste: 7
- Valles del Sur (Yaqui y Mayo): 7
- Río de Sonora y Centro-Río: 13
- Litoral: 4

**Intersecciones voluntarias (7):** Baviácora, San Javier, San Felipe de Jesús, Banámichi, Benito Juárez, San Ignacio Río Muerto y Bácum.

**Sin asignar (7):** Arizpe, Átil, Bacanora, Bacoachi, Benjamín Hill, La Colorada y Trincheras.

Son atributos de pertenencia múltiple; no convertirlos en polígonos excluyentes. La selección de dos o más zonas aplica una **unión de municipios únicos** para cálculo de población y casos. Las categorías de usuario deben etiquetarse como **propuestas**, nunca oficiales.

## Distritos de Salud, distribución municipal oficial

**Fuente primaria:** [Boletín Oficial de Sonora, 10 febrero 2025, artículo 29 BIS, página 23](https://boletinoficial.sonora.gob.mx/images/boletines/2025/02/2025CCXV12I.pdf).

| Distrito | Cabecera | Municipios |
|---|---|---:|
| DS01 | Hermosillo | 32 |
| DS02 | Caborca | 7 |
| DS03 | Santa Ana | 17 |
| DS04 | Ciudad Obregón / Cajeme | 8 |
| DS05 | Navojoa | 5 |
| DS06 | San Luis Río Colorado | 3 |

La relación código municipio→distrito está completa en `public/mapa-cahos/regiones-sonora.json`, validada contra los 72 municipios de la base poblacional CAHOS.

## Regiones COESPO actuales: 10

**Fuente primaria:** [COESPO Sonora, Información por Región](https://coespo.sonora.gob.mx/informacion-institucional/indicadores/infografias-indicadores-demograficos-y-socioeconomicos).

Capital (1), Alto Golfo (3), Gran Desierto (12), Frontera (4), Puerto (6), Río Yaqui (3), Río Mayo (7), Tres Ríos (17), Cuatro Sierras (6) y Sierra Alta (13). Total: **72 municipios, sin duplicaciones**.

**No confundir** con la versión histórica de 12 regiones socioeconómicas del [resumen regional COESPO 2010–2030](https://coespo.sonora.gob.mx/documentos/proypob20102030-20162050/Regionales-%28Coespo%202010-2030%29/ResumenProyeccionesRegionales-Sonora2010-2030.pdf). Ambas son regionalizaciones diferentes y requieren etiquetar su versión.

## IMSS Bienestar: 10 sedes verificadas, delimitaciones pendientes

**Fuente primaria:** [Comunicado oficial IMSS Bienestar 054/2025, 12 julio 2025](https://cdn.imssbienestar.gob.mx/ssib/assets/docs/notas_informativas/sala_prensa/148/20250712_imssbienestarinaugurahospitalcomunitarioviicamswitchquetraeraijusticiasocialensaludalpuebloyaqui.pdf).

San Luis Río Colorado, Caborca, Nogales, Moctezuma, Ures, Hermosillo, Guaymas, Ciudad Obregón, Navojoa y Huatabampo.

Solo se representa el municipio de cada sede. **No se infiere una adscripción municipal a partir de la proximidad a la cabecera** ni de los Distritos de Salud; para dibujar las regiones reales se requiere un padrón institucional actualizado de municipios/unidades de conducción médica.

## Interactividad y fuente geográfica

- Base [OpenStreetMap](https://www.openstreetmap.org/copyright) con Leaflet 1.9.4.
- Polígonos municipales INEGI producidos por el flujo de GitHub Pages de CAHOS.
- Modo alternativo **Solo polígonos INEGI**, útil si no cargan las teselas de OpenStreetMap.
- Selección de regiones múltiples y selección municipal adicional. Los municipios compartidos se computan una vez.
- Capas de **casos registrados**, **tasa por 100,000 habitantes**, **población proyectada** y **regionalización**.
- Tasas de una selección territorial: **suma de casos / suma de denominadores compatibles × 100,000**. Nunca sumar ni promediar tasas municipales sin ponderación.
- Si un municipio no trae información del cubo, no se interpreta como cero casos. No se calcula tasa regional hasta disponer de las filas de todos los municipios incluidos.
- La población es una proyección anual, mientras que los casos del año corriente pueden ser parciales.
- Casos no publicados en GitHub como estáticos: se recuperan por API Supabase autenticada conforme a RLS/rol. El visor no expone datos nominales.

## Validación automática

`public/mapa-cahos/region-core.js` valida la cobertura territorial y agrupa casos/población sin duplicar municipios. Las pruebas `tests/test_regionalizaciones_cahos.py` comprueban las cuatro capas antes del despliegue.

**Pendiente verificable:** tabla de adscripción municipal de IMSS Bienestar para pasar de **10 sedes** a **10 polígonos regionales oficiales**.
