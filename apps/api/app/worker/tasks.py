import json
import logging
import time

from sqlalchemy import delete

from app.db.session import SessionLocal
from app.models.scan import Finding, Scan, UploadedAsset
from app.services.source_ingestion import cleanup_source, ingest_source
from app.services.scanner_orchestrator import run_hybrid_scan
from app.worker.celery_app import celery_app

logger = logging.getLogger(__name__)


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
        # Location
        file_path=item.file_path,
        line_number=item.line_start or item.line_number,
        line_start=item.line_start,
        line_end=item.line_end,
        # Dataflow
        source=item.source,
        sink=item.sink,
        function_name=item.function_name,
        dataflow_trace=item.dataflow_trace,
        # Evidence & explanation
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
        # Triage
        verification_status=item.verification_status,
        dedupe_hash=item.dedupe_hash,
    )


def _delete_findings_safe(db, scan_id: str, max_retries: int = 3) -> None:
    """
    Delete findings for a scan with deadlock retry logic.
    MySQL InnoDB can deadlock on bulk DELETE with FK constraints when
    multiple threads scan concurrently. We retry with exponential backoff.
    """
    for attempt in range(max_retries):
        try:
            # Use Core DELETE to avoid ORM session conflicts with FK cascade
            db.execute(delete(Finding).where(Finding.scan_id == scan_id))
            db.flush()
            return
        except Exception as exc:
            err_str = str(exc)
            if "1213" in err_str or "Deadlock" in err_str:
                if attempt < max_retries - 1:
                    wait = 0.5 * (2 ** attempt)  # 0.5s, 1s, 2s
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
    db = SessionLocal()
    source_dir = None
    try:
        scan = db.get(Scan, scan_id)
        if scan is None:
            return scan_id

        scan.status = "running"
        db.commit()

        upload_asset = None
        if scan.source_type == "archive":
            upload_asset = db.get(UploadedAsset, scan.source_value)

        source_dir = ingest_source(scan.source_type, scan.source_value, upload_asset)
        findings, language_summary, framework_summary, risk_level, risk_percent = run_hybrid_scan(source_dir)

        # Delete previous findings with deadlock-safe retry
        _delete_findings_safe(db, scan.id)

        # Bulk-insert new findings in batches of 200 to avoid large transactions
        batch_size = 200
        for i in range(0, len(findings), batch_size):
            batch = findings[i: i + batch_size]
            db.add_all([Finding(scan_id=scan.id, **_finding_kwargs(item)) for item in batch])
            db.flush()

        scan.language_summary = json.dumps(language_summary)
        scan.framework_summary = json.dumps(framework_summary)
        scan.risk_level = risk_level
        scan.risk_percent = risk_percent
        scan.status = "completed"
        db.commit()

        logger.info("Scan %s completed: %d findings, risk=%s (%.1f%%)",
                    scan_id, len(findings), risk_level, risk_percent)

    except Exception as exc:
        logger.exception("Scan %s failed: %s", scan_id, exc)
        db.rollback()
        try:
            scan = db.get(Scan, scan_id)
            if scan is not None:
                scan.status = "failed"
                db.commit()
        except Exception:
            pass
        raise
    finally:
        if source_dir is not None:
            cleanup_source(source_dir)
        db.close()

    return scan_id


@celery_app.task(name="scan.run")
def run_scan(scan_id: str) -> str:
    return execute_scan(scan_id)
