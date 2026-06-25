import json
import threading
from collections import Counter
from datetime import datetime
from io import BytesIO
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
    ScanCreateRequest,
    ScanDetailResponse,
    ScanSummaryResponse,
    UploadCompleteRequest,
    UploadInitRequest,
    UploadInitResponse,
)
from app.services.report_exporter import export_json, export_pdf, export_sarif
from app.services.security import validate_captcha
from app.services.storage import create_upload_url, object_exists, put_object
from app.worker.tasks import execute_scan, run_scan

router = APIRouter()


def _queue_scan(payload: ScanCreateRequest, db: Session) -> ScanSummaryResponse:
    if payload.sourceType == "repo_url" and not payload.sourceValue.startswith(("https://github.com/", "http://github.com/")):
        raise HTTPException(status_code=400, detail="Only public GitHub repository URLs are supported")

    scan = Scan(source_type=payload.sourceType, source_value=payload.sourceValue)
    db.add(scan)
    db.commit()
    db.refresh(scan)

    if settings.scan_worker_mode.lower() == "celery":
        run_scan.delay(scan.id)
    elif settings.scan_worker_mode.lower() == "inline":
        execute_scan(scan.id)
    else:
        threading.Thread(target=execute_scan, args=(scan.id,), daemon=True).start()

    return ScanSummaryResponse(
        id=scan.id,
        status=scan.status,
        riskLevel=scan.risk_level,
        riskPercent=scan.risk_percent,
    )


@router.get("/scans")
def list_scans(limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)):
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
    _ = request
    return _queue_scan(payload, db)


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

    return {
        "uploadId": upload.id,
        "objectKey": upload.object_key,
        "uploadUrl": upload_url,
        "status": upload.status,
    }


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


@router.post("/uploads/{upload_id}/data")
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


@router.get("/scans/{scan_id}/findings")
def list_findings(
    scan_id: str,
    severity: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    query = select(Finding).where(Finding.scan_id == scan.id)
    if severity:
        query = query.where(Finding.severity == severity)

    records = db.scalars(query).all()
    return {
        "scanId": scan.id,
        "count": len(records),
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
            }
            for item in records
        ],
    }


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

    introduced = list(current_keys - base_keys)
    fixed = list(base_keys - current_keys)

    return {
        "baseScanId": base.id,
        "targetScanId": current.id,
        "introducedCount": len(introduced),
        "fixedCount": len(fixed),
        "riskDelta": current.risk_percent - base.risk_percent,
    }


@router.get("/scans/{scan_id}/export")
def export_scan(scan_id: str, format: str = Query(default="json"), db: Session = Depends(get_db)):
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


@router.post("/scans/{scan_id}/badge/publish")
def publish_badge(scan_id: str, db: Session = Depends(get_db)):
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")

    badge = PublicBadge(scan_id=scan.id)
    db.add(badge)
    db.commit()
    db.refresh(badge)

    return {
        "scanId": scan.id,
        "token": badge.token,
        "publicUrl": f"/public/scan/{badge.token}",
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


@router.post("/scan")
async def ci_scan(request: Request, payload: ScanCreateRequest, db: Session = Depends(get_db)):
    _ = request
    return _queue_scan(payload, db)

@router.post("/scan/{scan_id}/trigger")
def trigger_existing_scan(scan_id: str, db: Session = Depends(get_db)):
    scan = db.get(Scan, scan_id)
    if scan is None:
        raise HTTPException(status_code=404, detail="Scan not found")
        
    if settings.scan_worker_mode.lower() == "celery":
        run_scan.delay(scan.id)
    elif settings.scan_worker_mode.lower() == "inline":
        execute_scan(scan.id)
    else:
        threading.Thread(target=execute_scan, args=(scan.id,), daemon=True).start()
        
    return {"status": "accepted", "scanId": scan.id}
