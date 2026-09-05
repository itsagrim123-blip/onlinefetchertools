from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.errors import ClipFetchError
from app.services.image_tools import IMAGE_EXTENSIONS, compress_image, convert_image, crop_image, resize_image, rotate_image
from app.utils.files import cleanup_work_dir, create_work_dir, safe_upload_name, save_upload
from app.utils.responses import download_response

router = APIRouter(prefix="/api/image", tags=["Image tools"])


def result_file(work_dir: Path, output: Path, filename: str | None = None) -> FileResponse:
    return download_response(output, filename=filename or output.name, work_dir=work_dir)


async def input_image(upload: UploadFile, work_dir: Path) -> Path:
    name = safe_upload_name(upload.filename, "image")
    source = work_dir / name
    await save_upload(upload, source, IMAGE_EXTENSIONS)
    return source


@router.post("/convert")
async def convert(file: UploadFile = File(...), output_format: str = Form("png"), quality: int = Form(85)):
    work_dir = create_work_dir()
    try:
        source = await input_image(file, work_dir)
        stem = Path(safe_upload_name(file.filename, "image")).stem
        target_ext = output_format.lower().lstrip(".") or "png"
        out_name = f"{stem}_converted.{target_ext}"
        output = work_dir / out_name
        await asyncio.to_thread(convert_image, source, output, output_format, quality)
        return result_file(work_dir, output, out_name)
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/compress")
async def compress(file: UploadFile = File(...), quality: int = Form(75)):
    work_dir = create_work_dir()
    try:
        source = await input_image(file, work_dir)
        stem = Path(safe_upload_name(file.filename, "image")).stem
        out_name = f"{stem}_compressed{source.suffix.lower()}"
        output = work_dir / out_name
        await asyncio.to_thread(compress_image, source, output, quality)
        return result_file(work_dir, output, out_name)
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/resize")
async def resize(file: UploadFile = File(...), width: int = Form(...), height: int | None = Form(None), quality: int = Form(85)):
    work_dir = create_work_dir()
    try:
        source = await input_image(file, work_dir)
        stem = Path(safe_upload_name(file.filename, "image")).stem
        out_name = f"{stem}_resized{source.suffix.lower()}"
        output = work_dir / out_name
        await asyncio.to_thread(resize_image, source, output, width, height, quality)
        return result_file(work_dir, output, out_name)
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/crop")
async def crop(
    file: UploadFile = File(...),
    x: int = Form(...),
    y: int = Form(...),
    width: int = Form(...),
    height: int = Form(...),
    output_format: str = Form("png"),
    quality: int = Form(85),
):
    work_dir = create_work_dir()
    try:
        source = await input_image(file, work_dir)
        stem = Path(safe_upload_name(file.filename, "image")).stem
        target = output_format.lower().lstrip(".") or "png"
        out_name = f"{stem}_cropped.{target}"
        output = work_dir / out_name
        await asyncio.to_thread(crop_image, source, output, x, y, width, height, target, quality)
        return result_file(work_dir, output, out_name)
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/rotate")
async def rotate(
    file: UploadFile = File(...),
    angle: int = Form(90),
    flip_horizontal: bool = Form(False),
    flip_vertical: bool = Form(False),
    output_format: str = Form("png"),
    quality: int = Form(85),
):
    work_dir = create_work_dir()
    try:
        source = await input_image(file, work_dir)
        stem = Path(safe_upload_name(file.filename, "image")).stem
        target = output_format.lower().lstrip(".") or "png"
        out_name = f"{stem}_rotated.{target}"
        output = work_dir / out_name
        await asyncio.to_thread(rotate_image, source, output, angle, flip_horizontal, flip_vertical, target, quality)
        return result_file(work_dir, output, out_name)
    except Exception:
        cleanup_work_dir(work_dir)
        raise
