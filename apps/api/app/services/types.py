from __future__ import annotations

import hashlib
from dataclasses import dataclass, field


@dataclass
class EngineFinding:
    # ── Core identity ──────────────────────────────────────────────────────────
    engine: str
    title: str
    vuln_type: str
    severity: str          # Critical | High | Medium | Low | Info
    cvss4_score: float
    confidence: float      # 0.0 – 1.0
    cwe_id: str
    owasp_category: str

    # ── Location ───────────────────────────────────────────────────────────────
    file_path: str
    line_number: int       # kept for backward-compat; mirrors line_start
    code_snippet: str

    # ── Explanation ───────────────────────────────────────────────────────────
    attack_scenario: str
    poc: str
    remediation: str
    secure_example: str

    # ── Optional / enriched fields ────────────────────────────────────────────
    rule_id: str = ""
    scan_category: str = "SAST source code"
    source: str = ""
    sink: str = ""
    function_name: str = ""
    why_vulnerable: str = ""

    # ── New standardized fields ───────────────────────────────────────────────
    line_start: int = 0    # start line of the finding (0 = use line_number)
    line_end: int = 0      # end line of the finding (0 = same as line_start)
    # evidence stores only a redacted/masked match, never raw credentials
    evidence: str = ""
    impact: str = ""
    pentest_hint: str = ""   # authorized, safe verification steps only
    references: str = ""     # newline-separated CWE/OWASP/vendor links
    code_link: str = ""      # github blob URL or internal snippet viewer URL
    exploitability: str = "" # AI explanation of how exploitable this is
    false_positive_reason: str = "" # AI explanation if false positive

    # Triage & verification
    verification_status: str = "unverified"  # unverified|verified|failed|skipped|needs_review|false_positive_likely
    dedupe_hash: str = ""    # SHA-256 fingerprint for deduplication
    dataflow_trace: str = "" # JSON-serialized list of source→sink trace steps

    def __post_init__(self) -> None:
        if not self.rule_id:
            base = self.cwe_id or self.vuln_type or self.title
            self.rule_id = base.lower().replace(" ", "-")
        if not self.why_vulnerable:
            self.why_vulnerable = self.attack_scenario
        # Normalise line positions
        if self.line_start == 0:
            self.line_start = self.line_number or 1
        if self.line_end == 0:
            self.line_end = self.line_start
        # Compute deduplication hash if not already set
        if not self.dedupe_hash:
            # Hash omits 'engine' to allow cross-engine deduplication of the same issue
            # Using rule_id (normalized) + file_path + line_start
            raw = f"{self.rule_id}:{self.file_path}:{self.line_start}"
            self.dedupe_hash = hashlib.sha256(raw.encode()).hexdigest()[:16]
