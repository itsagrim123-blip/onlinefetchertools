from __future__ import annotations

import logging
import os
import shutil
import threading
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import get_settings
from app.errors import ClipFetchError, DownloadFailedError, JobNotFoundError
from app.models import DownloadJob, DownloadStatus
from app.utils.validation import sanitize_filename, validate_url

logger = logging.getLogger(__name__)


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, DownloadJob] = {}

    def create(self, job: DownloadJob) -> DownloadJob:
        self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> DownloadJob:
        job = self._jobs.get(job_id)
        if job is None:
            raise JobNotFoundError()
        return job

    def update(self, job: DownloadJob) -> DownloadJob:
        self._jobs[job.id] = job
        return job


class DownloadService:
    def __init__(self) -> None:
        self.store = JobStore()
        self._lock = threading.Lock()
        self._active_jobs = 0

    def create_job(self, url: str, format_id: str, filename_preference: str | None = None) -> DownloadJob:
        validate_url(url)
        base_name = sanitize_filename(filename_preference or "clipfetch-download", fallback="clipfetch-download")
        settings = get_settings()
        job = DownloadJob(
            id=str(uuid4()),
            url=url,
            format_id=format_id,
            filename=base_name,
            temp_dir=str(Path(settings.download_path) / f"tmp_{uuid4().hex}"),
        )
        with self._lock:
            self.store.create(job)
        return job

    def get_status(self, job_id: str) -> DownloadStatus:
        job = self.store.get(job_id)
        return DownloadStatus(
            job_id=job.id,
            status=job.status,
            progress=job.progress,
            filename=job.filename,
            error=job.error,
            downloaded_size=job.downloaded_size,
            speed=job.speed,
            eta=job.eta,
        )

    def get_file_path(self, job_id: str) -> Path:
        job = self.store.get(job_id)
        if job.status != "complete" or not job.filename:
            raise ClipFetchError("Download not ready", status_code=404)

        target = Path(get_settings().download_path) / job.filename
        if not target.exists():
            raise ClipFetchError("Download not found", status_code=404)
        return target

    def start(self, job: DownloadJob) -> None:
        settings = get_settings()
        with self._lock:
            if self._active_jobs >= settings.max_concurrent_downloads:
                raise ClipFetchError("Server busy", status_code=429)
            self._active_jobs += 1

        thread = threading.Thread(target=self._run_download, args=(job,), daemon=True)
        thread.start()

    def _run_download(self, job: DownloadJob) -> None:
        try:
            import yt_dlp

            job.status = "queued"
            self.store.update(job)
            os.makedirs(job.temp_dir or get_settings().download_path, exist_ok=True)

            safe_format = self._resolve_yt_dlp_format(job)
            outtmpl = str(Path(job.temp_dir or get_settings().download_path) / "%(title)s.%(ext)s")
            ydl_opts = {
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "outtmpl": outtmpl,
                "format": safe_format,
                "socket_timeout": get_settings().request_timeout_seconds,
                "retries": 2,
                "fragment_retries": 2,
                "progress_hooks": [self._progress_hook(job)],
                "paths": {"home": str(Path(job.temp_dir or get_settings().download_path))},
            }

            if safe_format == "bestaudio/best":
                ydl_opts["postprocessors"] = [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "0",
                }]
                ydl_opts["merge_output_format"] = "mp3"

            job.status = "downloading"
            self.store.update(job)

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([job.url])

            job.status = "processing"
            self.store.update(job)
            final_name = self._finalize_download(job)
            job.filename = final_name
            job.status = "complete"
            job.progress = 100
            job.completed_at = datetime.utcnow()
            job.error = None
            self.store.update(job)
        except Exception as exc:  # pragma: no cover - external downloader errors
            logger.exception("Download job failed for %s", job.id)
            job.status = "failed"
            job.progress = 0
            job.error = self._friendly_error_string(exc)
            job.completed_at = datetime.utcnow()
            self.store.update(job)
        finally:
            with self._lock:
                self._active_jobs = max(0, self._active_jobs - 1)
            if job.temp_dir:
                temp_path = Path(job.temp_dir)
                if temp_path.exists():
                    shutil.rmtree(temp_path, ignore_errors=True)

    def _resolve_yt_dlp_format(self, job: DownloadJob) -> str:
        selected = (job.format_id or "best").strip()
        if selected in {"best", "bestvideo", "bestaudio", "audio-only"}:
            return "bestaudio/best" if selected == "audio-only" else selected
        if selected.endswith("audio"):
            return "bestaudio/best"
        return selected

    def _progress_hook(self, job: DownloadJob):
        def hook(info: dict[str, Any]) -> None:
            if info.get("_type") == "playlist":
                return

            status = info.get("status")
            if status == "downloading":
                job.status = "downloading"
                total = info.get("total_bytes") or info.get("total_bytes_estimate") or 0
                downloaded = info.get("downloaded_bytes") or 0
                job.progress = int((downloaded / total) * 100) if total else 0
                job.downloaded_size = self._format_bytes(downloaded)
                job.speed = self._format_speed(info.get("speed") or 0)
                job.eta = self._format_eta(info.get("eta"))
            elif status == "finished":
                job.status = "processing"
                job.progress = 95
                job.eta = "processing"
            elif status == "error":
                job.status = "failed"
                job.error = "Download failed"
            self.store.update(job)
        return hook

    @staticmethod
    def _format_bytes(value: int) -> str:
        units = ["B", "KB", "MB", "GB"]
        size = float(value or 0)
        for unit in units:
            if size < 1024 or unit == units[-1]:
                return f"{size:.1f} {unit}"
            size /= 1024
        return "0 B"

    @staticmethod
    def _format_speed(value: float) -> str:
        if not value:
            return "0 KB/s"
        return f"{(value / 1024):.1f} KB/s"

    @staticmethod
    def _format_eta(value: Any) -> str:
        if value in (None, "None"):
            return "unknown"
        try:
            return f"{int(value)}s"
        except (TypeError, ValueError):
            return "unknown"

    @staticmethod
    def _friendly_error_string(exc: Exception) -> str:
        message = str(exc).strip()
        if not message:
            return "Download failed"
        lowered = message.lower()
        if "ffmpeg" in lowered:
            return "FFmpeg missing or failed while processing the media."
        if "network" in lowered or "timed out" in lowered or "temporarily unavailable" in lowered:
            return "Network error"
        if "private" in lowered or "restricted" in lowered:
            return "Private content"
        if "not found" in lowered or "unavailable" in lowered:
            return "Video unavailable"
        return "Download failed"

    @staticmethod
    def _finalize_download(job: DownloadJob) -> str:
        download_root = Path(get_settings().download_path)
        download_root.mkdir(parents=True, exist_ok=True)

        if not job.temp_dir:
            raise DownloadFailedError("Download failed")

        temp_dir = Path(job.temp_dir)
        if not temp_dir.exists():
            raise DownloadFailedError("Download failed")

        candidates = sorted((path for path in temp_dir.rglob("*") if path.is_file()), key=lambda p: p.stat().st_mtime, reverse=True)
        ignored_suffixes = {
            ".part",
            ".ytdl",
            ".json",
            ".description",
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
            ".vtt",
            ".srt",
            ".ass",
            ".lrc",
            ".txt",
        }
        for candidate in candidates:
            if candidate.suffix.lower() in ignored_suffixes:
                continue
            base_name = sanitize_filename(job.filename or candidate.stem, fallback="clipfetch-download")
            final_name = base_name + candidate.suffix.lower()
            final_path = download_root / final_name
            counter = 1
            while final_path.exists():
                final_path = download_root / f"{base_name}_{counter}{candidate.suffix.lower()}"
                counter += 1
            shutil.move(str(candidate), final_path)
            return final_name

        logger.error("No downloadable media found in %s: %s", temp_dir, [str(path.relative_to(temp_dir)) for path in temp_dir.rglob("*")])
        raise DownloadFailedError("Download failed")
