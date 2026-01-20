# Documentación de `src/jira.ts`

## Propósito
- Proveer clientes autenticados de Jira (API V2 y V3) para consultas.

## `makeClient(host, jiraEmail, jiraApiToken, logger?)`
- Retorna:
  - `client2`: `Version2Client` (Jira V2).
  - `client3`: `Version3Client` (Jira V3).
- Autenticación:
  - Basic Auth con `email` y `apiToken`.
- Middlewares (solo V3):
  - `onError(error)`: Loggea el error con el `logger` provisto.
  - `onResponse(response)`: Loggea respuestas para debugging si se provee `logger`.

## Uso típico
- `client3.issueSearch.countIssues({ jql: "issue in (ABC-123, XYZ-7)" })` para contar issues válidas.
- En caso de error, se recomienda capturar y publicar `commit status` `failure`.

## Consideraciones
- El `host` debe ser el de la organización (ej: `https://andreani.atlassian.net`).
- El `logger` es opcional; si se pasa `core.debug`, se obtendrá trazabilidad en logs.
