from __future__ import annotations

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from PIL import Image
from pypdf import PdfReader, PdfWriter

from app.errors import ClipFetchError


def merge_pdfs(sources: list[Path], output: Path) -> int:
    writer = PdfWriter()
    try:
        for source in sources:
            reader = PdfReader(str(source))
            for page in reader.pages:
                writer.add_page(page)
        with output.open("wb") as stream:
            writer.write(stream)
        return len(writer.pages)
    except Exception as exc:
        raise ClipFetchError("One or more PDFs are invalid", status_code=400) from exc


def parse_ranges(value: str, total_pages: int) -> list[int]:
    pages: set[int] = set()
    try:
        for part in value.split(","):
            token = part.strip()
            if not token:
                continue
            if "-" in token:
                start, end = (int(piece.strip()) for piece in token.split("-", 1))
                if start > end:
                    raise ValueError
                pages.update(range(start, end + 1))
            else:
                pages.add(int(token))
        if not pages or min(pages) < 1 or max(pages) > total_pages:
            raise ValueError
        return sorted(page - 1 for page in pages)
    except ValueError as exc:
        raise ClipFetchError(f"Invalid page range. Use values from 1 to {total_pages}.", status_code=400) from exc


def split_pdf(source: Path, output_dir: Path, ranges: str | None = None) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(str(source))
    groups = [parse_ranges(ranges, len(reader.pages))] if ranges else [[index] for index in range(len(reader.pages))]
    archive = output_dir / "split-pages.zip"
    with ZipFile(archive, "w", ZIP_DEFLATED) as zipped:
        for index, group in enumerate(groups, 1):
            writer = PdfWriter()
            for page_index in group:
                writer.add_page(reader.pages[page_index])
            page_file = output_dir / f"part-{index}.pdf"
            with page_file.open("wb") as stream:
                writer.write(stream)
            zipped.write(page_file, page_file.name)
    return archive


def images_to_pdf(sources: list[Path], output: Path) -> None:
    images = []
    try:
        for source in sources:
            with Image.open(source) as image:
                images.append(image.convert("RGB"))
        if not images:
            raise ValueError
        images[0].save(output, "PDF", save_all=True, append_images=images[1:])
    except Exception as exc:
        raise ClipFetchError("Could not create a PDF from the supplied images", status_code=400) from exc
    finally:
        for image in images:
            image.close()


def compress_pdf(source: Path, output: Path) -> None:
    reader = PdfReader(str(source))
    writer = PdfWriter(clone_from=reader)
    for page in writer.pages:
        page.compress_content_streams()
    writer.write(str(output))


def delete_pages(source: Path, output: Path, pages: str) -> None:
    reader = PdfReader(str(source))
    remove = set(parse_ranges(pages, len(reader.pages)))
    writer = PdfWriter()
    for index, page in enumerate(reader.pages):
        if index not in remove:
            writer.add_page(page)
    writer.write(str(output))


def reorder_pages(source: Path, output: Path, order: str) -> None:
    reader = PdfReader(str(source))
    indices = parse_ranges(order, len(reader.pages))
    if len(indices) != len(reader.pages) or set(indices) != set(range(len(reader.pages))):
        raise ClipFetchError("Reorder must include every page exactly once", status_code=400)
    writer = PdfWriter()
    for index in indices:
        writer.add_page(reader.pages[index])
    writer.write(str(output))


def pdf_to_images(source: Path, output_dir: Path, image_format: str = "png") -> Path:
    try:
        import fitz

        output_dir.mkdir(parents=True, exist_ok=True)
        document = fitz.open(str(source))
        archive = output_dir / "pdf-images.zip"
        with ZipFile(archive, "w", ZIP_DEFLATED) as zipped:
            for index, page in enumerate(document, 1):
                pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
                image_path = output_dir / f"page-{index}.{image_format}"
                pixmap.save(str(image_path))
                zipped.write(image_path, image_path.name)
        document.close()
        return archive
    except Exception as exc:
        raise ClipFetchError("Could not render the PDF pages", status_code=400) from exc
