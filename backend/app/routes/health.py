import importlib.util
import shutil
import time
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

from app.config import get_settings

router = APIRouter()
templates = Jinja2Templates(directory=str(Path(__file__).resolve().parents[1] / "templates"))


def _dependency_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


def _storage_available() -> bool:
    try:
        path = get_settings().download_path
        return path.is_dir() and path.exists()
    except OSError:
        return False


@router.get("/")
def root(request: Request):
    started_at = getattr(request.app.state, "started_at", time.monotonic())
    services = [
        {"name": "FastAPI", "label": "Web Framework", "icon": "layers", "available": True},
        {"name": "yt-dlp", "label": "YouTube Extractor", "icon": "play", "available": _dependency_available("yt_dlp")},
        {"name": "FFmpeg", "label": "Media Processing", "icon": "sparkles", "available": shutil.which("ffmpeg") is not None},
        {"name": "Storage", "label": "Local Filesystem", "icon": "database", "available": _storage_available()},
    ]
    endpoints = [
        {"method": "GET", "path": "/", "description": "Get API information", "href": "/"},
        {"method": "GET", "path": "/api/health", "description": "Check service health", "href": "/api/health"},
        {"method": "POST", "path": "/api/analyze", "description": "Analyze a YouTube URL", "href": None},
        {"method": "POST", "path": "/api/download", "description": "Create a download job", "href": None},
        {"method": "GET", "path": "/api/download/{job_id}/status", "description": "Check job progress", "href": None},
        {"method": "GET", "path": "/api/download/{job_id}/file", "description": "Retrieve a completed file", "href": None},
    ]
    return templates.TemplateResponse(
        request=request,
        name="status.html",
        context={
            "services": services,
            "endpoints": endpoints,
            "uptime_seconds": int(time.monotonic() - started_at),
            "version": request.app.version,
        },
    )


@router.get("/api/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "ClipFetch",
        "dependencies": {
            "fastapi": True,
            "yt_dlp": _dependency_available("yt_dlp"),
            "ffmpeg": shutil.which("ffmpeg") is not None,
        },
    }
