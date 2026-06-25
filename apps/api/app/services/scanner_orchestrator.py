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


SEVERITY_SCORE = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1, "Info": 0}


def calculate_risk(findings: list[EngineFinding]) -> tuple[str, float]:
    if not findings:
        return "Low", 5.0

    weights = {"Critical": 30, "High": 14, "Medium": 6, "Low": 2, "Info": 1}
    total = sum(weights.get(item.severity, 1) * item.confidence for item in findings)
    capped = min(float(total), 100.0)
    if any(item.severity == "Critical" for item in findings):
        capped = max(capped, 85.0)
    elif any(item.severity == "High" for item in findings):
        capped = max(capped, 60.0)
    elif any(item.severity == "Medium" for item in findings):
        capped = max(capped, 35.0)

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


def _scan_category(item: EngineFinding) -> str:
    title_blob = f"{item.engine} {item.title} {item.vuln_type} {item.file_path}".lower()
    if "dependency" in title_blob or item.engine == "trivy" and "@" in item.code_snippet:
        return "Dependency scan"
    if "secret" in title_blob or any(token in title_blob for token in ["password", "token", "api key", "credential"]):
        return "Secret scan"
    if any(item.file_path.lower().endswith(ext) for ext in [".properties", ".xml", ".yml", ".yaml", "dockerfile", ".ini", ".conf"]):
        return "Config scan"
    if any(token in title_blob for token in ["config", "cors", "debug", "docker", "ci/cd"]):
        return "Config scan"
    return "SAST source code"


def _infer_source_sink(item: EngineFinding, context: str = "") -> tuple[str, str]:
    blob = f"{item.title} {item.vuln_type} {item.code_snippet} {context}".lower()
    source = item.source
    sink = item.sink

    source_patterns = [
        ("request.getparameter", "HTTP request parameter"),
        ("getparameter(", "HTTP request parameter"),
        ("getheader(", "HTTP request header"),
        ("request.args", "HTTP query parameter"),
        ("request.form", "HTTP form body"),
        ("req.query", "HTTP query parameter"),
        ("req.body", "HTTP request body"),
        ("input(", "stdin/user input"),
        ("scanner.next", "stdin/user input"),
        ("user_url", "user-controlled URL"),
        ("target_url", "user-controlled URL"),
        ("url", "URL variable"),
    ]
    sink_patterns = [
        ("executequery", "SQL executeQuery"),
        ("executeupdate", "SQL executeUpdate"),
        ("cursor.execute", "SQL execute"),
        ("select", "SQL string construction"),
        ("runtime.getruntime().exec", "OS command execution"),
        ("processbuilder", "OS command execution"),
        ("os.system", "OS command execution"),
        ("subprocess", "OS command execution"),
        ("eval(", "dynamic code execution"),
        ("dangerouslysetinnerhtml", "DOM HTML injection sink"),
        ("innerhtml", "DOM HTML injection sink"),
        ("requests.get", "server-side HTTP request"),
        ("fetch(", "HTTP request sink"),
    ]

    if not source:
        source = next((label for needle, label in source_patterns if needle in blob), "")
    if not sink:
        sink = next((label for needle, label in sink_patterns if needle in blob), "")
    return source, sink


def _infer_function(source_dir: Path, item: EngineFinding) -> str:
    if item.function_name:
        return item.function_name

    path = source_dir / item.file_path
    if not path.exists() or not path.is_file():
        return ""

    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return ""

    upper = max(min(item.line_number - 1, len(lines) - 1), 0)
    patterns = [
        r"\bdef\s+([A-Za-z_][\w]*)\s*\(",
        r"\bfunction\s+([A-Za-z_][\w]*)\s*\(",
        r"\b(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\],\s]+\s+([A-Za-z_][\w]*)\s*\(",
        r"\b([A-Za-z_][\w]*)\s*=\s*\([^)]*\)\s*=>",
    ]
    for line in range(upper, -1, -1):
        text = lines[line].strip()
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)
    return ""


def _line_context(source_dir: Path, item: EngineFinding, radius: int = 10) -> str:
    path = source_dir / item.file_path
    if not path.exists() or not path.is_file():
        return ""
    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return ""
    start = max(item.line_number - radius - 1, 0)
    end = min(item.line_number + radius, len(lines))
    return "\n".join(lines[start:end])


def _rule_id(item: EngineFinding) -> str:
    if item.rule_id:
        return item.rule_id
    category_prefix = {
        "Secret scan": "secret",
        "SAST source code": "sast",
        "Dependency scan": "dep",
        "Config scan": "config",
    }.get(item.scan_category, "rule")
    engine = item.engine.lower().replace(" ", "-")
    cwe = item.cwe_id.lower() if item.cwe_id else item.vuln_type.lower().replace(" ", "-")
    return f"{category_prefix}.{engine}.{cwe}"


def _calibrate_severity(item: EngineFinding) -> None:
    blob = f"{item.title} {item.vuln_type} {item.code_snippet} {item.source} {item.sink}".lower()
    is_injection = any(token in blob for token in ["injection", "sql", "command", "xss", "ssrf"])
    is_secret = item.scan_category == "Secret scan"
    is_dependency = item.scan_category == "Dependency scan"

    if is_injection:
        has_source = bool(item.source)
        has_sink = bool(item.sink)
        if has_source and has_sink and item.confidence >= 0.82:
            item.severity = "Critical"
            item.cvss4_score = max(item.cvss4_score, 9.0)
        elif has_source and has_sink:
            item.severity = "High"
            item.cvss4_score = min(max(item.cvss4_score, 7.0), 8.9)
        elif has_sink:
            item.severity = "Medium"
            item.cvss4_score = min(max(item.cvss4_score, 5.0), 6.9)
            item.confidence = min(item.confidence, 0.72)
        else:
            item.severity = "Low"
            item.cvss4_score = min(item.cvss4_score, 3.9)
            item.confidence = min(item.confidence, 0.55)
        return

    if is_secret and not re.search(r"(?i)(akia|sk-|ghp_|token|password|secret|private key)", item.code_snippet):
        item.severity = "Medium"
        item.cvss4_score = min(item.cvss4_score, 6.9)
        return

    if is_dependency and "CVE-" not in f"{item.title} {item.poc}":
        item.severity = "Medium" if item.severity in {"Critical", "High"} else item.severity


def _enrich_findings(source_dir: Path, findings: list[EngineFinding]) -> list[EngineFinding]:
    for item in findings:
        context = _line_context(source_dir, item)
        item.scan_category = _scan_category(item)
        item.source, item.sink = _infer_source_sink(item, context)
        item.function_name = _infer_function(source_dir, item)
        if context and item.code_snippet and context.count("\n") <= 24:
            item.code_snippet = context.strip()
        item.rule_id = _rule_id(item)
        if not item.why_vulnerable:
            item.why_vulnerable = (
                f"{item.scan_category} finding from {item.engine}. "
                f"Source: {item.source or 'not proven'}; sink: {item.sink or 'not proven'}. "
                f"{item.attack_scenario}"
            )
        _calibrate_severity(item)
    return findings


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
                    rule_id="secret.sensitive-config-file",
                    scan_category="Secret scan",
                    source="repository file",
                    sink=path.name,
                    why_vulnerable="Sensitive configuration files often contain credentials or private runtime settings.",
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
                    rule_id="config.hidden-metadata-file",
                    scan_category="Config scan",
                    source="repository metadata",
                    sink=path.name,
                    why_vulnerable="Hidden metadata can disclose project internals or deployment structure.",
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
                    rule_id="secret.backup-or-dump-file",
                    scan_category="Secret scan",
                    source="repository file",
                    sink=path.name,
                    why_vulnerable="Backup and dump files may contain credentials, personal data, or database content.",
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
                        rule_id=f"secret.{label.lower().replace(' ', '-')}",
                        scan_category="Secret scan",
                        source="repository content",
                        sink=label,
                        why_vulnerable=f"{label} matched secret exposure pattern {cwe}.",
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
                    rule_id="config.permissive-cors",
                    scan_category="Config scan",
                    source="configuration content",
                    sink="CORS policy",
                    why_vulnerable="Wildcard CORS origins can allow untrusted websites to interact with browser-authenticated APIs.",
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
                        rule_id="secret.git-history-secret",
                        scan_category="Secret scan",
                        source="git commit history",
                        sink="secret material",
                        why_vulnerable="Secrets removed from current files can remain recoverable from commit history.",
                    )
                )
        except Exception:
            pass

    return findings


def _deduplicate_findings(findings: list[EngineFinding]) -> list[EngineFinding]:
    grouped: dict[tuple[str, str, str, str], EngineFinding] = {}
    for item in findings:
        key = (
            item.rule_id,
            item.file_path,
            item.function_name or str(item.line_number),
            item.sink or item.vuln_type,
        )
        existing = grouped.get(key)
        if existing is None:
            grouped[key] = item
            continue
        existing_rank = SEVERITY_SCORE.get(existing.severity, 0)
        item_rank = SEVERITY_SCORE.get(item.severity, 0)
        if (item_rank, item.confidence) > (existing_rank, existing.confidence):
            item.code_snippet = f"{existing.code_snippet}\n...\n{item.code_snippet}"
            grouped[key] = item
        else:
            existing.code_snippet = f"{existing.code_snippet}\n...\n{item.code_snippet}"
            existing.confidence = max(existing.confidence, item.confidence)
    return list(grouped.values())


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
    findings = _enrich_findings(source_dir, findings)

    findings = _deduplicate_findings(findings)

    language_summary, framework_summary = detect_language_framework(source_dir)
    risk_level, risk_percent = calculate_risk(findings)

    return findings, language_summary, framework_summary, risk_level, risk_percent
