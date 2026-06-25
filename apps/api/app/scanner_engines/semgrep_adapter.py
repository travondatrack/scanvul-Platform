from __future__ import annotations

import json
from pathlib import Path

from app.scanner_engines.utils import command_exists, parse_json_output, run_command
from app.services.types import EngineFinding

# Path to our custom taint-mode rule set
_RULES_DIR = Path(__file__).parent.parent / "rules" / "semgrep"


def run_semgrep(source_dir: Path) -> list[EngineFinding]:
    if not command_exists("semgrep"):
        return []

    cmd = ["semgrep", "--json"]

    # Include custom taint-mode rules if the directory exists
    if _RULES_DIR.exists() and any(_RULES_DIR.glob("*.yaml")):
        cmd += ["--config", str(_RULES_DIR)]

    # Also include Semgrep's standard auto ruleset
    cmd += ["--config", "auto", str(source_dir)]

    code, stdout, _stderr = run_command(cmd, cwd=source_dir, timeout=1200)
    if code not in {0, 1}:
        return []

    data = parse_json_output(stdout)
    findings: list[EngineFinding] = []

    for item in data.get("results", []):
        extra = item.get("extra", {})
        metadata = extra.get("metadata", {})

        raw_severity = str(extra.get("severity", "MEDIUM")).capitalize()
        severity = {"Error": "High", "Warning": "Medium", "Info": "Low"}.get(raw_severity, raw_severity)
        severity = severity if severity in {"Critical", "High", "Medium", "Low"} else "Medium"

        # ── Location ──────────────────────────────────────────────────────────
        start = item.get("start", {})
        end = item.get("end", {})
        line_start = int(start.get("line", 1))
        line_end = int(end.get("line", line_start))

        # ── Dataflow trace (taint mode provides source→intermediate→sink) ─────
        dataflow_trace = ""
        if "dataflow_trace" in extra:
            try:
                dataflow_trace = json.dumps(extra["dataflow_trace"])
            except (TypeError, ValueError):
                dataflow_trace = str(extra["dataflow_trace"])

        # ── Metadata fields ───────────────────────────────────────────────────
        cwe_raw = metadata.get("cwe", "")
        cwe_id = (cwe_raw[0] if isinstance(cwe_raw, list) else cwe_raw) or ""
        owasp_raw = metadata.get("owasp", "")
        owasp_cat = (owasp_raw[0] if isinstance(owasp_raw, list) else owasp_raw) or ""

        impact = str(metadata.get("impact", "")).strip()
        pentest_hint = str(metadata.get("pentest_hint", "")).strip()
        references_raw = metadata.get("references", [])
        if isinstance(references_raw, list):
            references = "\n".join(references_raw)
        else:
            references = str(references_raw)

        # ── Confidence from metadata ──────────────────────────────────────────
        conf_map = {"HIGH": 0.90, "MEDIUM": 0.75, "LOW": 0.55}
        confidence = conf_map.get(str(metadata.get("confidence", "")).upper(), 0.80)

        findings.append(
            EngineFinding(
                engine="semgrep",
                title=extra.get("message", "Semgrep finding"),
                vuln_type=str(metadata.get("vulnerability_class", "Security Misconfiguration")),
                severity=severity,
                cvss4_score=7.5 if severity in {"High", "Critical"} else 5.0,
                confidence=confidence,
                cwe_id=cwe_id,
                owasp_category=owasp_cat,
                file_path=item.get("path", ""),
                line_number=line_start,
                line_start=line_start,
                line_end=line_end,
                code_snippet=str(extra.get("lines", "")).strip(),
                evidence=str(extra.get("lines", "")).strip()[:200],  # first 200 chars of match
                impact=impact or "Untrusted input path reaches a sensitive operation.",
                attack_scenario="Untrusted input path reaches sensitive operation and may be exploitable.",
                poc="Use a crafted payload to reach the affected code path.",
                remediation="Validate input, constrain sinks, and use safe APIs.",
                secure_example="Use allowlist validation and parameterized interfaces.",
                pentest_hint=pentest_hint or "Trace user-controlled input to the reported sink. Verify in a staging environment.",
                references=references,
                rule_id=item.get("check_id", ""),
                dataflow_trace=dataflow_trace,
                scan_category="SAST source code",
            )
        )
    return findings
