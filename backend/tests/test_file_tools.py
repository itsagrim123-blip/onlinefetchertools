from io import BytesIO
from pathlib import Path

from PIL import Image
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter

from app.main import app
from app.services.image_tools import compress_image, convert_image, resize_image
from app.services.media_tools import _conversion_error
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


def test_media_errors_are_actionable():
    assert "audio track" in _conversion_error("Output file #0 does not contain any stream")
    assert "readable media" in _conversion_error("moov atom not found")


def test_image_crop_and_rotate():
    image = BytesIO()
    Image.new("RGB", (100, 100), "red").save(image, "PNG")
    image.seek(0)

    # Crop
    crop_res = client.post(
        "/api/image/crop",
        files={"file": ("sample.png", BytesIO(image.getvalue()), "image/png")},
        data={"x": 10, "y": 10, "width": 50, "height": 40, "output_format": "png"},
    )
    assert crop_res.status_code == 200
    cropped = Image.open(BytesIO(crop_res.content))
    assert cropped.size == (50, 40)

    # Rotate
    rot_res = client.post(
        "/api/image/rotate",
        files={"file": ("sample.png", BytesIO(image.getvalue()), "image/png")},
        data={"angle": 90, "flip_horizontal": "true", "output_format": "png"},
    )
    assert rot_res.status_code == 200
    rotated = Image.open(BytesIO(rot_res.content))
    assert rotated.size == (100, 100)


def test_webp_image_conversion():
    png_img = BytesIO()
    Image.new("RGBA", (40, 40), (255, 0, 0, 128)).save(png_img, "PNG")
    png_img.seek(0)

    # Convert to WebP
    webp_res = client.post(
        "/api/image/convert",
        files={"file": ("test.png", png_img, "image/png")},
        data={"output_format": "webp", "quality": 80},
    )
    assert webp_res.status_code == 200
    assert webp_res.content[:4] == b"RIFF"

    # Convert WebP back to PNG
    webp_bytes = BytesIO(webp_res.content)
    png_res = client.post(
        "/api/image/convert",
        files={"file": ("test.webp", webp_bytes, "image/webp")},
        data={"output_format": "png"},
    )
    assert png_res.status_code == 200
    roundtrip = Image.open(BytesIO(png_res.content))
    assert roundtrip.format == "PNG"


def test_pdf_to_text_and_manage(tmp_path):
    import pytest
    fitz = pytest.importorskip("fitz")

    doc = fitz.open()
    p1 = doc.new_page()
    p1.insert_text((50, 50), "First Page Content")
    p2 = doc.new_page()
    p2.insert_text((50, 50), "Second Page Content")
    pdf_path = tmp_path / "sample_doc.pdf"
    doc.save(str(pdf_path))
    doc.close()

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    # Test PDF to Text
    text_res = client.post(
        "/api/pdf/to-text",
        files={"file": ("sample.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )
    assert text_res.status_code == 200
    assert "First Page Content" in text_res.text
    assert "Second Page Content" in text_res.text

    # Test PDF Manage (delete page 1, keep only page 2)
    manage_res = client.post(
        "/api/pdf/manage",
        files={"file": ("sample.pdf", BytesIO(pdf_bytes), "application/pdf")},
        data={"order": "2"},
    )
    assert manage_res.status_code == 200
    managed_doc = fitz.open(stream=manage_res.content, filetype="pdf")
    assert len(managed_doc) == 1
    assert "Second Page Content" in managed_doc[0].get_text()
    managed_doc.close()

    # Test PDF Thumbnails
    thumb_res = client.post(
        "/api/pdf/thumbnails",
        files={"file": ("sample.pdf", BytesIO(pdf_bytes), "application/pdf")},
    )
    assert thumb_res.status_code == 200
    data = thumb_res.json()
    assert data["page_count"] == 2
    assert len(data["thumbnails"]) == 2
    assert data["thumbnails"][0].startswith("data:image/jpeg;base64,")
