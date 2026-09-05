from __future__ import annotations

import re
from pathlib import Path
from tempfile import mkdtemp
from typing import Iterable

from fastapi import UploadFile

from app.config import get_settings
from app.errors import ClipFetchError
from app.utils.validation import sanitize_filename


def create_work_dir() -> Path:
    return Path(mkdtemp(prefix="clipfetch_tool_", dir=str(get_settings().download_path)))


def safe_upload_name(name: str | None, fallback: str = "upload") -> str:
    return sanitize_filename(name, fallback=fallback)


def validate_extension(name: str, allowed: Iterable[str]) -> str:
    suffix = Path(name).suffix.lower()
    if suffix not in {extension.lower() for extension in allowed}:
        raise ClipFetchError(f"Unsupported file type: {suffix or 'unknown'}", status_code=400)
    return suffix


async def save_upload(upload: UploadFile, destination: Path, allowed: Iterable[str]) -> int:
    validate_extension(upload.filename or "", allowed)
    max_bytes = get_settings().max_upload_size_mb * 1024 * 1024
    total = 0
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("wb") as output:
        while chunk := await upload.read(1024 * 1024):
            total += len(chunk)
            if total > max_bytes:
                destination.unlink(missing_ok=True)
                raise ClipFetchError(f"File exceeds the {get_settings().max_upload_size_mb} MB upload limit", status_code=413)
            output.write(chunk)
    if total == 0:
        destination.unlink(missing_ok=True)
        raise ClipFetchError("Uploaded file is empty", status_code=400)
    return total


def cleanup_work_dir(work_dir: Path) -> None:
    import shutil

    shutil.rmtree(work_dir, ignore_errors=True)
