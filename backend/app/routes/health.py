import shutil

import yt_dlp
from fastapi import APIRouter

router = APIRouter()


@router.get("/api/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "service": "ClipFetch",
        "dependencies": {
            "yt_dlp": True,
            "ffmpeg": shutil.which("ffmpeg") is not None,
        },
    }
