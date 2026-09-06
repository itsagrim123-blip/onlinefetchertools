from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile

from app.errors import ClipFetchError
from app.services.noise_remover import (
    ALL_EXTENSIONS,
    NoiseRemoverService,
)
from app.utils.concurrency import MEDIA_SEMAPHORE
from app.utils.files import cleanup_work_dir, create_work_dir, safe_upload_name, save_upload
from app.utils.responses import download_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/media/noise-remover", tags=["AI Noise Remover"])
audio_router = APIRouter(prefix="/api/audio", tags=["AI Noise Remover"])


@router.post("/analyze")
async def analyze_audio_or_video(file: UploadFile = File(...)) -> dict[str, Any]:
    """
    Analyzes an uploaded audio or video file, returning metadata,
    duration, channel info, and normalized waveform peaks for visualization.
    """
    work_dir = create_work_dir()
    noise_service = NoiseRemoverService.get_instance()

    try:
        source_name = safe_upload_name(file.filename, "media")
        source_path = work_dir / source_name
        await save_upload(file, source_path, ALL_EXTENSIONS)

        async with MEDIA_SEMAPHORE:
            result = await asyncio.to_thread(noise_service.analyze_media_sync, source_path)

        result["filename"] = source_name
        return result
    except Exception:
        cleanup_work_dir(work_dir)
        raise
    finally:
        cleanup_work_dir(work_dir)


@router.post("/process")
async def remove_noise_from_media(
    file: UploadFile = File(...),
    mode: str = Form("auto"),
    strength: int = Form(60),
    voice_enhancement: bool = Form(True),
    hum_removal: str = Form("auto"),
    low_frequency_cleanup: str = Form("auto"),
    normalize: bool = Form(True),
    output_format: str = Form("auto"),
):
    """
    Removes background noise and applies audio enhancement using local RNNoise
    neural networks and FFmpeg audio DSP. Returns the cleaned audio or video file.
    """
    work_dir = create_work_dir()
    noise_service = NoiseRemoverService.get_instance()

    try:
        source_name = safe_upload_name(file.filename, "media")
        source_path = work_dir / source_name
        await save_upload(file, source_path, ALL_EXTENSIONS)

        async with MEDIA_SEMAPHORE:
            output_path, output_filename, cleaned_peaks = await asyncio.to_thread(
                noise_service.process_media_sync,
                source_path=source_path,
                work_dir=work_dir,
                mode=mode,
                strength=strength,
                voice_enhancement=voice_enhancement,
                hum_removal=hum_removal,
                low_frequency_cleanup=low_frequency_cleanup,
                normalize=normalize,
                output_format=output_format,
            )

        resp = download_response(output_path, filename=output_filename, work_dir=work_dir)
        # Attach cleaned waveform peaks in header for synchronized frontend visualizer
        try:
            resp.headers["X-Cleaned-Peaks"] = json.dumps(cleaned_peaks)
        except Exception as json_err:
            logger.warning("Failed to serialize cleaned peaks: %s", json_err)

        return resp
    except Exception:
        cleanup_work_dir(work_dir)
        raise


audio_router.add_api_route("/noise-removal", remove_noise_from_media, methods=["POST"])

