import json

from app.db.session import SessionLocal
from app.models.scan import Finding, Scan, UploadedAsset
from app.services.source_ingestion import cleanup_source, ingest_source
from app.services.scanner_orchestrator import run_hybrid_scan
from app.worker.celery_app import celery_app


@celery_app.task(name="scan.run")
def run_scan(scan_id: str) -> str:
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

        db.query(Finding).filter(Finding.scan_id == scan.id).delete()

        for item in findings:
            db.add(
                Finding(
                    scan_id=scan.id,
                    engine=item.engine,
                    title=item.title,
                    vuln_type=item.vuln_type,
                    severity=item.severity,
                    cvss4_score=item.cvss4_score,
                    confidence=item.confidence,
                    cwe_id=item.cwe_id,
                    owasp_category=item.owasp_category,
                    file_path=item.file_path,
                    line_number=item.line_number,
                    code_snippet=item.code_snippet,
                    attack_scenario=item.attack_scenario,
                    poc=item.poc,
                    remediation=item.remediation,
                    secure_example=item.secure_example,
                )
            )

        scan.language_summary = json.dumps(language_summary)
        scan.framework_summary = json.dumps(framework_summary)
        scan.risk_level = risk_level
        scan.risk_percent = risk_percent
        scan.status = "completed"
        db.commit()

    except Exception:
        scan = db.get(Scan, scan_id)
        if scan is not None:
            scan.status = "failed"
            db.commit()
        raise
    finally:
        if source_dir is not None:
            cleanup_source(source_dir)
        db.close()

    return scan_id
