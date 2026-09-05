from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.services.pdf_tools import compress_pdf, delete_pages, images_to_pdf, merge_pdfs, pdf_to_images, reorder_pages, split_pdf
from app.utils.files import cleanup_work_dir, create_work_dir, save_upload, safe_upload_name

router = APIRouter(prefix="/api/pdf", tags=["PDF tools"])
PDF_EXTENSIONS = {".pdf"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def result_file(work_dir: Path, output: Path, media_type: str = "application/octet-stream") -> FileResponse:
    return FileResponse(output, filename=output.name, media_type=media_type, background=BackgroundTask(cleanup_work_dir, work_dir))


@router.post("/merge")
async def merge(files: list[UploadFile] = File(...)):
    work_dir = create_work_dir()
    try:
        sources = []
        for index, upload in enumerate(files):
            destination = work_dir / f"{index}-{safe_upload_name(upload.filename, 'document')}"
            await save_upload(upload, destination, PDF_EXTENSIONS)
            sources.append(destination)
        output = work_dir / "merged.pdf"
        merge_pdfs(sources, output)
        return result_file(work_dir, output, "application/pdf")
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/split")
async def split(file: UploadFile = File(...), ranges: str | None = Form(None)):
    work_dir = create_work_dir()
    try:
        source = work_dir / safe_upload_name(file.filename, "document.pdf")
        await save_upload(file, source, PDF_EXTENSIONS)
        output = split_pdf(source, work_dir, ranges)
        return result_file(work_dir, output, "application/zip")
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/from-images")
async def from_images(files: list[UploadFile] = File(...)):
    work_dir = create_work_dir()
    try:
        sources = []
        for index, upload in enumerate(files):
            destination = work_dir / f"{index}-{safe_upload_name(upload.filename, 'image')}"
            await save_upload(upload, destination, IMAGE_EXTENSIONS)
            sources.append(destination)
        output = work_dir / "images.pdf"
        images_to_pdf(sources, output)
        return result_file(work_dir, output, "application/pdf")
    except Exception:
        cleanup_work_dir(work_dir)
        raise


async def saved_pdf(file: UploadFile, work_dir: Path) -> Path:
    source = work_dir / safe_upload_name(file.filename, "document.pdf")
    await save_upload(file, source, PDF_EXTENSIONS)
    return source


@router.post("/compress")
async def compress(file: UploadFile = File(...)):
    work_dir = create_work_dir()
    try:
        source = await saved_pdf(file, work_dir)
        output = work_dir / "compressed.pdf"
        compress_pdf(source, output)
        return result_file(work_dir, output, "application/pdf")
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/to-images")
async def to_images(file: UploadFile = File(...), image_format: str = Form("png")):
    work_dir = create_work_dir()
    try:
        source = await saved_pdf(file, work_dir)
        output = pdf_to_images(source, work_dir, image_format if image_format in {"png", "jpg"} else "png")
        return result_file(work_dir, output, "application/zip")
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/delete-pages")
async def delete(file: UploadFile = File(...), pages: str = Form(...)):
    work_dir = create_work_dir()
    try:
        source = await saved_pdf(file, work_dir)
        output = work_dir / "pages-deleted.pdf"
        delete_pages(source, output, pages)
        return result_file(work_dir, output, "application/pdf")
    except Exception:
        cleanup_work_dir(work_dir)
        raise


@router.post("/reorder")
async def reorder(file: UploadFile = File(...), order: str = Form(...)):
    work_dir = create_work_dir()
    try:
        source = await saved_pdf(file, work_dir)
        output = work_dir / "pages-reordered.pdf"
        reorder_pages(source, output, order)
        return result_file(work_dir, output, "application/pdf")
    except Exception:
        cleanup_work_dir(work_dir)
        raise
