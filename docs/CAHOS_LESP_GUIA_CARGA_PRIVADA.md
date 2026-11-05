# CAHOS · ¿Por qué no se muestran los datos del LESP?
**Actualización: 5 de noviembre de 2026**

## Causa
El módulo LESP del MAPA CAHOS no se alimenta del cubo SUIVE. Por diseño, los datos provienen de un **archivo agregado privado JSON**, que se importa a la memoria del navegador desde una sesión del **Administrador Maestro**. No está publicado en GitHub Pages ni se guarda en Supabase.

Al ingresar en una nueva pestaña o volver a cargar el mapa, el archivo debe importarse nuevamente. Este comportamiento es intencional para no dejar datos sensibles en almacenamiento local compartido.

## Pasos de carga
1. Descargar el archivo **LESP_SONORA_2026_agregados_PRIVADO_CAHOS.json** entregado por ChatGPT. No importar el Excel original nominal.
2. Abrir `/CAHOS/mapa-cahos/` e iniciar sesión con la cuenta **Administrador Maestro**.
3. Desplegar **LESP · Resultados positivos** y elegir el archivo JSON.
4. La interfaz debe mostrar **LESP importado correctamente**, el número de celdas del agregado y la última semana registrada.
5. El mapa cambia automáticamente a **LESP · Resultados positivos por municipio**. Selecciona municipio y semanas para abrir su ficha. El panorama inicial también tiene un enlace directo a la importación.
6. Para tasas, disponer de población del año elegido y distinguir denominador municipal de estatal.

## Qué no debe mostrarse como cero
Este archivo contiene **resultados positivos candidatos**, no una extracción exhaustiva de positivos y negativos. Si no existe fila positiva de un municipio/patología/intervalo, el visor marca **sin dato del extracto** en lugar de cero confirmado. Tampoco son casos confirmados de vigilancia por sí solos; se requiere definición oficial de caso y revisión de laboratorio.

## Próxima fase de integración real
Si se requiere que cualquier usuario autorizado vea LESP automáticamente al ingresar, configurar almacenamiento **protegido** por roles, controles de acceso reales a nivel servidor (RLS y API), bitácora y corte certificado. El proyecto Supabase CAHOS aún no está conectado en esta sesión. No se deberá subir el agregado privado a la carpeta pública `public/`.

## Verificación de la revisión
- 19/19 pruebas de sintaxis, DOM y semántica.
- Importación bloqueada sin sesión de Maestro.
- Importación activada con Maestro.
- Cambio automático a capa LESP.
- Distinción entre positivo registrado, ausencia de registros y archivo no cargado.
- Filtros de semanas aplicados correctamente a la fuente local.
