import io
import json
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.models.scan import Finding, Scan


def export_json(scan: Scan, findings: list[Finding]) -> bytes:
    payload = {
        "scanId": scan.id,
        "status": scan.status,
        "riskLevel": scan.risk_level,
        "riskPercent": scan.risk_percent,
        "generatedAt": datetime.utcnow().isoformat(),
        "findings": [
            {
                "id": finding.id,
                "engine": finding.engine,
                "title": finding.title,
                "vulnType": finding.vuln_type,
                "owasp": finding.owasp_category,
                "cwe": finding.cwe_id,
                "severity": finding.severity,
                "cvss4": finding.cvss4_score,
                "confidence": finding.confidence,
                "file": finding.file_path,
                "line": finding.line_number,
                "codeSnippet": finding.code_snippet,
                "attackScenario": finding.attack_scenario,
                "poc": finding.poc,
                "remediation": finding.remediation,
                "secureExample": finding.secure_example,
            }
            for finding in findings
        ],
    }
    return json.dumps(payload, indent=2).encode("utf-8")


def export_sarif(scan: Scan, findings: list[Finding]) -> bytes:
    sarif = {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {"driver": {"name": "CodeGuard AI", "version": "1.0.0"}},
                "results": [
                    {
                        "ruleId": finding.cwe_id or finding.vuln_type,
                        "level": finding.severity.lower(),
                        "message": {"text": finding.title},
                        "locations": [
                            {
                                "physicalLocation": {
                                    "artifactLocation": {"uri": finding.file_path},
                                    "region": {"startLine": finding.line_number},
                                }
                            }
                        ],
                    }
                    for finding in findings
                ],
            }
        ],
    }
    _ = scan
    return json.dumps(sarif, indent=2).encode("utf-8")


def export_pdf(scan: Scan, findings: list[Finding]) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(40, y, f"CodeGuard AI Scan Report: {scan.id}")
    y -= 24

    pdf.setFont("Helvetica", 11)
    pdf.drawString(40, y, f"Status: {scan.status} | Risk: {scan.risk_level} ({scan.risk_percent:.1f}%)")
    y -= 24

    for finding in findings:
        if y < 100:
            pdf.showPage()
            y = height - 50
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(40, y, f"[{finding.severity}] {finding.title}")
        y -= 14
        pdf.setFont("Helvetica", 10)
        pdf.drawString(40, y, f"{finding.file_path}:{finding.line_number} | CVSS4 {finding.cvss4_score}")
        y -= 20

    pdf.save()
    return buffer.getvalue()
