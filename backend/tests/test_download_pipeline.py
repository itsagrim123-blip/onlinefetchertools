import json
import shutil
import subprocess
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from app.errors import ClipFetchError, DownloadFailedError
from app.models import DownloadJob, VideoFormat
from app.services.downloader import DownloadService
from app.services.extractor import ExtractorService
from app.services.media_tools import clip_media, validate_media_file


def test_resolve_yt_dlp_format_prevents_silent_video():
    service = DownloadService()

    # 1. "best" must merge best video and best audio into mp4
    fmt, is_audio = service._resolve_yt_dlp_format(DownloadJob(url="https://example.com/v", format_id="best"))
    assert not is_audio
    assert "bestvideo" in fmt
    assert "bestaudio" in fmt

    # 2. Specific format ID (e.g. 137 for 1080p) must merge with audio
    fmt_137, is_audio = service._resolve_yt_dlp_format(DownloadJob(url="https://example.com/v", format_id="137"))
    assert not is_audio
    assert "137+bestaudio" in fmt_137

    # 3. Audio format must be detected as audio
    fmt_audio, is_audio = service._resolve_yt_dlp_format(DownloadJob(url="https://example.com/v", format_id="bestaudio"))
    assert is_audio
    assert fmt_audio == "bestaudio/best"

    fmt_audio2, is_audio2 = service._resolve_yt_dlp_format(DownloadJob(url="https://example.com/v", format_id="audio-only"))
    assert is_audio2
    assert fmt_audio2 == "bestaudio/best"


def test_validate_media_file_rejects_missing_or_empty(tmp_path):
    missing = tmp_path / "nonexistent.mp4"
    with pytest.raises(DownloadFailedError, match="not found"):
        validate_media_file(missing)

    empty = tmp_path / "empty.mp4"
    empty.write_bytes(b"")
    with pytest.raises(DownloadFailedError, match="empty"):
        validate_media_file(empty)


def test_validate_media_file_detects_missing_audio(tmp_path, monkeypatch):
    video_only_file = tmp_path / "video_only.mp4"
    video_only_file.write_bytes(b"fake video data")

    # Mock ffprobe returning only a video stream
    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = json.dumps({
        "streams": [{"codec_type": "video", "codec_name": "h264"}],
        "format": {"format_name": "mov,mp4", "duration": "5.0"},
    })

    monkeypatch.setattr("shutil.which", lambda cmd: "ffprobe" if cmd == "ffprobe" else None)
    monkeypatch.setattr("subprocess.run", lambda *a, **kw: mock_proc)

    with pytest.raises(DownloadFailedError, match="missing an audio track"):
        validate_media_file(video_only_file, expect_video=True, expect_audio=True)


def test_validate_media_file_succeeds_with_both_streams(tmp_path, monkeypatch):
    valid_file = tmp_path / "valid.mp4"
    valid_file.write_bytes(b"fake media data")

    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = json.dumps({
        "streams": [
            {"codec_type": "video", "codec_name": "h264"},
            {"codec_type": "audio", "codec_name": "aac"},
        ],
        "format": {"format_name": "mov,mp4", "duration": "5.0"},
    })

    monkeypatch.setattr("shutil.which", lambda cmd: "ffprobe" if cmd == "ffprobe" else None)
    monkeypatch.setattr("subprocess.run", lambda *a, **kw: mock_proc)

    result = validate_media_file(valid_file, expect_video=True, expect_audio=True)
    assert result["has_video"] is True
    assert result["has_audio"] is True


def test_ffmpeg_missing_fails_gracefully(monkeypatch):
    service = DownloadService()
    job = service.create_job("https://example.com/watch?v=abc123", "best")

    # Simulate FFmpeg missing from system PATH
    monkeypatch.setattr("shutil.which", lambda cmd: None)

    service._run_download(job)

    assert job.status == "failed"
    assert "FFmpeg is not installed" in (job.error or "")


def test_temp_dir_cleaned_up_on_failure(tmp_path, monkeypatch):
    service = DownloadService()
    job = service.create_job("https://example.com/watch?v=abc123", "best")
    temp_dir = Path(job.temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)
    (temp_dir / "partial.part").write_bytes(b"data")

    monkeypatch.setattr("shutil.which", lambda cmd: "ffmpeg" if cmd == "ffmpeg" else None)

    # Force yt-dlp download failure
    mock_ydl = MagicMock()
    mock_ydl.__enter__.return_value.download.side_effect = RuntimeError("Network error")
    monkeypatch.setattr("yt_dlp.YoutubeDL", lambda *a, **kw: mock_ydl)

    service._run_download(job)

    assert job.status == "failed"
    # Temp dir must be removed even on failure
    assert not temp_dir.exists()


def test_extractor_labels_audio_and_video_correctly():
    service = ExtractorService()
    mock_info = {
        "id": "test1",
        "title": "Test Video",
        "formats": [
            # Video only (DASH adaptive)
            {"format_id": "137", "vcodec": "avc1", "acodec": "none", "height": 1080, "ext": "mp4"},
            # Audio only
            {"format_id": "140", "vcodec": "none", "acodec": "mp4a", "ext": "m4a"},
            # Combined progressive
            {"format_id": "18", "vcodec": "avc1", "acodec": "mp4a", "height": 360, "ext": "mp4"},
        ],
    }

    with patch("yt_dlp.YoutubeDL") as mock_ydl_cls:
        mock_instance = MagicMock()
        mock_instance.extract_info.return_value = mock_info
        mock_ydl_cls.return_value.__enter__.return_value = mock_instance

        import asyncio
        metadata = asyncio.run(service.analyze_url("https://www.youtube.com/watch?v=test1234"))

        # "best" format should be prepended
        assert metadata.formats[0].format_id == "best"
        assert metadata.formats[0].has_audio is True
        assert metadata.formats[0].has_video is True

        # Format 137 must be flagged as having no audio
        fmt_137 = next(f for f in metadata.formats if f.format_id == "137")
        assert fmt_137.has_video is True
        assert fmt_137.has_audio is False

        # Format 140 must be audio
        fmt_140 = next(f for f in metadata.formats if f.format_id == "140")
        assert fmt_140.type == "audio"
        assert fmt_140.has_audio is True
        assert fmt_140.has_video is False

        # Format 18 has both
        fmt_18 = next(f for f in metadata.formats if f.format_id == "18")
        assert fmt_18.has_video is True
        assert fmt_18.has_audio is True


def test_friendly_error_string_mapping():
    service = DownloadService()
    assert "FFmpeg is not installed" in service._friendly_error_string(Exception("ffmpeg not found"))
    assert "merging" in service._friendly_error_string(Exception("FFmpeg merge error"))
    assert "audio track" in service._friendly_error_string(Exception("The video is missing an audio track"))
    assert "video stream" in service._friendly_error_string(Exception("missing a video stream"))
    assert "corrupted" in service._friendly_error_string(Exception("corrupted media"))
    assert "Network error" in service._friendly_error_string(Exception("timed out"))
    assert "Custom error" == service._friendly_error_string(ClipFetchError("Custom error"))


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg required for clip test")
def test_clip_media_preserves_audio_and_video(tmp_path):
    source = tmp_path / "src.mp4"
    clipped = tmp_path / "clipped.mp4"

    # Generate a small 4-second video with audio
    subprocess.run(
        [
            shutil.which("ffmpeg"),
            "-y",
            "-f", "lavfi", "-i", "testsrc=duration=4:size=320x240:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=1000:duration=4",
            "-c:v", "libx264",
            "-c:a", "aac",
            str(source),
        ],
        capture_output=True,
        check=True,
    )

    out = clip_media(source, clipped, start_time="1", end_time="3")
    assert out.exists()

    # Validate streams on clipped file
    validation = validate_media_file(out, expect_video=True, expect_audio=True)
    assert validation["has_video"] is True
    assert validation["has_audio"] is True

