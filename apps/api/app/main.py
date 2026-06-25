from fastapi import FastAPI
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import inspect, text

from app.api.router import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.db.base import Base
from app.db.session import engine
from app.services.storage import ensure_bucket_exists

app = FastAPI(title=settings.app_name, version="1.0.0")
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.include_router(api_router)


# ---------------------------------------------------------------------------
# Dev-only dynamic migration (SQLite).
# Guarded by ENABLE_DEV_AUTO_MIGRATION=true.
# In production with PostgreSQL, use explicit Alembic migrations.
# ---------------------------------------------------------------------------

_NEW_COLUMNS: dict[str, str] = {
    # Previously added
    "rule_id": "VARCHAR(120) DEFAULT ''",
    "scan_category": "VARCHAR(40) DEFAULT 'SAST source code'",
    "source": "TEXT DEFAULT ''",
    "sink": "TEXT DEFAULT ''",
    "function_name": "VARCHAR(160) DEFAULT ''",
    "why_vulnerable": "TEXT DEFAULT ''",
    # New in this release
    "line_start": "INTEGER DEFAULT 1",
    "line_end": "INTEGER DEFAULT 1",
    "evidence": "TEXT DEFAULT ''",
    "impact": "TEXT DEFAULT ''",
    "pentest_hint": "TEXT DEFAULT ''",
    "ext_references": "TEXT DEFAULT ''",
    "verification_status": "VARCHAR(40) DEFAULT 'unverified'",
    "dedupe_hash": "VARCHAR(64) DEFAULT ''",
    "dataflow_trace": "TEXT DEFAULT ''",
}


def ensure_finding_columns() -> None:
    """Add any missing columns to the findings table (SQLite dev only)."""
    existing = {column["name"] for column in inspect(engine).get_columns("findings")}
    with engine.begin() as connection:
        for name, definition in _NEW_COLUMNS.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE findings ADD COLUMN {name} {definition}"))


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    if settings.enable_dev_auto_migration:
        ensure_finding_columns()
    else:
        # Warn if running against SQLite without auto-migration enabled
        db_url = settings.database_url
        if db_url.startswith("sqlite"):
            import logging
            logging.getLogger(__name__).warning(
                "ENABLE_DEV_AUTO_MIGRATION is false. If columns are missing run with "
                "ENABLE_DEV_AUTO_MIGRATION=true or apply Alembic migrations."
            )
    ensure_bucket_exists()


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}
