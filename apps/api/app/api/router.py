from fastapi import APIRouter

from app.api.v1.scans import router as scans_router

api_router = APIRouter()
api_router.include_router(scans_router, prefix="/api/v1", tags=["scans"])
