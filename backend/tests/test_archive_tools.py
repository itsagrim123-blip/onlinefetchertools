from io import BytesIO
import zipfile
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.services.archive_tools import create_zip_archive, extract_zip_archive, inspect_zip_archive
from app.errors import ClipFetchError
import pytest

client = TestClient(app)


def test_create_zip_archive(tmp_path):
    f1 = tmp_path / "file1.txt"
    f2 = tmp_path / "file2.txt"
    f1.write_text("Hello One", encoding="utf-8")
    f2.write_text("Hello Two", encoding="utf-8")

    out_zip = tmp_path / "bundle.zip"
    count = create_zip_archive([(f1, "file1.txt"), (f2, "file1.txt")], out_zip)
    assert count == 2
    assert out_zip.exists()

    with zipfile.ZipFile(out_zip, "r") as archive:
        names = archive.namelist()
        assert "file1.txt" in names
        assert "file1 (1).txt" in names
        assert archive.read("file1.txt") == b"Hello One"
        assert archive.read("file1 (1).txt") == b"Hello Two"


def test_api_create_zip():
    response = client.post(
        "/api/file/create-zip",
        files=[
            ("files", ("doc.txt", BytesIO(b"content 1"), "text/plain")),
            ("files", ("image.png", BytesIO(b"\x89PNG\r\n\x1a\n"), "image/png")),
        ],
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"

    with zipfile.ZipFile(BytesIO(response.content), "r") as archive:
        names = archive.namelist()
        assert "doc.txt" in names
        assert "image.png" in names


def test_inspect_and_extract_safe_zip(tmp_path):
    zip_path = tmp_path / "safe.zip"
    with zipfile.ZipFile(zip_path, "w") as z:
        z.writestr("notes.txt", "meeting notes")
        z.writestr("sub/data.csv", "a,b,c")

    with open(zip_path, "rb") as f:
        file_bytes = f.read()

    # Inspect
    inspect_res = client.post(
        "/api/file/inspect-zip",
        files={"file": ("safe.zip", BytesIO(file_bytes), "application/zip")},
    )
    assert inspect_res.status_code == 200
    data = inspect_res.json()
    assert data["file_count"] == 2
    assert any(e["name"] == "notes.txt" for e in data["entries"])

    # Extract
    extract_res = client.post(
        "/api/file/extract-zip",
        files={"file": ("safe.zip", BytesIO(file_bytes), "application/zip")},
    )
    assert extract_res.status_code == 200
    assert extract_res.headers["content-type"] == "application/zip"


def test_reject_zip_slip_path_traversal(tmp_path):
    # Craft a malicious ZIP with path traversal
    malicious_zip = tmp_path / "evil.zip"
    with zipfile.ZipFile(malicious_zip, "w") as z:
        # Zip slip entry with ../../
        z.writestr("../../etc/passwd", "root:x:0:0:")

    with open(malicious_zip, "rb") as f:
        evil_bytes = f.read()

    # Test inspect rejects
    inspect_res = client.post(
        "/api/file/inspect-zip",
        files={"file": ("evil.zip", BytesIO(evil_bytes), "application/zip")},
    )
    assert inspect_res.status_code == 400
    assert "Path traversal is prohibited" in inspect_res.json()["detail"]

    # Test extract rejects
    extract_res = client.post(
        "/api/file/extract-zip",
        files={"file": ("evil.zip", BytesIO(evil_bytes), "application/zip")},
    )
    assert extract_res.status_code == 400
    assert "Path traversal is prohibited" in extract_res.json()["detail"]


def test_reject_absolute_path_zip(tmp_path):
    # Craft a malicious ZIP with absolute path
    malicious_zip = tmp_path / "abs.zip"
    with zipfile.ZipFile(malicious_zip, "w") as z:
        z.writestr("/root/secret.txt", "forbidden")

    with open(malicious_zip, "rb") as f:
        evil_bytes = f.read()

    res = client.post(
        "/api/file/inspect-zip",
        files={"file": ("abs.zip", BytesIO(evil_bytes), "application/zip")},
    )
    assert res.status_code == 400
    assert "Path traversal is prohibited" in res.json()["detail"]

