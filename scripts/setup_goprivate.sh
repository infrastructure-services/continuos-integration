#!/usr/bin/env bash
# Configura el acceso a módulos Go privados alojados en organizaciones de GitHub.
# Análogo a setup_nuget.sh (cicdv3-net-8): en lugar de registrar feeds NuGet,
# declara los prefijos GOPRIVATE y reescribe las URLs HTTPS de GitHub para
# inyectar las credenciales, de modo que `go mod download` pueda resolver los
# repos privados.
#
# Requiere las variables de entorno: GIT_USERNAME, GIT_TOKEN
set -euo pipefail

ORGS=(
  "architecture-it"
  "operations-innovation"
  "customer-experience"
  "warehouse-andreani"
  "witwot-jms"
  "corporate-solutions-gla"
  "eandreani"
)

# Construye la lista GOPRIVATE (prefijos de módulo separados por coma).
# Un prefijo como github.com/architecture-it cubre todos los repos de esa org.
GOPRIVATE_LIST=""
for org in "${ORGS[@]}"; do
  GOPRIVATE_LIST="${GOPRIVATE_LIST:+${GOPRIVATE_LIST},}github.com/${org}"
done

go env -w GOPRIVATE="${GOPRIVATE_LIST}"
echo "ℹ️  GOPRIVATE configurado: ${GOPRIVATE_LIST}"

# Reescribe las URLs HTTPS de GitHub para inyectar las credenciales.
# Persiste en ~/.gitconfig durante la vida del runner (efímero en CI).
git config --global \
  "url.https://${GIT_USERNAME}:${GIT_TOKEN}@github.com/.insteadOf" \
  "https://github.com/"

echo "✅ Acceso a módulos Go privados configurado."
