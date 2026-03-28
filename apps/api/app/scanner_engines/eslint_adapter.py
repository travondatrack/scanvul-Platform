from __future__ import annotations

from pathlib import Path

from app.scanner_engines.utils import command_exists, parse_json_output, run_command
from app.services.types import EngineFinding


def _regex_js_security_fallback(source_dir: Path) -> list[EngineFinding]:
    findings: list[EngineFinding] = []
    patterns = [
        ("dangerouslySetInnerHTML", "XSS (DOM)", "High", "CWE-79"),
        ("eval(", "Code Injection", "High", "CWE-95"),
        ("new Function(", "Code Injection", "High", "CWE-95"),
    ]

    for path in source_dir.rglob("*"):
        if path.suffix.lower() not in {".js", ".jsx", ".ts", ".tsx"}:
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for needle, vuln_type, severity, cwe in patterns:
            if needle in content:
                line_number = content[: content.index(needle)].count("\n") + 1
                findings.append(
                    EngineFinding(
                        engine="eslint-security",
                        title=f"Potential {vuln_type} due to {needle}",
                        vuln_type=vuln_type,
                        severity=severity,
                        cvss4_score=8.0,
                        confidence=0.72,
                        cwe_id=cwe,
                        owasp_category="A03:2021-Injection",
                        file_path=str(path.relative_to(source_dir)),
                        line_number=line_number,
                        code_snippet=needle,
                        attack_scenario="Attacker-controlled data may reach unsafe browser or runtime sink.",
                        poc="Inject crafted payload into the rendered or executed input path.",
                        remediation="Avoid dynamic execution and sanitize all untrusted data.",
                        secure_example="Use safe APIs and strict output encoding.",
                    )
                )
    return findings


def run_eslint_security(source_dir: Path) -> list[EngineFinding]:
    if not command_exists("eslint"):
        return _regex_js_security_fallback(source_dir)

    code, stdout, _stderr = run_command(
        ["eslint", str(source_dir), "-f", "json"],
        cwd=source_dir,
        timeout=1200,
    )
    if code not in {0, 1}:
        return _regex_js_security_fallback(source_dir)

    data = parse_json_output(stdout)
    findings: list[EngineFinding] = []
    for file_result in data if isinstance(data, list) else []:
        for msg in file_result.get("messages", []):
            severity = "High" if msg.get("severity", 1) == 2 else "Medium"
            findings.append(
                EngineFinding(
                    engine="eslint-security",
                    title=msg.get("message", "ESLint security finding"),
                    vuln_type=(msg.get("ruleId") or "JS/TS Security Issue"),
                    severity=severity,
                    cvss4_score=7.1 if severity == "High" else 5.2,
                    confidence=0.8,
                    cwe_id="",
                    owasp_category="A03:2021-Injection",
                    file_path=file_result.get("filePath", ""),
                    line_number=int(msg.get("line", 1)),
                    code_snippet="",
                    attack_scenario="Unsafe JavaScript behavior may be attacker-controlled.",
                    poc="Trigger the code path using untrusted input.",
                    remediation="Refactor unsafe sinks and add input/output controls.",
                    secure_example="Use safe rendering and strict validation.",
                )
            )
    return findings
