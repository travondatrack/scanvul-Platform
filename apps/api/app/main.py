import time
import uuid
from pathlib import Path
from fastapi import FastAPI, Request
import redis
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi.middleware import SlowAPIMiddleware
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


# In production with MySQL/PostgreSQL, schema is managed by Prisma migrations.


@app.on_event("startup")
def on_startup() -> None:
    db_url = settings.database_url
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
    redis_ok = False
    if settings.redis_url:
        try:
            redis.Redis.from_url(settings.redis_url, socket_connect_timeout=2, socket_timeout=2).ping()
            redis_ok = True
        except Exception:
            redis_ok = False
    storage_ok = False
    try:
        if settings.storage_backend.lower() == "local":
            storage_ok = Path(settings.local_storage_path).exists()
        else:
            storage_ok = bool(settings.minio_endpoint and settings.minio_bucket)
    except Exception:
        storage_ok = False
    return {
        "status": "ok" if all_ok else "degraded",
        "engines": tools,
        "redis": {"configured": bool(settings.redis_url), "available": redis_ok},
        "storage": {"backend": settings.storage_backend, "available": storage_ok},
        "secret_verify_enabled": settings.secret_verify_enabled,
        "llm_enabled": bool(settings.llm_api_key),
    }
