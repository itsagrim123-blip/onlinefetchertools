from __future__ import annotations

import logging
import subprocess
from pathlib import Path

from app.errors import ClipFetchError
from app.services.media_tools import _conversion_error, validate_media_file
from .builder import build_ffmpeg_command
from .models import VideoProjectManifest

logger = logging.getLogger(__name__)


def execute_project_render(
    manifest: VideoProjectManifest,
    assets_map: dict[str, Path],
    output_path: Path,
    timeout_seconds: int = 600,
) -> Path:
    """
    Renders the VideoProjectManifest to output_path using a single-pass FFmpeg command.
    Validates output integrity before returning.
    """
    command = build_ffmpeg_command(manifest, assets_map, output_path)
    logger.info("Executing video project render command: %s", " ".join(command))

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except FileNotFoundError as exc:
        raise ClipFetchError("FFmpeg is not installed on backend.", status_code=503) from exc
    except subprocess.TimeoutExpired as exc:
        raise ClipFetchError("Video project rendering timed out.", status_code=504) from exc

    if result.returncode != 0 or not output_path.exists():
        logger.error("FFmpeg project render failed (code %d): %s", result.returncode, result.stderr)
        raise ClipFetchError(_conversion_error(result.stderr), status_code=400)

    # Validate output media file
    try:
        validate_media_file(output_path, expect_video=True, expect_audio=False)
    except Exception as exc:
        logger.error("Rendered video failed validation: %s", exc)
        raise ClipFetchError("Rendered video file is invalid or unreadable.", status_code=500) from exc

    return output_path

