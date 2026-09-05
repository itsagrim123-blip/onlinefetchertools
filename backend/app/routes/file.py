from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.media_tools import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, convert_media, edit_video, extract_frame, video_to_gif
from app.utils.concurrency import MEDIA_SEMAPHORE
from app.utils.files import cleanup_work_dir, create_work_dir, safe_upload_name, save_upload

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
        async with MEDIA_SEMAPHORE:
            await asyncio.to_thread(convert_media, source, output, target_format)
        return FileResponse(output, filename=output.name, media_type="application/octet-stream", background=BackgroundTask(cleanup_work_dir, work_dir))
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/edit")
async def edit(
    file: UploadFile = File(...),
    start_time: str | None = Form(None),
    end_time: str | None = Form(None),
    resolution: str | None = Form(None),
    quality: str = Form("high"),
    output_format: str = Form("mp4"),
    include_audio: bool = Form(True),
    speed: float = Form(1.0),
):
    work_dir = create_work_dir()
    try:
        source = work_dir / safe_upload_name(file.filename, "video")
        await save_upload(file, source, VIDEO_EXTENSIONS)
        target_format = output_format.lower().lstrip(".") or "mp4"
        stem = Path(safe_upload_name(file.filename, "video")).stem
        output = work_dir / f"{stem}_edited.{target_format}"
        async with MEDIA_SEMAPHORE:
            await asyncio.to_thread(
                edit_video,
                source=source,
                output=output,
                start_time=start_time,
                end_time=end_time,
                resolution=resolution,
                quality=quality,
                output_format=target_format,
                include_audio=include_audio,
                speed=speed,
            )
        return FileResponse(
            output,
            filename=output.name,
            media_type="application/octet-stream",
            background=BackgroundTask(cleanup_work_dir, work_dir),
        )
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/video-to-gif")
async def create_gif(
    file: UploadFile = File(...),
    start_time: str | None = Form(None),
    end_time: str | None = Form(None),
    fps: int = Form(10),
    width: int = Form(480),
):
    work_dir = create_work_dir()
    try:
        source = work_dir / safe_upload_name(file.filename, "video")
        await save_upload(file, source, VIDEO_EXTENSIONS)
        stem = Path(safe_upload_name(file.filename, "video")).stem
        output = work_dir / f"{stem}.gif"
        async with MEDIA_SEMAPHORE:
            await asyncio.to_thread(
                video_to_gif,
                source=source,
                output=output,
                start_time=start_time,
                end_time=end_time,
                fps=fps,
                width=width,
            )
        return FileResponse(
            output,
            filename=output.name,
            media_type="image/gif",
            background=BackgroundTask(cleanup_work_dir, work_dir),
        )
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/extract-frame")
async def get_frame(
    file: UploadFile = File(...),
    timestamp: float = Form(0.0),
    format: str = Form("jpg"),
):
    work_dir = create_work_dir()
    try:
        source = work_dir / safe_upload_name(file.filename, "video")
        await save_upload(file, source, VIDEO_EXTENSIONS)
        stem = Path(safe_upload_name(file.filename, "video")).stem
        ext = "png" if format.lower().strip(".") == "png" else "jpg"
        media_type = "image/png" if ext == "png" else "image/jpeg"
        output = work_dir / f"{stem}_frame_{timestamp:.2f}.{ext}"
        async with MEDIA_SEMAPHORE:
            await asyncio.to_thread(extract_frame, source=source, output=output, timestamp=timestamp)
        return FileResponse(
            output,
            filename=output.name,
            media_type=media_type,
            background=BackgroundTask(cleanup_work_dir, work_dir),
        )
    except Exception:
        cleanup_work_dir(work_dir)
        raise
