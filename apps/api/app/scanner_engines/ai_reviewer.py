import json
import os
from typing import List, Dict, Any

class AIReviewer:
    def __init__(self):
        self.api_key = os.getenv("LLM_API_KEY")
        self.enabled = os.getenv("AI_REVIEW_ENABLED", "false").lower() == "true"

    def review_findings(self, findings: List[Dict[Any, Any]], code_content: str) -> List[Dict[Any, Any]]:
        if not self.enabled or not self.api_key:
            # Fallback to local heuristic triage if AI is disabled or no key
            return self._heuristic_triage(findings)

        # In a real implementation, this would call OpenAI or Groq API
        # to analyze the finding in the context of the code_content.
        # For now, we simulate AI review.
        for finding in findings:
            if "AWS Access Key" in finding["title"]:
                finding["pentest_hint"] = "[AI Generated] Use aws sts get-caller-identity to verify this token."
                finding["verification_status"] = "needs_review"
            
            # Simulated false positive reduction
            if "example.com" in finding.get("evidence_redacted", ""):
                finding["verification_status"] = "false_positive_likely"
                finding["confidence"] = "low"
                
        return findings

    def _heuristic_triage(self, findings: List[Dict[Any, Any]]) -> List[Dict[Any, Any]]:
        # Basic heuristic
        for finding in findings:
            if finding["verification_status"] == "unverified":
                finding["verification_status"] = "needs_review"
                
            # If it's a test file, it's likely a false positive
            file_path = finding.get("file_path", "").lower()
            if "test" in file_path or "mock" in file_path:
                finding["confidence"] = "low"
                finding["verification_status"] = "false_positive_likely"
                
        return findings
