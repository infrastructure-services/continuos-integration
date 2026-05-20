#!/usr/bin/env bash
# Configura el acceso a paquetes Python privados alojados en organizaciones de
# GitHub (instalables vía `pip install git+https://github.com/...`).
# Análogo a setup_nuget.sh (cicdv3-net-8) y setup_goprivate.sh (go-cicdv3-test):
# en lugar de registrar feeds NuGet/GOPRIVATE, inyecta las credenciales en las
# URLs HTTPS de GitHub (git rewrite, requiere git) y un .netrc (cubre pip /
# urllib / curl sin necesidad de git).
#
# Requiere las variables de entorno: GIT_USERNAME, GIT_TOKEN
set -euo pipefail

# Algunos runners self-hosted del monorepo no traen git en el PATH (en ese
# caso `actions/checkout` cae al fallback REST API). Intentamos instalarlo si
# falta; si no se puede, salteamos el rewrite pero mantenemos .netrc, que
# cubre la mayoría de los casos para pip.
if ! command -v git &>/dev/null; then
  if command -v apt-get &>/dev/null; then
    echo "ℹ️  git no encontrado, instalando via apt-get..."
    sudo apt-get update -y && sudo apt-get install -y git
  elif command -v yum &>/dev/null; then
    echo "ℹ️  git no encontrado, instalando via yum..."
    sudo yum install -y git
  elif command -v apk &>/dev/null; then
    echo "ℹ️  git no encontrado, instalando via apk..."
    apk add --no-cache git
  fi
fi

if command -v git &>/dev/null; then
  # Reescribe las URLs HTTPS de GitHub para inyectar las credenciales.
  # Persiste en ~/.gitconfig durante la vida del runner (efímero en CI).
  # Cubre dependencias declaradas como `git+https://github.com/<org>/<repo>`
  # en requirements.txt / pyproject.toml.
  git config --global \
    "url.https://${GIT_USERNAME}:${GIT_TOKEN}@github.com/.insteadOf" \
    "https://github.com/"
  echo "✅ git rewrite configurado (pip install git+https://github.com/... usa credenciales)."
else
  echo "⚠️  git no disponible y no se pudo instalar. Salteando rewrite — 'pip install git+https://...' no funcionará para repos privados. Si los necesitás, instalá git en el runner."
fi

# .netrc para herramientas que invocan HTTPS sin pasar por git (por ejemplo
# `pip download` desde un índice privado servido por github.com, o tarballs
# referenciadas en pyproject.toml). chmod 600 es requerido por curl/pip.
cat > "${HOME}/.netrc" <<EOF
machine github.com
  login ${GIT_USERNAME}
  password ${GIT_TOKEN}
EOF
chmod 600 "${HOME}/.netrc"

echo "✅ Acceso a paquetes Python privados configurado (.netrc OK)."
