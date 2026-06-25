from __future__ import annotations

import json
from pathlib import Path

import httpx

from app.scanner_engines.utils import command_exists, parse_json_output, run_command
from app.services.types import EngineFinding


def _query_osv(package_name: str, ecosystem: str, version: str) -> list[dict]:
    payload = {
        "package": {"name": package_name, "ecosystem": ecosystem},
        "version": version,
    }
    try:
        response = httpx.post("https://api.osv.dev/v1/query", json=payload, timeout=10)
        if not response.is_success:
            return []
        return response.json().get("vulns", [])
    except Exception:
        return []


def _dependency_fallback(source_dir: Path) -> list[EngineFinding]:
    findings: list[EngineFinding] = []

    package_json = source_dir / "package.json"
    if package_json.exists():
        try:
            data = json.loads(package_json.read_text(encoding="utf-8"))
            deps = data.get("dependencies", {})
            for name, version in deps.items():
                vulns = _query_osv(name, "npm", str(version).replace("^", "").replace("~", ""))
                for vuln in vulns[:3]:
                    findings.append(
                        EngineFinding(
                            engine="trivy",
                            title=vuln.get("summary", "Vulnerable dependency"),
                            vuln_type="Dependency Vulnerability",
                            severity="High",
                            cvss4_score=8.0,
                            confidence=0.83,
                            cwe_id="",
                            owasp_category="A06:2021-Vulnerable and Outdated Components",
                            file_path="package.json",
                            line_number=1,
                            code_snippet=f'"{name}": "{version}"',
                            attack_scenario="Known vulnerability in third-party package is exploitable in runtime path.",
                            poc=vuln.get("id", "See advisory"),
                            remediation="Upgrade to a fixed version listed by advisory.",
                            secure_example=f'"{name}": "<patched_version>"',
                            rule_id=vuln.get("id", ""),
                            scan_category="Dependency scan",
                            source=f"{name}@{version}",
                            sink="known vulnerable dependency",
                            why_vulnerable=f"OSV returned advisory {vuln.get('id', 'unknown')} for {name}@{version}.",
                        )
                    )
        except Exception:
            pass

    requirements = source_dir / "requirements.txt"
    if requirements.exists():
        for raw in requirements.read_text(encoding="utf-8", errors="ignore").splitlines():
            if "==" not in raw or raw.strip().startswith("#"):
                continue
            pkg, ver = raw.split("==", 1)
            vulns = _query_osv(pkg.strip(), "PyPI", ver.strip())
            for vuln in vulns[:3]:
                findings.append(
                    EngineFinding(
                        engine="trivy",
                        title=vuln.get("summary", "Vulnerable dependency"),
                        vuln_type="Dependency Vulnerability",
                        severity="High",
                        cvss4_score=8.0,
                        confidence=0.83,
                        cwe_id="",
                        owasp_category="A06:2021-Vulnerable and Outdated Components",
                        file_path="requirements.txt",
                        line_number=1,
                        code_snippet=raw.strip(),
                        attack_scenario="Known vulnerability in third-party package is exploitable in runtime path.",
                        poc=vuln.get("id", "See advisory"),
                        remediation="Upgrade to a fixed version listed by advisory.",
                        secure_example=f"{pkg.strip()}==<patched_version>",
                        rule_id=vuln.get("id", ""),
                        scan_category="Dependency scan",
                        source=f"{pkg.strip()}=={ver.strip()}",
                        sink="known vulnerable dependency",
                        why_vulnerable=f"OSV returned advisory {vuln.get('id', 'unknown')} for {pkg.strip()}=={ver.strip()}.",
                    )
                )

    return findings


def run_trivy_dependencies(source_dir: Path) -> list[EngineFinding]:
    if not command_exists("trivy"):
        return _dependency_fallback(source_dir)

    code, stdout, _stderr = run_command(
        ["trivy", "fs", "--format", "json", "--scanners", "vuln,secret,config", str(source_dir)],
        cwd=source_dir,
        timeout=1800,
    )
    if code not in {0, 1}:
        return _dependency_fallback(source_dir)

    data = parse_json_output(stdout)
    findings: list[EngineFinding] = []
    for result in data.get("Results", []):
        target = result.get("Target", "")
        for vuln in result.get("Vulnerabilities", []):
            severity = str(vuln.get("Severity", "MEDIUM")).capitalize()
            severity = severity if severity in {"Critical", "High", "Medium", "Low"} else "Medium"
            findings.append(
                EngineFinding(
                    engine="trivy",
                    title=vuln.get("Title") or vuln.get("VulnerabilityID", "Trivy finding"),
                    vuln_type="Dependency Vulnerability",
                    severity=severity,
                    cvss4_score=9.0 if severity == "Critical" else 7.9 if severity == "High" else 5.1,
                    confidence=0.93,
                    cwe_id="",
                    owasp_category="A06:2021-Vulnerable and Outdated Components",
                    file_path=target,
                    line_number=1,
                    code_snippet=f"{vuln.get('PkgName', '')}@{vuln.get('InstalledVersion', '')}",
                    attack_scenario="Published advisory indicates known exploitable weakness in dependency.",
                    poc=vuln.get("PrimaryURL", "See advisory"),
                    remediation="Upgrade to FixedVersion if available.",
                    secure_example=f"Upgrade to {vuln.get('FixedVersion', 'latest safe version')}",
                    rule_id=vuln.get("VulnerabilityID", ""),
                    scan_category="Dependency scan",
                    source=f"{vuln.get('PkgName', '')}@{vuln.get('InstalledVersion', '')}",
                    sink="Known vulnerable dependency",
                    why_vulnerable=(
                        f"Dependency {vuln.get('PkgName', '')} version "
                        f"{vuln.get('InstalledVersion', '')} matches advisory "
                        f"{vuln.get('VulnerabilityID', '')}."
                    ),
                )
            )
        for secret in result.get("Secrets", []):
            findings.append(
                EngineFinding(
                    engine="trivy",
                    title=secret.get("Title", "Secret detected"),
                    vuln_type="Hardcoded Secrets",
                    severity=str(secret.get("Severity", "HIGH")).capitalize(),
                    cvss4_score=8.0,
                    confidence=0.9,
                    cwe_id="CWE-798",
                    owasp_category="A02:2021-Cryptographic Failures",
                    file_path=target,
                    line_number=int(secret.get("StartLine", 1)),
                    code_snippet=secret.get("Match", secret.get("Code", {}).get("Lines", "")),
                    attack_scenario="A committed secret can be reused to access systems or data.",
                    poc=secret.get("RuleID", "Secret rule matched"),
                    remediation="Rotate the secret and load it from a vault or runtime environment.",
                    secure_example="secret = os.environ['SECRET_NAME']",
                    rule_id=secret.get("RuleID", ""),
                    scan_category="Secret scan",
                    source="committed source file",
                    sink=secret.get("Category", "secret material"),
                    why_vulnerable="Secret-like material is present in repository content.",
                )
            )
        for misconfig in result.get("Misconfigurations", []):
            severity = str(misconfig.get("Severity", "MEDIUM")).capitalize()
            findings.append(
                EngineFinding(
                    engine="trivy",
                    title=misconfig.get("Title", "Configuration issue"),
                    vuln_type="Security Misconfiguration",
                    severity=severity if severity in {"Critical", "High", "Medium", "Low"} else "Medium",
                    cvss4_score=7.0 if severity == "High" else 5.0,
                    confidence=0.86,
                    cwe_id="CWE-16",
                    owasp_category="A05:2021-Security Misconfiguration",
                    file_path=target,
                    line_number=int(misconfig.get("CauseMetadata", {}).get("StartLine", 1)),
                    code_snippet=misconfig.get("Message", ""),
                    attack_scenario="Insecure deployment or CI configuration can weaken runtime defenses.",
                    poc=misconfig.get("ID", "Configuration rule matched"),
                    remediation=misconfig.get("Resolution", "Harden the configuration according to the rule."),
                    secure_example=misconfig.get("Resolution", "Use least-privilege secure defaults."),
                    rule_id=misconfig.get("ID", ""),
                    scan_category="Config scan",
                    source=target,
                    sink=misconfig.get("Type", "configuration"),
                    why_vulnerable=misconfig.get("Description", misconfig.get("Message", "")),
                )
            )
    return findings
