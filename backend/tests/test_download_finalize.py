from pathlib import Path

from app.models import DownloadJob
from app.services.downloader import DownloadService


def test_finalize_download_accepts_media_containers(tmp_path, monkeypatch):
    service = DownloadService()
    job = DownloadJob(url="https://example.com/video", format_id="best", filename="clipfetch-download", temp_dir=str(tmp_path / "temp"))
    temp_dir = Path(job.temp_dir)
    temp_dir.mkdir()
    (temp_dir / "video.json").write_text("{}", encoding="utf-8")
    media_file = temp_dir / "video.ts"
    media_file.write_bytes(b"media")

    monkeypatch.setattr("app.services.downloader.get_settings", lambda: type("Settings", (), {"download_path": tmp_path / "downloads"})())

    filename = service._finalize_download(job)

    assert filename == "video.ts"
    assert (tmp_path / "downloads" / filename).exists()


def test_finalize_download_finds_nested_yt_dlp_output(tmp_path, monkeypatch):
    service = DownloadService()
    job = DownloadJob(url="https://example.com/video", format_id="best", filename="clipfetch-download", temp_dir=str(tmp_path / "temp"))
    nested_dir = Path(job.temp_dir) / "downloads" / "tmp_nested"
    nested_dir.mkdir(parents=True)
    media_file = nested_dir / "video.mp4"
    media_file.write_bytes(b"media")

    monkeypatch.setattr("app.services.downloader.get_settings", lambda: type("Settings", (), {"download_path": tmp_path / "downloads"})())

    filename = service._finalize_download(job)

    assert filename == "video.mp4"
    assert (tmp_path / "downloads" / filename).exists()


def test_finalize_download_uses_video_title_by_default(tmp_path, monkeypatch):
    service = DownloadService()
    job = DownloadJob(url="https://example.com/video", format_id="best", filename="clipfetch-download", temp_dir=str(tmp_path / "temp"))
    temp_dir = Path(job.temp_dir)
    temp_dir.mkdir()
    (temp_dir / "My Video Title.mp4").write_bytes(b"media")

    monkeypatch.setattr("app.services.downloader.get_settings", lambda: type("Settings", (), {"download_path": tmp_path / "downloads"})())

    filename = service._finalize_download(job)

    assert filename == "My_Video_Title.mp4"
    assert (tmp_path / "downloads" / filename).exists()