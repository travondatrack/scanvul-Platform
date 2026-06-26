"""
ScanVul AI — Scan API endpoints (FastAPI /api/v1)

Unified contract:
  POST   /scans                        Create + queue a new scan (authenticated / CI)
  POST   /scans/guest                  Guest scan (rate-limited, no auth required)
  POST   /scans/{scan_id}/trigger      Trigger an existing scan record
  POST   /scan/{scan_id}/trigger       Alias for backward compatibility
  GET    /scans                        List recent scans
  GET    /scans/{scan_id}              Full scan detail with findings
  GET    /scans/{scan_id}/status       Lightweight status for polling
  GET    /scans/{scan_id}/findings     Paginated findings
  GET    /scans/{scan_id}/heatmap      File hotspot map
  GET    /scans/{scan_id}/compare/{base_scan_id}  Diff two scans
  GET    /scans/{scan_id}/export       Export JSON / SARIF / PDF
  POST   /scans/{scan_id}/badge/publish  Publish public badge
  GET    /public/scan/{token}          Public badge view (no auth)
  POST   /scan                         CI alias → same as POST /scans
  POST   /uploads/init                 Init multipart upload
  PUT    /uploads/{upload_id}/data     Upload archive bytes
  POST   /uploads/complete             Mark upload complete
"""

import json
import threading
from collections import Counter
from datetime import datetime
from io import BytesIO
import logging
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.scan import Finding, PublicBadge, Scan, UploadedAsset
from app.schemas.scan import (
    GuestScanRequest,
    GuestScanResponse,
    ScanCreateRequest,
    ScanDetailResponse,
    ScanStatusResponse,
    ScanSummaryResponse,
    TriggerResponse,
    UploadCompleteRequest,
    UploadInitRequest,
    UploadInitResponse,
)
from app.services.report_exporter import export_json, export_pdf, export_sarif
from app.services.security import validate_captcha
from app.services.source_ingestion import validate_repo_url
from app.services.storage import create_upload_url, object_exists, put_object
from app.worker.tasks import execute_scan, run_scan

router = APIRouter()
logger = logging.getLogger(__name__)

# ─── Allowed scan statuses ───────────────────────────────────────────────────

TERMINAL_STATUSES = {"completed", "failed"}
RUNNING_STATUS = "running"
QUEUED_STATUS = "queued"


# ─── Internal helpers ─────────────────────────────────────────────────────────

def _validate_source(source_type: str, source_value: str) -> None:
    """Validate sourceType/sourceValue before creating a scan record."""
    if not source_value or not source_value.strip():
        raise HTTPException(status_code=400, detail="sourceValue must not be empty")

    if source_type == "repo_url":
        try:
            validate_repo_url(source_value)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    max_bytes = settings.scan_source_max_bytes
    if len(source_value.encode()) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"sourceValue exceeds maximum size of {max_bytes // 1024 // 1024} MB",
        )


def _dispatch_worker(scan_id: str) -> None:
    """Start scan execution via configured worker mode."""
    mode = settings.scan_worker_mode.lower()
    if mode == "celery":
        run_scan.delay(scan_id)
    elif mode == "inline":
        execute_scan(scan_id)
    else:
        threading.Thread(target=execute_scan, args=(scan_id,), daemon=True).start()


def _queue_scan(payload: ScanCreateRequest, db: Session) -> ScanSummaryResponse:
    """Create a Scan record and dispatch the worker. Used by auth + CI endpoints."""
    _validate_source(payload.sourceType, payload.sourceValue)

    scan = Scan(source_type=payload.sourceType, source_value=payload.sourceValue)
    db.add(scan)
    db.commit()
    db.refresh(scan)

    _dispatch_worker(scan.id)
    logger.info("Scan %s created and dispatched (sourceType=%s)", scan.id, payload.sourceType)

    return ScanSummaryResponse(
        id=scan.id,
        status=scan.status,
        riskLevel=scan.risk_level,
        riskPercent=scan.risk_percent,
    )


def _serialize_finding(item: Finding) -> dict:
    """Serialize a Finding DB model to a full dict for API responses."""
    return {
        "id": item.id,
        "engine": item.engine,
        "ruleId": item.rule_id,
        "scanCategory": item.scan_category,
        "title": item.title,
        "vulnType": item.vuln_type,
        "severity": item.severity,
        "cvss4": item.cvss4_score,
        "confidence": item.confidence,
        "cweId": item.cwe_id,
        "owaspCategory": item.owasp_category,
        # Location
        "filePath": item.file_path,
        "lineNumber": item.line_number,
        "lineStart": item.line_start or item.line_number,
        "lineEnd": item.line_end or item.line_number,
        # Dataflow
        "source": item.source,
        "sink": item.sink,
        "functionName": item.function_name,
        "dataflowTrace": item.dataflow_trace or "",
        # Evidence & explanation (evidence is already redacted)
        "evidence": item.evidence or "",
        "codeSnippet": item.code_snippet,
        "whyVulnerable": item.why_vulnerable,
        "attackScenario": item.attack_scenario,
        "impact": item.impact or "",
        "poc": item.poc,
        "remediation": item.remediation,
        "secureExample": item.secure_example,
        "pentestHint": item.pentest_hint or "",
        "references": item.references or "",
        # Triage
        "verificationStatus": item.verification_status or "unverified",
        "dedupeHash": item.dedupe_hash or "",
    }


# ─── List / Create ────────────────────────────────────────────────────────────

@router.get("/scans")
def list_scans(
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    scans = db.scalars(select(Scan).order_by(desc(Scan.created_at)).limit(limit)).all()
    return {
        "items": [
            {
                "id": scan.id,
                "status": scan.status,
                "riskLevel": scan.risk_level,
                "riskPercent": scan.risk_percent,
                "createdAt": scan.created_at.isoformat(),
            }
            for scan in scans
        ]
    }


@router.post("/scans", response_model=ScanSummaryResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def create_scan(
    request: Request,
    payload: ScanCreateRequest,
    _captcha: None = Depends(validate_captcha),
    db: Session = Depends(get_db),
):
    """Create + queue a new scan. Used by authenticated dashboard and CI pipeline."""
    _ = request
    return _queue_scan(payload, db)


# ─── Guest scan ───────────────────────────────────────────────────────────────

# In-memory rate limit store for guest scans (per IP, resets hourly)
# In production, replace with Redis-backed store.
_guest_rate_store: dict[str, dict] = {}


def _check_guest_rate_limit(ip: str, max_per_hour: int = 5) -> int:
    """
    Check and update in-memory rate limit for guest scans.
    Returns the number of requests remaining (0 means limit reached).
    Raises HTTPException 429 if limit exceeded.
    """
    import time
    now = time.time()
    entry = _guest_rate_store.get(ip)

    if entry is None or now > entry["expires_at"]:
        entry = {"count": 0, "expires_at": now + 3600}
    entry["count"] += 1
    _guest_rate_store[ip] = entry

    remaining = max_per_hour - entry["count"]
    if remaining < 0:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Maximum {max_per_hour} guest scans per hour.",
            headers={"Retry-After": "3600"},
        )
    return remaining


@router.post("/scans/guest", response_model=GuestScanResponse)
async def guest_scan(request: Request, payload: GuestScanRequest, db: Session = Depends(get_db)):
    """
    Unauthenticated guest scan endpoint.
    FastAPI creates + triggers the scan entirely — no Prisma/MySQL involvement.
    Rate limited to 5 scans/hour per IP.
    """
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or "unknown"
    )
    remaining = _check_guest_rate_limit(ip)

    source_value = payload.resolved_source_value()
    if not source_value:
        raise HTTPException(status_code=400, detail="sourceValue or codeSnippet is required")

    max_bytes = settings.guest_scan_max_bytes
    if len(source_value.encode()) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Input exceeds maximum guest scan size of {max_bytes // 1024} KB",
        )

    if payload.sourceType == "repo_url":
        try:
            validate_repo_url(source_value)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Create scan record in FastAPI's own DB
    language_summary = json.dumps({payload.language or "unknown": 100}) if payload.sourceType == "paste" else "{}"
    scan = Scan(
        source_type=payload.sourceType,
        source_value=source_value,
        status=QUEUED_STATUS,
        language_summary=language_summary,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    logger.info("Guest scan %s created from IP %s (sourceType=%s)", scan.id, ip, payload.sourceType)

    # Dispatch — errors here update scan to failed so it doesn't hang
    try:
        _dispatch_worker(scan.id)
    except Exception as exc:
        logger.exception("Failed to dispatch guest scan %s: %s", scan.id, exc)
        scan.status = "failed"
        db.commit()
        raise HTTPException(status_code=503, detail="Scan engine unavailable. Please try again later.") from exc

    return GuestScanResponse(
        message="Scan queued successfully",
        scanId=scan.id,
        remainingQuota=remaining,
    )


# ─── Scan detail & status ─────────────────────────────────────────────────────

@router.get("/scans/{scan_id}/status", response_model=ScanStatusResponse)
def get_scan_status(scan_id: str, db: Session = Depends(get_db)):
    """
    Lightweight status endpoint for UI polling.
    Returns only id/status/riskLevel/riskPercent/updatedAt — no findings payload.
    """
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
    return ScanStatusResponse(
        id=scan.id,
        status=scan.status,
        riskLevel=scan.risk_level,
        riskPercent=scan.risk_percent,
        updatedAt=scan.updated_at.isoformat(),
    )


@router.get("/scans/{scan_id}", response_model=ScanDetailResponse)
def get_scan(scan_id: str, db: Session = Depends(get_db)):
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    findings = db.scalars(select(Finding).where(Finding.scan_id == scan.id)).all()

    return ScanDetailResponse(
        id=scan.id,
        status=scan.status,
        riskLevel=scan.risk_level,
        riskPercent=scan.risk_percent,
        languageSummary=json.loads(scan.language_summary or "{}"),
        frameworkSummary=json.loads(scan.framework_summary or "{}"),
        findings=[_serialize_finding(item) for item in findings],
    )


# ─── Trigger existing scan ────────────────────────────────────────────────────

def _do_trigger(scan_id: str, db: Session) -> TriggerResponse:
    """
    Shared trigger logic used by both plural and legacy singular endpoints.

    Idempotency rules:
    - status=running  → 409 (already running, do not double-execute)
    - status=queued   → 202 (dispatch again in case worker dropped it)
    - status=completed / failed → re-trigger (retry)
    - scan not found  → 404
    """
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    if scan.status == RUNNING_STATUS:
        raise HTTPException(
            status_code=409,
            detail="Scan is already running. Wait for it to complete before re-triggering.",
        )

    action_msg = "accepted"
    if scan.status in TERMINAL_STATUSES:
        action_msg = "retrying"
        # Reset status to queued before re-dispatching
        scan.status = QUEUED_STATUS
        db.commit()

    try:
        _dispatch_worker(scan.id)
    except Exception as exc:
        logger.exception("Failed to dispatch scan %s: %s", scan_id, exc)
        scan.status = "failed"
        db.commit()
        raise HTTPException(status_code=503, detail="Scan engine unavailable. Please try again later.") from exc

    logger.info("Scan %s triggered (action=%s)", scan_id, action_msg)
    return TriggerResponse(
        status=action_msg,
        scanId=scan_id,
        message=f"Scan {action_msg}. Worker dispatched.",
    )


@router.post("/scans/{scan_id}/trigger", response_model=TriggerResponse)
def trigger_scan(scan_id: str, db: Session = Depends(get_db)):
    """
    Trigger an existing scan record (plural URL — canonical style).
    Called by Next.js after creating a Scan record via Prisma.
    """
    return _do_trigger(scan_id, db)


@router.post("/scan/{scan_id}/trigger", response_model=TriggerResponse)
def trigger_scan_legacy(scan_id: str, db: Session = Depends(get_db)):
    """
    Legacy singular-URL alias kept for backward compatibility.
    Delegates to the same logic as the canonical plural endpoint.
    """
    return _do_trigger(scan_id, db)


# ─── Findings ─────────────────────────────────────────────────────────────────

@router.get("/scans/{scan_id}/findings")
def list_findings(
    scan_id: str,
    severity: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    query = select(Finding).where(Finding.scan_id == scan.id)
    if severity:
        query = query.where(Finding.severity == severity.lower())
    if status:
        query = query.where(Finding.status == status)

    total = db.scalar(select(Finding).where(Finding.scan_id == scan.id).with_only_columns(Finding.id).order_by(None).subquery().c.id.count()) or 0
    records = db.scalars(query.offset((page - 1) * page_size).limit(page_size)).all()

    return {
        "scanId": scan.id,
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": max(1, -(-total // page_size)),  # ceiling division
        "items": [
            {
                "id": item.id,
                "severity": item.severity,
                "ruleId": item.rule_id,
                "scanCategory": item.scan_category,
                "title": item.title,
                "type": item.vuln_type,
                "cweId": item.cwe_id,
                "source": item.source,
                "sink": item.sink,
                "file": item.file_path,
                "lineStart": item.line_start or item.line_number,
                "lineEnd": item.line_end or item.line_number,
                "cvss4": item.cvss4_score,
                "confidence": item.confidence,
                "verificationStatus": item.verification_status or "unverified",
                "impact": item.impact or "",
                "pentestHint": item.pentest_hint or "",
                "status": item.status,
            }
            for item in records
        ],
    }


# ─── Heatmap & Compare ────────────────────────────────────────────────────────

@router.get("/scans/{scan_id}/heatmap")
def get_heatmap(scan_id: str, db: Session = Depends(get_db)):
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    findings = db.scalars(select(Finding).where(Finding.scan_id == scan.id)).all()
    counter = Counter(item.file_path for item in findings)
    return {
        "scanId": scan.id,
        "files": [{"file": file_path, "count": count} for file_path, count in counter.items()],
    }


@router.get("/scans/{scan_id}/compare/{base_scan_id}")
def compare_scans(scan_id: str, base_scan_id: str, db: Session = Depends(get_db)):
    current = db.get(Scan, scan_id)
    base = db.get(Scan, base_scan_id)
    if current is None or base is None:
        raise HTTPException(status_code=404, detail="One of the scans was not found")

    current_findings = db.scalars(select(Finding).where(Finding.scan_id == current.id)).all()
    base_findings = db.scalars(select(Finding).where(Finding.scan_id == base.id)).all()

    current_keys = {(item.vuln_type, item.file_path, item.line_start or item.line_number) for item in current_findings}
    base_keys = {(item.vuln_type, item.file_path, item.line_start or item.line_number) for item in base_findings}

    return {
        "baseScanId": base.id,
        "targetScanId": current.id,
        "introducedCount": len(current_keys - base_keys),
        "fixedCount": len(base_keys - current_keys),
        "riskDelta": current.risk_percent - base.risk_percent,
    }


# ─── Export ───────────────────────────────────────────────────────────────────

@router.get("/scans/{scan_id}/export")
def export_scan(
    scan_id: str,
    format: str = Query(default="json", regex="^(json|sarif|pdf)$"),
    db: Session = Depends(get_db),
):
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    findings = db.scalars(select(Finding).where(Finding.scan_id == scan.id)).all()

    if format == "json":
        content = export_json(scan, findings)
        media_type = "application/json"
        filename = f"scan-{scan_id}.json"
    elif format == "sarif":
        content = export_sarif(scan, findings)
        media_type = "application/json"
        filename = f"scan-{scan_id}.sarif"
    elif format == "pdf":
        content = export_pdf(scan, findings)
        media_type = "application/pdf"
        filename = f"scan-{scan_id}.pdf"
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")

    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── Public badge ─────────────────────────────────────────────────────────────

@router.post("/scans/{scan_id}/badge/publish")
def publish_badge(scan_id: str, db: Session = Depends(get_db)):
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    if scan.status != "completed":
        raise HTTPException(status_code=400, detail="Badge can only be published for completed scans")

    # Deactivate any existing active badges
    existing = db.scalars(select(PublicBadge).where(PublicBadge.scan_id == scan_id)).all()
    for badge in existing:
        badge.is_active = "false"
    db.flush()

    badge = PublicBadge(scan_id=scan.id)
    db.add(badge)
    db.commit()
    db.refresh(badge)

    return {
        "scanId": scan.id,
        "token": badge.token,
        "publicUrl": f"/api/v1/public/scan/{badge.token}",
        "expiresAt": badge.expires_at.isoformat(),
    }


@router.get("/public/scan/{token}")
def public_scan(token: str, db: Session = Depends(get_db)):
    badge = db.scalar(select(PublicBadge).where(PublicBadge.token == token))
    if badge is None or badge.is_active != "true":
        raise HTTPException(status_code=404, detail="Public scan not found")
    if badge.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Badge expired")

    scan = db.get(Scan, badge.scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    findings = db.scalars(select(Finding).where(Finding.scan_id == scan.id)).all()
    return {
        "scanId": scan.id,
        "status": scan.status,
        "riskLevel": scan.risk_level,
        "riskPercent": scan.risk_percent,
        "findingsCount": len(findings),
    }


# ─── CI / Legacy aliases ──────────────────────────────────────────────────────

@router.post("/scan", response_model=ScanSummaryResponse)
async def ci_scan(request: Request, payload: ScanCreateRequest, db: Session = Depends(get_db)):
    """CI pipeline alias — identical to POST /scans."""
    _ = request
    return _queue_scan(payload, db)


# ─── Upload flow ──────────────────────────────────────────────────────────────

@router.post("/uploads/init", response_model=UploadInitResponse)
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def init_upload(
    request: Request,
    payload: UploadInitRequest,
    _captcha: None = Depends(validate_captcha),
    db: Session = Depends(get_db),
):
    _ = request
    if payload.size > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Upload exceeds max size")

    lowered = payload.fileName.lower()
    if not (lowered.endswith(".zip") or lowered.endswith(".tar.gz") or lowered.endswith(".tgz")):
        raise HTTPException(status_code=400, detail="Only .zip or .tar.gz archives are supported")

    safe_name = os.path.basename(payload.fileName)
    object_key = f"uploads/{uuid4()}-{safe_name}"
    upload = UploadedAsset(file_name=safe_name, object_key=object_key, size_bytes=payload.size)
    db.add(upload)
    db.commit()
    db.refresh(upload)

    upload_url = create_upload_url(object_key)
    return {"uploadId": upload.id, "objectKey": upload.object_key, "uploadUrl": upload_url, "status": upload.status}


@router.put("/uploads/{upload_id}/data")
@limiter.limit(f"{settings.rate_limit_per_minute}/minute")
async def upload_archive_data(
    request: Request,
    upload_id: str,
    archive: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    _ = request
    upload = db.get(UploadedAsset, upload_id)
    if upload is None:
        raise HTTPException(status_code=404, detail="Upload not found")
    if upload.status == "completed":
        raise HTTPException(status_code=409, detail="Upload already completed")

    content = await archive.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="Upload exceeds max size")

    put_object(upload.object_key, content)
    upload.status = "uploaded"
    db.commit()
    return {"uploadId": upload.id, "status": upload.status}


@router.post("/uploads/complete")
def complete_upload(payload: UploadCompleteRequest, db: Session = Depends(get_db)):
    upload = db.get(UploadedAsset, payload.uploadId)
    if upload is None:
        raise HTTPException(status_code=404, detail="Upload not found")
    if not object_exists(upload.object_key):
        raise HTTPException(status_code=400, detail="Uploaded object not found in storage")

    upload.status = "completed"
    db.commit()
    return {"uploadId": upload.id, "status": upload.status}
