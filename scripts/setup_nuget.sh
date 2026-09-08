#!/usr/bin/env bash
# Registra las fuentes NuGet privadas de GitHub Packages.
# Requiere las variables de entorno: NUGET_USERNAME, NUGET_PASSWORD
set -euo pipefail

ORGS=(
  "architecture-it"
  "operations-innovation"
  "customer-experience"
  "warehouse-andreani"
  "witwot-jms"
  "corporate-solutions-gla"
)

dotnet nuget locals -c all

# La salida de `dotnet nuget list source` tiene el formato:
#   1.  nombre-source [Enabled]
#       https://...
# El patrón busca el nombre precedido por número+puntos+espacios.
for org in "${ORGS[@]}"; do
  if dotnet nuget list source | grep -qE "[0-9]+\.[[:space:]]+${org}[[:space:]]"; then
    echo "ℹ️  NuGet source '${org}' ya existe. Actualizando credenciales..."
    dotnet nuget update source "$org" \
      -u "${NUGET_USERNAME}" \
      -p "${NUGET_PASSWORD}" \
      --store-password-in-clear-text
  else
    echo "➕ Agregando NuGet source '${org}'..."
    dotnet nuget add source \
      "https://nuget.pkg.github.com/${org}/index.json" \
      --name "$org" \
      -u "${NUGET_USERNAME}" \
      -p "${NUGET_PASSWORD}" \
      --store-password-in-clear-text
  fi
done
