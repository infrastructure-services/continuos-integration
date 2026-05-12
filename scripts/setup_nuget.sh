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

for org in "${ORGS[@]}"; do
  dotnet nuget add source \
    "https://nuget.pkg.github.com/${org}/index.json" \
    --name "$org" \
    -u "${NUGET_USERNAME}" \
    -p "${NUGET_PASSWORD}" \
    --store-password-in-clear-text
done
