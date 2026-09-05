from __future__ import annotations

import subprocess
from pathlib import Path

from app.errors import ClipFetchError

VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".avi"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".aac", ".m4a", ".ogg", ".flac"}


def convert_media(source: Path, output: Path, output_format: str) -> None:
    allowed = {"mp4", "webm", "mov", "mkv", "mp3", "wav", "aac", "m4a", "ogg"}
    target = output_format.lower().lstrip(".")
    if target not in allowed:
        raise ClipFetchError("Unsupported media output format", status_code=400)
    command = ["ffmpeg", "-y", "-i", str(source), "-map_metadata", "-1"]
    if target in {"mp3", "aac", "m4a", "ogg", "wav"}:
        command += ["-vn"]
    command.append(str(output))
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=300, check=False)
    except FileNotFoundError as exc:
        raise ClipFetchError("FFmpeg is not installed on the backend", status_code=503) from exc
    except subprocess.TimeoutExpired as exc:
        raise ClipFetchError("Media processing timed out", status_code=504) from exc
    if result.returncode != 0 or not output.exists():
        raise ClipFetchError("Media conversion failed", status_code=400)
