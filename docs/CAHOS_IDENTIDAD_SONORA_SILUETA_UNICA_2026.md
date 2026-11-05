# CAHOS · Identidad visual unificada (noviembre de 2026)

## Principio permanente: una sola silueta de Sonora
- Fuente visual aprobada: mapa de contorno aportado por el usuario el 5 de noviembre de 2026.
- `public/assets/sonora-silueta.svg` es el **contorno sólido canónico** (trazado desde la referencia, sin líneas interiores).
- Nunca representar divisiones municipales, distritales, poblacionales o regionales **dentro de los emblemas, miniaturas ni marcadores**. Se permiten únicamente en el mapa operativo analítico, donde esas fronteras tienen significado geográfico.
- `public/assets/cahos-emblema.svg` utiliza **el mismo contorno** y los elementos visuales de la marca (pulso, red de datos, barras, cuidado).
- `public/assets/cahos-modulos.svg` contiene portadas y miniaturas vectoriales de Panorama, Mapa, Población, Calidad, Infraestructura, Administración y Acceso.
- `public/assets/cahos-marcadores.svg` contiene marcadores de territorio, seleccionado, hover, población, alerta, infraestructura, seguridad y clúster. No se inventan municipalidades ni coordenadas.

## Paleta única
| Token | Color | Uso |
|---|---|---|
| Baya profunda | `#8A1F5B` | Encabezados, botones principales, contornos e identidad |
| Rosa chicle | `#F06DA6` | Ilustraciones y acentos, no texto pequeño sobre blanco |
| Rosa pastel | `#FFC2D9` | Fondo decorativo y burbujas |
| Lila suave | `#CDB4F4` | Segunda serie demográfica y superficies complementarias |
| Crema cálida | `#FFF4E6` | Fondos e interiores del emblema |

Los textos pequeños deben usar baya oscura `#712047` o plum `#54283E`, no rosa pastel. Los estados epidemiológicos con semántica propia se conservan: naranja = 0 imputado, negro = 0 observado, advertencias y errores mantienen diferenciación.

## Arquitectura de identidad
- `public/cahos-shell.js`: carga las miniaturas, construye la navegación consistente y la portada por módulo.
- `public/cahos-identidad.css`: estilos compartidos y legibles para Panorama, Población, Calidad, Infraestructura, Acceso y Administración.
- `public/mapa-cahos/identidad-mapa.css`: misma familia para el mapa standalone. Marcador seleccionado utiliza la biblioteca vectorial CAHOS; el mapa INEGI conserva polígonos operativos.
- Los módulos mantienen sus permisos, tokens, cálculos, filtros y consultas sin reemplazar la lógica de origen.

## Radar demográfico
Población presenta ocho tarjetas automáticas sobre la base de 72 municipios:
1. Mayor población absoluta del año elegido.
2. Menor población absoluta.
3. Mayor densidad (hab/km²).
4. Menor densidad (hab/km²).
5. Participación de los cinco municipios más poblados en el total del estado.
6. Relación de dependencia por edad: (0–14 + 65+) / (15–64) × 100.
7. Índice de envejecimiento: 65+ / 0–14 × 100.
8. Cambio estatal proyectado 2015–2030, únicamente con ambos años completos.

Para densidad se calcula la superficie geográfica aproximada a partir de geometría INEGI (fórmula esférica); **no** se presenta como superficie municipal oficial publicada, ni se calcula densidad si faltan polígonos. Los valores se dejan con guion si no hay 72 municipios proyectados o si no existen años completos. La concentración de cinco municipios **no** se presenta como porcentaje de población urbana, pues los datos municipales no permiten inferir residencia urbana.

## Reglas de control
- Ningún emblema usa geometrías municipales renderizadas como 72 elementos separados.
- Nunca inferir ausencia de casos, de mediciones o de población desde un error de consulta.
- Los datos LESP privados permanecen fuera de las imágenes y de GitHub Pages.
- La pantalla de Administración solo muestra funciones con controles de acceso; el backend sigue siendo la autoridad.
- Pendiente de verificar la UI en navegador autenticado y la publicación en GitHub Pages tras el merge.

### Archivo de origen de la silueta
Imagen de contorno de Sonora aportada en esta conversación, convertida a un path SVG único y simplificado con tolerancia aproximada de 1 píxel respecto al dibujo de referencia. Los datos analíticos continúan georreferenciados por INEGI; la silueta de marca no es un mapa para mediciones.
