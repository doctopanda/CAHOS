# CAHOS · Observatorio SUIVE, seis años y Mapa Sonora (fase v0.5)

## Ya disponible en el código
- Lectura directa de cubo MSOLAP desde la conexión guardada en Excel, sin contraseñas nuevas.
- Selector libre de las patologías devueltas por el cubo; un conjunto inicial de enfermedades de interés se propone automáticamente solo cuando no existen favoritos guardados. No implica que las 337 etiquetas equivalgan a 337 rubros oficiales SUIVE. El usuario puede quitar y añadir las programadas en cualquier momento.
- Extracción programada para patologías guardadas cada seis horas con los siete años más recientes del cubo: año en curso + **seis años históricos previos**. Se ejecuta solo mientras el proceso local esté activo.
- Canal endémico exploratorio por semana epidemiológica P25/P50/P75. Requiere >=5 observaciones históricas por semana en la ventana de seis años; la ausencia de un dato no se imputa como cero. No se etiqueta como canal operativo certificado sin validación de cobertura y cambios de definición.
- Consulta municipal MDX por patología, año, entidad, sexo y edad. El mapa anual usa las geometrías GeoJSON del **INEGI** y obtiene los casos del cubo, no de fuentes geográficas.
- Tasas x100,000 cuando existen denominadores del mismo municipio, año y grupo por sexo/edad. Si el grupo SUIVE no coincide con los quinquenios de proyecciones, CAHOS muestra *tasa no calculable*.
- Curva demográfica por sexo y edad para el municipio seleccionado.

## Iniciar
1. Descargar el repositorio actualizado de GitHub a una carpeta nueva (no publicar el libro de cubos).
2. Usar `extractor/SELECCIONAR_EXCEL.bat` una vez para seleccionar el libro original `Cubos_2003_Actual.xlsx`.
3. Ejecutar `extractor/PROBAR_CONEXION.bat`. La evidencia local previa del usuario mostró 337 patologías, 24 años, 53 semanas y 2449 municipios accesibles, pero las nuevas consultas geográficas deben validarse en ese equipo.
4. Ejecutar `extractor/IMPORTAR_POBLACION.bat` y seleccionar el archivo de proyecciones municipales de Sonora 2015–2030. Este proceso **no** sube datos a GitHub. También se puede usar el JSON preparado guardándolo en `%LOCALAPPDATA%\CAHOS\poblacion_sonora.json`.
5. Ejecutar `extractor/INICIAR_EXTRACTOR.bat` y visitar `http://127.0.0.1:8789`.
6. Seleccionar patología y año en **Panorama**, consultar; entrar en **Mapa Sonora** y pulsar **Consultar municipios del cubo**.
7. Revisar el texto de estado si la descarga de geometrías falla. La cartografía se obtiene del INEGI mediante una API pública y se guarda localmente tras validar las 72 geometrías.

## Procedencia y validaciones
- Marco Geoestadístico municipal INEGI: `https://www.inegi.org.mx/servicios/catalogounico/`
- Servicio vectorial INEGI: `https://gaia.inegi.org.mx/wscatgeo/v2/geo/mgem/26`
- Capa municipal INEGI 2025: `https://lcidsig.inegi.org.mx/server/rest/services/Hosted/Municipios_2025/FeatureServer/0`
- Proyecciones por municipio Sonora 2015–2030: COESPO/CONAPO. Consultar `https://coespo.sonora.gob.mx/informacion-institucional/indicadores/proyecciones-de-poblacion`.
- INEGI Censo 2020 y API de indicadores: `https://www.inegi.org.mx/servicios/api-indicadores/`. El censo sirve para validar anclas de población; **no** reemplaza las proyecciones anuales para tasas de años sucesivos.
- El archivo de SEED 2026 entregado está en formato de tablas dinámicas de mortalidad por territorio/edad/sexo sin columna explícita de causa básica/CIE-10. Por tanto, no se atribuyen muertes a enfermedades del cubo SUIVE usando este archivo.
- El archivo LESP 2026 contiene nombres, folios y resultados nominales. No se incluye en GitHub ni en la aplicación pública. Se debe desarrollar una etapa de ingestión agregada segura y sin duplicados.

## Seguridad y alcance
El portal de GitHub Pages **no está conectado al cubo SINAVE ni al equipo localhost**. Los datos clínicos y la conexión OLAP permanecen en Windows. La geografía y las proyecciones son fuentes públicas; nunca se deben subir a GitHub archivos Excel de laboratorio, mortalidad nominal o contraseñas. El mapa de resultados debe funcionar localmente o detrás de una API institucional autenticada si se autoriza posteriormente. 
