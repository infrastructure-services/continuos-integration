# ✨ React CI – Acción compuesta

**Descripción**
- **Propósito:** Ejecuta lint (ESLint/Stylelint), build, tests y publica cobertura y reportes.
- **Compatibilidad:** Detecta automáticamente `npm`, `yarn` o `pnpm` según el lockfile.
- **Uso típico:** Para proyectos React/JS/TS con scripts estándar en `package.json`.

**Entradas**
- **`matrix_version`:** Versión de Node.js a utilizar (ej. `20`, `18`).
- **`fontawesome_token`:** Token para descargar paquetes privados de Font Awesome (opcional).
- **`packages_token`:** Token de GitHub Packages para autenticación (opcional).
- **`skip_test`:** Si es `true`, omite los tests. Por defecto `false`.
- **`ci`:** Si es `true`, fuerza modo CI en build/tests (rompe el flujo ante errores). Por defecto `false`.
- **`skip_lint`:** Si es `true`, omite ESLint/Stylelint. Por defecto `false`.
- **`cache`:** Si es `true`, habilita cache de `node_modules`. Por defecto `true`.
- **`pnpm_version`:** Versión de pnpm a instalar cuando se detecta `pnpm` (por defecto `10`).
- **`need_report`:** Si es `true`, genera y sube reportes JSON de linters. Por defecto `false`.

**Qué hace**
- **Gestión de PM:** Detecta el gestor por lockfile y arma el comando de instalación.
- **Setup Node:** Instala Node en la versión indicada y activa cache del gestor.
- **Credenciales npm:** Genera `.npmrc` si se proveen tokens (`packages_token` y/o `fontawesome_token`).
- **Cache de `node_modules`:** Restaura/guarda cache basada en el lockfile.
- **Lint:** Ejecuta `eslint` y `stylelint` si existen en `package.json` y no está activo `skip_lint`.
- **Build:** Ejecuta `build` con `CI` según la entrada `ci`.
- **Tests:** Ejecuta `test` con `--coverage`. Optimiza flags para Vitest/Jest. Se puede saltar con `skip_test`.
- **Artefactos:** Sube `coverage/` y (si `need_report` es `true`) `eslint-report.json` y `stylelint-report.json`.

**Requisitos**
- **Lockfile:** Debe existir uno de: `package-lock.json`, `yarn.lock` o `pnpm-lock.yaml`.
- **Scripts en `package.json`:** Se recomienda definir `build`, `test`, `eslint` y `stylelint`.

**Ejemplo de uso**
```yaml
name: CI
on:
	push:
		branches: [ main ]
	pull_request:
		branches: [ main ]

jobs:
	react-ci:
		runs-on: ubuntu-latest
		strategy:
			matrix:
				node: [ 18, 20 ]
		steps:
			- name: Checkout
				uses: actions/checkout@v4

			- name: React CI
				uses: infrastructure-services/continuos-integration@v3-beta
				with:
					matrix_version: ${{ matrix.node }}
					packages_token: ${{ secrets.GITHUB_PACKAGES_TOKEN }}
					fontawesome_token: ${{ secrets.FONTAWESOME_TOKEN }}
					skip_lint: 'false'
					skip_test: 'false'
					ci: 'true'
					cache: 'true'
					pnpm_version: '10'
					need_report: 'true'
```

**Notas y recomendaciones**
- **Lockfile requerido:** La acción falla si no encuentra un lockfile; sube el archivo de lock antes de ejecutar.
- **Tokens opcionales:** `.npmrc` se genera sólo si hay `packages_token` y/o `fontawesome_token`.
- **Vitest/Jest:** La acción detecta Vitest y evita flags de Jest (`--runInBand --silent`) cuando corresponde.
- **Cache:** Además del cache de `setup-node`, se usa `actions/cache` sobre `node_modules` con clave basada en lockfile.
- **Windows runners:** Los pasos usan `shell: bash`. En self-hosted Windows, asegúrate de tener bash disponible.

**Artefactos publicados**
- **`code-coverage-report`:** Contiene la carpeta `coverage/` generada por los tests.
- **`linter-reports`:** Archivos `eslint-report.json` y `stylelint-report.json` cuando `need_report` es `true`.

**Resolución de problemas**
- **No se generan reportes de lint:** Verifica que existan scripts `eslint` y `stylelint` en `package.json` y que `need_report` sea `true`.
- **Falla por lockfile:** Asegura subir el lockfile (npm/yarn/pnpm) del proyecto.
- **Instalación de dependencias lenta:** Activa `cache: 'true'` y confirma que el lockfile no cambió innecesariamente.

**Mantenimiento**
- **Referencia de acción:** Esta acción está definida en [action.yml](action.yml).
- **Versión recomendada:** Usa el tag `v3-beta` o un commit SHA para estabilidad.