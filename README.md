# continuos-integration

## Exclusión de artefactos del reporte de cobertura

Las carpetas `bin` y `obj` se excluyen siempre del reporte Cobertura, sin
importar su ubicación dentro del repositorio.

## Compatibilidad con Central Package Management

La inyección de NetAnalyzers y SonarAnalyzer respeta
`ManagePackageVersionsCentrally`: con administración centralizada, las versiones
se definen en elementos `PackageVersion` y las referencias no llevan `Version`.
Sin administración centralizada, las versiones se mantienen en `PackageReference`.

Los inputs `netanalyzers_version` y `sonaranalyzer_version` determinan las versiones
en ambos modos. Las entradas existentes de esos analyzers se reemplazan en el
archivo de inyección para evitar duplicados, sin modificar
`Directory.Packages.props`. Si `enable_sonar` es `false`, no se modifica la
referencia de Sonar que pudiera tener el repositorio.

## Exclusión de usings del análisis de duplicación

El análisis de jscpd excluye las líneas `using` y `global using` mediante
`--ignore-pattern`, sin modificar los umbrales, las exclusiones de archivos ni
la generación y el envío del reporte existentes.

El patrón `(?:^|\n)\s*(global\s+)?using\s+[^;]+;\s*(?=$|\n)` reconoce los
límites de línea sin usar `(?m)`, que no es compatible con las expresiones
regulares JavaScript utilizadas por jscpd 4.2.1.