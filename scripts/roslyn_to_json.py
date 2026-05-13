"""
Consolida los reportes JSON de `dotnet format analyzers` en un único archivo
JSON listo para enviar a la API de Sentinel.

Variables de entorno requeridas:
  REPORT_DIR   - directorio con los archivos .json generados por dotnet format
  JSON_OUTPUT  - ruta de salida del archivo JSON consolidado
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

report_dir = Path(os.environ["REPORT_DIR"])
json_path = os.environ["JSON_OUTPUT"]

issues = []

if report_dir.exists():
    for json_file in sorted(report_dir.glob("*.json")):
        with json_file.open("r", encoding="utf-8") as f:
            entries = json.load(f)
        for entry in (entries if isinstance(entries, list) else []):
            for change in entry.get("FileChanges", []):
                issues.append({
                    "ruleId":    change.get("DiagnosticId", ""),
                    "level":     change.get("DiagnosticSeverity", "warn"),
                    "message":   change.get("FormatDescription", ""),
                    "file":      entry.get("FilePath", ""),
                    "line":      change.get("LineNumber"),
                    "column":    change.get("CharNumber"),
                })

report = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "tool": "dotnet-format",
    "severity": "warn",
    "issues": issues,
    "totalIssues": len(issues),
}

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"Reporte JSON generado: {json_path} ({len(issues)} issue(s))")
