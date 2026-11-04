# MAPA CAHOS · Producto territorial independiente (fase piloto)

**Fecha:** 4 de noviembre de 2026.

## Lo que ya existe

El visor separado `public/mapa-cahos/index.html` y `public/mapa-cahos/app.js` se publica provisionalmente en:
https://doctopanda.github.io/CAHOS/mapa-cahos/

Funciona como una aplicación separada dentro de GitHub Pages de CAHOS para probar autenticación, cartografía y capas reales. **No existe todavía un repositorio `doctopanda/MAPA-CAHOS`**, y no se debe afirmar que esté publicado como repositorio nuevo.

- Cartografía de 72 municipios INEGI generada por GitHub Actions.
- Capas coloreadas de casos municipales (solo si el usuario puede leer esa extracción), tasa territorial por 100,000 con denominador compatible, población proyectada municipal.
- Filtros de patología, año, sexo y edad del catálogo real SINAVE.
- Ficha municipal al seleccionar el polígono, pirámide 14 grupos por sexo y tendencia demográfica de 2015–2030.
- Navegación con Panorama y Población que reutiliza el selector de filtros guardado en `sessionStorage` (sin tokens ni datos nominales en el estado compartido).
- Interfaz adaptable a móvil con paneles y capas. Pendientes: desplazamiento cartográfico por arrastre, leyenda estadística avanzada, comparaciones entre años, filtros distritales y vinculación a alertas epidemiológicas.
- Mapas y casos se obtienen de la API protegida de Supabase; **no se descargan como datos fijos al repositorio público**.

## Por qué aparecía gris el mapa-resumen

Se confirmaron 2 consultas municipales, cada una con 73 filas: 72 municipios con claves OLAP `001`–`072` y una fila adicional sin municipio que representa el total estatal.

Para infecciones intestinales por otros organismos (2026), la suma de los 72 municipios equivale a 77,948, igual al total estatal; para infecciones respiratorias agudas (2026) equivale a 280,849, igual al total estatal.

El mapa anterior no distinguía bien el total de las filas municipales ni vinculaba siempre las claves OLAP de 3 dígitos con las claves INEGI de 5 dígitos. Esto fue corregido en `public/mapa_sonora.js`. **Ninguna fila de total estatal se suma como un municipio 73.**

Las consultas municipales continúan con `publication_status=pending` por los controles de privacidad. El Administrador Maestro puede acceder a ellas a través de la vista preliminar autenticada (con advertencia). No se han liberado a otras cuentas ni publicitado como datos oficiales.

## Arquitectura de transición a repositorio propio

Cuando exista el repositorio `doctopanda/MAPA-CAHOS`, copiar `index.html` y `app.js` desde `public/mapa-cahos/` a su raíz, activar GitHub Pages. Las rutas de recursos compartidos usan `/CAHOS/` por diseño: mantienen el acceso a la autenticación, estado de filtros y GeoJSON oficial generado por el repositorio principal de CAHOS, sin copiar bases de casos.

Como ambos repositorios del usuario se servirían desde `doctopanda.github.io`, compartirían origen web y almacenamiento de sesión en la misma pestaña. **No debe exponerse ninguna clave secreta, token de agente ni datos nominales en GitHub.** El backend y RLS permanecen centralizados.

## Limitaciones

- La tasa se omite si grupo de edad o sexo del cubo no tiene un denominador compatible.
- Año 2026 puede tener casos de un corte parcial; denominador poblacional siempre anual.
- En el mapa se distingue `gris` sin información de `0` casos.
- Resultados municipales preliminares no son cifras oficiales certificadas ni están habilitados para acceso general.
- El visor se diseñó y pasó comprobaciones de sintaxis, pero se debe completar la prueba en navegador autenticado para certificar interacción y colorización end-to-end.
