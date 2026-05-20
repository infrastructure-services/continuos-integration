#!/usr/bin/env bash
# Configura el acceso a paquetes Python privados alojados en organizaciones de
# GitHub (instalables vía `pip install git+https://github.com/...`).
# Análogo a setup_nuget.sh (cicdv3-net-8) y setup_goprivate.sh (go-cicdv3-test):
# en lugar de registrar feeds NuGet/GOPRIVATE, inyecta las credenciales en las
# URLs HTTPS de GitHub (git rewrite) y opcionalmente expone un .netrc para que
# pip/urllib resuelvan github.com sin prompt interactivo.
#
# Requiere las variables de entorno: GIT_USERNAME, GIT_TOKEN
set -euo pipefail

# Reescribe las URLs HTTPS de GitHub para inyectar las credenciales.
# Persiste en ~/.gitconfig durante la vida del runner (efímero en CI).
# Cubre dependencias declaradas como `git+https://github.com/<org>/<repo>` en
# requirements.txt / pyproject.toml.
git config --global \
  "url.https://${GIT_USERNAME}:${GIT_TOKEN}@github.com/.insteadOf" \
  "https://github.com/"

# .netrc para herramientas que invocan HTTPS sin pasar por git (por ejemplo
# `pip download` desde un índice privado servido por github.com, o tarballs
# referenciadas en pyproject.toml). chmod 600 es requerido por curl/pip.
cat > "${HOME}/.netrc" <<EOF
machine github.com
  login ${GIT_USERNAME}
  password ${GIT_TOKEN}
EOF
chmod 600 "${HOME}/.netrc"

echo "✅ Acceso a paquetes Python privados configurado (git rewrite + .netrc)."
