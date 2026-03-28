from collections import Counter
from pathlib import Path
import re
import subprocess

from app.scanner_engines.ai_adapter import run_ai_contextual_analysis
from app.scanner_engines.bandit_adapter import run_bandit
from app.scanner_engines.eslint_adapter import run_eslint_security
from app.scanner_engines.owasp_patterns_adapter import run_owasp_patterns_scan
from app.scanner_engines.semgrep_adapter import run_semgrep
from app.scanner_engines.trivy_adapter import run_trivy_dependencies
from app.services.types import EngineFinding


def calculate_risk(findings: list[EngineFinding]) -> tuple[str, float]:
    if not findings:
        return "Low", 5.0

    weights = {"Critical": 25, "High": 15, "Medium": 8, "Low": 3}
    total = sum(weights.get(item.severity, 1) for item in findings)
    capped = min(float(total), 100.0)

    if capped >= 85:
        return "Critical", capped
    if capped >= 70:
        return "High", capped
    if capped >= 40:
        return "Medium", capped
    return "Low", capped


def detect_language_framework(source_dir: Path) -> tuple[dict, dict]:
    language_counter = Counter()
    framework_counter = Counter()

    ext_map = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
        ".cs": "dotnet",
        ".go": "go",
        ".rb": "ruby",
        ".php": "php",
    }

    for path in source_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in ext_map:
            language_counter[ext_map[path.suffix.lower()]] += 1

    if (source_dir / "package.json").exists():
        package_json = (source_dir / "package.json").read_text(encoding="utf-8", errors="ignore").lower()
        if "next" in package_json:
            framework_counter["next.js"] += 1
        if "express" in package_json:
            framework_counter["express"] += 1
        if "nestjs" in package_json:
            framework_counter["nestjs"] += 1
    if (source_dir / "requirements.txt").exists() or (source_dir / "pyproject.toml").exists():
        req_blob = ""
        for req_file in [source_dir / "requirements.txt", source_dir / "pyproject.toml"]:
            if req_file.exists():
                req_blob += req_file.read_text(encoding="utf-8", errors="ignore").lower()
        if "fastapi" in req_blob:
            framework_counter["fastapi"] += 1
        if "django" in req_blob:
            framework_counter["django"] += 1
        if "flask" in req_blob:
            framework_counter["flask"] += 1

    if not language_counter:
        language_counter["unknown"] = 1
    if not framework_counter:
        framework_counter["unknown"] = 1

    return dict(language_counter), dict(framework_counter)


def _scan_secrets_and_configs(source_dir: Path) -> list[EngineFinding]:
    findings: list[EngineFinding] = []
    secret_patterns = [
        (
            r"(?i)(api[_-]?key|access[_-]?key|secret[_-]?key|token|api[_-]?token)\s*[:=]\s*['\"][a-z0-9_\-\.]{16,}['\"]",
            "Hardcoded API Token/Key",
            "CWE-798",
            "Critical",
            9.4,
        ),
        (
            r"(?i)(authorization\s*[:=]\s*['\"]bearer\s+[a-z0-9_\-\.]{16,}['\"])",
            "Hardcoded Bearer Token",
            "CWE-798",
            "Critical",
            9.6,
        ),
        (
            r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{6,}['\"]",
            "Hardcoded Password",
            "CWE-259",
            "High",
            8.1,
        ),
        (r"AKIA[0-9A-Z]{16}", "Potential AWS Access Key", "CWE-798", "Critical", 9.3),
        (r"\bsk-[A-Za-z0-9]{20,}\b", "Potential OpenAI-style Secret Key", "CWE-798", "Critical", 9.2),
        (r"\bghp_[A-Za-z0-9]{30,}\b", "Potential GitHub Personal Access Token", "CWE-798", "Critical", 9.2),
        (
            r"(?i)https?://[^\s\"']+\?(?:[^\s\"']*&)?token=[A-Za-z0-9_\-]{16,}",
            "Sensitive Token Embedded in URL",
            "CWE-598",
            "High",
            8.3,
        ),
        (
            r"AIza[0-9A-Za-z\-_]{35}",
            "Potential Google API Key",
            "CWE-798",
            "Critical",
            9.3,
        ),
        (
            r"sk_live_[0-9a-zA-Z]{24}",
            "Potential Stripe Secret Key",
            "CWE-798",
            "Critical",
            9.2,
        ),
        (
            r"pk_live_[0-9a-zA-Z]{24}",
            "Potential Stripe Public Key Exposed in Source",
            "CWE-200",
            "Medium",
            5.9,
        ),
        (
            r"xox[baprs]-[0-9a-zA-Z\-]{10,48}",
            "Potential Slack Token",
            "CWE-798",
            "Critical",
            9.2,
        ),
        (
            r"(?i)(mongodb|mysql|postgres|postgresql):\/\/[^:\s]+:[^@\s]+@",
            "Database Credentials Embedded in Connection String",
            "CWE-798",
            "Critical",
            9.0,
        ),
        (
            r"(?i)jdbc:(mysql|postgresql|sqlserver):\/\/[^\"\s;]+",
            "JDBC Database Endpoint Hardcoded in Source",
            "CWE-200",
            "High",
            8.0,
        ),
        (
            r"(?i)private\s+static\s+final\s+String\s+(HOSTNAME|DB_HOST|DATABASE_HOST)\s*=\s*\"[^\"]+\"",
            "Hardcoded Database Host Constant",
            "CWE-798",
            "High",
            8.1,
        ),
        (
            r"(?i)private\s+static\s+final\s+String\s+(USER|DB_USER|USERNAME)\s*=\s*\"[^\"]+\"",
            "Hardcoded Database Username",
            "CWE-798",
            "High",
            8.0,
        ),
        (
            r"(?i)private\s+static\s+final\s+String\s+(PASSWORD|DB_PASSWORD|PASSWD)\s*=\s*\"[^\"]{6,}\"",
            "Hardcoded Database Password Constant",
            "CWE-259",
            "Critical",
            9.5,
        ),
        (
            r"(?i)private\s+static\s+final\s+String\s+PORT\s*=\s*\"\d{2,5}\"",
            "Hardcoded Database Port Constant",
            "CWE-200",
            "Medium",
            5.8,
        ),
        (
            r"-----BEGIN (RSA|DSA|EC)?\s*PRIVATE KEY-----",
            "Private Key Material Exposed",
            "CWE-321",
            "Critical",
            9.8,
        ),
        (
            r"eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+",
            "JWT Token Exposed in Source/Logs",
            "CWE-522",
            "High",
            8.0,
        ),
        (
            r"(?i)(jwt[_-]?secret|app[_-]?key|encryption[_-]?key)\s*[:=]\s*['\"][A-Za-z0-9\-_]{8,}['\"]",
            "JWT/Encryption Secret Hardcoded",
            "CWE-321",
            "Critical",
            9.1,
        ),
        (
            r"(?i)https?:\/\/(api|dev|staging|internal)\.[a-zA-Z0-9.-]+",
            "Internal/Backend Endpoint Exposed",
            "CWE-200",
            "Medium",
            6.0,
        ),
        (
            r"(?i)app\.get\(\s*['\"]\/(debug|test-login|admin-test|internal)['\"]",
            "Debug/Test Endpoint Potentially Exposed",
            "CWE-489",
            "High",
            7.8,
        ),
        (
            r"(?i)(secret|token|key)\s*:\s*[A-Za-z0-9\/\-_]{10,}",
            "Potential CI/CD Secret in Pipeline File",
            "CWE-798",
            "High",
            8.2,
        ),
        (
            r"(?i)if\s*\(\s*user\.role\s*===?\s*['\"]admin['\"]\s*\)",
            "Hardcoded Business Logic Privilege Check",
            "CWE-284",
            "Medium",
            6.4,
        ),
        (
            r"(?i)authorization\s*:\s*bearer\s+[A-Za-z0-9\-_\.]+",
            "Sensitive Authorization Token in Logs/Code",
            "CWE-532",
            "High",
            8.0,
        ),
    ]

    sensitive_file_names = {
        ".env",
        ".env.production",
        ".env.local",
        "config.json",
        "secrets.yml",
        "id_rsa",
        "id_dsa",
    }
    hidden_or_project_meta = {".git", ".ds_store", ".idea", ".vscode"}
    backup_extensions = {".sql", ".bak", ".dump", ".backup"}

    for path in source_dir.rglob("*"):
        if not path.is_file() or path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".lock"}:
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        lowered = content.lower()
        file_name_lower = path.name.lower()

        if file_name_lower in sensitive_file_names:
            findings.append(
                EngineFinding(
                    engine="secret-scan",
                    title="Sensitive configuration file present in scanned source",
                    vuln_type="Sensitive Data Exposure",
                    severity="High",
                    cvss4_score=8.2,
                    confidence=0.85,
                    cwe_id="CWE-200",
                    owasp_category="A02:2021-Cryptographic Failures",
                    file_path=str(path.relative_to(source_dir)),
                    line_number=1,
                    code_snippet=path.name,
                    attack_scenario="Leaked config files can expose secrets, database connections, or signing keys.",
                    poc="Download and inspect committed sensitive configuration file.",
                    remediation="Move secrets to vault/runtime environment and block sensitive files in VCS.",
                    secure_example="Use .env.example without real values and add .env to .gitignore.",
                )
            )

        if file_name_lower in hidden_or_project_meta:
            findings.append(
                EngineFinding(
                    engine="secret-scan",
                    title="Hidden project/meta file exposed",
                    vuln_type="Information Exposure",
                    severity="Low",
                    cvss4_score=3.7,
                    confidence=0.6,
                    cwe_id="CWE-200",
                    owasp_category="A05:2021-Security Misconfiguration",
                    file_path=str(path.relative_to(source_dir)),
                    line_number=1,
                    code_snippet=path.name,
                    attack_scenario="Metadata files can leak internal structure and aid targeted attacks.",
                    poc="Enumerate hidden files exposed by server/static hosting.",
                    remediation="Exclude hidden metadata files from deployment artifacts.",
                    secure_example="Configure build/deploy ignore rules for .git/.idea/.vscode.",
                )
            )

        if path.suffix.lower() in backup_extensions or path.name.lower().endswith(".sql.gz"):
            findings.append(
                EngineFinding(
                    engine="secret-scan",
                    title="Backup or dump file present in source",
                    vuln_type="Sensitive Data Exposure",
                    severity="High",
                    cvss4_score=8.7,
                    confidence=0.82,
                    cwe_id="CWE-200",
                    owasp_category="A02:2021-Cryptographic Failures",
                    file_path=str(path.relative_to(source_dir)),
                    line_number=1,
                    code_snippet=path.name,
                    attack_scenario="Backup files may contain user data, credentials, and full database content.",
                    poc="Download dump and recover records offline.",
                    remediation="Remove backup artifacts from repository and secure backup storage.",
                    secure_example="Store encrypted backups in dedicated protected storage.",
                )
            )

        for pattern, label, cwe, severity, cvss4_score in secret_patterns:
            for match in re.finditer(pattern, content):
                findings.append(
                    EngineFinding(
                        engine="secret-scan",
                        title=label,
                        vuln_type="Hardcoded Secrets",
                        severity=severity,
                        cvss4_score=cvss4_score,
                        confidence=0.91,
                        cwe_id=cwe,
                        owasp_category="A02:2021-Cryptographic Failures",
                        file_path=str(path.relative_to(source_dir)),
                        line_number=content[: match.start()].count("\n") + 1,
                        code_snippet=match.group(0),
                        attack_scenario="Leaked secret can be reused by attacker to access infrastructure or data.",
                        poc="Use extracted credential against exposed service.",
                        remediation="Rotate secret immediately and load from secure secret manager.",
                        secure_example="api_key = os.environ['API_KEY']",
                    )
                )

        if "cors" in lowered and "*" in lowered and "origin" in lowered:
            findings.append(
                EngineFinding(
                    engine="config-scan",
                    title="Potentially permissive CORS configuration",
                    vuln_type="Insecure Configuration",
                    severity="Medium",
                    cvss4_score=6.1,
                    confidence=0.7,
                    cwe_id="CWE-942",
                    owasp_category="A05:2021-Security Misconfiguration",
                    file_path=str(path.relative_to(source_dir)),
                    line_number=1,
                    code_snippet="CORS origin: *",
                    attack_scenario="Malicious origins can abuse browser trust to access protected resources.",
                    poc="Craft cross-origin request from attacker domain.",
                    remediation="Restrict allowed origins to trusted domains.",
                    secure_example="allow_origins=['https://app.example.com']",
                )
            )

    git_dir = source_dir / ".git"
    if git_dir.exists() and git_dir.is_dir():
        try:
            history = subprocess.run(
                ["git", "-C", str(source_dir), "log", "-p", "-n", "30", "--no-color"],
                capture_output=True,
                text=True,
                check=False,
                timeout=20,
            )
            history_blob = (history.stdout or "") + "\n" + (history.stderr or "")
            if re.search(r"AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z\-_]{35}|sk_live_[0-9a-zA-Z]{24}|ghp_[0-9A-Za-z]{36}", history_blob):
                findings.append(
                    EngineFinding(
                        engine="secret-scan",
                        title="Potential secret found in git commit history",
                        vuln_type="Secret in Git History",
                        severity="Critical",
                        cvss4_score=9.5,
                        confidence=0.83,
                        cwe_id="CWE-798",
                        owasp_category="A02:2021-Cryptographic Failures",
                        file_path=".git/history",
                        line_number=1,
                        code_snippet="git log -p contains secret-like pattern",
                        attack_scenario="Secrets removed from latest code may remain extractable from commit history.",
                        poc="Use git log/show to recover previously committed credentials.",
                        remediation="Rotate keys and rewrite history using filter-repo/BFG if exposure confirmed.",
                        secure_example="Pre-commit secret scan + immediate key rotation on leak.",
                    )
                )
        except Exception:
            pass

    return findings


def _deduplicate_findings(findings: list[EngineFinding]) -> list[EngineFinding]:
    seen: set[tuple[str, str, int, str]] = set()
    deduped: list[EngineFinding] = []
    for item in findings:
        key = (item.file_path, item.vuln_type, item.line_number, item.title)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def _add_attack_chain_findings(findings: list[EngineFinding]) -> list[EngineFinding]:
    has_secret_leak = any(
        item.vuln_type in {"Hardcoded Secrets", "Cryptographic Failures"}
        or "api key" in item.title.lower()
        for item in findings
    )
    ssrf_findings = [item for item in findings if "ssrf" in item.vuln_type.lower() or "A10" in item.owasp_category]

    if has_secret_leak and ssrf_findings:
        findings.append(
            EngineFinding(
                engine="risk-correlation",
                title="Critical attack chain: SSRF + leaked credential exposure",
                vuln_type="Attack Chain",
                severity="Critical",
                cvss4_score=9.7,
                confidence=0.9,
                cwe_id="CWE-918",
                owasp_category="A10:2021-Server-Side Request Forgery",
                file_path=ssrf_findings[0].file_path,
                line_number=ssrf_findings[0].line_number,
                code_snippet=ssrf_findings[0].code_snippet,
                attack_scenario=(
                    "Attacker can exploit SSRF to query internal metadata/services and combine it with leaked API keys "
                    "for privilege escalation or lateral movement."
                ),
                poc="Use user-controlled URL to reach internal endpoint and reuse exposed key in downstream API calls.",
                remediation="Block internal URL ranges, enforce URL allowlist, and rotate/revoke leaked credentials.",
                secure_example="validate_url_allowlist(url); secret = vault.get('api_key')",
            )
        )

    return findings


def run_hybrid_scan(source_dir: Path) -> tuple[list[EngineFinding], dict, dict, str, float]:

    findings: list[EngineFinding] = []
    findings.extend(run_semgrep(source_dir))
    findings.extend(run_bandit(source_dir))
    findings.extend(run_eslint_security(source_dir))
    findings.extend(run_trivy_dependencies(source_dir))
    findings.extend(run_ai_contextual_analysis(source_dir))
    findings.extend(run_owasp_patterns_scan(source_dir))
    findings.extend(_scan_secrets_and_configs(source_dir))
    findings = _add_attack_chain_findings(findings)

    findings = _deduplicate_findings(findings)

    language_summary, framework_summary = detect_language_framework(source_dir)
    risk_level, risk_percent = calculate_risk(findings)

    return findings, language_summary, framework_summary, risk_level, risk_percent
