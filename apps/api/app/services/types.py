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
