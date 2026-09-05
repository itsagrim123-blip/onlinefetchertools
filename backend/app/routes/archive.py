from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask

from app.services.archive_tools import create_zip_archive, extract_zip_archive, inspect_zip_archive
from app.utils.files import cleanup_work_dir, create_work_dir, safe_upload_name, save_upload

router = APIRouter(prefix="/api/file", tags=["File and Archive tools"])
ZIP_EXTENSIONS = {".zip"}


def result_file(work_dir: Path, output: Path, media_type: str = "application/zip") -> FileResponse:
    return FileResponse(
        output,
        filename=output.name,
        media_type=media_type,
        background=BackgroundTask(cleanup_work_dir, work_dir),
    )


@router.post("/create-zip")
async def create_zip(files: list[UploadFile] = File(...)):
    work_dir = create_work_dir()
    try:
        sources: list[tuple[Path, str]] = []
        for index, upload in enumerate(files):
            clean_raw = upload.filename or f"file_{index}"
            destination = work_dir / f"upload_{index}_{safe_upload_name(clean_raw, 'item')}"
            # Allow any file extensions for archiving
            destination.parent.mkdir(parents=True, exist_ok=True)
            with destination.open("wb") as output:
                while chunk := await upload.read(1024 * 1024):
                    output.write(chunk)
            sources.append((destination, clean_raw))

        output_zip = work_dir / "archive.zip"
        create_zip_archive(sources, output_zip)
        return result_file(work_dir, output_zip, "application/zip")
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/inspect-zip")
async def inspect_zip(file: UploadFile = File(...)):
    work_dir = create_work_dir()
    try:
        destination = work_dir / safe_upload_name(file.filename, "archive.zip")
        await save_upload(file, destination, ZIP_EXTENSIONS)
        entries = inspect_zip_archive(destination)
        cleanup_work_dir(work_dir)
        return JSONResponse({"file_count": len(entries), "entries": entries})
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/extract-zip")
async def extract_zip(file: UploadFile = File(...)):
    work_dir = create_work_dir()
    try:
        destination = work_dir / safe_upload_name(file.filename, "archive.zip")
        await save_upload(file, destination, ZIP_EXTENSIONS)
        output_zip = extract_zip_archive(destination, work_dir)
        return result_file(work_dir, output_zip, "application/zip")
    except Exception:
        cleanup_work_dir(work_dir)
        raise

