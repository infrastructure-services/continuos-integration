# Documentación de `src/utils.ts`

## Propósito
- Extraer claves de Jira desde una lista de mensajes (título y commits).

## `extractIssueKeys(messages: string[]): Set<string>`
- Regex: `/\b[A-Z][A-Z0-9]*-\d+\b/g`.
- Recorre cada mensaje y agrega todas las coincidencias a un `Set` para evitar duplicados.
- Retorna el conjunto de claves encontradas.

## Ejemplos
- Mensaje: `feat(ABC-123): agregar endpoint` -> Claves: `ABC-123`.
- Mensaje: `fix: corregir bug XYZ-7 y ABC-123` -> Claves: `XYZ-7`, `ABC-123`.
- Sin coincidencias -> `Set` vacío.

## Consideraciones
- El patrón es genérico: letras mayúsculas para el proyecto + número (`PROJ-42`).
- No valida existencia en Jira; solo extracción. La validación real ocurre en `main.ts` vía API.
