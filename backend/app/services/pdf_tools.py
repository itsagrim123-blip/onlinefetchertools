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


def pdf_to_text(source: Path, output: Path) -> str:
    try:
        import fitz

        document = fitz.open(str(source))
        extracted_parts: list[str] = []
        total_pages = len(document)

        for page_num, page in enumerate(document, 1):
            text = page.get_text()
            header = f"--- Page {page_num} of {total_pages} ---"
            if text and text.strip():
                extracted_parts.append(f"{header}\n\n{text.strip()}")
            else:
                extracted_parts.append(f"{header}\n\n[No extractable text on this page]")

        document.close()

        full_text = "\n\n".join(extracted_parts)
        # Check if entire PDF had no extractable text
        has_any_text = any("[No extractable text on this page]" not in part for part in extracted_parts)
        if not has_any_text:
            full_text = "No extractable text was found in this PDF document.\nScanned pages or image-only documents require OCR to recognize text."

        output.write_text(full_text, encoding="utf-8")
        return full_text
    except Exception as exc:
        if isinstance(exc, ClipFetchError):
            raise
        raise ClipFetchError("Could not extract text from the PDF", status_code=400) from exc


def manage_pages(source: Path, output: Path, order: str) -> None:
    """
    Manages PDF pages by retaining and ordering the specified 1-based page numbers.
    Supports both deletion (omitted pages) and reordering (arbitrary sequence).
    Example: order="3,1,4" keeps pages 3, 1, and 4 in that exact order.
    """
    try:
        reader = PdfReader(str(source))
        total_pages = len(reader.pages)
        if total_pages == 0:
            raise ClipFetchError("The PDF document has no pages.", status_code=400)

        tokens = [t.strip() for t in order.split(",") if t.strip()]
        if not tokens:
            raise ClipFetchError("You must select at least one page to keep.", status_code=400)

        page_indices: list[int] = []
        for token in tokens:
            try:
                page_num = int(token)
            except ValueError:
                raise ClipFetchError(f"Invalid page number: '{token}'.", status_code=400)
            if page_num < 1 or page_num > total_pages:
                raise ClipFetchError(f"Page number {page_num} is out of bounds (1-{total_pages}).", status_code=400)
            page_indices.append(page_num - 1)

        writer = PdfWriter()
        for idx in page_indices:
            writer.add_page(reader.pages[idx])

        with output.open("wb") as stream:
            writer.write(stream)
    except ClipFetchError:
        raise
    except Exception as exc:
        raise ClipFetchError("Failed to update PDF pages.", status_code=400) from exc


def generate_pdf_thumbnails(source: Path, max_pages: int = 100) -> list[str]:
    """
    Generates lightweight JPEG thumbnail previews encoded as base64 data URLs.
    """
    import base64

    try:
        import fitz

        document = fitz.open(str(source))
        thumbnails: list[str] = []
        limit = min(len(document), max_pages)

        for i in range(limit):
            page = document[i]
            pix = page.get_pixmap(matrix=fitz.Matrix(0.35, 0.35), alpha=False)
            jpeg_bytes = pix.tobytes("jpeg")
            encoded = base64.b64encode(jpeg_bytes).decode("ascii")
            thumbnails.append(f"data:image/jpeg;base64,{encoded}")

        document.close()
        return thumbnails
    except Exception as exc:
        raise ClipFetchError("Could not generate page thumbnails for this PDF.", status_code=400) from exc
