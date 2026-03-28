from __future__ import annotations

from pathlib import Path

from app.scanner_engines.utils import command_exists, parse_json_output, run_command
from app.services.types import EngineFinding


def run_bandit(source_dir: Path) -> list[EngineFinding]:
    if not command_exists("bandit"):
        return []

    code, stdout, _stderr = run_command(
        ["bandit", "-r", str(source_dir), "-f", "json"],
        cwd=source_dir,
        timeout=1200,
    )
    if code not in {0, 1}:
        return []

    data = parse_json_output(stdout)
    findings: list[EngineFinding] = []
    for item in data.get("results", []):
        level = str(item.get("issue_severity", "MEDIUM")).capitalize()
        severity = {"High": "High", "Medium": "Medium", "Low": "Low"}.get(level, "Medium")

        findings.append(
            EngineFinding(
                engine="bandit",
                title=item.get("issue_text", "Bandit finding"),
                vuln_type=item.get("test_name", "Python Security Issue"),
                severity=severity,
                cvss4_score=7.4 if severity == "High" else 5.4 if severity == "Medium" else 3.1,
                confidence=0.9,
                cwe_id="",
                owasp_category="A05:2021-Security Misconfiguration",
                file_path=item.get("filename", ""),
                line_number=int(item.get("line_number", 1)),
                code_snippet=item.get("code", "").strip(),
                attack_scenario="Unsafe Python behavior may be exploited depending on reachable execution path.",
                poc="Trigger vulnerable function with attacker-controlled input.",
                remediation="Refactor to secure API and add strict validation.",
                secure_example="Replace unsafe function with secure equivalent.",
            )
        )
    return findings
