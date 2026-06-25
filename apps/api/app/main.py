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


def ensure_finding_columns() -> None:
    existing = {column["name"] for column in inspect(engine).get_columns("findings")}
    columns = {
        "rule_id": "VARCHAR(120) DEFAULT ''",
        "scan_category": "VARCHAR(40) DEFAULT 'SAST source code'",
        "source": "TEXT DEFAULT ''",
        "sink": "TEXT DEFAULT ''",
        "function_name": "VARCHAR(160) DEFAULT ''",
        "why_vulnerable": "TEXT DEFAULT ''",
    }
    with engine.begin() as connection:
        for name, definition in columns.items():
            if name not in existing:
                connection.execute(text(f"ALTER TABLE findings ADD COLUMN {name} {definition}"))


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_finding_columns()
    ensure_bucket_exists()


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}
