from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

from app.errors import ClipFetchError
from app.utils.files import safe_upload_name

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def open_image(source: Path) -> Image.Image:
    try:
        with Image.open(source) as image:
            image.verify()
        return Image.open(source).convert("RGBA")
    except Exception as exc:
        raise ClipFetchError("The image is corrupted or unsupported", status_code=400) from exc


def convert_image(source: Path, output: Path, target_format: str, quality: int = 85) -> None:
    image = open_image(source)
    target = target_format.lower().lstrip(".")
    if target in {"jpg", "jpeg"}:
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.save(output, "JPEG", quality=max(1, min(100, quality)), optimize=True)
    elif target == "png":
        image.save(output, "PNG", optimize=True)
    elif target == "webp":
        image.save(output, "WEBP", quality=max(1, min(100, quality)), method=6)
    else:
        raise ClipFetchError("Unsupported image output format", status_code=400)


def compress_image(source: Path, output: Path, quality: int) -> None:
    convert_image(source, output, source.suffix or ".jpg", quality)


def resize_image(source: Path, output: Path, width: int, height: int | None, quality: int) -> None:
    if width < 1 or width > 10000 or (height is not None and (height < 1 or height > 10000)):
        raise ClipFetchError("Resize dimensions must be between 1 and 10000 pixels", status_code=400)
    image = open_image(source)
    if height:
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    else:
        ratio = width / image.width
        image = image.resize((width, max(1, round(image.height * ratio))), Image.Resampling.LANCZOS)
    target = source.suffix.lstrip(".") or "png"
    if target in {"jpg", "jpeg"}:
        image = image.convert("RGB")
        image.save(output, "JPEG", quality=quality, optimize=True)
    else:
        image.save(output, target.upper() if target != "webp" else "WEBP", optimize=True)
