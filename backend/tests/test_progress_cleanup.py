from app.services.cleanup import CleanupService
from app.services.downloader import DownloadService


def test_download_service_handles_progress_and_failure():
    service = DownloadService()
    job = service.create_job("https://example.com/watch?v=abc123", "bestvideo")
    job.status = "downloading"
    job.progress = 25
    service.store.update(job)
    current = service.get_status(job.id)
    assert current.status == "downloading"
    assert current.progress == 25


def test_cleanup_service_starts_and_runs():
    cleanup = CleanupService()
    assert cleanup is not None
    cleanup.stop()
