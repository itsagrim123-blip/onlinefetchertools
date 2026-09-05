from __future__ import annotations

import logging
from pathlib import Path
from tempfile import mkdtemp
from urllib.parse import urlparse

from app.errors import ClipFetchError, UnsupportedUrlError
from app.models import VideoFormat, VideoMetadata
from app.utils.validation import sanitize_filename, validate_url

logger = logging.getLogger(__name__)


class ExtractorService:
    async def analyze_url(self, url: str) -> VideoMetadata:
        logger.info("URL validation started")
        validated_url = validate_url(url)
        if not self._looks_like_supported_site(validated_url):
            raise UnsupportedUrlError("Unsupported URL")
        logger.info("URL validation completed for %s", validated_url)

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
            import yt_dlp

            logger.info("yt-dlp metadata extraction started for %s", validated_url)
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(validated_url, download=False)
        except Exception as exc:
            logger.exception("yt-dlp metadata extraction failed for %s", validated_url)
            raise ClipFetchError("Video unavailable", status_code=404) from exc

        if not info:
            raise ClipFetchError("Video unavailable", status_code=404)

        formats: list[VideoFormat] = []
        seen: set[str] = set()

        raw_formats = info.get("formats", []) or []
        has_any_video = False
        has_any_audio = False

        for entry in raw_formats:
            format_id = entry.get("format_id")
            if not format_id:
                continue

            format_key = str(format_id)
            if format_key in seen:
                continue
            seen.add(format_key)

            has_v = entry.get("vcodec") not in (None, "none")
            has_a = entry.get("acodec") not in (None, "none")

            if not has_v and has_a:
                ftype = "audio"
                has_any_audio = True
            elif has_v:
                ftype = "video"
                has_any_video = True
                if has_a:
                    has_any_audio = True
            else:
                continue

            resolution = entry.get("format_note") or entry.get("height")
            filesize = entry.get("filesize") or entry.get("filesize_approx")
            formats.append(
                VideoFormat(
                    format_id=str(format_id),
                    language=str(entry.get("language")) if entry.get("language") else None,
                    resolution=str(resolution) if resolution is not None else None,
                    ext=str(entry.get("ext") or "mp4"),
                    filesize=int(filesize) if filesize is not None else None,
                    type=ftype,
                    quality_label=str(entry.get("format_note") or entry.get("quality") or "unknown"),
                    has_video=has_v,
                    has_audio=has_a,
                )
            )

        # Prepend "best" option for optimal video+audio merged quality
        if has_any_video:
            formats.insert(
                0,
                VideoFormat(
                    format_id="best",
                    resolution="Best Quality",
                    ext="mp4",
                    filesize=None,
                    type="video",
                    quality_label="Best Available (Video + Audio)",
                    has_video=True,
                    has_audio=True,
                ),
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
                    has_video=False,
                    has_audio=True,
                )
            ]

        metadata = VideoMetadata(
            success=True,
            id=str(info.get("id") or "meta-1"),
            title=str(info.get("title") or "Untitled media"),
            thumbnail=info.get("thumbnail"),
            duration=int(info.get("duration") or 0) if info.get("duration") is not None else None,
            uploader=info.get("uploader") or info.get("channel") or info.get("channel_id"),
            formats=formats,
        )
        logger.info("yt-dlp metadata extraction completed for %s with %d formats", validated_url, len(formats))
        return metadata

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
