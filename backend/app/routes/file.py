from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.errors import ClipFetchError
from app.services.image_tools import IMAGE_EXTENSIONS
from app.services.media_tools import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, convert_media, edit_video, extract_frame, video_to_gif
from app.services.video_project import VideoProjectManifest
from app.services.video_project.executor import execute_project_render
from app.utils.concurrency import MEDIA_SEMAPHORE
from app.utils.files import cleanup_work_dir, create_work_dir, safe_upload_name, save_upload
from app.utils.responses import download_response

router = APIRouter(prefix="/api/media", tags=["Media tools"])


@router.post("/convert")
async def convert(file: UploadFile = File(...), output_format: str = Form("mp4")):
    work_dir = create_work_dir()
    try:
        source = work_dir / safe_upload_name(file.filename, "media")
        await save_upload(file, source, VIDEO_EXTENSIONS | AUDIO_EXTENSIONS)
        stem = Path(safe_upload_name(file.filename, "media")).stem
        target_format = "mp3" if output_format == "audio" else output_format
        output = work_dir / f"{stem}_converted.{target_format.lstrip('.')}"
        async with MEDIA_SEMAPHORE:
            await asyncio.to_thread(convert_media, source, output, target_format)
        return download_response(output, filename=output.name, work_dir=work_dir)
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/extract-audio")
async def extract_audio_route(file: UploadFile = File(...), output_format: str = Form("mp3")):
    work_dir = create_work_dir()
    try:
        source = work_dir / safe_upload_name(file.filename, "video")
        await save_upload(file, source, VIDEO_EXTENSIONS)
        stem = Path(safe_upload_name(file.filename, "video")).stem
        target_format = output_format.lower().lstrip(".")
        if target_format not in {"mp3", "wav", "aac", "m4a", "ogg"}:
            target_format = "mp3"
        output = work_dir / f"{stem}_extracted.{target_format}"
        async with MEDIA_SEMAPHORE:
            await asyncio.to_thread(convert_media, source, output, target_format)
        return download_response(output, filename=output.name, media_type=f"audio/{target_format}", work_dir=work_dir)
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
        return download_response(output, filename=output.name, work_dir=work_dir)
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
        return download_response(output, filename=output.name, media_type="image/gif", work_dir=work_dir)
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
        return download_response(output, filename=output.name, media_type=media_type, work_dir=work_dir)
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/project-render")
async def project_render(request: Request):
    work_dir = create_work_dir()
    try:
        form = await request.form()
        manifest_raw = form.get("manifest")
        if not manifest_raw or not isinstance(manifest_raw, str):
            raise ClipFetchError("Missing project manifest", status_code=400)

        try:
            manifest = VideoProjectManifest.model_validate_json(manifest_raw)
        except Exception as exc:
            raise ClipFetchError(f"Invalid project manifest: {exc}", status_code=400) from exc

        allowed_exts = VIDEO_EXTENSIONS | AUDIO_EXTENSIONS | IMAGE_EXTENSIONS | {".svg", ".gif", ".bmp"}
        assets_map: dict[str, Path] = {}

        from starlette.datastructures import UploadFile as StarletteUploadFile

        for key, value in form.items():
            if key.startswith("asset_") and (isinstance(value, (UploadFile, StarletteUploadFile)) or hasattr(value, "filename")):
                asset_id = key[len("asset_"):]
                safe_name = safe_upload_name(getattr(value, "filename", None), fallback=f"{asset_id}.mp4")
                dest = work_dir / f"{asset_id}_{safe_name}"
                await save_upload(value, dest, allowed_exts)
                assets_map[asset_id] = dest

        out_format = manifest.export_settings.format.lower().lstrip(".") or "mp4"
        clean_title = safe_upload_name(manifest.title, fallback="video_project")
        output = work_dir / f"{clean_title}.{out_format}"

        async with MEDIA_SEMAPHORE:
            await asyncio.to_thread(
                execute_project_render,
                manifest=manifest,
                assets_map=assets_map,
                output_path=output,
            )

        return download_response(output, filename=output.name, work_dir=work_dir)
    except Exception:
        cleanup_work_dir(work_dir)
        raise

