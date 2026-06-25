from typing import Literal

from pydantic import BaseModel, Field


class ScanCreateRequest(BaseModel):
    sourceType: Literal["repo_url", "archive", "paste"]
    sourceValue: str = Field(min_length=1)


class UploadInitRequest(BaseModel):
    fileName: str = Field(min_length=1, max_length=255)
    size: int = Field(gt=0)


class UploadInitResponse(BaseModel):
    uploadId: str
    objectKey: str
    uploadUrl: str
    status: str


class UploadCompleteRequest(BaseModel):
    uploadId: str = Field(min_length=1)


class FindingResponse(BaseModel):
    id: int
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
    verificationStatus: str   # unverified|verified|failed|skipped|needs_review|false_positive_likely
    dedupeHash: str


class ScanSummaryResponse(BaseModel):
    id: str
    status: str
    riskLevel: str
    riskPercent: float


class ScanDetailResponse(ScanSummaryResponse):
    languageSummary: dict
    frameworkSummary: dict
    findings: list[FindingResponse]
