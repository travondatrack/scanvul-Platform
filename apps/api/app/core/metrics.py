from prometheus_client.core import GaugeMetricFamily, CounterMetricFamily
from prometheus_client.registry import CollectorRegistry
from sqlalchemy import text
from app.db.session import SessionLocal

class ScanVulMetricsCollector:
    def collect(self):
        db = SessionLocal()
        try:
            # Total Scans by status
            scan_status_gauge = GaugeMetricFamily("scanvul_scans_total", "Total scans by status", labels=["status"])
            rows = db.execute(text("SELECT status, COUNT(*) FROM scans GROUP BY status")).fetchall()
            for status, count in rows:
                scan_status_gauge.add_metric([status], count)
            yield scan_status_gauge

            # Findings by severity
            findings_gauge = GaugeMetricFamily("scanvul_findings_total", "Total findings by severity", labels=["severity"])
            f_rows = db.execute(text("SELECT severity, COUNT(*) FROM findings GROUP BY severity")).fetchall()
            for severity, count in f_rows:
                findings_gauge.add_metric([severity], count)
            yield findings_gauge

            # Queue Depth (scans with status 'queued')
            queue_gauge = GaugeMetricFamily("scanvul_queue_depth", "Current number of queued scans")
            q_count = db.execute(text("SELECT COUNT(*) FROM scans WHERE status='queued'")).scalar()
            queue_gauge.add_metric([], q_count or 0)
            yield queue_gauge
            
        finally:
            db.close()
