import importlib.util
import shutil

from fastapi import APIRouter

router = APIRouter()


def _dependency_available(module_name: str) -> bool:
    return importlib.util.find_spec(module_name) is not None


@router.get("/")
def root() -> dict[str, str]:
    return {"service": "ClipFetch", "status": "ok", "health": "/api/health"}


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
