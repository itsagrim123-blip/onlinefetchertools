from __future__ import annotations

import os
from pathlib import Path
from typing import Any
import zipfile

from app.errors import ClipFetchError
from app.utils.validation import sanitize_filename

MAX_ARCHIVE_FILES = 1000
MAX_SINGLE_FILE_BYTES = 100 * 1024 * 1024  # 100 MB
MAX_TOTAL_UNCOMPRESSED_BYTES = 500 * 1024 * 1024  # 500 MB
WINDOWS_RESERVED_NAMES = {
    "CON", "PRN", "AUX", "NUL",
    *(f"COM{i}" for i in range(1, 10)),
    *(f"LPT{i}" for i in range(1, 10)),
}


def create_zip_archive(sources: list[tuple[Path, str]], output: Path) -> int:
    """
    Creates a ZIP archive from a list of (file_path, original_filename) tuples.
    Handles duplicate filenames safely by appending index counters.
    """
    if not sources:
        raise ClipFetchError("No files provided to create ZIP archive.", status_code=400)

    used_names: set[str] = set()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path, raw_name in sources:
            clean_name = sanitize_filename(Path(raw_name).name, fallback="file")
            # Deduplicate filename if necessary
            target_name = clean_name
            stem = Path(clean_name).stem
            suffix = Path(clean_name).suffix
            counter = 1
            while target_name.lower() in used_names:
                target_name = f"{stem} ({counter}){suffix}"
                counter += 1
            used_names.add(target_name.lower())

            archive.write(file_path, arcname=target_name)

    return len(used_names)


def _validate_zip_entry(info: zipfile.ZipInfo, dest_dir: Path) -> Path:
    """
    Validates a single ZIP entry for Zip Slip, path traversal, reserved names, and bomb traits.
    Returns the safe resolved target path within dest_dir.
    """
    name = info.filename

    # Reject null bytes
    if "\x00" in name:
        raise ClipFetchError("Archive contains invalid file paths with null bytes.", status_code=400)

    # Reject absolute paths, drive letters, and parent traversal tokens
    if name.startswith(("/", "\\")) or ":" in name or ".." in Path(name).parts:
        raise ClipFetchError(f"Malicious path detected in archive: '{name}'. Path traversal is prohibited.", status_code=400)

    # Check for Windows reserved names in path components
    for part in Path(name).parts:
        stem = Path(part).stem.upper()
        if stem in WINDOWS_RESERVED_NAMES:
            raise ClipFetchError(f"Archive entry uses reserved filename: '{part}'.", status_code=400)

    # Ensure resolved path is strictly within dest_dir
    resolved_target = (dest_dir / name).resolve()
    resolved_root = dest_dir.resolve()
    if not resolved_target.is_relative_to(resolved_root):
        raise ClipFetchError(f"Archive entry escapes destination directory: '{name}'.", status_code=400)

    # Check entry uncompressed size
    if info.file_size > MAX_SINGLE_FILE_BYTES:
        raise ClipFetchError(f"Archive file '{name}' exceeds size limit ({info.file_size // (1024*1024)} MB).", status_code=400)

    # Compression bomb check (ratio > 100:1 for entries over 10MB)
    if info.compress_size > 0 and info.file_size > 10 * 1024 * 1024:
        ratio = info.file_size / info.compress_size
        if ratio > 100.0:
            raise ClipFetchError(f"Suspicious compression ratio ({ratio:.1f}:1) detected for '{name}'. Potential decompression bomb.", status_code=400)

    return resolved_target


def inspect_zip_archive(source: Path) -> list[dict[str, Any]]:
    """
    Inspects and validates an uploaded ZIP archive without extracting it.
    Returns metadata list of entries.
    """
    if not zipfile.is_zipfile(source):
        raise ClipFetchError("The uploaded file is not a valid ZIP archive.", status_code=400)

    entries: list[dict[str, Any]] = []
    dummy_dir = source.parent / "_inspect_sandbox"
    total_uncompressed = 0

    with zipfile.ZipFile(source, "r") as archive:
        infolist = archive.infolist()
        if len(infolist) > MAX_ARCHIVE_FILES:
            raise ClipFetchError(f"Archive contains too many files ({len(infolist)}). Limit is {MAX_ARCHIVE_FILES}.", status_code=400)

        for info in infolist:
            _validate_zip_entry(info, dummy_dir)
            total_uncompressed += info.file_size
            if total_uncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES:
                raise ClipFetchError("Total uncompressed size of archive exceeds 500 MB limit.", status_code=400)

            entries.append({
                "name": info.filename,
                "size": info.file_size,
                "compressed_size": info.compress_size,
                "is_dir": info.is_dir(),
            })

    return entries


def extract_zip_archive(source: Path, output_dir: Path) -> Path:
    """
    Safely extracts all files from a ZIP archive into a destination folder,
    and returns a clean, sanitized output ZIP archive containing all extracted files.
    """
    if not zipfile.is_zipfile(source):
        raise ClipFetchError("The uploaded file is not a valid ZIP archive.", status_code=400)

    extract_sandbox = output_dir / "extracted"
    extract_sandbox.mkdir(parents=True, exist_ok=True)

    total_uncompressed = 0
    with zipfile.ZipFile(source, "r") as archive:
        infolist = archive.infolist()
        if len(infolist) > MAX_ARCHIVE_FILES:
            raise ClipFetchError(f"Archive contains too many files ({len(infolist)}).", status_code=400)

        for info in infolist:
            target_path = _validate_zip_entry(info, extract_sandbox)
            total_uncompressed += info.file_size
            if total_uncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES:
                raise ClipFetchError("Total uncompressed size of archive exceeds 500 MB limit.", status_code=400)

            if info.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
            else:
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(info) as src, open(target_path, "wb") as dst:
                    while chunk := src.read(64 * 1024):
                        dst.write(chunk)

    # Repackage safely into a clean output ZIP for download
    output_archive = output_dir / "extracted_files.zip"
    with zipfile.ZipFile(output_archive, "w", compression=zipfile.ZIP_DEFLATED) as clean_zip:
        for root, _, files in os.walk(extract_sandbox):
            for file in files:
                full_path = Path(root) / file
                rel_path = full_path.relative_to(extract_sandbox)
                clean_zip.write(full_path, arcname=str(rel_path))

    return output_archive

