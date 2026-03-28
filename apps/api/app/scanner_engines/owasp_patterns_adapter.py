from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from app.services.types import EngineFinding


@dataclass
class PatternRule:
    regex: str
    title: str
    vuln_type: str
    severity: str
    cvss4_score: float
    cwe_id: str
    owasp_category: str
    attack_scenario: str
    poc: str
    remediation: str
    secure_example: str
    confidence: float = 0.78


RULES: list[PatternRule] = [
    PatternRule(
        regex=r"(?i)(allowanonymous|permitall|skip[_-]?auth|auth[_-]?disabled\s*=\s*true)",
        title="Authentication or authorization bypass flag detected",
        vuln_type="Broken Access Control",
        severity="High",
        cvss4_score=8.6,
        cwe_id="CWE-284",
        owasp_category="A01:2021-Broken Access Control",
        attack_scenario="Unauthorized users may access restricted endpoints or resources.",
        poc="Call protected endpoint without valid token.",
        remediation="Enforce centralized authorization checks and remove bypass flags.",
        secure_example="if not current_user.has_permission('resource:read'): raise HTTPException(403)",
    ),
    PatternRule(
        regex=r"(?i)(md5\(|sha1\(|des\.|rc4|sslv3|tlsv1)",
        title="Weak cryptographic primitive usage",
        vuln_type="Cryptographic Failures",
        severity="High",
        cvss4_score=8.1,
        cwe_id="CWE-327",
        owasp_category="A02:2021-Cryptographic Failures",
        attack_scenario="Attackers can break weak crypto to recover sensitive data.",
        poc="Offline crack weak hash or downgrade weak cipher usage.",
        remediation="Use modern algorithms (AES-GCM, SHA-256+, Argon2/bcrypt for passwords).",
        secure_example="hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())",
    ),
    PatternRule(
        regex=r"(?i)(select\s+.+\+|execute\(f[\"']|subprocess\..*shell\s*=\s*true|os\.system\(|Runtime\.getRuntime\(\)\.exec)",
        title="Potential injection sink with untrusted input",
        vuln_type="Injection",
        severity="Critical",
        cvss4_score=9.1,
        cwe_id="CWE-89",
        owasp_category="A03:2021-Injection",
        attack_scenario="Untrusted input may reach SQL/OS command sinks and enable remote compromise.",
        poc="Inject payload such as ' OR 1=1 -- or command separators.",
        remediation="Use parameterized queries and avoid shell command concatenation.",
        secure_example="cursor.execute('SELECT * FROM users WHERE id = %s', (user_id,))",
        confidence=0.84,
    ),
    PatternRule(
        regex=r"(?i)(TODO\s*:\s*security|FIXME\s*:\s*auth|trust client side)",
        title="Insecure design marker in code",
        vuln_type="Insecure Design",
        severity="Medium",
        cvss4_score=6.2,
        cwe_id="CWE-657",
        owasp_category="A04:2021-Insecure Design",
        attack_scenario="Security controls omitted by design can create systemic exploit paths.",
        poc="Abuse workflow step that has no server-side security enforcement.",
        remediation="Add threat modeling and mandatory security checks at design phase.",
        secure_example="Design endpoint with least-privilege and deny-by-default authorization.",
        confidence=0.62,
    ),
    PatternRule(
        regex=r"(?i)(debug\s*=\s*true|cors\s*[:=].*\*|origins?\s*=\s*\[?['\"]\*['\"]|default[_-]?password)",
        title="Security misconfiguration pattern",
        vuln_type="Security Misconfiguration",
        severity="High",
        cvss4_score=7.7,
        cwe_id="CWE-16",
        owasp_category="A05:2021-Security Misconfiguration",
        attack_scenario="Weak default and permissive configuration broadens attack surface.",
        poc="Access debug endpoint or perform cross-origin unauthorized requests.",
        remediation="Disable debug mode and tighten CORS/default credentials.",
        secure_example="DEBUG=False and allow_origins=['https://trusted.example']",
    ),
    PatternRule(
        regex=r"(?i)(jwt[_-]?secret\s*[:=]\s*['\"].+['\"]|session[_-]?id\s*=\s*request\.args|mfa[_-]?enabled\s*=\s*false)",
        title="Weak authentication/session handling",
        vuln_type="Identification and Authentication Failures",
        severity="High",
        cvss4_score=8.4,
        cwe_id="CWE-287",
        owasp_category="A07:2021-Identification and Authentication Failures",
        attack_scenario="Attackers can forge tokens or hijack sessions due to weak auth setup.",
        poc="Replay or forge session/JWT based on leaked static secret.",
        remediation="Use rotated secrets, secure session flags, and enforce MFA.",
        secure_example="JWT secret from vault + secure HttpOnly/SameSite session cookies.",
    ),
    PatternRule(
        regex=r"(?i)(curl\s+.+\|\s*(bash|sh)|pip\s+install\s+--trusted-host|npm\s+install\s+--force)",
        title="Software/data integrity anti-pattern",
        vuln_type="Software and Data Integrity Failures",
        severity="High",
        cvss4_score=8.0,
        cwe_id="CWE-494",
        owasp_category="A08:2021-Software and Data Integrity Failures",
        attack_scenario="Unverified update/script source can introduce supply chain compromise.",
        poc="Tamper remote script/package and execute in pipeline/runtime.",
        remediation="Verify signatures/checksums and pin trusted artifact sources.",
        secure_example="Download signed artifact and verify checksum before execution.",
    ),
    PatternRule(
        regex=r"(?i)(except\s+Exception\s*:\s*pass|catch\s*\(.*\)\s*\{\s*\}|logger\.disabled\s*=\s*true)",
        title="Insufficient security logging/monitoring",
        vuln_type="Security Logging and Monitoring Failures",
        severity="Medium",
        cvss4_score=6.0,
        cwe_id="CWE-778",
        owasp_category="A09:2021-Security Logging and Monitoring Failures",
        attack_scenario="Security-relevant events may be suppressed, delaying incident detection.",
        poc="Trigger repeated auth failures without any audit trail.",
        remediation="Log security events with context and monitor alerting pipelines.",
        secure_example="logger.warning('auth_failed', extra={'user': user_id, 'ip': client_ip})",
        confidence=0.7,
    ),
    PatternRule(
        regex=r"(?i)(requests\.(get|post|put|patch)\(\s*(url|target_url|user_url|request\.|input)|axios\.(get|post)\(\s*(url|target_url|user_url)|fetch\(\s*(url|target_url|user_url))",
        title="Potential SSRF sink with attacker-controlled URL",
        vuln_type="Server-Side Request Forgery (SSRF)",
        severity="High",
        cvss4_score=8.5,
        cwe_id="CWE-918",
        owasp_category="A10:2021-Server-Side Request Forgery",
        attack_scenario="Attacker may force server to request internal metadata/services and exfiltrate secrets.",
        poc="Pass URL like http://169.254.169.254/latest/meta-data/ as input.",
        remediation="Apply URL allowlist, block internal ranges, and enforce egress policy.",
        secure_example="validate_url_against_allowlist(user_url); requests.get(validated_url, timeout=3)",
    ),
]


def _is_text_code_file(path: Path) -> bool:
    return path.suffix.lower() in {
        ".py",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".java",
        ".cs",
        ".go",
        ".rb",
        ".php",
        ".yml",
        ".yaml",
        ".json",
        ".env",
        ".ini",
        ".conf",
        ".properties",
    }


def run_owasp_patterns_scan(source_dir: Path) -> list[EngineFinding]:
    findings: list[EngineFinding] = []

    for path in source_dir.rglob("*"):
        if not path.is_file() or not _is_text_code_file(path):
            continue

        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        for rule in RULES:
            for match in re.finditer(rule.regex, content):
                findings.append(
                    EngineFinding(
                        engine="owasp-patterns",
                        title=rule.title,
                        vuln_type=rule.vuln_type,
                        severity=rule.severity,
                        cvss4_score=rule.cvss4_score,
                        confidence=rule.confidence,
                        cwe_id=rule.cwe_id,
                        owasp_category=rule.owasp_category,
                        file_path=str(path.relative_to(source_dir)),
                        line_number=content[: match.start()].count("\n") + 1,
                        code_snippet=match.group(0),
                        attack_scenario=rule.attack_scenario,
                        poc=rule.poc,
                        remediation=rule.remediation,
                        secure_example=rule.secure_example,
                    )
                )

    return findings
