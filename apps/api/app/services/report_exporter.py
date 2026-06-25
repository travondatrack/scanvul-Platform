"""
Report Exporter
===============
Exports scan findings in JSON, SARIF 2.1.0, and PDF formats.

SARIF 2.1.0 notes:
  - rules registry under runs[0].tool.driver.rules.
  - results map ruleId → location (startLine, endLine) + fingerprint.
  - level mapping: Critical/High → "error", Medium → "warning", Low/Info → "note".
  - Secrets in evidence are already redacted before reaching this layer.
"""
from __future__ import annotations

import io
import json
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.models.scan import Finding, Scan

# SARIF severity level mapping
_SARIF_LEVEL = {"Critical": "error", "High": "error", "Medium": "warning",
                 "Low": "note", "Info": "note"}


# ---------------------------------------------------------------------------
# JSON export
# ---------------------------------------------------------------------------

def export_json(scan: Scan, findings: list[Finding]) -> bytes:
    payload = {
        "scanId": scan.id,
        "status": scan.status,
        "riskLevel": scan.risk_level,
        "riskPercent": scan.risk_percent,
        "generatedAt": datetime.utcnow().isoformat(),
        "findings": [
            {
                "id": f.id,
                "engine": f.engine,
                "ruleId": f.rule_id,
                "scanCategory": f.scan_category,
                "title": f.title,
                "vulnType": f.vuln_type,
                "owasp": f.owasp_category,
                "cwe": f.cwe_id,
                "severity": f.severity,
                "cvss4": f.cvss4_score,
                "confidence": f.confidence,
                "verificationStatus": f.verification_status,
                "dedupeHash": f.dedupe_hash,
                # Location
                "file": f.file_path,
                "lineStart": f.line_start or f.line_number,
                "lineEnd": f.line_end or f.line_number,
                # Dataflow
                "source": f.source,
                "sink": f.sink,
                "functionName": f.function_name,
                "dataflowTrace": json.loads(f.dataflow_trace) if f.dataflow_trace else [],
                # Evidence & explanation (evidence is already redacted)
                "evidence": f.evidence,
                "codeSnippet": f.code_snippet,
                "impact": f.impact,
                "whyVulnerable": f.why_vulnerable,
                "attackScenario": f.attack_scenario,
                "poc": f.poc,
                "remediation": f.remediation,
                "secureExample": f.secure_example,
                "pentestHint": f.pentest_hint,
                "references": f.references,
            }
            for f in findings
        ],
    }
    return json.dumps(payload, indent=2).encode("utf-8")


# ---------------------------------------------------------------------------
# SARIF 2.1.0 export
# ---------------------------------------------------------------------------

def _build_rules_registry(findings: list[Finding]) -> list[dict]:
    """Build the rules registry ensuring unique rule IDs."""
    seen: dict[str, dict] = {}
    for f in findings:
        rule_id = f.rule_id or f.cwe_id or f.vuln_type
        if rule_id in seen:
            continue

        help_uri = ""
        if f.references:
            help_uri = f.references.split("\n")[0].strip()
        elif f.cwe_id:
            cwe_num = f.cwe_id.replace("CWE-", "")
            help_uri = f"https://cwe.mitre.org/data/definitions/{cwe_num}.html"

        seen[rule_id] = {
            "id": rule_id,
            "name": "".join(w.title() for w in (f.title or rule_id).split()[:6]),
            "shortDescription": {"text": f.title or rule_id},
            "fullDescription": {
                "text": f.why_vulnerable or f.attack_scenario or f.title or ""
            },
            "helpUri": help_uri,
            "help": {
                "text": (
                    f"Remediation: {f.remediation}\n\n"
                    f"Pentest hint: {f.pentest_hint or 'N/A'}\n\n"
                    f"References: {f.references or help_uri}"
                )
            },
            "properties": {
                "tags": ["security"],
                "cwe": f.cwe_id,
                "owasp": f.owasp_category,
                "scanCategory": f.scan_category,
                "severity": f.severity,
                "cvss4": f.cvss4_score,
                "impact": f.impact,
                "pentestHint": f.pentest_hint,
            },
        }
    return list(seen.values())


def export_sarif(scan: Scan, findings: list[Finding]) -> bytes:
    rules = _build_rules_registry(findings)
    rule_index: dict[str, int] = {r["id"]: i for i, r in enumerate(rules)}

    results = []
    for f in findings:
        rule_id = f.rule_id or f.cwe_id or f.vuln_type
        line_start = f.line_start or f.line_number or 1
        line_end = max(f.line_end or line_start, line_start)

        result: dict = {
            "ruleId": rule_id,
            "ruleIndex": rule_index.get(rule_id, 0),
            "level": _SARIF_LEVEL.get(f.severity, "warning"),
            "message": {
                "text": (
                    f"{f.title}. "
                    f"Source: {f.source or 'unknown'} → Sink: {f.sink or 'unknown'}. "
                    f"Confidence: {f.confidence:.2f}. "
                    f"VerificationStatus: {f.verification_status}."
                )
            },
            "locations": [
                {
                    "physicalLocation": {
                        "artifactLocation": {"uri": f.file_path, "uriBaseId": "%SRCROOT%"},
                        "region": {
                            "startLine": line_start,
                            "endLine": line_end,
                            **({"snippet": {"text": f.evidence}} if f.evidence else {}),
                        },
                    }
                }
            ],
            "fingerprints": {"dedupeHash/v1": f.dedupe_hash},
            "properties": {
                "engine": f.engine,
                "scanCategory": f.scan_category,
                "confidence": f.confidence,
                "verificationStatus": f.verification_status,
                "cwe": f.cwe_id,
                "owasp": f.owasp_category,
                "cvss4": f.cvss4_score,
                "impact": f.impact,
                "remediation": f.remediation,
                "pentestHint": f.pentest_hint,
            },
        }

        # Include dataflow trace as related locations if present
        if f.dataflow_trace:
            try:
                trace = json.loads(f.dataflow_trace)
                if isinstance(trace, list) and trace:
                    result["relatedLocations"] = [
                        {
                            "id": idx,
                            "message": {"text": str(step.get("message", f"Step {idx}"))},
                            "physicalLocation": {
                                "artifactLocation": {
                                    "uri": step.get("path", f.file_path),
                                    "uriBaseId": "%SRCROOT%",
                                },
                                "region": {"startLine": int(step.get("line", line_start))},
                            },
                        }
                        for idx, step in enumerate(trace)
                    ]
            except (json.JSONDecodeError, TypeError):
                pass

        results.append(result)

    sarif = {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "CodeGuard AI",
                        "version": "1.0.0",
                        "informationUri": "https://github.com/your-org/codeguard-ai",
                        "rules": rules,
                    }
                },
                "results": results,
                "artifacts": [
                    {"location": {"uri": f.file_path, "uriBaseId": "%SRCROOT%"}}
                    for f in findings
                ],
                "properties": {
                    "scanId": scan.id,
                    "riskLevel": scan.risk_level,
                    "riskPercent": scan.risk_percent,
                    "generatedAt": datetime.utcnow().isoformat(),
                },
            }
        ],
    }

    output = json.dumps(sarif, indent=2).encode("utf-8")

    # Inline SARIF schema validation (best-effort, non-blocking)
    try:
        import jsonschema  # type: ignore
        import urllib.request
        schema_url = "https://json.schemastore.org/sarif-2.1.0.json"
        with urllib.request.urlopen(schema_url, timeout=3) as resp:
            schema = json.loads(resp.read())
        jsonschema.validate(instance=sarif, schema=schema)
    except Exception:
        pass  # Validation is best-effort; export proceeds regardless

    return output


# ---------------------------------------------------------------------------
# PDF export
# ---------------------------------------------------------------------------

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
    pdf.drawString(40, y, f"Generated: {datetime.utcnow().isoformat()}")
    y -= 30

    for finding in findings:
        if y < 120:
            pdf.showPage()
            y = height - 50

        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(40, y, f"[{finding.severity}] {finding.rule_id or finding.engine}: {finding.title[:80]}")
        y -= 14

        pdf.setFont("Helvetica", 9)
        pdf.drawString(
            40, y,
            f"{finding.file_path}:L{finding.line_start or finding.line_number}"
            f" | {finding.scan_category} | {finding.engine}"
            f" | Confidence: {finding.confidence:.0%} | {finding.verification_status}"
        )
        y -= 12
        pdf.drawString(40, y, f"Source: {finding.source or 'unknown'}  →  Sink: {finding.sink or 'unknown'}")
        y -= 12
        if finding.impact:
            impact_text = finding.impact[:100]
            pdf.drawString(40, y, f"Impact: {impact_text}")
            y -= 12
        if finding.pentest_hint:
            hint = finding.pentest_hint.split("\n")[0][:100]
            pdf.drawString(40, y, f"Pentest: {hint}")
            y -= 12
        y -= 8

    pdf.save()
    return buffer.getvalue()
