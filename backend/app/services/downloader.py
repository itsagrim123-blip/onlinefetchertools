from __future__ import annotations

import logging
import os
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import get_settings
from app.errors import ClipFetchError, DownloadFailedError, JobNotFoundError
from app.models import DownloadJob, DownloadStatus
from app.services.media_tools import clip_media, validate_media_file
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

    def create_job(
        self,
        url: str,
        format_id: str,
        filename_preference: str | None = None,
        start_time: str | None = None,
        end_time: str | None = None,
    ) -> DownloadJob:
        validate_url(url)
        base_name = sanitize_filename(filename_preference or "clipfetch-download", fallback="clipfetch-download")
        settings = get_settings()
        job = DownloadJob(
            id=str(uuid4()),
            url=url,
            format_id=format_id,
            filename=base_name,
            temp_dir=str(Path(settings.download_path) / f"tmp_{uuid4().hex}"),
            start_time=start_time,
            end_time=end_time,
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
            # Requirement: Verify FFmpeg availability before starting processing
            if not shutil.which("ffmpeg"):
                raise ClipFetchError(
                    "FFmpeg is not installed on the backend server. Audio and video merging requires FFmpeg.",
                    status_code=503,
                )

            import yt_dlp

            job.status = "queued"
            self.store.update(job)
            os.makedirs(job.temp_dir or get_settings().download_path, exist_ok=True)

            safe_format, is_audio = self._resolve_yt_dlp_format(job)
            outtmpl = str(Path(job.temp_dir or get_settings().download_path) / "%(title)s.%(ext)s")
            ydl_opts: dict[str, Any] = {
                "quiet": True,
                "no_warnings": True,
                "noplaylist": True,
                "outtmpl": outtmpl,
                "format": safe_format,
                "socket_timeout": get_settings().request_timeout_seconds,
                "retries": 3,
                "fragment_retries": 3,
                "progress_hooks": [self._progress_hook(job)],
                "paths": {"home": str(Path(job.temp_dir or get_settings().download_path))},
            }

            if is_audio:
                ydl_opts["postprocessors"] = [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "0",
                }]
                ydl_opts["merge_output_format"] = "mp3"
            else:
                # Always merge video + audio into a single playable MP4 container
                ydl_opts["merge_output_format"] = "mp4"

            job.status = "downloading"
            self.store.update(job)

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([job.url])

            job.status = "processing"
            self.store.update(job)

            final_name = self._finalize_download(job, is_audio=is_audio)
            job.filename = final_name
            job.status = "complete"
            job.progress = 100
            job.completed_at = datetime.now(timezone.utc)
            job.error = None
            self.store.update(job)
        except Exception as exc:
            logger.exception("Download job failed for %s", job.id)
            job.status = "failed"
            job.progress = 0
            job.error = self._friendly_error_string(exc)
            job.completed_at = datetime.now(timezone.utc)
            self.store.update(job)
        finally:
            with self._lock:
                self._active_jobs = max(0, self._active_jobs - 1)
            if job.temp_dir:
                temp_path = Path(job.temp_dir)
                if temp_path.exists():
                    shutil.rmtree(temp_path, ignore_errors=True)

    def _resolve_yt_dlp_format(self, job: DownloadJob) -> tuple[str, bool]:
        """
        Resolves yt-dlp format string.
        Returns: (format_selector, is_audio_only)
        Ensures normal video downloads ALWAYS combine bestvideo and bestaudio,
        never returning a silent video-only stream.
        """
        selected = (job.format_id or "best").strip()

        # Audio-only downloads
        if selected in {"bestaudio", "audio-only", "audio"} or selected.endswith("audio"):
            return "bestaudio/best", True

        # Best quality video downloads: merge best video and best audio
        if selected in {"best", "bestvideo", "video", "auto"}:
            return "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best", False

        # Specific format ID requested (e.g. "137" for 1080p video-only, or "18" for 360p combined)
        # If format already has audio ([acodec!=none]), use it directly.
        # Otherwise, merge with best available audio stream!
        format_str = (
            f"{selected}[acodec!=none]/"
            f"{selected}+bestaudio[ext=m4a]/"
            f"{selected}+bestaudio/"
            f"{selected}/best"
        )
        return format_str, False

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
        if isinstance(exc, ClipFetchError):
            return exc.message
        message = str(exc).strip()
        if not message:
            return "Download failed"
        lowered = message.lower()
        if "ffmpeg is not installed" in lowered or "ffmpeg not found" in lowered:
            return "FFmpeg is not installed on the backend server."
        if "ffmpeg" in lowered or "merge" in lowered:
            return "FFmpeg failed while merging audio and video streams."
        if "audio track" in lowered or "missing an audio" in lowered or "no audio" in lowered:
            return "The requested video does not have a playable audio track."
        if "video stream" in lowered or "missing a video" in lowered:
            return "The requested content does not have a valid video stream."
        if "corrupted" in lowered or "unreadable" in lowered or "invalid" in lowered:
            return "The downloaded media file is corrupted or invalid."
        if "unsupported" in lowered or "requested format not available" in lowered:
            return "The requested quality or format is not available for this video."
        if "network" in lowered or "timed out" in lowered or "temporarily unavailable" in lowered:
            return "Network error while downloading media."
        if "private" in lowered or "restricted" in lowered:
            return "This video is private or restricted."
        if "not found" in lowered or "unavailable" in lowered:
            return "Video unavailable"
        return "Download failed"

    def _finalize_download(self, job: DownloadJob, is_audio: bool = False) -> str:
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

            target_candidate = candidate
            # Apply clipping if user requested start_time or end_time
            if job.start_time or job.end_time:
                clipped_output = candidate.parent / f"clipped_{candidate.name}"
                target_candidate = clip_media(candidate, clipped_output, job.start_time, job.end_time)

            # Validate the output file before presenting to user
            validate_media_file(
                target_candidate,
                expect_video=not is_audio,
                expect_audio=True,
            )

            requested_name = job.filename if job.filename != "clipfetch-download" else target_candidate.stem
            base_name = sanitize_filename(requested_name, fallback="clipfetch-download")
            final_name = base_name + target_candidate.suffix.lower()
            final_path = download_root / final_name
            counter = 1
            while final_path.exists():
                final_path = download_root / f"{base_name}_{counter}{target_candidate.suffix.lower()}"
                counter += 1
            shutil.move(str(target_candidate), final_path)
            return final_name

        logger.error("No downloadable media found in %s: %s", temp_dir, [str(path.relative_to(temp_dir)) for path in temp_dir.rglob("*")])
        raise DownloadFailedError("Download failed")
