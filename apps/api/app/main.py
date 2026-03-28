from fastapi import FastAPI
from slowapi.middleware import SlowAPIMiddleware

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


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_bucket_exists()


@app.get("/health")
def health():
    return {"status": "ok", "service": settings.app_name}
