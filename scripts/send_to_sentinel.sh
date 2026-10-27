#!/usr/bin/env bash
# Envía un reporte (JSON u otro formato) a la API de Sentinel.
#
# Variables de entorno requeridas:
#   SENTINEL_URL     - URL base de la API (sin trailing slash)
#   SCAN_ID          - ID del scan creado en Sentinel
#   SENSOR_ID        - ID del sensor al que pertenece el reporte
#   REPORT_PATH      - Ruta absoluta al archivo a enviar
#   IS_LAST_REPORT   - "true" si es el último reporte del scan, "false" si no
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

if [ "${HTTP_STATUS}" -ge 200 ] && [ "${HTTP_STATUS}" -lt 300 ]; then
  if [[ "${REPORT_PATH}" == *.sarif ]]; then
    REPORT_ITEM_COUNT=$(jq '[.runs[]?.results[]?] | length' "${REPORT_PATH}")
  elif [[ "${REPORT_PATH}" == *.json ]]; then
    REPORT_ITEM_COUNT=$(jq 'if type == "array" then [.[].FileChanges[]?] | length else 0 end' "${REPORT_PATH}" 2>/dev/null || echo 0)
  else
    REPORT_ITEM_COUNT=0
  fi
  SENTINEL_ITEM_COUNT=$(jq -r '.itemCount // empty' sentinel_response.txt 2>/dev/null)

  if [[ -n "${SENTINEL_ITEM_COUNT}" && "${REPORT_ITEM_COUNT}" -gt 0 && "${SENTINEL_ITEM_COUNT}" -eq 0 ]]; then
    echo "⚠️ Sentinel aceptó el upload, pero registró 0 items aunque el reporte contiene ${REPORT_ITEM_COUNT} findings."
    exit 1
  fi

  echo "Upload OK"
else
  echo "⚠️ WARNING: Sentinel respondió con HTTP ${HTTP_STATUS}. El reporte puede no haberse registrado, pero el workflow continúa."
fi
