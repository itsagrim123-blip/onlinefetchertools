from __future__ import annotations

import mimetypes
from pathlib import Path
from urllib.parse import quote

from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.utils.files import cleanup_work_dir

# Explicit MIME mappings for guaranteed file-type consistency on mobile browsers
MIME_TYPE_MAPPING: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".flac": "audio/flac",
    ".ogg": "audio/ogg",
    ".zip": "application/zip",
    ".txt": "text/plain; charset=utf-8",
}


def guess_media_type(filename_or_path: str | Path, fallback: str = "application/octet-stream") -> str:
    """
    Resolves the exact, accurate MIME type for a file.
    Prefers the explicit MIME_TYPE_MAPPING to ensure Android / mobile browsers
    correctly classify images, videos, audio, and documents.
    """
    suffix = Path(filename_or_path).suffix.lower()
    if suffix in MIME_TYPE_MAPPING:
        return MIME_TYPE_MAPPING[suffix]

    guessed, _ = mimetypes.guess_type(str(filename_or_path))
    if guessed:
        return guessed

    return fallback


def build_content_disposition(filename: str, disposition_type: str = "attachment") -> str:
    """
    Builds an RFC 6266 / RFC 5987 compliant Content-Disposition header with both:
    - standard ASCII fallback filename="safe_name.ext"
    - UTF-8 encoded filename*=UTF-8''percent_encoded_name.ext
    """
    safe_ascii = "".join(c if 32 <= ord(c) < 127 and c not in '"\\;' else "_" for c in filename)
    if not safe_ascii:
        safe_ascii = "download"

    encoded_utf8 = quote(filename, encoding="utf-8")
    return f'{disposition_type}; filename="{safe_ascii}"; filename*=UTF-8\'\'{encoded_utf8}'


def download_response(
    file_path: Path,
    filename: str | None = None,
    media_type: str | None = None,
    work_dir: Path | None = None,
) -> FileResponse:
    """
    Constructs a FileResponse configured specifically for mobile and desktop browser compatibility:
    1. Correct MIME type (never forced generic application/octet-stream unless truly unknown).
    2. Explicit Content-Disposition with RFC 5987 encoding and ASCII fallback.
    3. Custom X-Filename header allowing frontend fetch to directly read the unescaped filename.
    4. Anti-caching headers (Cache-Control: no-cache, no-store, must-revalidate) to avoid stale downloads.
    5. Optional background work_dir cleanup.
    """
    resolved_name = filename or file_path.name
    resolved_media_type = media_type or guess_media_type(resolved_name)

    headers = {
        "Content-Disposition": build_content_disposition(resolved_name),
        "Content-Type": resolved_media_type,
        "X-Filename": quote(resolved_name, encoding="utf-8"),
        "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }

    background = BackgroundTask(cleanup_work_dir, work_dir) if work_dir else None

    return FileResponse(
        file_path,
        media_type=resolved_media_type,
        headers=headers,
        background=background,
    )

