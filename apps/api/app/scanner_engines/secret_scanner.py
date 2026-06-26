"""
Secret Scanner
==============
Gitleaks-style regex + Shannon entropy filter + opt-in TruffleHog-style verification.

Pipeline:
  1. Walk all non-binary files in source_dir (ThreadPoolExecutor, 8 workers).
  2. For each line, test against PATTERNS dict.
  3. Shannon entropy filter: discard matches with entropy < MIN_ENTROPY (placeholders, test values).
  4. Redact the raw value before creating EngineFinding (never store raw secrets).
  5. Opt-in live verification (SECRET_VERIFY_ENABLED=true):
     - GitHub token: GET /user with Authorization header → 3 s timeout.
     - Slack token: POST /api/auth.test → 3 s timeout.
     - Result stored in verification_status: verified | failed | skipped.
     - Raw token is NEVER logged or persisted.
"""
from __future__ import annotations

import concurrent.futures
import hashlib
import math
import os
import re
from pathlib import Path

from app.services.types import EngineFinding

# ---------------------------------------------------------------------------
# Pattern registry  (Gitleaks-style)
# ---------------------------------------------------------------------------

PATTERNS: dict[str, tuple[str, str, str]] = {
    # name: (regex, cwe, owasp)
    "AWS Access Key": (
        r"AKIA[0-9A-Z]{16}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "AWS Secret Key": (
        r"(?i)aws[_\-\.]?secret[_\-\.]?(?:access[_\-\.]?)?key[^a-zA-Z0-9]{0,4}[A-Za-z0-9/+]{40}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "GitHub Token (Classic)": (
        r"ghp_[A-Za-z0-9]{36}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "GitHub App Token": (
        r"(?:ghs_|gho_|ghu_)[A-Za-z0-9]{36}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "OpenAI API Key": (
        r"sk-[A-Za-z0-9]{20,48}T3BlbkFJ[A-Za-z0-9]{20,48}|sk-proj-[A-Za-z0-9_\-]{80,}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "Slack Bot/User Token": (
        r"xox[baprs]-[0-9A-Za-z\-]{10,72}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "Slack Webhook": (
        r"https://hooks\.slack\.com/services/T[A-Za-z0-9_]{8,}/B[A-Za-z0-9_]{8,}/[A-Za-z0-9_]{24,}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "Stripe Live Key": (
        r"sk_live_[0-9a-zA-Z]{24,}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "Stripe Restricted Key": (
        r"rk_live_[0-9a-zA-Z]{24,}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "Google Cloud API Key": (
        r"AIza[0-9A-Za-z\-_]{35}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "HuggingFace Token": (
        r"hf_[A-Za-z0-9]{34,}",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "JWT Token": (
        r"eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+",
        "CWE-522", "A07:2021-Identification and Authentication Failures",
    ),
    "PEM Private Key": (
        r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----",
        "CWE-321", "A02:2021-Cryptographic Failures",
    ),
    "Database Connection URL": (
        r"(?i)(?:mysql|postgres|postgresql|mongodb|redis|amqp)://[^:\s]+:[^@\s]+@[^\s/\"']+",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
    "Generic High-Entropy Secret": (
        r"(?i)(?:api_?key|secret|password|passwd|token|auth|credential)[^a-zA-Z0-9]{0,4}['\"]?[:=]\s*['\"]?([A-Za-z0-9+/\-_]{20,64})['\"]?",
        "CWE-798", "A07:2021-Identification and Authentication Failures",
    ),
}

# ---------------------------------------------------------------------------
# Shannon Entropy
# ---------------------------------------------------------------------------

MIN_ENTROPY = 3.5  # bits per character — below this = likely placeholder/test value

def _shannon_entropy(value: str) -> float:
    """Calculate Shannon entropy (bits per character) of a string."""
    if not value:
        return 0.0
    freq: dict[str, int] = {}
    for ch in value:
        freq[ch] = freq.get(ch, 0) + 1
    n = len(value)
    return -sum((c / n) * math.log2(c / n) for c in freq.values())


_PLACEHOLDER_RE = re.compile(
    r"(?i)your[_\-]?(?:api[_\-]?)?(?:key|secret|token)|"
    r"change[_\-]?me|placeholder|example|xxx+|test[_\-]?secret|"
    r"<[^>]+>|\[.*?\]|insert[_\-]?here|dummy|sample|fake"
)


def _is_real_secret(value: str) -> bool:
    """Return True if value has sufficient entropy and is not a known placeholder."""
    if _PLACEHOLDER_RE.search(value):
        return False
    return _shannon_entropy(value) >= MIN_ENTROPY


# ---------------------------------------------------------------------------
# Redaction helper
# ---------------------------------------------------------------------------

def _redact(value: str) -> str:
    """Return a masked version of the secret — never the raw value."""
    n = len(value)
    if n <= 8:
        return "***"
    show = max(4, n // 6)
    return value[:show] + "…" + value[-show:]


# ---------------------------------------------------------------------------
# Opt-in live verification (TruffleHog-style)
# ---------------------------------------------------------------------------

def _verify_github_token(token: str) -> str:
    """Return 'verified', 'failed', or 'skipped'."""
    try:
        import urllib.request
        req = urllib.request.Request(
            "https://api.github.com/user",
            headers={"Authorization": f"token {token}", "User-Agent": "CodeGuard-SecretScanner/1.0"},
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            return "verified" if resp.status == 200 else "failed"
    except Exception:
        return "skipped"


def _verify_slack_token(token: str) -> str:
    """Return 'verified', 'failed', or 'skipped'."""
    try:
        import json
        import urllib.request
        data = f"token={token}".encode()
        req = urllib.request.Request(
            "https://slack.com/api/auth.test",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            body = json.loads(resp.read())
            return "verified" if body.get("ok") else "failed"
    except Exception:
        return "skipped"


def _live_verify(secret_type: str, raw_value: str, verify_enabled: bool) -> str:
    """Attempt live verification. Raw value is used transiently and never stored."""
    if not verify_enabled:
        return "unverified"
    if "GitHub" in secret_type:
        return _verify_github_token(raw_value)
    if "Slack" in secret_type and "Webhook" not in secret_type:
        return _verify_slack_token(raw_value)
    return "unverified"


# ---------------------------------------------------------------------------
# Per-file scanner
# ---------------------------------------------------------------------------

def scan_file_for_secrets(
    file_path: str,
    source_dir_str: str,
    verify_enabled: bool = False,
) -> list[EngineFinding]:
    findings: list[EngineFinding] = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as fh:
            lines = fh.read().splitlines()
    except OSError:
        return findings

    rel_path = os.path.relpath(file_path, source_dir_str)

    for line_num, line in enumerate(lines, 1):
        for secret_type, (pattern, cwe, owasp) in PATTERNS.items():
            for match in re.finditer(pattern, line):
                # Use the first capture group if present (Generic pattern), else full match
                raw_value = match.group(1) if match.lastindex else match.group(0)

                if not _is_real_secret(raw_value):
                    continue  # entropy too low or placeholder detected

                redacted = _redact(raw_value)
                verification_status = _live_verify(secret_type, raw_value, verify_enabled)
                
                # Mask the secret in the code snippet to prevent leaking
                safe_snippet = line.replace(raw_value, redacted).strip()[:200]
                
                # raw_value is no longer referenced after this point

                confidence = 0.85
                if verification_status == "verified":
                    confidence = 1.0
                elif verification_status == "failed":
                    confidence = 0.60  # might be an expired/revoked key

                findings.append(
                    EngineFinding(
                        engine="secret-scan",
                        rule_id=f"SECRET_{secret_type.upper().replace(' ', '_').replace('(', '').replace(')', '')}",
                        scan_category="Secret scan",
                        title=f"Hardcoded {secret_type} detected",
                        vuln_type="Hardcoded Secret",
                        severity="Critical",
                        cvss4_score=9.1,
                        confidence=confidence,
                        cwe_id=cwe,
                        owasp_category=owasp,
                        file_path=rel_path,
                        line_number=line_num,
                        line_start=line_num,
                        line_end=line_num,
                        # evidence = redacted only — never raw secret
                        evidence=f"{secret_type}: {redacted}",
                        code_snippet=safe_snippet,
                        why_vulnerable=(
                            f"A hardcoded {secret_type} was detected in source code with high entropy "
                            f"(entropy ≥ {MIN_ENTROPY:.1f} bits/char), indicating a real credential rather than a placeholder."
                        ),
                        attack_scenario=(
                            "An attacker who gains read access to the repository (e.g. public GitHub, "
                            "leaked backup) can immediately use this secret to authenticate as the application."
                        ),
                        impact=(
                            f"Full compromise of the {secret_type} — attacker can impersonate the application, "
                            "access protected resources, and pivot to further attacks."
                        ),
                        poc=(
                            f"Retrieve the token from source control history. "
                            f"Use it directly in API calls to the corresponding service."
                        ),
                        remediation=(
                            "1. Rotate / revoke the exposed credential immediately.\n"
                            "2. Remove it from all branches and git history (use git-filter-repo).\n"
                            "3. Store secrets in environment variables or a secrets manager (Vault, AWS SSM).\n"
                            "4. Add pre-commit hooks (detect-secrets, gitleaks) to prevent re-introduction."
                        ),
                        secure_example="SECRET_KEY = os.environ['MY_SERVICE_KEY']  # loaded from env / secrets manager",
                        pentest_hint=(
                            "Verify in a controlled staging environment only:\n"
                            f"1. Confirm the token matches the expected format for {secret_type}.\n"
                            "2. Check git log / reflog for older commits that may also contain this secret.\n"
                            "3. If verification is enabled, the scanner will attempt an auth check automatically."
                        ),
                        references=(
                            f"https://cwe.mitre.org/data/definitions/{cwe.replace('CWE-', '')}.html\n"
                            "https://owasp.org/www-community/vulnerabilities/Use_of_hard-coded_password\n"
                            "https://github.com/gitleaks/gitleaks"
                        ),
                        verification_status=verification_status,
                    )
                )
    return findings


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_secret_scan(source_dir: Path, verify_enabled: bool = False) -> list[EngineFinding]:
    """
    Scan source_dir for hardcoded secrets.

    Args:
        source_dir: root directory to walk.
        verify_enabled: if True, attempt live verification (opt-in, see SECRET_VERIFY_ENABLED).
    """
    _IGNORE_DIRS = {
        ".git", "node_modules", "venv", ".venv", "dist", "build",
        ".next", "vendor", "__pycache__", ".mypy_cache", ".pytest_cache",
    }
    _IGNORE_EXTS = {
        ".min.js", ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".svg",
        ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
        ".dll", ".exe", ".so", ".dylib", ".pyc", ".class",
        ".pack", ".idx", ".woff", ".woff2", ".ttf", ".eot",
        ".mp3", ".mp4", ".wav", ".avi", ".mov",
        ".bin", ".dat", ".db", ".sqlite",
    }

    source_dir_str = str(source_dir)
    files_to_scan: list[str] = []
    for root, dirs, files in os.walk(source_dir_str):
        dirs[:] = [d for d in dirs if d not in _IGNORE_DIRS]
        for fname in files:
            if any(fname.endswith(ext) for ext in _IGNORE_EXTS):
                continue
            files_to_scan.append(os.path.join(root, fname))

    all_findings: list[EngineFinding] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [
            pool.submit(scan_file_for_secrets, fp, source_dir_str, verify_enabled)
            for fp in files_to_scan
        ]
        for future in concurrent.futures.as_completed(futures):
            try:
                all_findings.extend(future.result())
            except Exception:
                pass

    return all_findings
