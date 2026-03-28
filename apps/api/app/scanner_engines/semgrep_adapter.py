from __future__ import annotations

from pathlib import Path

from app.scanner_engines.utils import command_exists, parse_json_output, run_command
from app.services.types import EngineFinding


def run_semgrep(source_dir: Path) -> list[EngineFinding]:
    if not command_exists("semgrep"):
        return []

    code, stdout, _stderr = run_command(
        ["semgrep", "--json", "--config", "auto", str(source_dir)],
        cwd=source_dir,
        timeout=1200,
    )
    if code not in {0, 1}:
        return []

    data = parse_json_output(stdout)
    findings: list[EngineFinding] = []
    for item in data.get("results", []):
        extra = item.get("extra", {})
        metadata = extra.get("metadata", {})
        raw_severity = str(extra.get("severity", "MEDIUM")).capitalize()
        severity = {"Error": "High", "Warning": "Medium", "Info": "Low"}.get(raw_severity, raw_severity)

        findings.append(
            EngineFinding(
                engine="semgrep",
                title=extra.get("message", "Semgrep finding"),
                vuln_type=metadata.get("vulnerability_class", "Security Misconfiguration"),
                severity=severity if severity in {"Critical", "High", "Medium", "Low"} else "Medium",
                cvss4_score=7.5 if severity in {"High", "Critical"} else 5.0,
                confidence=0.88,
                cwe_id=str(metadata.get("cwe", "")),
                owasp_category=str(metadata.get("owasp", "")),
                file_path=item.get("path", ""),
                line_number=int(item.get("start", {}).get("line", 1)),
                code_snippet=str(extra.get("lines", "")).strip(),
                attack_scenario="Untrusted input path reaches sensitive operation and may be exploitable.",
                poc="Use crafted payload to reach affected code path.",
                remediation="Validate input, constrain sinks, and use safe APIs.",
                secure_example="Use allowlist validation and parameterized interfaces.",
            )
        )
    return findings
