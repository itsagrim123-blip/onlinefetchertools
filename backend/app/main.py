from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes.health import router as health_router
from app.routes.media import router as media_router
from app.services.cleanup import CleanupService

logging.basicConfig(level=logging.INFO)
settings = get_settings()
cleanup_service = CleanupService()

app = FastAPI(title="ClipFetch", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(media_router)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ClipFetch"}
