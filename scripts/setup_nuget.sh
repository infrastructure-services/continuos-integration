#!/usr/bin/env bash
# Registra los feeds privados de NuGet de Andreani (GitHub Packages) para esta compilación.
#
# Entorno requerido:
#   NUGET_USERNAME  Usuario de GitHub con permisos read:packages
#   NUGET_PASSWORD  PAT con permisos read:packages
#
# Por qué esto reconstruye la configuración en lugar de parchearla:
#
#   `dotnet nuget list source` resuelve la jerarquía de configuración desde el directorio
#   actual, mientras que `dotnet nuget add source` sin --configfile escribe en la
#   configuración a nivel de usuario. Leer de un ámbito (scope) y escribir en otro es lo
#   que hizo que la versión anterior fallara: un repositorio que incluye su propio nuget.config
#   puede declarar uno de estos feeds bajo una clave diferente, por lo que la búsqueda por 
#   nombre no lo encuentra y el comando `add` de todas formas rechaza la URL como duplicada.
#
#   `add` tampoco es idempotente, y los runners autohospedados reutilizan $HOME entre
#   trabajos (jobs), por lo que un script incremental hereda orígenes y credenciales obsoletos
#   de lo último que se haya compilado allí. Reconstruir desde una base fija en cada
#   ejecución elimina ambos modos de fallo sin necesidad de detectar el estado.

set -euo pipefail

ORGS=(
  architecture-it
  operations-innovation
  customer-experience
  warehouse-andreani
  witwot-jms
  corporate-solutions-gla
)

FEED_HOST="nuget.pkg.github.com"
NUGET_CONFIG_PATH="${NUGET_CONFIG_PATH:-${HOME}/.nuget/NuGet/NuGet.Config}"

: "${NUGET_USERNAME:?NUGET_USERNAME is required}"
: "${NUGET_PASSWORD:?NUGET_PASSWORD is required}"

# 1. Rebuild the user-level config from a known baseline.

mkdir -p "$(dirname "$NUGET_CONFIG_PATH")"
cat > "$NUGET_CONFIG_PATH" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <add key="nuget.org" value="https://api.nuget.org/v3/index.json" />
  </packageSources>
</configuration>
XML

dotnet nuget locals -c all >/dev/null

# 2. Register every feed against that one file.
#    --configfile scopes both the duplicate check and the write to this file,
#    so a repository-level nuget.config can no longer collide with it.

unregistered=()
for org in "${ORGS[@]}"; do
  echo "➕ Registering NuGet source '${org}'"
  if ! dotnet nuget add source "https://${FEED_HOST}/${org}/index.json" \
      --name "$org" \
      --username "$NUGET_USERNAME" \
      --password "$NUGET_PASSWORD" \
      --store-password-in-clear-text \
      --configfile "$NUGET_CONFIG_PATH"; then
    unregistered+=("$org")
  fi
done

if [[ ${#unregistered[@]} -gt 0 ]]; then
  echo "::error::Could not register NuGet sources: ${unregistered[*]}"
  exit 1
fi

# 3. Hacer cumplir la convención de nombres de la que dependen las credenciales.
#
#    NuGet asocia las entradas <packageSourceCredentials> por el NOMBRE del origen, y un
#    <clear /> en el nuget.config de un repositorio elimina los nombres registrados arriba.
#    Un repositorio que declara uno de estos feeds bajo una clave diferente lo está
#    restaurando de forma anónima y fallará con un HTTP 401 mucho más adelante en la
#    compilación, sin que nada apunte a la causa real. Es mejor fallar aquí e indicar
#    exactamente qué cambiar.
#
#    Esto se ejecuta deliberadamente SIN --configfile: queremos la vista resuelta que
#    el comando restore realmente verá, incluyendo el nuget.config del repositorio.

violations=0
while read -r name url; do
  [[ "$url" == "https://${FEED_HOST}/"*"/index.json" ]] || continue
  org="${url#https://${FEED_HOST}/}"
  org="${org%/index.json}"
  [[ "$name" == "$org" ]] && continue
  echo "::error file=nuget.config::This repository declares ${url} under the source name '${name}'."
  echo "::error::NuGet matches credentials by source name, so this feed restores anonymously and fails with HTTP 401."
  echo "::error::Rename that key to '${org}' in nuget.config, including its packageSourceMapping entry."
  violations=1
done < <(dotnet nuget list source | awk '
  /^[[:space:]]*[0-9]+\.[[:space:]]+/ { name = $2; next }
  /^[[:space:]]*https?:\/\// && name != "" { print name, $1; name = "" }
')

exit "$violations"
