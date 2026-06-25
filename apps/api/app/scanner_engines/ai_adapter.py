"""
AI Triage Engine
================
Post-scan triage step that refines findings using an LLM (Groq/OpenAI-compatible).

Workflow:
  1. Rule engines run first and produce candidate findings.
  2. This module receives the candidate list and, for each finding, sends the
     code context + finding details to the LLM.
  3. The LLM returns a JSON verdict:
       - is_false_positive (bool)
       - confidence_delta   (float, -0.3 … +0.1)
       - verification_status
       - explanation
       - remediation
       - pentest_hint
  4. We update the finding fields (adjust confidence, set verification_status,
     set pentest_hint / remediation if LLM provides better ones).
     Findings are NEVER silently deleted – even false-positive candidates remain
     in the results with verification_status="false_positive_likely".

Fallback (no LLM key):
  Local heuristic triage only. Marks findings as "needs_review" or
  "false_positive_likely" based on structural signals.
  Nothing is marked "verified" without real LLM or live verification.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import httpx

from app.core.config import settings
from app.services.types import EngineFinding

logger = logging.getLogger(__name__)

# Maximum findings to send to LLM per scan (cost/latency control)
_LLM_TRIAGE_LIMIT = 25
# Max code snippet length sent to LLM
_SNIPPET_LIMIT = 600

# ---------------------------------------------------------------------------
# Heuristic triage (no LLM)
# ---------------------------------------------------------------------------

def _heuristic_triage(findings: list[EngineFinding]) -> list[EngineFinding]:
    """
    Tag findings with needs_review or false_positive_likely using local rules.
    Never marks anything as 'verified'.
    """
    for f in findings:
        if f.verification_status != "unverified":
            continue  # already processed

        blob = f"{f.title} {f.vuln_type} {f.code_snippet} {f.source} {f.sink}".lower()

        # Heuristic: injection candidate with both source AND sink proven → needs_review
        if ("injection" in blob or "sqli" in blob or "command" in blob) and f.source and f.sink:
            f.verification_status = "needs_review"
            continue

        # Heuristic: no source proved for injection → lower confidence, likely FP
        if ("injection" in blob or "xss" in blob or "ssrf" in blob) and not f.source:
            f.confidence = min(f.confidence, 0.55)
            f.verification_status = "false_positive_likely"
            continue

        # Heuristic: localhost / test URLs in secrets
        if f.scan_category == "Secret scan":
            ev = (f.evidence or "").lower()
            if any(tok in ev for tok in ["localhost", "127.0.0.1", "example.com", "test"]):
                f.confidence = min(f.confidence, 0.40)
                f.verification_status = "false_positive_likely"
                continue

        # Default: leave as needs_review
        f.verification_status = "needs_review"

    return findings


# ---------------------------------------------------------------------------
# LLM triage (Groq / OpenAI-compatible)
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = (
    "You are an expert security code reviewer. "
    "Analyse the provided finding and code snippet, then respond ONLY with a JSON object "
    "in the following format:\n"
    '{\n'
    '  "is_false_positive": false,\n'
    '  "confidence_delta": 0.0,\n'
    '  "verification_status": "needs_review",\n'
    '  "explanation": "...",\n'
    '  "remediation": "...",\n'
    '  "pentest_hint": "..."\n'
    '}\n\n'
    "Rules:\n"
    "- confidence_delta must be between -0.30 and +0.10.\n"
    "- verification_status must be one of: needs_review, false_positive_likely.\n"
    "  Do NOT use 'verified' – that requires live external confirmation.\n"
    "- pentest_hint must describe only authorised, safe verification steps.\n"
    "- Respond with raw JSON only, no markdown fences."
)


def _build_user_message(f: EngineFinding) -> str:
    snippet = (f.code_snippet or f.evidence or "")[:_SNIPPET_LIMIT]
    return (
        f"Rule: {f.rule_id}\n"
        f"Title: {f.title}\n"
        f"CWE: {f.cwe_id}  OWASP: {f.owasp_category}\n"
        f"Severity: {f.severity}  Confidence: {f.confidence:.2f}\n"
        f"File: {f.file_path}  Lines: {f.line_start}-{f.line_end}\n"
        f"Source: {f.source or 'unknown'}  →  Sink: {f.sink or 'unknown'}\n\n"
        f"Code snippet:\n```\n{snippet}\n```\n\n"
        f"Evidence (redacted): {f.evidence or 'n/a'}"
    )


def _call_llm(user_msg: str) -> dict | None:
    base_url = (settings.llm_base_url or "https://api.openai.com/v1").rstrip("/")
    api_key = settings.llm_api_key
    model = settings.llm_model

    try:
        resp = httpx.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}",
                     "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_msg},
                ],
                "temperature": 0.1,
                "max_tokens": 400,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
        # Strip markdown fences if model adds them
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        return json.loads(content)
    except Exception as exc:
        logger.debug("LLM triage call failed: %s", exc)
        return None


def _llm_triage(findings: list[EngineFinding]) -> list[EngineFinding]:
    """Send up to _LLM_TRIAGE_LIMIT candidates to LLM for triage."""
    # Prioritise high-confidence, high-severity findings for LLM review
    candidates = sorted(
        [f for f in findings if f.verification_status == "unverified"],
        key=lambda f: (-{"Critical": 4, "High": 3, "Medium": 2, "Low": 1}.get(f.severity, 0), -f.confidence),
    )[:_LLM_TRIAGE_LIMIT]

    for f in candidates:
        verdict = _call_llm(_build_user_message(f))
        if verdict is None:
            f.verification_status = "needs_review"
            continue

        # Apply confidence delta (clamped)
        delta = float(verdict.get("confidence_delta", 0.0))
        delta = max(-0.30, min(0.10, delta))
        f.confidence = max(0.0, min(1.0, f.confidence + delta))

        status = verdict.get("verification_status", "needs_review")
        if status not in {"needs_review", "false_positive_likely"}:
            status = "needs_review"
        f.verification_status = status

        # Use LLM-provided explanations if they are non-empty
        if verdict.get("explanation"):
            f.why_vulnerable = verdict["explanation"]
        if verdict.get("remediation"):
            f.remediation = verdict["remediation"]
        if verdict.get("pentest_hint"):
            f.pentest_hint = verdict["pentest_hint"]

    # Findings NOT sent to LLM get heuristic triage
    not_triaged = [f for f in findings if f.verification_status == "unverified"]
    _heuristic_triage(not_triaged)

    return findings


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_ai_triage(findings: list[EngineFinding], _source_dir: Path | None = None) -> list[EngineFinding]:
    """
    Post-scan triage. Receives all candidate findings, returns enriched list.
    Findings are never deleted – only confidence and verification_status are updated.
    """
    if not findings:
        return findings

    if settings.llm_api_key:
        logger.info("AI triage: using LLM (%s/%s) for up to %d findings",
                    settings.llm_provider, settings.llm_model, _LLM_TRIAGE_LIMIT)
        return _llm_triage(findings)

    logger.info("AI triage: no LLM key configured, running heuristic triage only")
    return _heuristic_triage(findings)
