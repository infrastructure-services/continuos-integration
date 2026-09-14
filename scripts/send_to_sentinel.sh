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

if [ ! -f "${REPORT_PATH}" ]; then
  echo "ERROR: el archivo de reporte no existe: ${REPORT_PATH} (el step anterior no lo generó)."
  exit 1
fi

# "|| CURL_EXIT=$?" captura el código de salida real de curl sin cortar el script.
CURL_EXIT=0
HTTP_STATUS=$(curl -s -X POST \
  "${SENTINEL_URL}/api/v1/scans/${SCAN_ID}/sensors/${SENSOR_ID}/report" \
  -H "Content-Type: multipart/form-data" \
  -F "report=@${REPORT_PATH}" \
  -F "isLastReport=${IS_LAST_REPORT}" \
  --connect-timeout 30 \
  --max-time 300 \
  -w "%{http_code}" \
  -o sentinel_response.txt) || CURL_EXIT=$?

if [ "$CURL_EXIT" -ne 0 ]; then
  case "$CURL_EXIT" in
    6)  REASON="No se pudo resolver el host (DNS). Revisá que 'sentinel_url' ($SENTINEL_URL) sea correcto y accesible desde el runner." ;;
    7)  REASON="No se pudo conectar al host (¿servicio caído o bloqueado por firewall/VPN?)." ;;
    28) REASON="Timeout: el servidor no respondió a tiempo." ;;
    35) REASON="Error de conexión SSL/TLS." ;;
    52) REASON="El servidor cerró la conexión sin devolver respuesta." ;;
    56) REASON="Fallo al recibir datos del servidor." ;;
    60) REASON="Problema con el certificado SSL del servidor." ;;
    *)  REASON="Error de red no clasificado (ver https://curl.se/libcurl/c/libcurl-errors.html)." ;;
  esac
  echo "ERROR: curl falló con código ${CURL_EXIT} al llamar a Sentinel."
  echo "Motivo: ${REASON}"
  exit 1
fi

echo "HTTP Status: ${HTTP_STATUS}"
echo "Response body:"
cat sentinel_response.txt

if [ "${HTTP_STATUS}" -ge 200 ] && [ "${HTTP_STATUS}" -lt 300 ]; then
  echo "Upload OK"
else
  echo "ERROR: Sentinel respondió con HTTP ${HTTP_STATUS}. El reporte no se registró."
  exit 1
fi
