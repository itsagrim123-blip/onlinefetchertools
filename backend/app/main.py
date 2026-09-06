from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import logging
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routes.health import router as health_router
from app.routes.image import router as image_router
from app.routes.pdf import router as pdf_router
from app.routes.file import router as file_router
from app.routes.archive import router as archive_router
from app.routes.media import router as media_router
from app.errors import ClipFetchError
from app.services.cleanup import CleanupService

logging.basicConfig(level=logging.INFO)
settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    _.state.started_at = time.monotonic()
    cleanup_service = CleanupService()
    # Non-blocking warm up of the AI background remover model session
    from app.services.background_remover import BackgroundRemoverService

    asyncio.create_task(BackgroundRemoverService.get_instance().initialize())
    try:
        yield
    finally:
        cleanup_service.stop()

app = FastAPI(title="ClipFetch", version="1.0.0", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.exception_handler(ClipFetchError)
async def clipfetch_error_handler(_: Request, exc: ClipFetchError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_origin_regex=r"https://[a-zA-Z0-9.-]+\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "Content-Disposition",
        "Content-Type",
        "Content-Length",
        "X-Filename",
        "X-Image-Width",
        "X-Image-Height",
        "Cache-Control",
    ],
)


app.include_router(health_router)
app.include_router(media_router)
app.include_router(image_router)
app.include_router(pdf_router)
app.include_router(file_router)
app.include_router(archive_router)
