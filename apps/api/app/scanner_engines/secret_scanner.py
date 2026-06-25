"""
Secret Scanner Engine
=====================
Gitleaks-style regex patterns + Shannon entropy filtering + allowlist support.
Opt-in live verification via SECRET_VERIFY_ENABLED=true.

Safety invariants:
  - Raw credentials are NEVER stored in the database or reports.
  - evidence fields hold only masked values (e.g. "sk-****c123").
  - Live verification is disabled by default.
  - Allowlist skips obvious placeholders and localhost values.
"""
from __future__ import annotations

import math
import re
import subprocess
from collections import Counter
from pathlib import Path
from typing import Sequence

from app.core.config import settings
from app.services.types import EngineFinding

# ---------------------------------------------------------------------------
# Shannon entropy
# ---------------------------------------------------------------------------

def _entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = Counter(s)
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


# Minimum entropy threshold to consider a match a real secret (not a placeholder).
# Random base64/hex strings typically score > 3.5 bits.
_MIN_ENTROPY = 3.2

# ---------------------------------------------------------------------------
# Allowlist – skip test placeholders and documentation samples
# ---------------------------------------------------------------------------

_ALLOWLIST_RE = re.compile(
    r"(?i)("
    r"your[_\-]?|example[_\-]?|sample[_\-]?|test[_\-]?|dummy|placeholder|"
    r"changeme|change_me|xxx+|000+|aaa+|bbb+|fill[_\-]?in|insert[_\-]?here|"
    r"todo|fixme|replace|<your|<api|<key|<token|"
    r"localhost|127\.0\.0\.1|0\.0\.0\.0"
    r")"
)

# File extensions to skip entirely
_SKIP_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".lock", ".ico", ".svg",
                    ".woff", ".woff2", ".ttf", ".eot", ".map"}

# ---------------------------------------------------------------------------
# Secret redaction
# ---------------------------------------------------------------------------

def _redact(value: str) -> str:
    """Mask a secret value, keeping only the first 3 and last 3 characters."""
    if len(value) <= 8:
        return "****"
    return value[:3] + "****" + value[-3:]


# ---------------------------------------------------------------------------
# Secret patterns (Gitleaks-style)
# ---------------------------------------------------------------------------

# Each entry: (rule_id, regex_pattern, title, cwe_id, severity, cvss4_score, impact, owasp, references)
_SECRET_RULES: list[tuple] = [
    (
        "secret.aws-access-key",
        r"(?<![A-Z0-9])(AKIA[0-9A-Z]{16})(?![A-Z0-9])",
        "AWS Access Key ID",
        "CWE-798", "Critical", 9.3,
        "Attacker can call AWS APIs with full IAM permissions of the leaked key.",
        "A02:2021-Cryptographic Failures",
        "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html\nhttps://cwe.mitre.org/data/definitions/798.html",
    ),
    (
        "secret.openai-key",
        r"\bsk-[A-Za-z0-9]{20,}\b",
        "OpenAI / OpenAI-compatible Secret Key",
        "CWE-798", "Critical", 9.2,
        "Attacker can consume paid LLM API quota and access conversation history.",
        "A02:2021-Cryptographic Failures",
        "https://platform.openai.com/docs/guides/safety-best-practices\nhttps://cwe.mitre.org/data/definitions/798.html",
    ),
    (
        "secret.groq-key",
        r"\bgsk_[A-Za-z0-9]{20,}\b",
        "Groq API Key",
        "CWE-798", "Critical", 9.2,
        "Attacker can consume Groq LLM API quota under the owner's account.",
        "A02:2021-Cryptographic Failures",
        "https://console.groq.com/docs/openai\nhttps://cwe.mitre.org/data/definitions/798.html",
    ),
    (
        "secret.github-pat",
        r"\bghp_[A-Za-z0-9]{36,}\b",
        "GitHub Personal Access Token",
        "CWE-798", "Critical", 9.2,
        "Attacker can read/write repos and manage GitHub resources.",
        "A02:2021-Cryptographic Failures",
        "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure\nhttps://cwe.mitre.org/data/definitions/798.html",
    ),
    (
        "secret.slack-token",
        r"\bxox[baprs]-[0-9A-Za-z\-]{10,48}\b",
        "Slack Token",
        "CWE-798", "Critical", 9.2,
        "Attacker can read Slack messages and impersonate the user/bot.",
        "A02:2021-Cryptographic Failures",
        "https://api.slack.com/authentication/best-practices\nhttps://cwe.mitre.org/data/definitions/798.html",
    ),
    (
        "secret.stripe-secret-key",
        r"\bsk_live_[0-9a-zA-Z]{24,}\b",
        "Stripe Secret Key",
        "CWE-798", "Critical", 9.2,
        "Attacker can initiate charges, refunds, and access payment data.",
        "A02:2021-Cryptographic Failures",
        "https://stripe.com/docs/keys\nhttps://cwe.mitre.org/data/definitions/798.html",
    ),
    (
        "secret.google-api-key",
        r"\bAIza[0-9A-Za-z\-_]{35}\b",
        "Google API Key",
        "CWE-798", "Critical", 9.3,
        "Attacker can abuse Google services (Maps, Vision, etc.) under the owner's billing.",
        "A02:2021-Cryptographic Failures",
        "https://cloud.google.com/docs/authentication/api-keys\nhttps://cwe.mitre.org/data/definitions/798.html",
    ),
    (
        "secret.private-key",
        r"-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----",
        "Private Key Material",
        "CWE-321", "Critical", 9.8,
        "Attacker can impersonate the key owner, decrypt communications, or forge signatures.",
        "A02:2021-Cryptographic Failures",
        "https://cwe.mitre.org/data/definitions/321.html",
    ),
    (
        "secret.jwt-token-exposed",
        r"\beyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\b",
        "JWT Token Exposed in Source",
        "CWE-522", "High", 8.0,
        "Leaked JWT allows session hijacking without needing credentials.",
        "A02:2021-Cryptographic Failures",
        "https://owasp.org/www-project-web-security-testing-guide/\nhttps://cwe.mitre.org/data/definitions/522.html",
    ),
    (
        "secret.hardcoded-password",
        r"(?i)(?:password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{6,}['\"]",
        "Hardcoded Password",
        "CWE-259", "High", 8.1,
        "Hardcoded credentials enable account compromise and service access.",
        "A02:2021-Cryptographic Failures",
        "https://cwe.mitre.org/data/definitions/259.html",
    ),
    (
        "secret.generic-api-key",
        r"(?i)(?:api[_\-]?key|access[_\-]?key|secret[_\-]?key|auth[_\-]?token)\s*[:=]\s*['\"][A-Za-z0-9_\-\.]{16,}['\"]",
        "Generic Hardcoded API Key / Token",
        "CWE-798", "High", 8.2,
        "Leaked API key can be reused to access the target service.",
        "A02:2021-Cryptographic Failures",
        "https://cwe.mitre.org/data/definitions/798.html",
    ),
    (
        "secret.db-connection-string",
        r"(?i)(?:mongodb|mysql|postgres(?:ql)?|redis|mssql|sqlserver)://[^:\s]+:[^@\s]+@[^\s\"']+",
        "Database Credentials in Connection String",
        "CWE-798", "Critical", 9.0,
        "Leaked DB credentials allow full database access.",
        "A02:2021-Cryptographic Failures",
        "https://cwe.mitre.org/data/definitions/798.html",
    ),
    (
        "secret.bearer-token",
        r"(?i)Authorization\s*:\s*['\"]?Bearer\s+[A-Za-z0-9\-_\.]{20,}",
        "Hardcoded Bearer Token",
        "CWE-798", "Critical", 9.6,
        "Attacker can replay the token to impersonate the user.",
        "A02:2021-Cryptographic Failures",
        "https://cwe.mitre.org/data/definitions/798.html",
    ),
]

# ---------------------------------------------------------------------------
# Opt-in live verification
# ---------------------------------------------------------------------------

_VERIFIERS: dict[str, tuple[str, str, int]] = {
    # rule_id → (method, url_template, expected_status)
    "secret.slack-token": ("GET", "https://slack.com/api/auth.test", 200),
    "secret.github-pat":  ("GET", "https://api.github.com/user", 200),
    "secret.groq-key":    ("GET", "https://api.groq.com/openai/v1/models", 200),
    "secret.openai-key":  ("GET", "https://api.openai.com/v1/models", 200),
    "secret.stripe-secret-key": ("GET", "https://api.stripe.com/v1/balance", 200),
}


def _verify_secret(rule_id: str, raw_value: str) -> str:
    """Return verification_status string. Raw value is used only for the request header."""
    if not settings.secret_verify_enabled:
        return "skipped"
    verifier = _VERIFIERS.get(rule_id)
    if verifier is None:
        return "skipped"
    method, url, expected_status = verifier
    try:
        import httpx
        headers: dict[str, str] = {}
        if "slack" in rule_id:
            headers = {"Authorization": f"Bearer {raw_value}"}
        elif "github" in rule_id:
            headers = {"Authorization": f"token {raw_value}",
                       "User-Agent": "CodeGuard-SecretVerifier/1.0"}
        elif rule_id in ("secret.groq-key", "secret.openai-key"):
            headers = {"Authorization": f"Bearer {raw_value}"}
        elif "stripe" in rule_id:
            headers = {"Authorization": f"Bearer {raw_value}"}
        resp = httpx.request(method, url, headers=headers, timeout=1.5, follow_redirects=False)
        return "verified" if resp.status_code == expected_status else "failed"
    except Exception:
        return "failed"

# ---------------------------------------------------------------------------
# Sensitive file & backup patterns
# ---------------------------------------------------------------------------

_SENSITIVE_FILE_NAMES = {".env", ".env.production", ".env.local", "config.json",
                          "secrets.yml", "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"}
_BACKUP_EXTENSIONS = {".sql", ".bak", ".dump", ".backup"}
_HIDDEN_META = {".ds_store", ".idea", ".vscode"}

# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_secret_scan(source_dir: Path) -> list[EngineFinding]:
    findings: list[EngineFinding] = []

    for path in source_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() in _SKIP_EXTENSIONS:
            continue

        rel = str(path.relative_to(source_dir))
        name_lower = path.name.lower()

        # ── Sensitive file names ──────────────────────────────────────────────
        if name_lower in _SENSITIVE_FILE_NAMES:
            findings.append(EngineFinding(
                engine="secret-scan",
                title="Sensitive configuration file committed to source",
                vuln_type="Sensitive Data Exposure",
                severity="High", cvss4_score=8.2, confidence=0.85,
                cwe_id="CWE-200", owasp_category="A02:2021-Cryptographic Failures",
                file_path=rel, line_number=1, code_snippet=path.name,
                evidence=path.name,
                impact="Leaked config files may expose credentials, signing keys, or infrastructure details.",
                attack_scenario="Attacker downloads committed sensitive configuration file to extract credentials.",
                poc="Download the exposed file from the repository.",
                remediation="Remove the file from VCS, rotate exposed secrets, and use a secret manager.",
                secure_example="Use .env.example with placeholder values; add real .env to .gitignore.",
                pentest_hint="Verify: git log --follow -- <file> to check history. Confirm with git show <commit>:<file>.",
                references="https://owasp.org/www-community/vulnerabilities/Sensitive_Data_Exposure\nhttps://cwe.mitre.org/data/definitions/200.html",
                rule_id="secret.sensitive-config-file", scan_category="Secret scan",
                source="repository file", sink=path.name,
                verification_status="unverified",
            ))

        # ── Backup / dump files ───────────────────────────────────────────────
        if path.suffix.lower() in _BACKUP_EXTENSIONS or name_lower.endswith(".sql.gz"):
            findings.append(EngineFinding(
                engine="secret-scan",
                title="Backup or dump file found in source",
                vuln_type="Sensitive Data Exposure",
                severity="High", cvss4_score=8.7, confidence=0.82,
                cwe_id="CWE-200", owasp_category="A02:2021-Cryptographic Failures",
                file_path=rel, line_number=1, code_snippet=path.name,
                evidence=path.name,
                impact="Backup files may contain full database records, credentials, and PII.",
                attack_scenario="Attacker downloads backup/dump to recover records offline.",
                poc="Download file and inspect with sqlite3/psql or a hex editor.",
                remediation="Remove backup artifacts from the repository and encrypt backups in dedicated storage.",
                secure_example="Store encrypted backups in a private S3 bucket with lifecycle policies.",
                pentest_hint="Confirm file is accessible via direct download. Check for .gitignore coverage.",
                references="https://cwe.mitre.org/data/definitions/200.html",
                rule_id="secret.backup-or-dump-file", scan_category="Secret scan",
                source="repository file", sink=path.name,
                verification_status="unverified",
            ))

        # ── Regex + entropy scanning ──────────────────────────────────────────
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue

        for rule_id, pattern, title, cwe, severity, cvss, impact, owasp, refs in _SECRET_RULES:
            for match in re.finditer(pattern, content):
                raw_value = match.group(0)

                # Skip allow-listed placeholders
                if _ALLOWLIST_RE.search(raw_value):
                    continue

                # Entropy gate for patterns that capture variable-length strings
                # (skip gate for fixed-format patterns like PEM headers)
                if "-----BEGIN" not in raw_value:
                    # Extract the credential portion (after = or : if present)
                    cred_part = re.split(r"[:=\s]+", raw_value.strip())[-1].strip("'\"")
                    if _entropy(cred_part) < _MIN_ENTROPY:
                        continue

                line_no = content[: match.start()].count("\n") + 1
                redacted_evidence = _redact(raw_value)

                verification_status = _verify_secret(rule_id, raw_value)
                confidence = 0.91
                if verification_status == "verified":
                    confidence = min(confidence + 0.06, 0.97)
                elif verification_status == "failed":
                    confidence = max(confidence - 0.15, 0.55)

                findings.append(EngineFinding(
                    engine="secret-scan",
                    title=title,
                    vuln_type="Hardcoded Secret",
                    severity=severity, cvss4_score=cvss, confidence=confidence,
                    cwe_id=cwe, owasp_category=owasp,
                    file_path=rel, line_number=line_no,
                    code_snippet=f"[redacted – see evidence field]",
                    evidence=redacted_evidence,
                    impact=impact,
                    attack_scenario="Leaked secret can be reused by an attacker to access infrastructure or data.",
                    poc="Use the extracted credential against the exposed service (authorised testing only).",
                    remediation="Rotate the secret immediately and load it from a secret manager at runtime.",
                    secure_example="api_key = os.environ['API_KEY']  # never hardcode",
                    pentest_hint=(
                        "1. Confirm the secret is reachable (git history, public repo mirror).\n"
                        "2. In an authorised staging environment, attempt authentication with the key.\n"
                        "3. Document the access level granted and report findings immediately."
                    ),
                    references=refs,
                    rule_id=rule_id, scan_category="Secret scan",
                    source="repository content", sink=title,
                    verification_status=verification_status,
                    why_vulnerable=f"{title}: pattern matched with entropy {_entropy(raw_value):.2f} bits.",
                ))

    # ── Git history scan ──────────────────────────────────────────────────────
    git_dir = source_dir / ".git"
    if git_dir.exists() and git_dir.is_dir():
        try:
            history = subprocess.run(
                ["git", "-C", str(source_dir), "log", "-p", "-n", "30", "--no-color"],
                capture_output=True, text=True, check=False, timeout=20,
            )
            blob = (history.stdout or "") + "\n" + (history.stderr or "")
            history_patterns = [
                (r"AKIA[0-9A-Z]{16}", "secret.aws-access-key"),
                (r"AIza[0-9A-Za-z\-_]{35}", "secret.google-api-key"),
                (r"sk_live_[0-9a-zA-Z]{24}", "secret.stripe-secret-key"),
                (r"ghp_[0-9A-Za-z]{36}", "secret.github-pat"),
                (r"gsk_[A-Za-z0-9]{20,}", "secret.groq-key"),
            ]
            found_in_history = any(
                re.search(pat, blob) for pat, _ in history_patterns
                if not _ALLOWLIST_RE.search(pat)
            )
            if found_in_history:
                findings.append(EngineFinding(
                    engine="secret-scan",
                    title="Potential secret found in git commit history",
                    vuln_type="Secret in Git History",
                    severity="Critical", cvss4_score=9.5, confidence=0.83,
                    cwe_id="CWE-798", owasp_category="A02:2021-Cryptographic Failures",
                    file_path=".git/history", line_number=1,
                    code_snippet="[redacted – pattern matched in git log output]",
                    evidence="[redacted – pattern matched in commit history]",
                    impact="Secrets removed from current code remain recoverable from commit history.",
                    attack_scenario="Attacker extracts old secret from git log and replays it against the service.",
                    poc="git log -p | grep -E '<pattern>' (authorised testing only)",
                    remediation="Rotate all affected credentials. Rewrite history using git-filter-repo or BFG Repo Cleaner.",
                    secure_example="Pre-commit hooks + immediate key rotation on confirmed leak.",
                    pentest_hint=(
                        "Use 'git log -p --all' on a local clone to search commit diffs.\n"
                        "Cross-reference with known secret patterns. Do NOT expose findings publicly."
                    ),
                    references="https://trufflesecurity.com/trufflehog\nhttps://cwe.mitre.org/data/definitions/798.html",
                    rule_id="secret.git-history-secret", scan_category="Secret scan",
                    source="git commit history", sink="secret material",
                    verification_status="unverified",
                ))
        except Exception:
            pass

    return findings
