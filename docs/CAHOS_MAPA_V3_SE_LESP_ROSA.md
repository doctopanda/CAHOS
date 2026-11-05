# CAHOS MAPA v3 · Identidad rosa, tiempo epidemiológico y fuente LESP
**Fecha de trabajo:** 5 de noviembre de 2026 · **Estado:** interfaz y cálculos implementados, despliegue en GitHub Pages pendiente de verificación en navegador.

## Diseño
Colores aprobados por CAHOS: baya profunda `#8A1F5B`, rosa chicle `#F06DA6`, rosa pastel `#FFC2D9`, lila suave `#CDB4F4`, crema `#FFF4E6`.
La silueta en el emblema no se dibuja manualmente: se reconstruye dinámicamente a partir de los 72 polígonos municipales INEGI que usa el mapa. El emblema conserva un símbolo sustituto si falla la descarga pública de geometrías.

## Tiempo y procedencia
- Las semanas epidemiológicas **inician el domingo y terminan el sábado**; la SE 1 corresponde a la semana con al menos cuatro días de enero, de acuerdo con OPS.
- En 2026, **SE 1: 4–10 de enero**. 2026 contiene 52 semanas epidemiológicas; del 1 al 3 de enero pertenece a SE 53 de 2025.
- Controles: anual, semana individual, intervalo SE inicial/final, acumulado hasta SE.
- La consulta SUIVE **estatal semanal** emplea `kind:"weekly"` de la API existente y guarda el rango `week_start/week_end`.
- La consulta SUIVE **municipal** continúa con `kind:"municipality"` solo si se solicita año completo. **Nunca se reutiliza el total anual en vistas por semanas**.
- Para habilitar SUIVE municipal por semanas será necesario evolucionar API + agente Windows y validar `municipality_weekly`, un desagregado de municipios×semanas. Se deja fuera de esta actualización para no exponer consultas incompletas ni quebrar permisos.
- Los periodos sin extracción, retenidos por privacidad o con `no_data` **no se convierten en cero**.

## Tasas
| Indicador | Numerador | Denominador | Escala |
|---|---|---|---|
| SUIVE · tasa municipal | casos municipales, mismo periodo y filtros | población municipal del año y estrato compatible | ×100 000 |
| SUIVE · aporte por población estatal | casos del municipio | población estatal del año y estrato compatible | ×100 000 |
| SUIVE · tasa estatal del periodo | casos semanales estatales del cubo | población estatal del año y estrato compatible | ×100 000 |
| SUIVE · contribución al total | casos municipales | casos estatales conciliados | % |
| LESP · resultados positivos por población municipal | resultados positivos clasificados de procedencia municipal | población total municipal del año | ×100 000 |
| LESP · aporte por población estatal | resultados positivos clasificados de procedencia municipal | población total estatal del año | ×100 000 |

**Regla de interpretación:** el aporte por población estatal no es el riesgo individual en ese municipio; el indicador LESP tampoco es incidencia de enfermedad ni caso confirmado, hasta que se valide la clasificación de vigilancia.

## Procesamiento privado LESP
El archivo recibido contiene cuatro hojas de alerta temprana: 2023–2026. La hoja 2026 usa: nombre, fecha de inicio de síntomas, unidad notificante, procedencia, clave LESP, folio SINAVE, fecha de emisión, resultado y observaciones. **Contiene información nominal y no debe publicarse en GitHub Pages.**

Se generó en el entorno privado del trabajo `LESP_SONORA_2026_agregados_PRIVADO_CAHOS.json`, con:
- año epidemiológico; semana por **fecha de emisión del informe**; municipio por **procedencia reportada**; patología de resultado; número de resultados positivos candidatos;
- exclusión conservadora de registros ambientales y de anotaciones sin positividad interpretable;
- deduplicación por clave LESP + patología + municipio, **sin garantía de unicidad de paciente**;
- clasificación por texto: **requiere validación LESP/epidemiología**. Detectar patógeno, IgM o anticuerpos reactivos no es por sí mismo confirmación de caso, ni debe sumarse a SUIVE sin un vínculo nominal y reglas oficiales;
- sin nombres, CURP, domicilio, teléfonos, folios individuales ni identificadores de muestras.
- **Uso estrictamente privado**: únicamente el Maestro puede activar el control de importación en la interfaz; el JSON se lee en memoria de la pestaña, no se envía por la red ni se guarda en localStorage. La URL pública no contiene el archivo ni números LESP.
- La última semana con positivos clasificados **no verifica el corte oficial**. Las semanas posteriores no se tratan como ceros confirmados.

## Calidad y límites
- El archivo fuente necesita homologación de nombres municipales, identificación del periodo de informe y revisión de reportes repetidos.
- Las tasas usan proyecciones poblacionales del mismo año: se muestran solo si el denominador está disponible.
- Las vistas provisionales SUIVE siguen sujetas a los roles y controles de la API.
- El mapa de fondo permanece geográfico: polígonos oficiales + OpenStreetMap; no se introducen polígonos IMSS Bienestar ficticios.
- **Pendiente**: prueba de usabilidad en navegador autenticado y despliegue de cambios de API/Windows para los cortes municipales semanales. La presente versión no despliega Edge Functions ni cambia RLS.

## Fuentes metodológicas
- OPS: https://www.paho.org/sites/default/files/2016-cha-calendario-epidemiologico.pdf
- NOM-017-SSA2-2012: https://sidof.segob.gob.mx/notas/docFuente/5288225
- DGE/SUIVE: https://www.gob.mx/salud/acciones-y-programas/direccion-general-de-epidemiologia-boletin-epidemiologico?idiom=es-MX
