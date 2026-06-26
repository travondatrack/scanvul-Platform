import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime
from sqlalchemy.exc import OperationalError
from celery.exceptions import SoftTimeLimitExceeded
import redis

# We import modules after patching where possible, but for simplicity we mock at the application level
from app.worker.tasks import execute_scan, _delete_findings_safe, EventLogger
from app.models.scan import Scan, ScanEvent

@pytest.fixture
def mock_db():
    db = MagicMock()
    # Provide a mock scan object
    mock_scan = Scan(
        id="scan-123",
        source_type="paste",
        source_value="some_code",
        status="queued"
    )
    db.get.return_value = mock_scan
    return db

@pytest.fixture
def mock_redis_lock():
    with patch("app.worker.tasks._redis_client") as mock_redis:
        mock_lock = MagicMock()
        mock_lock.acquire.return_value = True
        mock_redis.lock.return_value = mock_lock
        yield mock_lock

@pytest.fixture
def mock_dependencies():
    with patch("app.worker.tasks.SessionLocal") as mock_session_local, \
         patch("app.worker.tasks.ingest_source") as mock_ingest, \
         patch("app.worker.tasks.run_hybrid_scan") as mock_run_scan, \
         patch("app.worker.tasks.cleanup_source") as mock_cleanup, \
         patch("app.worker.tasks._delete_findings_safe") as mock_delete:
        
        mock_db = MagicMock()
        mock_scan = Scan(
            id="scan-123",
            source_type="paste",
            source_value="some_code",
            status="queued"
        )
        mock_db.get.return_value = mock_scan
        mock_session_local.return_value = mock_db
        
        mock_ingest.return_value = "/tmp/fake_dir"
        mock_run_scan.return_value = ([], {}, {}, "Low", 5.0)
        
        yield {
            "session": mock_db,
            "scan": mock_scan,
            "ingest": mock_ingest,
            "run_hybrid": mock_run_scan,
            "cleanup": mock_cleanup,
            "delete": mock_delete
        }

def test_worker_success(mock_dependencies, mock_redis_lock):
    deps = mock_dependencies
    
    # Run the worker
    result = execute_scan("scan-123")
    
    assert result == "scan-123"
    assert deps["scan"].status == "completed"
    assert deps["scan"].completed_at is not None
    assert deps["scan"].duration_ms is not None
    
    # Verify cleanup was called
    deps["cleanup"].assert_called_once_with("/tmp/fake_dir")
    
    # Verify events were logged (ingest_started, findings_saving, completed)
    # The event logger adds to DB
    assert deps["session"].add.call_count > 0

def test_worker_failed_sets_status_failed(mock_dependencies, mock_redis_lock):
    deps = mock_dependencies
    deps["run_hybrid"].side_effect = Exception("Some arbitrary error")
    
    with pytest.raises(Exception):
        execute_scan("scan-123")
        
    assert deps["scan"].status == "failed"
    assert deps["scan"].error_message == "Some arbitrary error"
    
    # Cleanup should still be called!
    deps["cleanup"].assert_called_once_with("/tmp/fake_dir")
    
def test_timeout_sets_failed(mock_dependencies, mock_redis_lock):
    deps = mock_dependencies
    deps["run_hybrid"].side_effect = SoftTimeLimitExceeded("Timeout")
    
    with pytest.raises(SoftTimeLimitExceeded):
        execute_scan("scan-123")
        
    assert deps["scan"].status == "failed"
    assert "Scan exceeded maximum time limit" in deps["scan"].error_message
    
    # Cleanup should still be called
    deps["cleanup"].assert_called_once_with("/tmp/fake_dir")

def test_retry_db_deadlock():
    # Test _delete_findings_safe isolated
    db = MagicMock()
    db.execute.side_effect = [
        Exception("1213 Deadlock found when trying to get lock"),
        Exception("1213 Deadlock found when trying to get lock"),
        None # Success on 3rd try
    ]
    
    with patch("time.sleep") as mock_sleep:
        _delete_findings_safe(db, "scan-123", max_retries=3)
        assert db.execute.call_count == 3
        assert mock_sleep.call_count == 2
        
def test_idempotency_lock_skip():
    with patch("app.worker.tasks._redis_client") as mock_redis:
        mock_lock = MagicMock()
        mock_lock.acquire.return_value = False # Lock is held by someone else!
        mock_redis.lock.return_value = mock_lock
        
        with patch("app.worker.tasks.SessionLocal") as mock_session_local:
            result = execute_scan("scan-123")
            
            assert result == "scan-123"
            mock_session_local.assert_not_called() # DB was never hit
