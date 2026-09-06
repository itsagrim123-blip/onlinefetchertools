from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageOps

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:
    pass

from app.errors import ClipFetchError
from app.utils.files import safe_upload_name

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}


def open_image(source: Path) -> Image.Image:
    try:
        with Image.open(source) as image:
            image.verify()
        opened = Image.open(source)
        opened = ImageOps.exif_transpose(opened)
        return opened.convert("RGBA")
    except Exception as exc:
        raise ClipFetchError("The image is corrupted or unsupported", status_code=400) from exc


def convert_image(source: Path, output: Path, target_format: str, quality: int = 85) -> None:
    image = open_image(source)
    target = target_format.lower().lstrip(".")
    if target in {"jpg", "jpeg"}:
        image = image.convert("RGB")
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


def crop_image(
    source: Path,
    output: Path,
    x: int,
    y: int,
    width: int,
    height: int,
    target_format: str = "png",
    quality: int = 85,
) -> None:
    if width <= 0 or height <= 0:
        raise ClipFetchError("Crop dimensions must be greater than zero", status_code=400)
    image = open_image(source)
    img_w, img_h = image.size
    if x < 0 or y < 0 or x >= img_w or y >= img_h:
        raise ClipFetchError("Crop coordinates are outside image bounds", status_code=400)
    box = (x, y, min(img_w, x + width), min(img_h, y + height))
    cropped = image.crop(box)
    target = (target_format or source.suffix.lstrip(".") or "png").lower().lstrip(".")
    if target in {"jpg", "jpeg"}:
        cropped = cropped.convert("RGB")
        cropped.save(output, "JPEG", quality=max(1, min(100, quality)), optimize=True)
    elif target == "webp":
        cropped.save(output, "WEBP", quality=max(1, min(100, quality)), method=6)
    else:
        cropped.save(output, "PNG", optimize=True)


def rotate_image(
    source: Path,
    output: Path,
    angle: int = 90,
    flip_horizontal: bool = False,
    flip_vertical: bool = False,
    target_format: str = "png",
    quality: int = 85,
) -> None:
    if angle not in {0, 90, 180, 270, 360}:
        raise ClipFetchError("Angle must be 0, 90, 180, or 270 degrees", status_code=400)
    image = open_image(source)
    norm_angle = angle % 360
    if norm_angle != 0:
        image = image.rotate(-norm_angle, expand=True)
    if flip_horizontal:
        image = ImageOps.mirror(image)
    if flip_vertical:
        image = ImageOps.flip(image)

    target = (target_format or source.suffix.lstrip(".") or "png").lower().lstrip(".")
    if target in {"jpg", "jpeg"}:
        image = image.convert("RGB")
        image.save(output, "JPEG", quality=max(1, min(100, quality)), optimize=True)
    elif target == "webp":
        image.save(output, "WEBP", quality=max(1, min(100, quality)), method=6)
    else:
        image.save(output, "PNG", optimize=True)


def process_remove_background(
    source: Path,
    output: Path,
    edge_refinement: bool = False,
    background_color: str | None = None,
) -> tuple[int, int]:
    image = open_image(source)
    width, height = image.size

    if width > 5000 or height > 5000:
        raise ClipFetchError(
            f"Image dimensions ({width}x{height} px) exceed the maximum supported limit (5000x5000 px)",
            status_code=400,
        )

    from app.services.background_remover import BackgroundRemoverService

    service = BackgroundRemoverService.get_instance()
    result = service.remove_background_sync(
        image,
        alpha_matting=edge_refinement,
        background_color=background_color,
    )

    result.save(output, "PNG", optimize=True)
    return result.width, result.height

