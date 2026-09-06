from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import Response

from app.errors import ClipFetchError
from app.services.captions import AutoCaptionsService
from app.services.media_tools import VIDEO_EXTENSIONS, validate_media_file
from app.utils.concurrency import MEDIA_SEMAPHORE
from app.utils.files import cleanup_work_dir, create_work_dir, safe_upload_name, save_upload
from app.utils.responses import download_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media/auto-captions", tags=["Auto Captions"])


@router.post("/transcribe")
async def transcribe_video(
    file: UploadFile = File(...),
    language: str = Form("auto"),
    translate: bool = Form(False),
):
    """
    Extracts audio and generates timestamped captions from speech in the uploaded video.
    """
    work_dir = create_work_dir()
    captions_service = AutoCaptionsService.get_instance()

    try:
        source_name = safe_upload_name(file.filename, "video")
        source_path = work_dir / source_name
        await save_upload(file, source_path, VIDEO_EXTENSIONS)

        # Validate that the file has a video stream
        validate_media_file(source_path, expect_video=True, expect_audio=False)

        # Extract 16kHz audio to WAV
        audio_path = work_dir / "extracted_speech.wav"
        async with MEDIA_SEMAPHORE:
            await asyncio.to_thread(captions_service.extract_audio_sync, source_path, audio_path)

            # Transcribe audio with speech recognition model
            result = await asyncio.to_thread(
                captions_service.transcribe_sync,
                audio_path=audio_path,
                language=language,
                translate=translate,
            )

        return result
    except Exception:
        cleanup_work_dir(work_dir)
        raise
    finally:
        # Audio and intermediate upload in this step can be cleaned up
        cleanup_work_dir(work_dir)


@router.post("/export")
async def export_captioned_video(
    file: UploadFile = File(...),
    captions: str = Form(...),
    position: str = Form("bottom"),
    style_preset: str = Form("classic"),
    font_size: int = Form(28),
    font_color: str = Form("#FFFFFF"),
    background_box: bool = Form(False),
    outline_color: str = Form("#000000"),
    font_family: str = Form("Arial"),
):
    """
    Burns the timestamped captions permanently into the video stream frames using FFmpeg.
    Returns the rendered MP4 file.
    """
    work_dir = create_work_dir()
    captions_service = AutoCaptionsService.get_instance()

    try:
        # Parse segments JSON
        try:
            segments_data = json.loads(captions)
            if not isinstance(segments_data, list):
                raise ValueError("Captions must be a JSON array of segments")
        except Exception as json_err:
            raise ClipFetchError(f"Invalid caption segments format: {json_err}", status_code=400) from json_err

        if not segments_data:
            raise ClipFetchError("At least one caption segment is required to export.", status_code=400)

        source_name = safe_upload_name(file.filename, "video")
        source_path = work_dir / source_name
        await save_upload(file, source_path, VIDEO_EXTENSIONS)

        # Probe video dimensions so ASS subtitles scale accurately
        probe = validate_media_file(source_path, expect_video=True, expect_audio=False)
        video_width = 1920
        video_height = 1080
        for s in probe.get("streams", []):
            if s.get("codec_type") == "video":
                video_width = int(s.get("width", 1920))
                video_height = int(s.get("height", 1080))
                break

        # Generate styled ASS file
        ass_content = captions_service.generate_ass_subtitles(
            segments=segments_data,
            video_width=video_width,
            video_height=video_height,
            position=position,
            style_preset=style_preset,
            font_size=font_size,
            font_color=font_color,
            background_box=background_box,
            outline_color=outline_color,
            font_family=font_family,
        )

        ass_path = work_dir / "captions.ass"
        ass_path.write_text(ass_content, encoding="utf-8")

        stem = Path(source_name).stem
        output_filename = f"{stem}-captioned.mp4"
        output_path = work_dir / output_filename

        async with MEDIA_SEMAPHORE:
            await asyncio.to_thread(
                captions_service.burn_captions_sync,
                video_path=source_path,
                ass_path=ass_path,
                output_path=output_path,
                work_dir=work_dir,
            )

        return download_response(output_path, filename=output_filename, media_type="video/mp4", work_dir=work_dir)

    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/srt")
async def download_srt(
    captions: str = Form(...),
    filename: str = Form("subtitles.srt"),
):
    """
    Generates and downloads SubRip (.srt) subtitle file from caption segments.
    """
    captions_service = AutoCaptionsService.get_instance()
    try:
        segments_data = json.loads(captions)
        if not isinstance(segments_data, list):
            raise ValueError("Captions must be a JSON array of segments")
    except Exception as json_err:
        raise ClipFetchError(f"Invalid caption segments format: {json_err}", status_code=400) from json_err

    srt_content = captions_service.generate_srt_subtitles(segments_data)
    safe_name = safe_upload_name(filename, fallback="subtitles.srt")
    if not safe_name.endswith(".srt"):
        safe_name += ".srt"

    from app.utils.responses import build_content_disposition

    return Response(
        content=srt_content.encode("utf-8"),
        media_type="application/x-subrip",
        headers={
            "Content-Disposition": build_content_disposition(safe_name),
            "Content-Type": "application/x-subrip; charset=utf-8",
            "Cache-Control": "no-cache",
        },
    )


@router.post("/vtt")
async def download_vtt(
    captions: str = Form(...),
    filename: str = Form("subtitles.vtt"),
):
    """
    Generates and downloads WebVTT (.vtt) subtitle file from caption segments.
    """
    captions_service = AutoCaptionsService.get_instance()
    try:
        segments_data = json.loads(captions)
        if not isinstance(segments_data, list):
            raise ValueError("Captions must be a JSON array of segments")
    except Exception as json_err:
        raise ClipFetchError(f"Invalid caption segments format: {json_err}", status_code=400) from json_err

    vtt_content = captions_service.generate_vtt_subtitles(segments_data)
    safe_name = safe_upload_name(filename, fallback="subtitles.vtt")
    if not safe_name.endswith(".vtt"):
        safe_name += ".vtt"

    from app.utils.responses import build_content_disposition

    return Response(
        content=vtt_content.encode("utf-8"),
        media_type="text/vtt",
        headers={
            "Content-Disposition": build_content_disposition(safe_name),
            "Content-Type": "text/vtt; charset=utf-8",
            "Cache-Control": "no-cache",
        },
    )

