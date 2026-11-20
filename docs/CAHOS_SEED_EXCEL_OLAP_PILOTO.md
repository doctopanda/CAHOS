# CAHOS · SEED Excel OLAP · Piloto v0.1

## Alcance y estado (20 noviembre 2026)
Se incorpora el **módulo de mortalidad SEED** como fuente diferenciada de SUIVE (morbimortalidad notificada) y LESP (resultados de laboratorio). Esta integración **no requiere servicios, PowerShell, Docker ni un conector residente**.

**Libro maestro:** `SEED MAESTRO.xlsx` del equipo institucional autorizado. Este libro **NO está en GitHub**.

Auditoría local de la copia suministrada: incluye `xl/connections.xml` con conexión OLAP tipo 5 al catálogo `DEFUNCIONES_2026` mediante proveedor `MSOLAP.8`; contiene una PivotTable vinculada a la conexión y 43 jerarquías/35 dimensiones de caché. No contiene `vbaProject.bin` ni datos numéricos del cubo en caché (recordCount=0; saveData=0). La conexión real **no se ha comprobado** desde este entorno: requiere Excel y la sesión/red autorizadas. No se incorporan parámetros confidenciales de conexión en este repositorio.

## Procedimiento en Microsoft Excel (Windows)
1. **Conservar intacto** `SEED MAESTRO.xlsx` en ubicación institucional protegida. No subirlo a GitHub, chats públicos ni páginas web.
2. Abrir en Excel de escritorio, con sesión y permisos institucionales. **Datos > Consultas y conexiones / Conexiones existentes**: comprobar la conexión SEED.
3. Desde la PivotTable, elegir **Actualizar** o **Datos > Actualizar todo**. Si Excel indica error, registrar **el código o categoría**, no copiar cadenas de conexión ni contraseñas. Un vínculo persistido **no garantiza** acceso: se necesitan permisos reales en el servidor.
4. Si el pivote aparece vacío, mostrar **Lista de campos** y disponer **[Measures].[DEFUNCIONES]** en Valores; **ENTIDAD RESIDENCIA** y **AÑO DE DEFUNCION** en filtros; **MUNICIPIO RESIDENCIA** en filas y **MES DE DEFUNCION** en columnas. Seleccionar Sonora y año 2026. No incluir datos de CURP, nombres, localidad desagregada, ni variables identificables.
5. Comprobar que los municipios y total estatal concilian para el corte vigente. No presumir que el total del nuevo corte coincide con una extracción previa.
6. Guardar **copia de resultados agregados** como **CSV UTF-8**, con los encabezados originales del pivote; conservar el maestro conectado por separado. Evitar el total nacional `Grand Total *` y mantener la categoría municipal `998 SE IGNORA` separada.
7. Abrir **CAHOS → SEED · Mortalidad** y seleccionar **solo el CSV agregado**. El navegador lee el archivo localmente y permite explorar/exportar una versión limpia con año, municipio, mes, defunciones y estado de dato. No envía contenido al servidor.

### Actualización automática *en Excel*
En Propiedades de conexión → Uso, puede activarse **Actualizar al abrir el archivo** cuando la configuración de Excel y la política institucional lo permitan. Una conexión OLAP no garantiza compatibilidad con actualización en segundo plano ni con procesos desatendidos. La actualización de Excel **NO actualiza automáticamente GitHub Pages**; el visor usa CSV agregado importado manualmente. Este diseño elimina la necesidad de un agente residente.

## Pruebas
- La estructura del CSV de prueba se obtuvo exclusivamente de la tabla municipal 2026 proporcionada por el usuario (sin publicarla): **72 municipios, 10 meses enero-octubre, una categoría ignorada con seis registros; total fuente y total sumado 14,862; diferencias: 0**.
- Los meses sin valor visible se preservan como `sin_dato`; no inferir cero certificado.
- No se exportan ni publican celdas nominativas ni conexiones institucionales.
- La fuente de muerte en SEED se debe etiquetar por **fecha de defunción y municipio de residencia**, no como casos SUIVE.
- Corte 2026 parcial; año y fecha de corte deben corroborarse en cada actualización.
- Pendiente: prueba **en vivo** de conexión nativa Excel/OLAP, desgloses de sexo/edad/CIE-10, integración de regiones con el catálogo municipal y política institucional de publicación de agregados.

## Separación de seguridad
- No subir Excel conectado `SEED MAESTRO.xlsx` a la aplicación ni al repositorio. Puede incorporar detalles de autenticación en el XML de conexión.
- No publicar agregados indiscriminados por causa, municipio y edad. Aplicar revisión/supresión de celdas pequeñas y autorización antes de pasar de vista local a datos compartidos.
- La conexión OLAP existente no es una autorización automática para redistribución; se mantienen permisos del servidor y políticas de datos.
- La rama `feature/cahos-seed-excel-olap-2026-11-20` es de revisión: **main, SUIVE y LESP permanecen sin alterar** hasta aprobar la integración.
