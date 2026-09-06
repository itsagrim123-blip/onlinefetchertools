from __future__ import annotations

from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def make_test_image(format: str = "JPEG", size: tuple[int, int] = (120, 120)) -> BytesIO:
    """Creates an image with a distinct subject (red circle) on a white background."""
    img = Image.new("RGB", size, (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse((30, 30, 90, 90), fill=(220, 20, 60))
    buffer = BytesIO()
    img.save(buffer, format=format)
    buffer.seek(0)
    return buffer


def test_remove_background_jpg_returns_transparent_png():
    img_buf = make_test_image("JPEG")
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("product.jpg", img_buf, "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert "product-no-bg.png" in response.headers["content-disposition"]
    assert "product-no-bg.png" in response.headers.get("x-filename", "")

    # Validate output image properties
    out_img = Image.open(BytesIO(response.content))
    assert out_img.format == "PNG"
    assert out_img.mode == "RGBA"
    assert out_img.size == (120, 120)

    # Verify that transparency is REAL (alpha channel contains transparent pixels < 255)
    alpha = out_img.split()[-1]
    alpha_extrema = alpha.getextrema()
    # At least some pixels should be transparent (min alpha < 255)
    assert alpha_extrema[0] < 255, f"Expected transparent pixels, but min alpha is {alpha_extrema[0]}"


def test_remove_background_png_input():
    img_buf = make_test_image("PNG")
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("portrait.png", img_buf, "image/png")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert "portrait-no-bg.png" in response.headers["content-disposition"]

    out_img = Image.open(BytesIO(response.content))
    assert out_img.format == "PNG"
    assert out_img.mode == "RGBA"
    alpha = out_img.split()[-1]
    assert alpha.getextrema()[0] < 255


def test_remove_background_webp_input():
    img_buf = make_test_image("WEBP")
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("banner.webp", img_buf, "image/webp")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert "banner-no-bg.png" in response.headers["content-disposition"]


def test_remove_background_solid_color_replacement():
    img_buf = make_test_image("JPEG")
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("photo.jpg", img_buf, "image/jpeg")},
        data={"background_color": "#00ff00"},
    )

    assert response.status_code == 200
    out_img = Image.open(BytesIO(response.content))
    assert out_img.size == (120, 120)
    # When replaced with solid color, background pixels will have color #00ff00 and alpha 255
    corner_pixel = out_img.getpixel((5, 5))
    # Green should be dominant in corner background
    assert corner_pixel[1] > corner_pixel[0]


def test_remove_background_corrupted_file_returns_400():
    corrupted_data = BytesIO(b"not-a-valid-image-file-data")
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("broken.jpg", corrupted_data, "image/jpeg")},
    )

    assert response.status_code == 400
    assert "corrupted" in response.json()["detail"].lower()


def test_remove_background_oversized_dimensions_rejected(monkeypatch):
    img_buf = make_test_image("JPEG")

    # Mock open_image to simulate an oversized image
    from app.services import image_tools

    original_open = image_tools.open_image

    def mock_open_image(source: Path):
        return Image.new("RGBA", (5001, 4000), (255, 255, 255, 255))

    monkeypatch.setattr(image_tools, "open_image", mock_open_image)

    response = client.post(
        "/api/image/remove-background",
        files={"file": ("huge.jpg", img_buf, "image/jpeg")},
    )

    assert response.status_code == 400
    assert "exceed the maximum supported limit" in response.json()["detail"]


def test_remove_background_cleanup_on_error(monkeypatch):
    img_buf = make_test_image("JPEG")

    from app.routes import image as image_route
    from app.errors import ClipFetchError

    cleanup_called = False
    orig_cleanup = image_route.cleanup_work_dir

    def mock_cleanup(work_dir):
        nonlocal cleanup_called
        cleanup_called = True
        orig_cleanup(work_dir)

    def mock_fail(*args, **kwargs):
        raise ClipFetchError("Simulated segmentation failure", status_code=500)

    monkeypatch.setattr(image_route, "process_remove_background", mock_fail)
    monkeypatch.setattr(image_route, "cleanup_work_dir", mock_cleanup)

    response = client.post(
        "/api/image/remove-background",
        files={"file": ("test.jpg", img_buf, "image/jpeg")},
    )

    assert response.status_code == 500
    assert cleanup_called is True


def test_remove_background_edge_refinement_flag():
    img_buf = make_test_image("PNG")
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("person_hair.png", img_buf, "image/png")},
        data={"edge_refinement": "true"},
    )

    assert response.status_code == 200
    out_img = Image.open(BytesIO(response.content))
    assert out_img.format == "PNG"
    assert out_img.mode == "RGBA"
    assert out_img.size == (120, 120)


def test_remove_background_transparent_png_input():
    # Input image with transparent background already + additional content
    img = Image.new("RGBA", (100, 100), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rectangle((20, 20, 80, 80), fill=(255, 100, 0, 255))
    buf = BytesIO()
    img.save(buf, "PNG")
    buf.seek(0)

    response = client.post(
        "/api/image/remove-background",
        files={"file": ("transparent_input.png", buf, "image/png")},
    )

    assert response.status_code == 200
    out_img = Image.open(BytesIO(response.content))
    assert out_img.format == "PNG"
    assert out_img.mode == "RGBA"
    alpha = out_img.split()[-1]
    assert alpha.getextrema()[0] < 255


def test_remove_background_headers_and_disposition():
    img_buf = make_test_image("JPEG", size=(150, 90))
    response = client.post(
        "/api/image/remove-background",
        files={"file": ("camera_product.jpg", img_buf, "image/jpeg")},
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/png"
    assert "camera_product-no-bg.png" in response.headers["content-disposition"]
    assert response.headers["x-filename"] == "camera_product-no-bg.png"
    assert response.headers["x-image-width"] == "150"
    assert response.headers["x-image-height"] == "90"
    assert "no-cache" in response.headers["cache-control"]


