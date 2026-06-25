from dataclasses import dataclass


@dataclass
class EngineFinding:
    engine: str
    title: str
    vuln_type: str
    severity: str
    cvss4_score: float
    confidence: float
    cwe_id: str
    owasp_category: str
    file_path: str
    line_number: int
    code_snippet: str
    attack_scenario: str
    poc: str
    remediation: str
    secure_example: str
    rule_id: str = ""
    scan_category: str = "SAST source code"
    source: str = ""
    sink: str = ""
    function_name: str = ""
    why_vulnerable: str = ""

    def __post_init__(self) -> None:
        if not self.rule_id:
            base = self.cwe_id or self.vuln_type or self.title
            self.rule_id = base.lower().replace(" ", "-")
        if not self.why_vulnerable:
            self.why_vulnerable = self.attack_scenario
