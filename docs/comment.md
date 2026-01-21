# Documentación de `src/comment.ts`

## Propósito
- Publicar o actualizar un comentario de validación en un Pull Request, indicando:
  - Si el PR disparará una nueva versión (`major`/`minor`/`patch`).
  - Si cumple la integración con JIRA (título, branch y commits con claves).
  - Recomendaciones de merge (Squash vs Merge) según las validaciones.

## Funciones principales
- **`commentWithValidation(pr_name, branch_name, octokit, actor?, commentBody?)`**: Orquesta la obtención de commits, valida JIRA y convención de commits, arma el comentario y lo crea/actualiza.
- **`determineReleaseType(commitMessage)`**: Dado un mensaje de commit, retorna `major` | `minor` | `patch` o `null`.

## Parámetros
- **`pr_name`**: Título del Pull Request.
- **`branch_name`**: Nombre del branch (puede venir como `refs/heads/<branch>`; el módulo lo normaliza).
- **`octokit`**: Cliente GitHub (Octokit) con plugins REST/paginate; se usa `github.context` para `owner/repo/issue.number`.
- **`actor`** (opcional): Usuario que publicará el comentario. Default: `CybersecurityGLA`.
- **`commentBody`** (opcional): Marcador para localizar comentarios previos. Default: `<!-- issue-validator -->`.

## Lógica de validación
1. Recupera los commits del PR: `octokit.rest.pulls.listCommits({ owner, repo, pull_number })`.
2. Extrae mensajes de commit y los formatea para mostrarlos.
3. Patrones usados:
   - Claves de JIRA: `/\b[A-Z0-9]+-\d+\b/g`.
   - Convención de commits (para CI/CD): `/^(feat|fix|perf|ref|styles|BREAKING CHANGE).*\:\s.*$/i`.
4. Determina si el título o algún commit disparan versionado.
5. Calcula el tipo de versión más alto entre los commits con `determineReleaseType`:
   - `major`: contiene `BREAKING CHANGE` o `breaking: true`.
   - `minor`: inicia con `feat`/`FEAT`.
   - `patch`: inicia con `fix`/`FIX` o coincide con `BUGFIX`, `SECURITY`, ciertos emojis, `ref`, `styles`, `perf`.
6. Valida integración JIRA:
   - Título del PR válido: `^(feat|fix)\([A-Z0-9-]+\)\:\s.*$`.
   - Branch o commits contienen claves de JIRA.
   - Combina resultados para recomendar `Squash and merge` o `Merge pull request`.
7. Construye el comentario (en español) con secciones:
   - Resumen de validación de CI/CD.
   - Validación de convención de commits.
   - Validación de integración con JIRA.
   - Detalles (título, branch, listado de mensajes).
   - Instrucciones y documentación.
8. Crea o actualiza el comentario:
   - Busca un comentario previo del `actor` que contenga el marcador.
   - Si existe, lo actualiza; si no, crea uno nuevo.

## Ejemplo de uso (dentro de una Action)
```ts
import * as github from '@actions/github'
import { commentWithValidation } from './src/comment'

export async function run() {
  const token = process.env.GITHUB_TOKEN!
  const octokit = github.getOctokit(token) as any

  const pr = github.context.payload.pull_request
  if (!pr) throw new Error('Este flujo requiere evento pull_request')

  await commentWithValidation(
    pr.title,
    github.context.ref,
    octokit,
    // opcional: actor y marcador
    'CybersecurityGLA',
    '<!-- issue-validator -->'
  )
}
```

## Consideraciones
- Requiere `github.context.issue.number` para comentar; el evento debe ser `pull_request`.
- El `actor` debe corresponder al usuario/bot que publica comentarios (cuenta de la Action).
- El comentario se genera en español y usa formato `es-AR` para fecha/hora.
- El regex de emojis está presente y contribuye al tipo `patch` vía `determineReleaseType`.

## Extensión y personalización
- Se puede ajustar el regex de convención de commits o de JIRA según políticas locales.
- El texto del comentario puede personalizarse (secciones, enlaces, idioma).
- Para añadir más señales de versionado, extienda `determineReleaseType`.
