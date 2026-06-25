from __future__ import annotations

from pathlib import Path

from app.services.types import EngineFinding


def run_ai_contextual_analysis(source_dir: Path) -> list[EngineFinding]:
    findings: list[EngineFinding] = []

    for path in source_dir.rglob("*"):
        if path.suffix.lower() not in {".py", ".js", ".ts", ".jsx", ".tsx"}:
            continue
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        lowered = content.lower()

        if "findbyid(" in lowered and "owner" not in lowered and "user_id" not in lowered:
            line = lowered.index("findbyid(")
            findings.append(
                EngineFinding(
                    engine="ai",
                    title="Potential IDOR due to unscoped object lookup",
                    vuln_type="Broken Access Control",
                    severity="High",
                    cvss4_score=8.4,
                    confidence=0.74,
                    cwe_id="CWE-639",
                    owasp_category="A01:2021-Broken Access Control",
                    file_path=str(path.relative_to(source_dir)),
                    line_number=content[:line].count("\n") + 1,
                    code_snippet="findById(...)",
                    attack_scenario="User can enumerate identifiers to access data outside their authorization scope.",
                    poc="GET /resource/{incrementing-id}",
                    remediation="Enforce tenant/user ownership checks in repository query.",
                    secure_example="findByIdAndOwner(resourceId, currentUser.id)",
                    rule_id="ai.idor-unscoped-object-lookup",
                    scan_category="SAST source code",
                    source="request-controlled identifier",
                    sink="object lookup",
                    function_name="findById",
                    why_vulnerable="Object lookup does not show owner or tenant scoping near the access path.",
                )
            )

        if "thread" in lowered and "lock" not in lowered and "race" in lowered:
            line = lowered.index("thread")
            findings.append(
                EngineFinding(
                    engine="ai",
                    title="Potential race condition in concurrent logic",
                    vuln_type="Race Condition",
                    severity="Medium",
                    cvss4_score=6.3,
                    confidence=0.62,
                    cwe_id="CWE-362",
                    owasp_category="A04:2021-Insecure Design",
                    file_path=str(path.relative_to(source_dir)),
                    line_number=content[:line].count("\n") + 1,
                    code_snippet="thread/...",
                    attack_scenario="Concurrent requests can bypass intended ordering and corrupt security-sensitive state.",
                    poc="Send two simultaneous requests to update the same resource.",
                    remediation="Use transactional boundaries and locking primitives.",
                    secure_example="Use mutex/transaction with row-level locking.",
                    rule_id="ai.concurrent-race-condition",
                    scan_category="SAST source code",
                    source="concurrent request or thread",
                    sink="shared mutable state",
                    why_vulnerable="Concurrent logic references thread/race behavior without visible locking.",
                )
            )

    return findings
