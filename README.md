# Dev-visor: Bot de Ayuda para Flujos de Trabajo con Bases de Datos

Dev-visor es un bot diseñado para facilitar la creación y gestión de flujos de trabajo basados en bases de datos. Utilizando tecnologías modernas como el SDK de Microsoft 365 Agents, este bot permite a los usuarios interactuar con sus datos de manera eficiente y estructurada.

## Características Principales

- **Gestión de Tablas y Columnas**: Obtén información detallada sobre las tablas y columnas de tu base de datos.
- **Búsqueda Avanzada**: Encuentra tablas y datos específicos utilizando herramientas de búsqueda personalizadas.
- **Lectura de Requisitos**: Procesa documentos PDF para extraer requisitos y generar flujos de trabajo automáticamente.
- **Integración con Microsoft 365**: Interactúa con el bot directamente desde Microsoft Teams u otras aplicaciones de Microsoft 365.

## Requisitos Previos

Para ejecutar este proyecto en tu máquina local, necesitarás:

- [Node.js](https://nodejs.org/), versiones soportadas: 18, 20, 22.
- [Microsoft 365 Agents Toolkit para Visual Studio Code](https://aka.ms/teams-toolkit) o [CLI de Microsoft 365 Agents Toolkit](https://aka.ms/teamsfx-toolkit-cli).
- Una cuenta de Azure con acceso a [Azure OpenAI](https://aka.ms/oai/access).

## Configuración Inicial

1. Clona este repositorio en tu máquina local.
2. En el archivo `env/.env.local`, configura las siguientes variables:
   - `SECRET_AZURE_OPENAI_API_KEY=<tu-clave>`
   - `AZURE_OPENAI_ENDPOINT=<tu-endpoint>`
   - `AZURE_OPENAI_DEPLOYMENT_NAME=<tu-despliegue>`
3. Ejecuta el comando `npm install` para instalar las dependencias.
4. Inicia el entorno de desarrollo con `npm run dev:teamsfx`.

## Estructura del Proyecto

| Carpeta      | Contenido                                           |
|--------------|----------------------------------------------------|
| `appPackage` | Plantillas para el manifiesto de la aplicación     |
| `env`        | Archivos de configuración del entorno             |
| `infra`      | Plantillas para la provisión de recursos en Azure |
| `src`        | Código fuente de la aplicación                    |

## Uso

1. Inicia el bot en el entorno de desarrollo.
2. Interactúa con el bot a través de Microsoft Teams o el Microsoft 365 Agents Playground.
3. Utiliza los comandos disponibles para gestionar tus flujos de trabajo y bases de datos.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, abre un issue o envía un pull request para sugerir mejoras o reportar problemas.

---

**Nota**: Este proyecto está diseñado para funcionar con las últimas versiones del modelo GPT-4o-mini para garantizar respuestas precisas y eficientes.
