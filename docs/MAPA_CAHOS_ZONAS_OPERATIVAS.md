# MAPA CAHOS · Regionalización operativa propuesta (2026-11-04)

## Alcance

Se integran seis zonas territoriales **aportadas por el responsable de CAHOS** para análisis de campo y epidemiología, **sin considerarlas regionalización oficial de COESPO, Distritos de Salud o IMSS Bienestar**. Archivo maestro: `public/data/cahos_macrozonas_operativas.json`.

| Zona | Municipios incluidos (con posibles traslapes) | Color |
| --- | ---: | --- |
| Sierra (Alta y Baja) | 29 | #8264ad |
| Frontera | 12 | #db674b |
| Desierto y Noroeste | 7 | #dfaa53 |
| Valles del Sur (Yaqui y Mayo) | 7 | #5eaa78 |
| Río de Sonora y Centro-Río | 13 | #4d9cc7 |
| Litoral (Costa Sur y Guaymas) | 4 | #2e9ea1 |

## Integridad territorial

Las seis listas suman **72 asignaciones**, pero representan **65 municipios diferentes**. Por tanto, faltan 7 de los 72 municipios sonorenses y otros 7 pertenecen a dos zonas simultáneamente.

**Sin asignación:** Arizpe (26006), Átil (26007), Bacanora (26009), Bacoachi (26011), Benjamín Hill (26016), La Colorada (26021) y Trincheras (26064).

**Con traslapes:** Baviácora (26014), San Javier (26054), San Felipe de Jesús (26053), Banámichi (26013) en Sierra + Río de Sonora; Bácum (26012) en Valles del Sur + Río de Sonora; Benito Juárez (26071) y San Ignacio Río Muerto (26072) en Valles del Sur + Litoral.

Estos datos no se ajustan o corrigen de manera implícita. La página permite seleccionar una o más zonas y municipios. **Los indicadores agregados usan la unión de claves municipales únicas**, no la suma de indicadores de zonas superpuestas. Las selecciones municipales adicionales actúan como intersección del conjunto regional activo.

Se conserva una capa explícita **Sin asignación** para los 7 municipios pendientes. En ausencia de casos autorizados por el cubo, los agregados quedan como desconocidos, **no como cero**.

## Presentación cartográfica

- `public/mapa-cahos/index.html`: visor avanzado, nueva capa `Macrorregiones operativas`.
- `public/mapa-cahos/app.js`: polígonos INEGI en OpenStreetMap con Leaflet 1.9.4, controles de multiselección y panel municipal con sus zonas. Si falla la librería remota, se usa el mapa SVG anterior como respaldo.
- `public/cahos-state.js`: conserva selección territorial entre módulos sin guardar datos nominales ni credenciales.
- Selección por Ctrl/Shift+clic en polígonos o selector de municipios. Botón para limpiar la selección.
- En capas de casos/tasas/población, las zonas seleccionadas resaltan las áreas incluidas.
- Los municipios con doble pertenencia muestran contorno diferenciado y ficha con las dos zonas.
- Para tasas, solo se calcula si todos los municipios seleccionados tienen casos y denominadores compatibles; no se suma una tasa promedio de municipios.

## Otras divisiones de Sonora

Son **clasificaciones distintas** y deberán mantenerse en catálogos independientes:
- Distritos de Salud (6): Secretaría de Salud Sonora, https://salud.sonora.gob.mx/index.php?id=61&option=com_sppagebuilder&view=page
- COESPO (regiones socioeconómicas, incluye Sierra Alta y Sierra Baja por separado): https://coespo.sonora.gob.mx/documentos/proypob20102030-20162050/Regionales-%28Coespo%202010-2030%29/ResumenProyeccionesRegionales-Sonora2010-2030.pdf
- IMSS Bienestar, diez regiones de conducción médica (nota 2025): https://cdn.imssbienestar.gob.mx/ssib/assets/docs/notas_informativas/sala_prensa/148/20250712_imssbienestarinaugurahospitalcomunitarioviicamswitchquetraeraijusticiasocialensaludpuebloyaqui.pdf

La correspondencia nominal municipal de distritos e IMSS Bienestar se debe documentar y verificar con un catálogo actualizado antes de activar sus filtros, evitando adjudicar municipios a una región por proximidad o suposición.

## Nota sobre denominadores

El visor usa población municipal COESPO/CONAPO 2015–2030 previamente importada a Supabase, con la misma clave geoestadística de INEGI. Son **proyecciones**, no censos. Una tasa regional requiere sumar los casos y el denominador poblacional compatible de los mismos municipios únicos, sexo y edad. Un periodo de vigilancia parcial no debe llamarse incidencia anual completa.
