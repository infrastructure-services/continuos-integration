# Continuous Integration v3 — Python

Pipeline de CI/CD v3 self-contained para proyectos Python del monorepo. Replica
la estructura de [`cicdv3-net-8`](https://github.com/infrastructure-services/continuos-integration/tree/cicdv3-net-8)
y [`go-cicdv3-test`](https://github.com/infrastructure-services/continuos-integration/tree/go-cicdv3-test):
ejecuta tests, lint, métricas y duplicados, y reporta cada resultado a Sentinel
vía sus "sensores". No delega en sub-actions externas — el composite tiene los
~25 steps internos.

## Sensores Sentinel

| Sensor          | Herramienta              | Reporte                                |
|-----------------|--------------------------|----------------------------------------|
| `python-cover`  | `pytest --cov` (Cobertura) | `TestResults/Cobertura.xml`          |
| `ruff`          | `ruff check`             | `ruff-report.json` (array de issues)    |
| `cloc`          | `cloc`                   | `cloc-report.json`                      |
| `jscpd`         | `jscpd` (`--format python`) | `jscpd-report/jscpd-report.json`     |

El `Create Sentinel Scan` es **bloqueante**: si no devuelve `scanId`, el job
falla (`exit 1`). Los 4 `Send X to Sentinel` son `continue-on-error: true` para
tolerar blips transitorios en un sensor individual sin frenar el resto del
análisis. El último envío (`jscpd`) marca `IS_LAST_REPORT=true` para cerrar el
scan en Sentinel.

## Inputs

| Input | Default | Descripción |
|---|---|---|
| `github_username` *(req)* | — | Usuario de GitHub para `setup_pypriv.sh` (paquetes privados). |
| `github_token` *(req)* | — | Token con `read:packages` y read en los repos privados. |
| `workdir_src` | `.` | Dir del código a analizar (relativo al repo). Construido como `${{ github.workspace }}/${{ inputs.workdir_src }}`. |
| `workdir_test` | `.` | Dir donde correr `pytest`. |
| `version` | `3.11` | Versión de Python para `actions/setup-python@v5`. |
| `skip_test` | `false` | Si `true`, saltea el step `Test`. |
| `pytest_version` | `8.3.4` | Pin de `pytest`. |
| `pytest_cov_version` | `6.0.0` | Pin de `pytest-cov`. |
| `ruff_version` | `0.8.4` | Pin de `ruff`. |
| `sonar_url` *(req)* | — | Vestigial. Retenido por compat con orquestador `@v3-test`. No se usa internamente — Sentinel reemplaza a SonarQube. |
| `sonar_token` *(req)* | — | Idem. |
| `sonar_custom` | `""` | Idem. |
| `sonar_tags` | `""` | Idem. |
| `sentinel_url` | `https://sentinel-api-gitops-test.apps.ocptest.andreani.com.ar` | API base de Sentinel. |
| `sentinel_sensor_id` | `1` | Vestigial. Los sensores reales se nombran por step. |
| `gitops_url` | `https://ui-gitops-test.apps.ocptest.andreani.com.ar` | UI de GitOps usada en el comentario del PR. |

## Runner

**Requiere `runs-on: self-hosted`** (o cualquier runner con acceso de red a
`*.apps.ocptest.andreani.com.ar`). Las composite actions no tienen `runs-on`
propio — viene del workflow caller. Si Sentinel no responde, el step bloqueante
`Create Sentinel Scan` aborta el job.

## Orquestador `@v3-test`

El orquestador (`infrastructure-services/continuos-integration/action.yml`
branch `v3-test`) llama a este pipeline cuando el input `workflow` es `Python`
o `PythonData`. **No hay ternario que reescriba `workdir_src` para Python** —
los valores se pasan tal cual los recibe el orquestador (a diferencia de Go,
donde `./` se reescribe a `./src`). Si el repo target tiene el código en una
subcarpeta, pasar `workdir_src: 'src'` (o el path que corresponda) desde el
workflow caller.

Para apuntar el orquestador a esta branch, alguien debe editar
`v3-test/action.yml`:

```diff
- uses: infrastructure-services/continuos-integration@python
+ uses: infrastructure-services/continuos-integration@python-cicdv3-test
```

## Lecciones recogidas portando .NET → Go → Python

1. **`working-directory` absoluto**: composite actions resuelven `working-directory: ./`
   al directorio del action, no al workspace del repo caller. Por eso todos los
   steps con paths usan `${{ github.workspace }}/${{ inputs.workdir_src }}`.
2. **`setup-python` sin `cache-dependency-path`**: si se setea con un path
   que contenga `./`, `@actions/glob` lo rechaza con `Relative pathing '.' and
   '..' is not allowed`. Se deja auto-detect.
3. **Sentinel bloqueante desde el primer commit**: `Create Sentinel Scan` no
   tiene `continue-on-error`. Si falla, no tiene sentido seguir generando
   reportes que no se van a poder asociar.
4. **`Send X to Sentinel` con `continue-on-error: true`**: tolera fallas
   transitorias de un sensor individual sin frenar los siguientes.
5. **Sensor `python-cover`** (no `pytest-cov` ni `coverage`): nombre del sensor
   en la convención Sentinel del monorepo, ya registrado server-side.
6. **`pytest-cov` genera Cobertura directo**: sin paso de conversión análogo
   a `reportgenerator` (.NET) o `gocover-cobertura` (Go).
7. **ruff exit codes**: `0` sin issues, `1` con issues (esperado), `>=2` error
   real. El step trata `1` como éxito. Cuando no hay issues, ruff no escribe el
   JSON → el step crea `[]` para que el envío a Sentinel y el conteo posterior
   no fallen.
8. **Tooling pineado**: `pytest`, `pytest-cov` y `ruff` se instalan con
   versión fija (`==`). Para subirlas, cambiar el default del input
   correspondiente — no instalar `pytest@latest` en CI.
9. **Inputs `sonar_*` retenidos vestigiales**: Sentinel reemplaza a SonarQube;
   los inputs siguen existiendo para no romper el contrato con el orquestador.
10. **Fallback robusto de Python (EOL + runner aislado)**: el orquestador
    `v3-test` tiene `version: '3.8'` como default — Python 3.8 está EOL desde
    octubre 2024. Además, los runners self-hosted del monorepo no siempre
    tienen el tool-cache de `actions/setup-python@v5` poblado ni acceso al
    manifest público (`raw.githubusercontent.com/actions/python-versions`), lo
    que hace que tanto `3.8` como `3.x` fallen con `was not found in the local
    cache`. Para no romper a downstreams, el composite implementa un único
    fallback al Python del sistema:
    - Step 1 `Setup Python (requested version)`: intenta `setup-python@v5` con
      la versión solicitada. `continue-on-error: true`.
    - Step 2 `Setup Python (system fallback)`: si el paso 1 falló, usa el
      `python3` que tenga el sistema; si no existe, lo instala via
      `apt-get`/`yum`/`apk`. Crea shims `python`/`pip` en `$HOME/.local/python-shim`
      y los expone via `$GITHUB_PATH` para que los steps siguientes los
      encuentren con los nombres canónicos.
    - Step 3 `Report Python version`: emite `::warning::` con la versión real
      cuando se usó el fallback.
    Trade-off: el fallback degrada silenciosamente la versión solicitada. Si
    tu código depende de una versión específica (sintaxis EOL, deps que pinean
    Python), override `version` en el workflow caller, populá el tool-cache
    del runner, o subí el default en `v3-test`.
11. **`--ignore-installed` en deps del proyecto**: en runners que usan el
    Python del sistema (RHEL/CentOS), varios paquetes Python están instalados
    via RPM/dnf (`requests`, `urllib3`, `six`, etc.) y no tienen `RECORD` file
    — pip aborta el uninstall con `Cannot uninstall X: The package was installed
    by rpm`. El step `Install project dependencies` usa `--ignore-installed`
    para que pip saltee el uninstall y deposite la versión nueva por encima
    en `/usr/local/lib/.../site-packages`. El paquete RPM queda intacto pero
    el nuevo gana en `sys.path`. Trade-off: dos versiones coexisten en disco
    (mayor footprint), pero el runtime usa la nueva. Para evitarlo: usar
    venv o pre-popular el tool-cache del runner.

## Scripts

- `scripts/send_to_sentinel.sh` — POST multipart del reporte al endpoint
  `/api/v1/scans/{SCAN_ID}/sensors/{SENSOR_ID}/report`. Tech-agnostic; mismo
  contenido que en `cicdv3-net-8`.
- `scripts/setup_pypriv.sh` — Configura acceso a paquetes Python privados de
  GitHub: `git config insteadOf` (cubre `pip install git+https://...`) +
  `~/.netrc` (cubre herramientas que invocan HTTPS directamente). Tolera la
  ausencia de `git` en el runner (varios self-hosted del monorepo no lo
  traen): intenta instalarlo via `apt-get`/`yum`/`apk`, y si no se puede,
  saltea el rewrite con warning pero mantiene `.netrc` (suficiente para
  pip/curl en la mayoría de los casos).

## Métricas en el PR

Al finalizar, el step `Comment on PR` deja un comentario con:

- 🧪 Cobertura % (de `Cobertura.xml`)
- ⚠️ Issues ruff (length del array JSON)
- 📋 Líneas duplicadas + % (jscpd statistics)
- Link a GitOps UI con `org/project/application?branch=`

El `Collect Metrics` step es `continue-on-error: true`: si jq o el parseo del
XML fallan, las métricas quedan en `N/A` pero el comentario sale igual.
