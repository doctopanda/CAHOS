# CAHOS · Control de calidad y liberación de agregados SINAVE

**Fecha del control inicial:** 4 de noviembre de 2026.  
**Alcance:** datos agregados del cubo SINAVE, entidad 26 Sonora.  
**Responsable técnico del procedimiento:** revisión asistida por ChatGPT a petición expresa del administrador. No equivale a cotejo con un corte oficial firmado.

## Control interno de las primeras 14 extracciones

- 14 snapshots, 1,006 filas agregadas, correspondientes a dengue no grave, dengue grave y dengue con signos de alarma.
- Cero medidas no numéricas, negativas o fraccionarias.
- Cero semanas fuera del intervalo permitido; cero años ajenos a los filtros; todos los resultados restringidos a Sonora.
- Sin coordenadas duplicadas dentro de cada extracción.
- Coincidencia de los totales anuales y la suma de semanas completas en 20 comparaciones por patología/año.
- Coincidencia de los totales por sexo y edad frente al total anual de 2026 en 6 comparaciones.
- Se confirmó la repetición de un producto anual de dengue no grave 2025 (9,025 casos) sin sumar dos veces la misma consulta.

**Decisión:** las 14 extracciones que superaron estas pruebas fueron habilitadas para cuentas CAHOS autorizadas. Los metadatos `coverage.status=technical_consistency_checked` y `coverage.official_cut_verified=false` distinguen esta liberación de una validación epidemiológica oficial. No se asignó la aprobación a la identidad de ningún usuario humano (`approved_by=null`).

## Regla para futuras extracciones

La función Edge `cahos-api` comprueba automáticamente, antes de liberar resultados:
1. Presencia de filas y medidas de casos enteras, no negativas y dentro de límites.
2. Ejes obligatorios completos, coordenadas únicas y correspondencia con los años seleccionados.
3. Semanas dentro del intervalo solicitado.
4. Ámbito institucional de Sonora mediante catálogos permitidos.
5. Restricción de los desgloses municipales e institucionales para evaluar privacidad y conteos pequeños.

Las extracciones agregadas de tipo anual, semanal, edad y sexo que pasan estas reglas se etiquetan como **integridad técnica comprobada** y se habilitan automáticamente **solo para usuarios autenticados y autorizados**, sin solicitar aprobaciones manuales. Los resultados que fallen controles se mantienen restringidos y se registra la razón.

## Limitaciones científicas y de seguridad

- La consistencia aritmética no comprueba captación, subregistro, retrasos de notificación, definiciones modificadas, duplicados de origen ni fidelidad de la extracción contra un boletín oficial.
- La fecha de extracción no implica fecha de corte oficial. Un año parcial no debe interpretarse como un año completo.
- La medida `Casos` es la medida definida por el cubo y no demuestra por sí misma personas únicas.
- La liberación técnica dentro de CAHOS no autoriza difusión pública ni publicación nominal.
- El usuario Administrador Maestro puede consultar resultados restringidos con etiquetas explícitas; no se les otorga carácter oficial.
- El estado de publicación refleja acceso técnico dentro de CAHOS, no aprobación regulatoria de una autoridad sanitaria.

## Auditoría

La interfaz `public/revision.html` muestra el informe de calidad y permite descargar datos agregados para auditoría sin pedir aprobaciones al usuario. Las columnas `coverage`, `publication_status`, `approved_at` y `approved_by` preservan la trazabilidad del control aplicado.
