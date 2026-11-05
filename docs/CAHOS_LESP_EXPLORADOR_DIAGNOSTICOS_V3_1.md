# MAPA CAHOS v3.1 · Explorador anual de diagnósticos LESP

## Nueva interacción
- En la ficha municipal, seleccionar **Dengue, sarampión, tuberculosis u otro diagnóstico** directamente sobre la lista. La cantidad visible en la lista es la del periodo seleccionado en el filtro general.
- La minigráfica inferior cambia inmediatamente al diagnóstico elegido y muestra su **comportamiento anual por semana epidemiológica**, desde SE 01 hasta la última SE con positivos clasificados del archivo agregado de ese año.
- El botón **Todos los diagnósticos** restaura la serie total anual del municipio.
- Pulsar la minigráfica, con ratón o teclado, abre un **diálogo flotante responsivo** que usa la identidad rosa/baya/lila de CAHOS.
- En el flotante hay selector de diagnóstico, alternancia entre **Año completo** y **Periodo seleccionado**, total del alcance, pico semanal, semanas con registro y última SE documentada.
- Pulsar una barra o acceder con teclado a ella muestra la SE y la cantidad específica.
- Se cierra con el botón ×, **Volver al mapa**, tecla **Escape** o clic fuera del contenido.
- Al cambiar de municipio se restablece el diagnóstico a "Todos" y se cierra la ventana anterior. Si cambian semana/año y la fuente está disponible, la serie se refresca.

## Metodología
- Fuente: **agregado LESP protegido** recuperado por CAHOS bajo permisos del Administrador Maestro; esta vista no realiza consultas públicas ni requiere cambios de RLS.
- Un resultado positivo de laboratorio **no equivale automáticamente a un caso confirmado de vigilancia ni a un paciente único**.
- La semana se atribuye conforme a la fecha de emisión del informe definida en la fuente, no a la fecha de inicio de síntomas.
- El usuario puede filtrar, por ejemplo, SE 10–20. La lista muestra positivos para ese periodo, pero el gráfico anual mantiene la serie de SE 01 al último registro positivo disponible. El tramo del filtro se resalta en **baya**, el resto en **lila**. La vista alternativa "Periodo seleccionado" se limita a SE 10–20.
- **Sin fila positiva no equivale a 0 observado:** las semanas sin registro se representan como valores ausentes. Las cifras del total suman solo resultados disponibles. Una semana posterior a la última semana registrada en el extracto no se presenta como cobertura del reporte.
- El año anterior no puede extrapolarse si todavía no existe un agregado protegido para ese año.

## Visual y accesibilidad
- El diagnóstico seleccionado tiene estado `aria-pressed`.
- El botón de ampliar es accesible por teclado; el modal es un elemento `dialog` nativo con foco administrado por el navegador.
- Gráfica vectorial `SVG` con título por barra, interacción por clic, `Enter` o barra espaciadora.
- Se usa `textContent` para datos de patología y municipios, nunca HTML concatenado con cadenas del LESP.
- Diálogo y tarjetas adaptadas a escritorio y celular, con preferencia por movimiento reducido.

## Alcance
Cambios en `public/mapa-cahos/temporal-lesp.js`, `app.js`, `index.html` y `lesp-explorador.css`. No se modifican los reportes originales, los datos clínicos, Supabase ni el motor de SUIVE.

**Pendiente de verificar en navegador:** interacción visual después del despliegue de GitHub Pages, bajo sesión autorizada de Maestro.
