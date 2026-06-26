import time
import uuid
from fastapi import FastAPI, Request
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import inspect, text
from prometheus_client import make_asgi_app, Counter, Histogram, REGISTRY

from app.core.logger import logger, request_id_var
from app.core.metrics import ScanVulMetricsCollector

REGISTRY.register(ScanVulMetricsCollector())

from app.api.router import api_router
from app.core.config import settings
from app.core.limiter import limiter
from app.db.base import Base
from app.db.session import engine
from app.services.storage import ensure_bucket_exists
from app.scanner_engines.utils import command_exists

app = FastAPI(title=settings.app_name, version="1.0.0")

# Prometheus Metrics ASGI App
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

# Prometheus Counters/Histograms
REQUEST_COUNT = Counter("http_requests_total", "Total HTTP requests", ["method", "endpoint", "http_status"])
REQUEST_LATENCY = Histogram("http_request_duration_seconds", "HTTP request latency", ["method", "endpoint"])

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        req_id = str(uuid.uuid4())
        request_id_var.set(req_id)
        start_time = time.time()
        
        response = await call_next(request)
        
        process_time = time.time() - start_time
        REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path, http_status=response.status_code).inc()
        REQUEST_LATENCY.labels(method=request.method, endpoint=request.url.path).observe(process_time)
        
        logger.info(
            "Request completed",
            extra={
                "http_method": request.method,
                "url": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(process_time * 1000, 2)
            }
        )
        return response

app.add_middleware(RequestLoggingMiddleware)
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
    return {
        "status": "ok" if all_ok else "degraded",
        "engines": tools,
        "secret_verify_enabled": settings.secret_verify_enabled,
        "llm_enabled": bool(settings.llm_api_key),
    }
