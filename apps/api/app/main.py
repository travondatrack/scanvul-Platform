from fastapi import FastAPI
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import inspect, text

from app.api.router import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.db.base import Base
from app.db.session import engine
from app.services.storage import ensure_bucket_exists
from app.scanner_engines.utils import command_exists

app = FastAPI(title=settings.app_name, version="1.0.0")
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.include_router(api_router)


# ---------------------------------------------------------------------------
# Dev-only dynamic migration (SQLite only).
# Guarded by ENABLE_DEV_AUTO_MIGRATION=true.
# In production with MySQL/PostgreSQL, schema is managed by Prisma migrations.
# ---------------------------------------------------------------------------

_NEW_COLUMNS: dict[str, str] = {
    "rule_id": "VARCHAR(120) DEFAULT ''",
    "scan_category": "VARCHAR(40) DEFAULT 'SAST source code'",
    "source": "TEXT DEFAULT ''",
    "sink": "TEXT DEFAULT ''",
    "function_name": "VARCHAR(160) DEFAULT ''",
    "why_vulnerable": "TEXT DEFAULT ''",
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
    db_url = settings.database_url

    if db_url.startswith("sqlite"):
        # SQLite: let SQLAlchemy create tables and run dev migration
        Base.metadata.create_all(bind=engine)
        if settings.enable_dev_auto_migration:
            ensure_finding_columns()
        else:
            import logging
            logging.getLogger(__name__).warning(
                "ENABLE_DEV_AUTO_MIGRATION is false. If columns are missing, run with "
                "ENABLE_DEV_AUTO_MIGRATION=true or apply Alembic migrations."
            )
    else:
        # MySQL / PostgreSQL: schema is managed by Prisma (npx prisma db push).
        # Do NOT call create_all() — it will conflict with Prisma's FK definitions.
        import logging
        logging.getLogger(__name__).info(
            "Using external DB (%s). Schema managed by Prisma — skipping create_all().",
            db_url.split("://")[0],
        )

    ensure_bucket_exists()


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}


@app.get("/health/engines")
def health_engines():
    """Return availability of all scanner engine tools."""
    tools = {
        "semgrep": command_exists("semgrep"),
        "bandit": command_exists("bandit"),
        "trivy": command_exists("trivy"),
        "git": command_exists("git"),
        "eslint": command_exists("eslint"),
    }
    all_ok = all(tools.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "engines": tools,
        "secret_verify_enabled": settings.secret_verify_enabled,
        "llm_enabled": bool(settings.llm_api_key),
    }
