# continuos-integration

## Exclusión de artefactos del reporte de cobertura

Las carpetas `bin` y `obj` se excluyen siempre del reporte Cobertura, sin
importar su ubicación dentro del repositorio.

## Exclusión de usings del análisis de duplicación

El análisis de jscpd excluye las líneas `using` y `global using` mediante
`--ignore-pattern`, sin modificar los umbrales, las exclusiones de archivos ni
la generación y el envío del reporte existentes.

El patrón `(?:^|\n)\s*(global\s+)?using\s+[^;]+;\s*(?=$|\n)` reconoce los
límites de línea sin usar `(?m)`, que no es compatible con las expresiones
regulares JavaScript utilizadas por jscpd 4.2.1.