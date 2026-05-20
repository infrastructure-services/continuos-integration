# continuos-integration · go-cicdv3-test

Composite Action de **CI/CD v3 para proyectos Go**. Es la contraparte de la rama
[`cicdv3-net-8`](../../tree/cicdv3-net-8) (CI/CD v3 para .NET 8): reemplaza el
análisis de SonarQube por un pipeline de **sensores reportados a Sentinel**.

## Qué hace

1. **Create Sentinel Scan** — crea un scan en Sentinel y obtiene `scanId`,
   `projectId`, `applicationId` y `organizationId`. Si Sentinel es inalcanzable,
   el paso lo registra y el pipeline continúa igual.
2. **Build & Test** — `go build ./...` y `go test ./... -coverprofile`.
3. **Coverage** — convierte el perfil de cobertura de Go a formato Cobertura XML
   con [`gocover-cobertura`](https://github.com/boumenot/gocover-cobertura).
4. **Análisis estático** — ejecuta [`golangci-lint`](https://golangci-lint.run/)
   con salida JSON.
5. **Métricas de código** — `cloc` (conteo de líneas).
6. **Código duplicado** — `jscpd` con tokenizer de Go.
7. Cada reporte se envía a Sentinel; al final se publica un resumen en el
   `STEP_SUMMARY` y un comentario en el PR.

## Equivalencia con `cicdv3-net-8`

| Herramienta .NET (cicdv3-net-8) | Equivalente Go (go-cicdv3-test) | Sensor Sentinel |
|---------------------------------|---------------------------------|-----------------|
| `dotnet test` + `reportgenerator` (Cobertura) | `go test -coverprofile` + `gocover-cobertura` | `go-cover` |
| Roslyn Analyzers (`dotnet format analyzers`) | `golangci-lint` | `golangci-lint` |
| `cloc` | `cloc` | `cloc` |
| `jscpd` | `jscpd` | `jscpd` |
| `setup_nuget.sh` (feeds NuGet) | `setup_goprivate.sh` (`GOPRIVATE` + git insteadOf) | — |
| `send_to_sentinel.sh` | `send_to_sentinel.sh` (idéntico) | — |

> Los sensores `go-cover` y `golangci-lint` deben existir en el backend de
> Sentinel. Los pasos de envío usan `continue-on-error`, por lo que un sensor
> no registrado no rompe el pipeline.

## Inputs

| Input | Requerido | Default | Descripción |
|-------|-----------|---------|-------------|
| `github_username` | sí | — | Usuario de GitHub para packages/módulos privados |
| `github_token` | sí | — | Token con permiso de lectura de packages |
| `workdir_src` | no | `src/` | Directorio del módulo Go |
| `workdir_test` | no | `src/` | Directorio de los tests |
| `go_version` | no | `stable` | Versión de Go a instalar |
| `sonar_url` | sí | — | Retenido por compatibilidad — el análisis lo hace Sentinel |
| `sonar_token` | sí | — | Retenido por compatibilidad |
| `sonar_custom` | no | `""` | Retenido por compatibilidad |
| `sonar_tags` | no | `""` | Retenido por compatibilidad |
| `sentinel_url` | no | `https://sentinel-api-gitops-test...` | URL base de la API de Sentinel |
| `sentinel_sensor_id` | no | `1` | ID de sensor (retenido para paridad con cicdv3-net-8) |
| `gitops_url` | no | `https://ui-gitops-test...` | URL base de la UI de GitOps |

## Notas

- **Sentinel es bloqueante.** `Create Sentinel Scan` falla la action si no
  obtiene `scanId` o no puede contactar la API (`--connect-timeout 30`,
  `--max-time 120`). El runner debe poder resolver `sentinel_url` (URL interna
  de Andreani → requiere runner self-hosted en la red). Los envíos individuales
  (`Send X to Sentinel`) mantienen `continue-on-error: true` para tolerar
  errores transitorios de un solo reporte sin romper el run (igual que
  `cicdv3-net-8`).
- **`workdir_src` / `workdir_test`** deben apuntar al directorio del `go.mod`. El
  default es `src/`; si el módulo está en la raíz del repo, el workflow que invoca
  esta action debe pasar `workdir_src: ./` y `workdir_test: ./`.
- `golangci-lint` está fijado en `v2.12.2`. Requiere binario built con Go
  reciente: los v1.x se construyeron con Go ≤1.24 y rechazan repos que apuntan
  a Go 1.26+. Si el repo tiene `.golangci.yml` v1, hay que migrar al schema v2
  (ver [migration guide](https://golangci-lint.run/product/migration-guide/)).
- Los inputs `sonar_*` se conservan para no romper a los workflows que ya
  invocan esta action; el análisis de calidad ahora lo realiza Sentinel.
- Rama de prueba (`-test`) — análoga a `react-cicdv3-test`.
