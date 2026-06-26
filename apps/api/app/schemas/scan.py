from typing import Literal, Optional

from pydantic import BaseModel, Field


# ─── Request schemas ────────────────────────────────────────────────────────

class ScanCreateRequest(BaseModel):
    """Used by authenticated users and CI alias to create + queue a scan."""
    sourceType: Literal["repo_url", "archive", "paste"]
    sourceValue: str = Field(min_length=1)


class GuestScanRequest(BaseModel):
    """
    Used by the guest (unauthenticated) scan endpoint.
    Accepts paste or repo_url only; archive requires auth (upload flow).
    """
    sourceType: Literal["paste", "repo_url"] = "paste"
    # Unified field — callers may also use codeSnippet for backward compat
    sourceValue: Optional[str] = None
    codeSnippet: Optional[str] = None  # alias for paste sourceValue
    language: Optional[str] = None     # hint stored in languageSummary

    def resolved_source_value(self) -> str:
        """Return the canonical source value from either field."""
        return (self.sourceValue or self.codeSnippet or "").strip()


class UploadInitRequest(BaseModel):
    fileName: str = Field(min_length=1, max_length=255)
    size: int = Field(gt=0)


class UploadCompleteRequest(BaseModel):
    uploadId: str = Field(min_length=1)


# ─── Response schemas ────────────────────────────────────────────────────────

class ScanSummaryResponse(BaseModel):
    id: str
    status: str
    riskLevel: str
    riskPercent: float


class ScanStatusResponse(BaseModel):
    """Lightweight status response for polling — avoids sending full findings."""
    id: str
    status: str
    riskLevel: str
    riskPercent: float
    updatedAt: str


class TriggerResponse(BaseModel):
    """Returned when triggering an existing scan."""
    status: str   # "accepted" | "already_running" | "retrying"
    scanId: str
    message: str


class GuestScanResponse(BaseModel):
    """Returned after creating a guest scan."""
    message: str
    scanId: str
    remainingQuota: int


class UploadInitResponse(BaseModel):
    uploadId: str
    objectKey: str
    uploadUrl: str
    status: str


class FindingResponse(BaseModel):
    id: str
    engine: str
    ruleId: str
    scanCategory: str
    title: str
    vulnType: str
    severity: str
    cvss4: float
    confidence: float
    cweId: str
    owaspCategory: str

    # Location
    filePath: str
    lineNumber: int
    lineStart: int
    lineEnd: int

    # Dataflow
    source: str
    sink: str
    functionName: str
    dataflowTrace: str

    # Evidence & explanation
    evidence: str          # redacted match – never raw credentials
    codeSnippet: str
    whyVulnerable: str
    attackScenario: str
    impact: str
    poc: str
    remediation: str
    secureExample: str
    pentestHint: str       # authorized safe verification steps
    references: str        # newline-separated CWE/OWASP/vendor links

    # Triage
    verificationStatus: str
    dedupeHash: str


class ScanDetailResponse(ScanSummaryResponse):
    languageSummary: dict
    frameworkSummary: dict
    findings: list[FindingResponse]
