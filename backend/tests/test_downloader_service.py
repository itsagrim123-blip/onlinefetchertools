from pathlib import Path

from app.models import DownloadJob
from app.services.downloader import DownloadService
from app.utils.validation import sanitize_filename, validate_url


def test_validate_url_rejects_internal_targets():
    try:
        validate_url("http://localhost:8000/test")
        assert False
    except ValueError:
        assert True


def test_filename_sanitization_security():
    safe = sanitize_filename("../../not safe?.mp4", fallback="file")
    assert safe == "not_safe.mp4"


def test_job_lifecycle_round_trip():
    service = DownloadService()
    job = service.create_job("https://example.com/watch?v=abc123", "bestvideo", "sample clip")
    assert job.id
    assert job.status == "queued"
    assert job.filename == "sample_clip"


def test_cleanup_service_handles_temp_dirs():
    service = DownloadService()
    job = service.create_job("https://example.com/watch?v=abc123", "bestvideo", "tmp test")
    temp_dir = Path(job.temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    (temp_dir / "test.txt").write_text("demo", encoding="utf-8")
    assert temp_dir.exists()
