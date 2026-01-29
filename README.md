# Analizador de Reportes de Linter y Cobertura

![Coverage](./badges/coverage.svg)

**Resumen**

Esta acción de GitHub analiza un reporte de linter (y puede considerar la
cobertura) y publica recomendaciones de calidad de código como comentario en el
Pull Request. Además, marca el commit con un estado de verificación de “success”
o “failure” según el resultado del análisis.

—

**Características**

- Publica un comentario en el PR con recomendaciones claras y accionables.
- Evita temas de seguridad por diseño; se enfoca en calidad (legibilidad,
  mantenibilidad, simplicidad, testabilidad, consistencia y documentación).
- Actualiza un comentario previo del bot si existe; si no, crea uno nuevo.
- Registra un Commit Status (`success`/`failure`) para el SHA analizado.

—

**Cómo Funciona**

- La acción se ejecuta en eventos de `pull_request`. Si se invoca fuera de un
  PR, finaliza de forma no disruptiva con un aviso.
- Lee la ruta del reporte desde el input `report-path` (por defecto
  `./report.json`).
- Crea una sesión con GitHub Copilot (`gpt-4o`) usando un prompt de sistema
  específico de calidad.
- Envía el reporte como archivo adjunto para generar recomendaciones.
- Publica/actualiza el comentario del PR con el contenido generado.
- Determina el estado PASS/FAIL buscando la cadena “**Result:** FAIL” (sin
  distinción de mayúsculas/minúsculas) en el contenido generado:
  - Si se encuentra “FAIL” → `failure`
  - De lo contrario → `success`

—

**Entradas (inputs)**

- `github_token` (obligatorio): Token con permisos para leer/escribir en el
  repositorio/PR.
- `report-path` (opcional): Ruta al archivo de reporte (por defecto
  `./report.json`).

—

**Ejemplo de Uso (workflow)**

```yaml
name: Code Quality
on:
	pull_request:
		types: [opened, synchronize, reopened]

jobs:
	quality:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v4
			- name: Ejecutar análisis de calidad
				uses: ./. # o infrastructure-services/continuos-integration@v3-beta
				with:
					github_token: ${{ secrets.GITHUB_TOKEN }}
					report-path: ./report.json
```

—

**Detalles Técnicos**

- Arquitectura ESM en TypeScript, empaquetada con Rollup hacia `dist/index.js`.
- Punto de entrada de la acción: [src/index.ts](src/index.ts) → ejecuta `run()`.
- Lógica principal: [src/main.ts](src/main.ts)
  - Lee inputs con `@actions/core`.
  - Usa `@actions/github` para obtener `octokit` y contexto del PR.
  - Crea sesión con `@github/copilot-sdk` (modelo `gpt-4o`) y envía el reporte
    como adjunto.
  - Publica comentario vía `createOrUpdateComment` y fija Commit Status mediante
    `repos.createCommitStatus`.
- Comentarios en PR: [src/comment.ts](src/comment.ts)
  - Actor por defecto: `CybersecurityGLA`.
  - Marcador en cuerpo: `<!-- code-quality-validator -->`.
  - Si existe un comentario del actor con el marcador, se actualiza; si no, se
    crea uno.
- Prompt del sistema: [src/prompts.ts](src/prompts.ts)
  - Enfocado exclusivamente en calidad (sin seguridad), con formato de salida
    recomendado y checklist.
- Definición de la acción: [action.yml](action.yml)
  - `using: node24`, `main: dist/index.js`.

—

**Condiciones de Éxito/Fracaso**

- La función `isPass()` considera PASS cuando el mensaje NO contiene
  `**result:** fail` (comparación case-insensitive). Cualquier otro contenido se
  interpreta como éxito.
- El estado se publica con `repos.createCommitStatus` usando el contexto por
  defecto “Jira Issue Validation”.

—

**Requisitos**

- Node.js 24 en tiempo de ejecución del action runner.
- Permisos del token suficientes para comentar en PR y crear statuses.
- El archivo del reporte debe existir en la ruta indicada por `report-path`.

—

**Desarrollo Local**

- Instalar dependencias:

```bash
npm install
```

- Formateo y lint:

```bash
npm run format:write
npm run lint
```

- Pruebas:

```bash
npm run test
```

- Empaquetado (genera `dist/`):

```bash
npm run bundle
```

- Flujo completo (format + lint + test + coverage + package):

```bash
npm run all
```

- Probar localmente la acción (requiere `.env` si aplica):

```bash
npm run local-action
```

—

**Limitaciones y Decisiones**

- El análisis deliberadamente no cubre temas de seguridad; el prompt los excluye
  para mantener foco en calidad.
- El resultado PASS/FAIL depende del contenido devuelto por Copilot; si el
  mensaje no contiene “**Result:** FAIL”, se interpreta como PASS.
- La acción solo opera en `pull_request`; llamados desde otros eventos finalizan
  sin fallo pero sin ejecutar el análisis.

—

**Estructura del Proyecto**

- Código fuente: `src/`
  - [src/index.ts](src/index.ts)
  - [src/main.ts](src/main.ts)
  - [src/comment.ts](src/comment.ts)
  - [src/prompts.ts](src/prompts.ts)
  - [src/types.ts](src/types.ts)
- Salida empaquetada: `dist/`
- Pruebas: `__tests__/`
- Configuración de compilación: [rollup.config.ts](rollup.config.ts)
- Configuración de Jest: [jest.config.js](jest.config.js)
- Metadata de la acción: [action.yml](action.yml)

—

**Mantenimiento**

- Tras modificar archivos en `src/`, ejecutar `npm run bundle` para actualizar
  `dist/`.
- Asegurar que las pruebas pasen y que el paquete esté actualizado antes de
  crear una versión.
