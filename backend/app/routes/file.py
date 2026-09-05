from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.media_tools import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, convert_media
from app.utils.files import cleanup_work_dir, create_work_dir, save_upload, safe_upload_name

router = APIRouter(prefix="/api/media", tags=["Media tools"])


@router.post("/convert")
@router.post("/extract-audio")
async def convert(file: UploadFile = File(...), output_format: str = Form("mp4")):
    work_dir = create_work_dir()
    try:
        source = work_dir / safe_upload_name(file.filename, "media")
        await save_upload(file, source, VIDEO_EXTENSIONS | AUDIO_EXTENSIONS)
        target_format = "mp3" if output_format == "audio" else output_format
        output = work_dir / f"converted.{target_format.lstrip('.')}"
        convert_media(source, output, target_format)
        return FileResponse(output, filename=output.name, media_type="application/octet-stream", background=BackgroundTask(cleanup_work_dir, work_dir))
    except Exception:
        cleanup_work_dir(work_dir)
        raise
