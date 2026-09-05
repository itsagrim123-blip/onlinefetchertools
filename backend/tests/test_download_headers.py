from __future__ import annotations

import io
from urllib.parse import unquote

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def make_test_image(format="PNG") -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (50, 50), color=(255, 0, 0))
    img.save(buf, format=format)
    return buf.getvalue()


def test_cors_expose_headers():
    image_bytes = make_test_image("PNG")
    response = client.post(
        "/api/image/convert",
        headers={
            "Origin": "http://localhost:3000",
        },
        files={"file": ("test.png", io.BytesIO(image_bytes), "image/png")},
        data={"output_format": "png", "quality": 85},
    )
    assert response.status_code == 200
    exposed = response.headers.get("access-control-expose-headers", "")
    assert "Content-Disposition" in exposed
    assert "Content-Type" in exposed
    assert "X-Filename" in exposed
    assert "Cache-Control" in exposed


def test_image_convert_headers():
    image_bytes = make_test_image("PNG")
    response = client.post(
        "/api/image/convert",
        files={"file": ("sample photo.png", io.BytesIO(image_bytes), "image/png")},
        data={"output_format": "jpg", "quality": 85},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert "no-cache" in response.headers.get("cache-control", "")
    assert "no-store" in response.headers.get("cache-control", "")

    cd = response.headers.get("content-disposition", "")
    assert 'filename="sample_photo_converted.jpg"' in cd
    assert "filename*=UTF-8''" in cd

    x_fn = unquote(response.headers.get("x-filename", ""))
    assert x_fn.endswith(".jpg")
    assert "converted" in x_fn


def test_image_compress_headers():
    image_bytes = make_test_image("JPEG")
    response = client.post(
        "/api/image/compress",
        files={"file": ("my_image.jpg", io.BytesIO(image_bytes), "image/jpeg")},
        data={"quality": 75},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert "no-cache" in response.headers.get("cache-control", "")
    x_fn = unquote(response.headers.get("x-filename", ""))
    assert x_fn == "my_image_compressed.jpg"


def test_pdf_merge_headers():
    # Simple minimal PDF bytes
    pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n101\n%%EOF\n"
    response = client.post(
        "/api/pdf/merge",
        files=[
            ("files", ("doc1.pdf", io.BytesIO(pdf_bytes), "application/pdf")),
            ("files", ("doc2.pdf", io.BytesIO(pdf_bytes), "application/pdf")),
        ],
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert "no-cache" in response.headers.get("cache-control", "")
    x_fn = unquote(response.headers.get("x-filename", ""))
    assert x_fn == "merged.pdf"


def test_create_zip_headers():
    response = client.post(
        "/api/file/create-zip",
        files=[
            ("files", ("test1.txt", io.BytesIO(b"Hello world"), "text/plain")),
        ],
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "no-cache" in response.headers.get("cache-control", "")
    x_fn = unquote(response.headers.get("x-filename", ""))
    assert x_fn == "archive.zip"


def test_sequential_downloads_mime_integrity():
    """
    Simulates the exact user sequence on mobile:
    JPG -> PNG -> PDF -> JPG -> WebP -> ZIP
    Verifies that every download has its own independent filename,
    correct extension, exact MIME type, and no-cache headers.
    """
    pdf_bytes = b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n101\n%%EOF\n"

    # 1. Download JPG
    img_jpg = make_test_image("JPEG")
    res1 = client.post(
        "/api/image/compress",
        files={"file": ("photo1.jpg", io.BytesIO(img_jpg), "image/jpeg")},
        data={"quality": 80},
    )
    assert res1.status_code == 200
    assert res1.headers["content-type"] == "image/jpeg"
    assert unquote(res1.headers["x-filename"]) == "photo1_compressed.jpg"

    # 2. Download PNG
    res2 = client.post(
        "/api/image/convert",
        files={"file": ("photo2.jpg", io.BytesIO(img_jpg), "image/jpeg")},
        data={"output_format": "png", "quality": 90},
    )
    assert res2.status_code == 200
    assert res2.headers["content-type"] == "image/png"
    assert unquote(res2.headers["x-filename"]) == "photo2_converted.png"

    # 3. Download PDF
    res3 = client.post(
        "/api/pdf/merge",
        files=[
            ("files", ("doc_a.pdf", io.BytesIO(pdf_bytes), "application/pdf")),
            ("files", ("doc_b.pdf", io.BytesIO(pdf_bytes), "application/pdf")),
        ],
    )
    assert res3.status_code == 200
    assert res3.headers["content-type"] == "application/pdf"
    assert unquote(res3.headers["x-filename"]) == "merged.pdf"

    # 4. Download JPG again
    res4 = client.post(
        "/api/image/resize",
        files={"file": ("banner.jpg", io.BytesIO(img_jpg), "image/jpeg")},
        data={"width": 100, "quality": 80},
    )
    assert res4.status_code == 200
    assert res4.headers["content-type"] == "image/jpeg"
    assert unquote(res4.headers["x-filename"]) == "banner_resized.jpg"

    # 5. Download WebP
    res5 = client.post(
        "/api/image/convert",
        files={"file": ("picture.png", io.BytesIO(make_test_image("PNG")), "image/png")},
        data={"output_format": "webp", "quality": 80},
    )
    assert res5.status_code == 200
    assert res5.headers["content-type"] == "image/webp"
    assert unquote(res5.headers["x-filename"]) == "picture_converted.webp"

    # 6. Download ZIP
    res6 = client.post(
        "/api/file/create-zip",
        files=[
            ("files", ("data.txt", io.BytesIO(b"content"), "text/plain")),
        ],
    )
    assert res6.status_code == 200
    assert res6.headers["content-type"] == "application/zip"
    assert unquote(res6.headers["x-filename"]) == "archive.zip"

