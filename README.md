# CAHOS | Plataforma de análisis epidemiológico

CAHOS retoma su desarrollo como una plataforma modular. Su **primer módulo es el Visor SUIVE**, orientado a lectura y consulta parametrizada de cubos del SINAVE: padecimiento, años, semanas epidemiológicas, entidad/municipio, sexo y edad.

## Módulo 01: Visor SUIVE

- Tablero de patologías preseleccionadas, filtros territoriales y temporales.
- Comparativos de años, series semanales, distribución por edad/sexo y canal endémico exploratorio cuando existan series comparables suficientes.
- Programación de patologías favoritas y consultas automáticas a través de un **servicio institucional protegido**, una vez conectado.
- Exportación de resultados agregados solo según los permisos de la API.

## Estado

**Vista web disponible para publicación. Datos reales: pendientes.** La versión GitHub Pages no accede al cubo directamente, no almacena ni publica contraseñas, no ejecuta Python/PowerShell y no muestra datos sintéticos como oficiales. La conexión SINAVE deberá realizarse mediante acceso institucional autorizado de solo lectura, en un backend aislado que autentique usuarios, audite consultas y autorice únicamente salidas publicables.

## Despliegue

Repositorio: [doctopanda/CAHOS](https://github.com/doctopanda/CAHOS).Página esperada si el despliegue está habilitado: `https://doctopanda.github.io/CAHOS/`.

La carpeta `public/` es la única publicada por el flujo de GitHub Actions `.github/workflows/pages.yml`. En GitHub: **Settings → Pages → Build and deployment → GitHub Actions**. No incluir en el repositorio archivos Excel originales con conexiones MSOLAP, datos nominales, credenciales, exportaciones o servicios internos.

`public/configuracion-publica.js` contiene solo parámetros de visualización públicos. Mantener `apiBaseUrl: ""` mientras no exista una API segura validada. No colocar tokens ni claves en JavaScript público.

## Próximas etapas

1. Validar consultas MDX contra el cubo en equipo autorizado y permisos institucionales.
2. Preparar API autenticada que presente exclusivamente agregados autorizados a CAHOS.
3. Activar actualización automática de patologías programadas, trazabilidad y corte SE.
4. Validar casos/tasas y cálculos de canales endémicos frente a fuentes oficiales.
5. Incorporar nuevos módulos de CAHOS sin alterar la lectura SUIVE.