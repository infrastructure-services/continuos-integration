"""
Convierte los reportes JSON de `dotnet format analyzers` a un único XML
compatible con la API de Sentinel.

Variables de entorno requeridas:
  REPORT_DIR  - directorio con los archivos .json generados por dotnet format
  XML_OUTPUT  - ruta de salida del archivo XML
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

report_dir = Path(os.environ["REPORT_DIR"])
xml_path = os.environ["XML_OUTPUT"]

root = ET.Element(
    "RoslynAnalysisReport",
    {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "tool": "dotnet-format",
        "severity": "warn",
    },
)

if report_dir.exists():
    for json_file in sorted(report_dir.glob("*.json")):
        with json_file.open("r", encoding="utf-8") as f:
            entries = json.load(f)
        for entry in entries if isinstance(entries, list) else []:
            for change in entry.get("FileChanges", []):
                issue = ET.SubElement(root, "Issue")
                ET.SubElement(issue, "RuleId").text = change.get("DiagnosticId", "")
                ET.SubElement(issue, "Level").text = change.get("DiagnosticSeverity", "warn")
                ET.SubElement(issue, "Message").text = change.get("FormatDescription", "")
                ET.SubElement(issue, "File").text = entry.get("FilePath", "")
                ET.SubElement(issue, "Line").text = str(change.get("LineNumber", ""))
                ET.SubElement(issue, "Column").text = str(change.get("CharNumber", ""))

ET.ElementTree(root).write(xml_path, encoding="utf-8", xml_declaration=True)
print(f"Reporte generado: {xml_path}")
