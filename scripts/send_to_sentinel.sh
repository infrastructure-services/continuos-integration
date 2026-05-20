#!/usr/bin/env bash
# Envía un reporte (JSON u otro formato) a la API de Sentinel.
#
# Variables de entorno requeridas:
#   SENTINEL_URL     - URL base de la API (sin trailing slash)
#   SCAN_ID          - ID del scan creado en Sentinel
#   SENSOR_ID        - ID del sensor al que pertenece el reporte
#   REPORT_PATH      - Ruta absoluta al archivo a enviar
#   IS_LAST_REPORT   - "true" si es el último reporte del scan, "false" si no
#
# Comportamiento del exit code:
#   - Sends intermedios (IS_LAST_REPORT=false): siempre exit 0 (best-effort —
#     un blip transitorio en un sensor no debe frenar el resto del pipeline).
#   - Send final (IS_LAST_REPORT=true): exit 1 si HTTP no es 2xx. Sin éxito
#     en este send, Sentinel no cierra el scan y queda PENDING permanente
#     en la DB. Mejor que el job termine rojo y se vea claro que algo falló,
#     antes que dejar scans huérfanos silenciosamente.
set -uo pipefail

echo "Enviando reporte a Sentinel: ${REPORT_PATH}"

HTTP_STATUS=$(curl -s -X POST \
  "${SENTINEL_URL}/api/v1/scans/${SCAN_ID}/sensors/${SENSOR_ID}/report" \
  -H "Content-Type: multipart/form-data" \
  -F "report=@${REPORT_PATH}" \
  -F "isLastReport=${IS_LAST_REPORT}" \
  --connect-timeout 30 \
  --max-time 300 \
  -w "%{http_code}" \
  -o sentinel_response.txt)

echo "HTTP Status: ${HTTP_STATUS}"
echo "Response body:"
cat sentinel_response.txt
echo

# Si curl falló completamente (DNS, timeout), HTTP_STATUS puede quedar vacío
# o ser un código no numérico. Normalizar a 0 para que las comparaciones
# numéricas funcionen.
if ! [[ "${HTTP_STATUS}" =~ ^[0-9]+$ ]]; then
  HTTP_STATUS=0
fi

if [ "${HTTP_STATUS}" -ge 200 ] && [ "${HTTP_STATUS}" -lt 300 ]; then
  echo "✅ Upload OK"
  exit 0
fi

echo "⚠️ WARNING: Sentinel respondió con HTTP ${HTTP_STATUS}. El reporte puede no haberse registrado."

if [ "${IS_LAST_REPORT:-false}" = "true" ]; then
  echo "❌ ERROR: este es el ÚLTIMO reporte (IS_LAST_REPORT=true) y falló. Sentinel no cerrará el scan, que quedará PENDING permanente en la DB. Fallando el job para que el problema sea visible."
  exit 1
fi

echo "El workflow continúa porque no es el último reporte (best-effort para sends intermedios)."
exit 0
