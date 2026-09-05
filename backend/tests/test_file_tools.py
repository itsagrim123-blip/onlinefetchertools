from io import BytesIO
from pathlib import Path

from PIL import Image
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter

from app.main import app
from app.services.image_tools import compress_image, convert_image, resize_image
from app.services.pdf_tools import merge_pdfs, split_pdf

client = TestClient(app)


def make_image(path: Path, color: str = "red") -> None:
    Image.new("RGB", (120, 80), color).save(path, "PNG")


def make_pdf(path: Path, pages: int = 2) -> None:
    writer = PdfWriter()
    for _ in range(pages):
        writer.add_blank_page(width=300, height=300)
    writer.write(str(path))


def test_image_services_convert_compress_resize(tmp_path):
    source = tmp_path / "source.png"
    make_image(source)
    converted = tmp_path / "converted.jpg"
    compressed = tmp_path / "compressed.jpg"
    resized = tmp_path / "resized.png"

    convert_image(source, converted, "jpg")
    compress_image(converted, compressed, 60)
    resize_image(source, resized, 60, None, 80)

    assert Image.open(converted).format == "JPEG"
    assert compressed.exists()
    assert Image.open(resized).size == (60, 40)


def test_image_convert_api_returns_file(tmp_path):
    image = BytesIO()
    Image.new("RGB", (20, 20), "blue").save(image, "PNG")
    image.seek(0)

    response = client.post("/api/image/convert", files={"file": ("sample.png", image, "image/png")}, data={"output_format": "jpg"})

    assert response.status_code == 200
    assert response.headers["content-disposition"]
    assert response.content[:2] == b"\xff\xd8"


def test_pdf_merge_split_and_from_images(tmp_path):
    first = tmp_path / "one.pdf"
    second = tmp_path / "two.pdf"
    merged = tmp_path / "merged.pdf"
    make_pdf(first, 2)
    make_pdf(second, 1)

    assert merge_pdfs([first, second], merged) == 3
    assert len(PdfReader(str(merged)).pages) == 3
    archive = split_pdf(merged, tmp_path / "split")
    assert archive.exists()

    image = BytesIO()
    Image.new("RGB", (20, 20), "green").save(image, "PNG")
    image.seek(0)
    response = client.post("/api/pdf/from-images", files={"files": ("page.png", image, "image/png")})
    assert response.status_code == 200
    assert response.content[:4] == b"%PDF"
