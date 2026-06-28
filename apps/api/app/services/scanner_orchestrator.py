from collections import Counter
from pathlib import Path
import logging
import re
import subprocess

from app.core.config import settings
from app.scanner_engines.ai_adapter import run_ai_triage
from app.scanner_engines.bandit_adapter import run_bandit
from app.scanner_engines.eslint_adapter import run_eslint_security
from app.scanner_engines.owasp_patterns_adapter import run_owasp_patterns_scan
from app.scanner_engines.secret_scanner import run_secret_scan
from app.scanner_engines.semgrep_adapter import run_semgrep
from app.scanner_engines.trivy_adapter import run_trivy_dependencies
from app.services.types import EngineFinding

logger = logging.getLogger(__name__)


SEVERITY_SCORE = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1, "Info": 0}


# ---------------------------------------------------------------------------
# Risk calculation
# ---------------------------------------------------------------------------

def calculate_risk(findings: list[EngineFinding]) -> tuple[str, float]:
    if not findings:
        return "Low", 5.0

    weights = {"Critical": 30, "High": 14, "Medium": 6, "Low": 2, "Info": 1}
    # Factor in reachability (confidence)
    total = sum(weights.get(item.severity, 1) * item.confidence for item in findings)
    
    # Secret verification penalty/bonus
    if any(f.scan_category == "Secret scan" and f.verification_status == "verified" for f in findings):
        total += 20  # Verified live secret is a massive risk

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


# ---------------------------------------------------------------------------
# Language / framework detection
# ---------------------------------------------------------------------------

def detect_language_framework(source_dir: Path) -> tuple[dict, dict]:
    language_counter: Counter = Counter()
    framework_counter: Counter = Counter()

    ext_map = {
        ".py": "python", ".js": "javascript", ".jsx": "javascript",
        ".ts": "typescript", ".tsx": "typescript", ".java": "java",
        ".cs": "dotnet", ".go": "go", ".rb": "ruby", ".php": "php",
    }

    for path in source_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in ext_map:
            language_counter[ext_map[path.suffix.lower()]] += 1

    if (source_dir / "package.json").exists():
        pkg = (source_dir / "package.json").read_text(encoding="utf-8", errors="ignore").lower()
        if "next" in pkg:
            framework_counter["next.js"] += 1
        if "express" in pkg:
            framework_counter["express"] += 1
        if "nestjs" in pkg:
            framework_counter["nestjs"] += 1

    for req_file in [source_dir / "requirements.txt", source_dir / "pyproject.toml"]:
        if req_file.exists():
            blob = req_file.read_text(encoding="utf-8", errors="ignore").lower()
            if "fastapi" in blob:
                framework_counter["fastapi"] += 1
            if "django" in blob:
                framework_counter["django"] += 1
            if "flask" in blob:
                framework_counter["flask"] += 1

    if not language_counter:
        language_counter["unknown"] = 1
    if not framework_counter:
        framework_counter["unknown"] = 1

    return dict(language_counter), dict(framework_counter)


# ---------------------------------------------------------------------------
# Scan-category classifier
# ---------------------------------------------------------------------------

def _scan_category(item: EngineFinding) -> str:
    if item.engine in ("secret-scan",):
        return "Secret scan"
    if item.engine in ("trivy",):
        return "Dependency scan"
    if item.engine in ("config-scan",):
        return "Config scan"

    blob = f"{item.engine} {item.title} {item.vuln_type} {item.file_path}".lower()
    if "dependency" in blob or (item.engine == "trivy" and "@" in item.code_snippet):
        return "Dependency scan"
    if "secret" in blob or any(t in blob for t in ["password", "token", "api key", "credential"]):
        return "Secret scan"
    if any(item.file_path.lower().endswith(ext)
           for ext in [".properties", ".xml", ".yml", ".yaml", "dockerfile", ".ini", ".conf"]):
        return "Config scan"
    if any(t in blob for t in ["config", "cors", "debug", "docker", "ci/cd"]):
        return "Config scan"
    return "SAST source code"


# ---------------------------------------------------------------------------
# Source / sink inference
# ---------------------------------------------------------------------------

_SOURCE_PATTERNS = [
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

_SINK_PATTERNS = [
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


def _infer_source_sink(item: EngineFinding, context: str = "") -> tuple[str, str]:
    blob = f"{item.title} {item.vuln_type} {item.code_snippet} {context}".lower()
    source = item.source or next((lbl for needle, lbl in _SOURCE_PATTERNS if needle in blob), "")
    sink = item.sink or next((lbl for needle, lbl in _SINK_PATTERNS if needle in blob), "")
    return source, sink


# ---------------------------------------------------------------------------
# Function-name inference
# ---------------------------------------------------------------------------

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

    upper = max(min(item.line_start - 1, len(lines) - 1), 0)
    patterns = [
        r"\bdef\s+([A-Za-z_][\w]*)\\s*\(",
        r"\bfunction\s+([A-Za-z_][\w]*)\s*\(",
        r"\b(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\],\s]+\s+([A-Za-z_][\w]*)\s*\(",
        r"\b([A-Za-z_][\w]*)\s*=\s*\([^)]*\)\s*=>",
    ]
    for line_idx in range(upper, -1, -1):
        text = lines[line_idx].strip()
        for pat in patterns:
            m = re.search(pat, text)
            if m:
                return m.group(1)
    return ""


# ---------------------------------------------------------------------------
# Context window
# ---------------------------------------------------------------------------

def _line_context(source_dir: Path, item: EngineFinding, radius: int = 10) -> str:
    path = source_dir / item.file_path
    if not path.exists() or not path.is_file():
        return ""
    try:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
    except OSError:
        return ""
    start = max(item.line_start - radius - 1, 0)
    end = min(item.line_end + radius, len(lines))
    return "\n".join(lines[start:end])


# ---------------------------------------------------------------------------
# Rule ID
# ---------------------------------------------------------------------------

def _rule_id(item: EngineFinding) -> str:
    if item.rule_id:
        return item.rule_id
    prefix = {
        "Secret scan": "secret",
        "SAST source code": "sast",
        "Dependency scan": "dep",
        "Config scan": "config",
    }.get(item.scan_category, "rule")
    engine = item.engine.lower().replace(" ", "-")
    cwe = item.cwe_id.lower() if item.cwe_id else item.vuln_type.lower().replace(" ", "-")
    return f"{prefix}.{engine}.{cwe}"


# ---------------------------------------------------------------------------
# Severity calibration
# ---------------------------------------------------------------------------

def _calibrate_severity(item: EngineFinding) -> None:
    blob = f"{item.title} {item.vuln_type} {item.code_snippet} {item.source} {item.sink}".lower()
    is_injection = any(t in blob for t in ["injection", "sql", "command", "xss", "ssrf"])
    is_secret = item.scan_category == "Secret scan"
    is_dependency = item.scan_category == "Dependency scan"

    if is_injection:
        if item.source and item.sink and item.confidence >= 0.82:
            item.severity = "Critical"
            item.cvss4_score = max(item.cvss4_score, 9.0)
        elif item.source and item.sink:
            item.severity = "High"
            item.cvss4_score = min(max(item.cvss4_score, 7.0), 8.9)
        elif item.sink:
            item.severity = "Medium"
            item.cvss4_score = min(max(item.cvss4_score, 5.0), 6.9)
            item.confidence = min(item.confidence, 0.72)
        else:
            item.severity = "Low"
            item.cvss4_score = min(item.cvss4_score, 3.9)
            item.confidence = min(item.confidence, 0.55)
        return

    if is_secret and not re.search(
        r"(?i)(akia|sk-|gsk_|ghp_|token|password|secret|private key)", item.evidence or item.code_snippet
    ):
        item.severity = "Medium"
        item.cvss4_score = min(item.cvss4_score, 6.9)
        return

    if is_dependency and "CVE-" not in f"{item.title} {item.poc}":
        item.severity = "Medium" if item.severity in {"Critical", "High"} else item.severity


# ---------------------------------------------------------------------------
# Enrichment pipeline
# ---------------------------------------------------------------------------

def _enrich_findings(source_dir: Path, source_type: str, source_value: str, findings: list[EngineFinding]) -> list[EngineFinding]:
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
        # Ensure evidence field is set for SAST findings (from code_snippet, not raw secret)
        if not item.evidence and item.code_snippet:
            item.evidence = item.code_snippet[:200]
            
        # Generate code_link
        if source_type == "repo_url" and source_value.startswith("http"):
            repo_base = source_value
            if repo_base.endswith("/"):
                repo_base = repo_base[:-1]
            if repo_base.endswith(".git"):
                repo_base = repo_base[:-4]
            branch = "main" # Can be improved if we store branch
            line_hash = f"#L{item.line_start}"
            if item.line_end and item.line_end > item.line_start:
                line_hash += f"-L{item.line_end}"
            item.code_link = f"{repo_base}/blob/{branch}/{item.file_path}{line_hash}"
        else:
            item.code_link = f"/dashboard/scans/snippet?file={item.file_path}&line={item.line_start}"
            
    return findings


# ---------------------------------------------------------------------------
# Deduplication by dedupe_hash
# ---------------------------------------------------------------------------

def _deduplicate_findings(findings: list[EngineFinding]) -> list[EngineFinding]:
    seen: dict[str, EngineFinding] = {}
    for item in findings:
        existing = seen.get(item.dedupe_hash)
        if existing is None:
            seen[item.dedupe_hash] = item
            continue
        # Keep the finding with higher (severity, confidence)
        existing_rank = SEVERITY_SCORE.get(existing.severity, 0)
        item_rank = SEVERITY_SCORE.get(item.severity, 0)
        if (item_rank, item.confidence) > (existing_rank, existing.confidence):
            seen[item.dedupe_hash] = item
        else:
            # Merge confidence upward
            existing.confidence = max(existing.confidence, item.confidence)
    return list(seen.values())


# ---------------------------------------------------------------------------
# Attack chain correlation
# ---------------------------------------------------------------------------

def _add_attack_chain_findings(findings: list[EngineFinding]) -> list[EngineFinding]:
    has_secret_leak = any(
        item.vuln_type in {"Hardcoded Secret", "Cryptographic Failures"} or "api key" in item.title.lower()
        for item in findings
    )
    ssrf_findings = [f for f in findings if "ssrf" in f.vuln_type.lower() or "A10" in f.owasp_category]

    if has_secret_leak and ssrf_findings:
        ref = ssrf_findings[0]
        findings.append(EngineFinding(
            engine="risk-correlation",
            title="Critical attack chain: SSRF + leaked credential exposure",
            vuln_type="Attack Chain",
            severity="Critical", cvss4_score=9.7, confidence=0.90,
            cwe_id="CWE-918", owasp_category="A10:2021-Server-Side Request Forgery",
            file_path=ref.file_path, line_number=ref.line_start,
            code_snippet=ref.code_snippet,
            evidence=ref.evidence,
            impact=(
                "Combined SSRF + leaked credential enables attacker to query internal "
                "metadata endpoints and escalate privileges using the exposed API key."
            ),
            attack_scenario=(
                "Attacker exploits SSRF to query cloud metadata or internal services "
                "and combines it with the leaked API key for lateral movement."
            ),
            poc="Use user-controlled URL to reach internal endpoint; reuse exposed key in downstream API calls.",
            remediation="Block internal URL ranges, enforce URL allowlist, and rotate/revoke leaked credentials.",
            secure_example="validate_url_allowlist(url); secret = vault.get('api_key')",
            pentest_hint=(
                "1. Confirm SSRF reach to 169.254.169.254 or internal services in staging.\n"
                "2. Cross-check which API keys have permissions on those services.\n"
                "3. Test in an authorised environment with a non-production key."
            ),
            references=(
                "https://owasp.org/www-community/attacks/Server_Side_Request_Forgery\n"
                "https://cwe.mitre.org/data/definitions/918.html"
            ),
            scan_category="SAST source code",
        ))
    return findings


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

from typing import Callable, Optional

def run_hybrid_scan(
    source_dir: Path,
    source_type: str = "",
    source_value: str = "",
    log_event: Optional[Callable[[str, str], None]] = None,
    policy: Optional[dict] = None,
) -> tuple[list[EngineFinding], dict, dict, str, float]:
    findings: list[EngineFinding] = []
    policy = policy or {}
    enabled = set(policy.get("enabled_engines") or ["semgrep", "bandit", "eslint", "owasp", "trivy", "secrets"])

    def _log(event_type: str, msg: str = "") -> None:
        if log_event:
            log_event(event_type, msg)

    # ── Stage 1: SAST ──────────────────────────────────────────────────────
    _log("sast_scan_started", "Running SAST engines (Semgrep, Bandit, ESLint, Patterns)...")
    if "semgrep" in enabled:
        before = len(findings)
        findings.extend(run_semgrep(source_dir))
        _log("semgrep_completed", f"Semgrep completed with {len(findings) - before} findings.")
    else:
        _log("semgrep_skipped", "Semgrep disabled by scanner policy.")
    if "bandit" in enabled:
        before = len(findings)
        findings.extend(run_bandit(source_dir))
        _log("bandit_completed", f"Bandit completed with {len(findings) - before} findings.")
    else:
        _log("bandit_skipped", "Bandit disabled by scanner policy.")
    if "eslint" in enabled:
        before = len(findings)
        findings.extend(run_eslint_security(source_dir))
        _log("eslint_completed", f"ESLint security completed with {len(findings) - before} findings.")
    else:
        _log("eslint_skipped", "ESLint security disabled by scanner policy.")
    if "owasp" in enabled:
        before = len(findings)
        findings.extend(run_owasp_patterns_scan(source_dir))
        _log("owasp_completed", f"OWASP pattern scan completed with {len(findings) - before} findings.")
    else:
        _log("owasp_skipped", "OWASP pattern scan disabled by scanner policy.")

    # ── Stage 2: Dependency scan ───────────────────────────────────────────
    if "trivy" in enabled:
        _log("dependency_scan_started", "Running Trivy dependency scan...")
        before = len(findings)
        findings.extend(run_trivy_dependencies(source_dir))
        _log("trivy_completed", f"Trivy dependency scan completed with {len(findings) - before} findings.")
    else:
        _log("trivy_skipped", "Trivy dependency scan disabled by scanner policy.")

    # ── Stage 3: Secret scan (opt-in live verification) ───────────────────
    if "secrets" in enabled:
        _log("secret_scan_started", "Running Secret scan...")
        verify_secrets = bool(policy.get("secret_verification_enabled", settings.secret_verify_enabled))
        before = len(findings)
        findings.extend(run_secret_scan(source_dir, verify_enabled=verify_secrets))
        _log("secret_scan_completed", f"Secret scan completed with {len(findings) - before} findings.")
    else:
        _log("secret_scan_skipped", "Secret scan disabled by scanner policy.")

    # ── Stage 4: Attack chain correlation ─────────────────────────────────
    findings = _add_attack_chain_findings(findings)

    # ── Stage 5: Enrich (source/sink, function, category, severity) ────────
    findings = _enrich_findings(source_dir, source_type, source_value, findings)

    # ── Stage 6: Deduplicate by dedupe_hash ────────────────────────────────
    findings = _deduplicate_findings(findings)

    # ── Stage 7: AI triage (post-scan, adjusts confidence + status) ────────
    if settings.llm_api_key and policy.get("ai_triage_enabled", True):
        _log("ai_triage_started", "Running AI triage on findings...")
        findings = run_ai_triage(findings, source_dir)
        _log("ai_triage_completed", "AI triage completed.")
    else:
        _log("ai_triage_skipped", "AI triage skipped because it is disabled or no API key is configured.")

    # ── Stage 8: Confidence floor + triage stats ────────────────────────────
    # AI is never allowed to zero-out confidence (findings are never silently deleted)
    for f in findings:
        f.confidence = max(f.confidence, 0.05)

    threshold = policy.get("severity_threshold") or "Info"
    min_rank = SEVERITY_SCORE.get(threshold, 0)
    findings = [item for item in findings if SEVERITY_SCORE.get(item.severity, 0) >= min_rank]

    _log_triage_stats(findings)

    language_summary, framework_summary = detect_language_framework(source_dir)
    risk_level, risk_percent = calculate_risk(findings)

    return findings, language_summary, framework_summary, risk_level, risk_percent


# ---------------------------------------------------------------------------
# Triage statistics logger
# ---------------------------------------------------------------------------

def _log_triage_stats(findings: list[EngineFinding]) -> None:
    from collections import Counter as _Counter
    stats = _Counter(f.verification_status for f in findings)
    sev_stats = _Counter(f.severity for f in findings)
    logger.info(
        "Scan complete — %d findings | severity: %s | triage: %s",
        len(findings),
        dict(sev_stats),
        dict(stats),
    )
