from __future__ import annotations

import logging
from pathlib import Path
from tempfile import mkdtemp
from urllib.parse import urlparse

import yt_dlp

from app.errors import ClipFetchError, UnsupportedUrlError
from app.models import VideoFormat, VideoMetadata
from app.utils.validation import sanitize_filename, validate_url

logger = logging.getLogger(__name__)


class ExtractorService:
    async def analyze_url(self, url: str) -> VideoMetadata:
        validated_url = validate_url(url)
        if not self._looks_like_supported_site(validated_url):
            raise UnsupportedUrlError("Unsupported URL")

        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "extract_flat": False,
            "noplaylist": True,
            "socket_timeout": 20,
            "nocheckcertificate": False,
            "simulate": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(validated_url, download=False)
        except Exception as exc:
            logger.exception("Metadata extraction failed")
            raise ClipFetchError("Video unavailable", status_code=404) from exc

        if not info:
            raise ClipFetchError("Video unavailable", status_code=404)

        formats: list[VideoFormat] = []
        seen: set[str] = set()

        for entry in info.get("formats", []) or []:
            format_id = entry.get("format_id")
            if not format_id:
                continue

            format_key = str(format_id)
            if format_key in seen:
                continue
            seen.add(format_key)

            if entry.get("vcodec") == "none" and entry.get("acodec") != "none":
                ftype = "audio"
            elif entry.get("vcodec") not in (None, "none"):
                ftype = "video"
            else:
                continue

            resolution = entry.get("format_note") or entry.get("height")
            filesize = entry.get("filesize") or entry.get("filesize_approx")
            formats.append(
                VideoFormat(
                    format_id=str(format_id),
                    resolution=str(resolution) if resolution is not None else None,
                    ext=str(entry.get("ext") or "mp4"),
                    filesize=int(filesize) if filesize is not None else None,
                    type=ftype,
                    quality_label=str(entry.get("format_note") or entry.get("quality") or "unknown"),
                )
            )

        if not formats:
            formats = [
                VideoFormat(
                    format_id="bestaudio/best",
                    resolution=None,
                    ext="mp3",
                    filesize=None,
                    type="audio",
                    quality_label="audio",
                )
            ]

        return VideoMetadata(
            success=True,
            id=str(info.get("id") or "meta-1"),
            title=str(info.get("title") or "Untitled media"),
            thumbnail=info.get("thumbnail"),
            duration=int(info.get("duration") or 0) if info.get("duration") is not None else None,
            uploader=info.get("uploader") or info.get("channel") or info.get("channel_id"),
            formats=formats,
        )

    @staticmethod
    def _looks_like_supported_site(url: str) -> bool:
        hostname = urlparse(url).hostname or ""
        hostname = hostname.lower()
        if not hostname:
            return False
        supported = (
            "youtube.com",
            "youtu.be",
            "vimeo.com",
            "soundcloud.com",
            "twitter.com",
            "x.com",
            "facebook.com",
            "instagram.com",
            "tiktok.com",
            "dailymotion.com",
            "bandcamp.com",
            "rumble.com",
            "bitchute.com",
        )
        return any(domain in hostname for domain in supported)

    @staticmethod
    def sanitize_filename_for_job(name: str) -> str:
        clean = sanitize_filename(name, fallback="clipfetch-download")
        return clean + ".mp4" if "." not in clean else clean

    @staticmethod
    def create_temp_dir() -> str:
        return mkdtemp(prefix="clipfetch_")

    @staticmethod
    def get_download_path(job_id: str, filename: str) -> Path:
        from app.config import get_settings

        base_dir = get_settings().download_path
        safe_name = sanitize_filename(filename, fallback=f"{job_id}_download")
        return base_dir / safe_name
