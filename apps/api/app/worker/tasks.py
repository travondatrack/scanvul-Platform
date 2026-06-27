import json
import logging
import time
from datetime import datetime
import socket

import redis
from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import delete
from sqlalchemy.exc import OperationalError, IntegrityError

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.scan import Finding, Scan, ScanEvent, UploadedAsset
from app.services.source_ingestion import cleanup_source, ingest_source
from app.services.scanner_orchestrator import run_hybrid_scan
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)

# Distributed lock client
_redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

class EventLogger:
    """Helper to persist progress events to the database in real-time."""
    def __init__(self, db, scan_id: str):
        self.db = db
        self.scan_id = scan_id

    def log(self, event_type: str, message: str = "") -> None:
        try:
            event = ScanEvent(scan_id=self.scan_id, event_type=event_type, message=message)
            self.db.add(event)
            self.db.commit()
            logger.info("[Scan %s] %s: %s", self.scan_id, event_type, message)
        except Exception as e:
            logger.error("Failed to log event %s for scan %s: %s", event_type, self.scan_id, e)
            self.db.rollback()


def _finding_kwargs(item) -> dict:
    """Map an EngineFinding dataclass to Finding model keyword arguments."""
    return dict(
        engine=item.engine,
        rule_id=item.rule_id,
        scan_category=item.scan_category,
        title=item.title,
        vuln_type=item.vuln_type,
        severity=item.severity,
        cvss4_score=item.cvss4_score,
        confidence=item.confidence,
        cwe_id=item.cwe_id,
        owasp_category=item.owasp_category,
        file_path=item.file_path,
        line_number=item.line_start or item.line_number,
        line_start=item.line_start,
        line_end=item.line_end,
        source=item.source,
        sink=item.sink,
        function_name=item.function_name,
        dataflow_trace=item.dataflow_trace,
        evidence=item.evidence,
        code_snippet=item.code_snippet,
        why_vulnerable=item.why_vulnerable,
        attack_scenario=item.attack_scenario,
        impact=item.impact,
        poc=item.poc,
        remediation=item.remediation,
        secure_example=item.secure_example,
        pentest_hint=item.pentest_hint,
        references=item.references,
        code_link=item.code_link,
        verification_status=item.verification_status,
        dedupe_hash=item.dedupe_hash,
    )


def _delete_findings_safe(db, scan_id: str, max_retries: int = 3) -> None:
    """
    Delete findings for a scan with deadlock retry logic.
    MySQL InnoDB can deadlock on bulk DELETE with FK constraints.
    """
    for attempt in range(max_retries):
        try:
            db.execute(delete(Finding).where(Finding.scan_id == scan_id))
            db.flush()
            return
        except Exception as exc:
            err_str = str(exc)
            if "1213" in err_str or "Deadlock" in err_str:
                if attempt < max_retries - 1:
                    wait = 0.5 * (2 ** attempt)
                    logger.warning(
                        "Deadlock on findings DELETE for scan %s (attempt %d/%d), retrying in %.1fs",
                        scan_id, attempt + 1, max_retries, wait,
                    )
                    db.rollback()
                    time.sleep(wait)
                else:
                    raise
            else:
                raise


def execute_scan(scan_id: str) -> str:
    """Core execution logic with distributed lock, events, and safe cleanup."""
    lock_name = f"scanvul:lock:scan:{scan_id}"
    lock = _redis_client.lock(lock_name, timeout=630)  # 10m30s to match celery hard limit

    # Use blocking=False to immediately return if already running elsewhere
    if not lock.acquire(blocking=False):
        logger.warning("Scan %s is already locked and running in another worker.", scan_id)
        return scan_id

    db = SessionLocal()
    source_dir = None
    event_logger = EventLogger(db, scan_id)
    start_time = datetime.utcnow()

    try:
        scan = db.get(Scan, scan_id)
        if scan is None:
            logger.warning("Scan %s not found in DB.", scan_id)
            return scan_id

        scan.status = "running"
        scan.started_at = start_time
        scan.worker_id = socket.gethostname()
        scan.error_message = None
        db.commit()

        event_logger.log("ingest_started", f"Ingesting source: {scan.source_type}")

        upload_asset = None
        if scan.source_type == "archive":
            upload_asset = db.get(UploadedAsset, scan.source_value)

        source_dir = ingest_source(scan.source_type, scan.source_value, upload_asset)
        
        # Inject log_event callback to track progress across engines
        findings, language_summary, framework_summary, risk_level, risk_percent = run_hybrid_scan(
            source_dir, 
            source_type=scan.source_type,
            source_value=scan.source_value,
            log_event=event_logger.log
        )

        event_logger.log("findings_saving", "Processing findings and tracking history...")
        
        old_findings_map = {}
        if scan.project_id:
            from sqlalchemy import select
            # Get all findings for this project (excluding current scan if retrying)
            # We keep the latest status seen for each dedupe_hash
            prev_findings = db.execute(
                select(Finding).where(Finding.project_id == scan.project_id, Finding.scan_id != scan.id)
            ).scalars().all()
            for pf in prev_findings:
                old_findings_map[pf.dedupe_hash] = {
                    "status": pf.status,
                    "assignee_id": pf.assignee_id,
                    "verification_status": pf.verification_status,
                }

        _delete_findings_safe(db, scan.id)

        # Bulk-insert
        batch_size = 200
        for i in range(0, len(findings), batch_size):
            batch = findings[i: i + batch_size]
            db_findings = []
            events_to_create = []
            
            for item in batch:
                kwargs = _finding_kwargs(item)
                kwargs["project_id"] = scan.project_id
                
                old = old_findings_map.get(item.dedupe_hash)
                if old:
                    kwargs["assignee_id"] = old["assignee_id"]
                    kwargs["verification_status"] = old["verification_status"]
                    old_status = old["status"]
                    
                    if old_status == "fixed":
                        kwargs["status"] = "reopened"
                        # Event will be created after flush so we have the finding ID
                        events_to_create.append({
                            "type": "reopened",
                            "old": "fixed",
                            "new": "reopened",
                            "dedupe_hash": item.dedupe_hash
                        })
                    elif old_status in ["false_positive", "accepted_risk", "ignored", "in_progress", "confirmed"]:
                        kwargs["status"] = old_status
                        
                db_findings.append(Finding(scan_id=scan.id, **kwargs))
                
            db.add_all(db_findings)
            db.flush()

        end_time = datetime.utcnow()
        duration_ms = int((end_time - start_time).total_seconds() * 1000)

        scan.language_summary = json.dumps(language_summary)
        scan.framework_summary = json.dumps(framework_summary)
        scan.risk_level = risk_level
        scan.risk_percent = risk_percent
        scan.status = "completed"
        scan.completed_at = end_time
        scan.duration_ms = duration_ms
        db.commit()

        event_logger.log("completed", f"Scan finished successfully in {duration_ms}ms")
        logger.info("Scan %s completed: %d findings, risk=%s (%.1f%%)",
                    scan_id, len(findings), risk_level, risk_percent)

    except SoftTimeLimitExceeded as exc:
        msg = "Scan exceeded maximum time limit (timeout)."
        logger.error("Scan %s timeout: %s", scan_id, exc)
        db.rollback()
        _mark_scan_failed(db, scan_id, msg)
        event_logger.log("failed", msg)
        raise

    except Exception as exc:
        msg = str(exc)
        logger.exception("Scan %s failed: %s", scan_id, msg)
        db.rollback()
        _mark_scan_failed(db, scan_id, msg)
        event_logger.log("failed", msg)
        raise

    finally:
        # Cleanup temp directory even if timeout occurs
        if source_dir is not None:
            cleanup_source(source_dir)
        db.close()
        try:
            lock.release()
        except redis.exceptions.LockError:
            pass  # Lock already expired/released

    return scan_id


def _mark_scan_failed(db, scan_id: str, error_message: str) -> None:
    """Helper to safely mark a scan as failed."""
    try:
        scan = db.get(Scan, scan_id)
        if scan is not None:
            scan.status = "failed"
            scan.completed_at = datetime.utcnow()
            scan.error_message = error_message[:10000] if error_message else None
            db.commit()
    except Exception as e:
        logger.error("Could not update scan %s to failed: %s", scan_id, e)
        db.rollback()


# Configure auto-retry for transient DB errors (e.g. lost connection)
@celery_app.task(
    name="scan.run",
    bind=True,
    autoretry_for=(OperationalError,),
    retry_kwargs={"max_retries": 3, "countdown": 5},
    retry_backoff=True,
)
def run_scan(self, scan_id: str) -> str:
    return execute_scan(scan_id)


@celery_app.task(name="scan.cleanup_stale")
def cleanup_stale_scans() -> int:
    """
    Periodic task to find scans stuck in 'queued' or 'running' for too long
    and mark them as failed.
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        # Find queued scans > 3 minutes old
        stale_scans = db.query(Scan).filter(
            Scan.status == "queued"
        ).all()
        
        failed_count = 0
        for scan in stale_scans:
            if scan.created_at and (now - scan.created_at).total_seconds() > 180:
                logger.warning("Scan %s stuck in queued for > 3 minutes. Marking as failed.", scan.id)
                scan.status = "failed"
                scan.completed_at = now
                scan.error_message = "Scan timeout: Stuck in queue for more than 3 minutes."
                db.add(ScanEvent(scan_id=scan.id, event_type="failed", message=scan.error_message))
                failed_count += 1
                
        # Also clean up stuck 'running' scans > 30 mins
        stuck_running = db.query(Scan).filter(
            Scan.status == "running"
        ).all()
        
        for scan in stuck_running:
            if scan.started_at and (now - scan.started_at).total_seconds() > 1800:
                logger.warning("Scan %s stuck in running for > 30 minutes. Marking as failed.", scan.id)
                scan.status = "failed"
                scan.completed_at = now
                scan.error_message = "Scan timeout: Stuck in running for more than 30 minutes."
                db.add(ScanEvent(scan_id=scan.id, event_type="failed", message=scan.error_message))
                failed_count += 1
                
        if failed_count > 0:
            db.commit()
            
        return failed_count
    except Exception as exc:
        logger.error("Failed to cleanup stale scans: %s", exc)
        db.rollback()
        return 0
    finally:
        db.close()
