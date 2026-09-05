from __future__ import annotations

import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any

from app.errors import ClipFetchError, DownloadFailedError

logger = logging.getLogger(__name__)

VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv", ".avi"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".aac", ".m4a", ".ogg", ".flac"}


def _conversion_error(stderr: str) -> str:
    """Turn common FFmpeg failures into safe, actionable messages."""
    detail = stderr.lower()
    if "does not contain any stream" in detail or "output file #0 does not contain any stream" in detail:
        return "This video does not contain an audio track to extract."
    if "moov atom not found" in detail or "invalid data found when processing input" in detail:
        return "This file is not a readable media file. Try downloading or exporting it again."
    if "could not find codec parameters" in detail or "unknown decoder" in detail:
        return "This file uses a video or audio codec that cannot be read on this server."
    return "Media conversion failed. Make sure the uploaded file is complete and playable."


def convert_media(source: Path, output: Path, output_format: str) -> None:
    allowed = {"mp4", "webm", "mov", "mkv", "mp3", "wav", "aac", "m4a", "ogg"}
    target = output_format.lower().lstrip(".")
    if target not in allowed:
        raise ClipFetchError("Unsupported media output format", status_code=400)
    command = ["ffmpeg", "-y", "-i", str(source), "-map_metadata", "-1"]
    if target in {"mp3", "aac", "m4a", "ogg", "wav"}:
        command += ["-vn"]
    command.append(str(output))
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=300, check=False)
    except FileNotFoundError as exc:
        raise ClipFetchError("FFmpeg is not installed on the backend", status_code=503) from exc
    except subprocess.TimeoutExpired as exc:
        raise ClipFetchError("Media processing timed out", status_code=504) from exc
    if result.returncode != 0 or not output.exists():
        raise ClipFetchError(_conversion_error(result.stderr), status_code=400)


def validate_media_file(
    file_path: Path,
    expect_video: bool = True,
    expect_audio: bool = True,
) -> dict[str, Any]:
    """
    Validates that a downloaded/processed media file:
    - Exists on disk
    - Has a size > 0 bytes
    - Has a valid container readable by ffprobe
    - Contains a video stream if expect_video=True
    - Contains an audio stream if expect_audio=True
    """
    if not file_path.exists():
        raise DownloadFailedError("Downloaded media file not found on disk.")
    if file_path.stat().st_size == 0:
        raise DownloadFailedError("Downloaded media file is empty (0 bytes).")

    ffprobe_cmd = shutil.which("ffprobe")
    if not ffprobe_cmd:
        logger.warning("ffprobe not found in PATH; falling back to basic file existence/size validation.")
        return {"size": file_path.stat().st_size, "has_video": True, "has_audio": True}

    cmd = [
        ffprobe_cmd,
        "-v", "error",
        "-show_entries", "stream=codec_type,codec_name,width,height",
        "-show_entries", "format=format_name,duration,size",
        "-of", "json",
        str(file_path),
    ]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=False)
    except Exception as exc:
        logger.exception("ffprobe execution failed for %s", file_path)
        raise DownloadFailedError("Failed to validate media integrity.") from exc

    if proc.returncode != 0:
        logger.error("ffprobe rejected %s with return code %d: %s", file_path, proc.returncode, proc.stderr)
        raise DownloadFailedError("The output media file is corrupted or unreadable.")

    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        logger.error("ffprobe JSON parsing error: %s", exc)
        raise DownloadFailedError("Failed to parse media probe metadata.") from exc

    streams = data.get("streams", [])
    has_video = any(s.get("codec_type") == "video" for s in streams)
    has_audio = any(s.get("codec_type") == "audio" for s in streams)

    if expect_video and not has_video:
        raise DownloadFailedError("The downloaded file is missing a video stream.")

    if expect_audio and not has_audio:
        raise DownloadFailedError("The downloaded video is missing an audio track.")

    return {
        "has_video": has_video,
        "has_audio": has_audio,
        "size": file_path.stat().st_size,
        "streams": streams,
    }


def clip_media(
    source: Path,
    output: Path,
    start_time: str | None = None,
    end_time: str | None = None,
) -> Path:
    """
    Clips/trims a media file from start_time to end_time using FFmpeg:
    - Preserves all streams (video + audio)
    - Tries lossless stream-copy first
    - Falls back to high-quality re-encoding (CRF 18 + AAC 192k) if stream-copy fails or drops streams
    """
    ffmpeg_cmd = shutil.which("ffmpeg")
    if not ffmpeg_cmd:
        raise ClipFetchError("FFmpeg is not installed on the backend server.", status_code=503)

    time_args: list[str] = []
    if start_time:
        time_args.extend(["-ss", str(start_time).strip()])
    if end_time:
        time_args.extend(["-to", str(end_time).strip()])

    if not time_args:
        return source

    # Strategy 1: Attempt stream-copy with all streams mapped (-map 0)
    copy_cmd = [
        ffmpeg_cmd,
        "-y",
        *time_args,
        "-i", str(source),
        "-c", "copy",
        "-map", "0",
        "-avoid_negative_ts", "make_zero",
        str(output),
    ]

    res = subprocess.run(copy_cmd, capture_output=True, text=True, timeout=300, check=False)
    stream_copy_ok = False
    if res.returncode == 0 and output.exists() and output.stat().st_size > 0:
        try:
            validate_media_file(output, expect_video=True, expect_audio=True)
            stream_copy_ok = True
        except Exception:
            stream_copy_ok = False
            output.unlink(missing_ok=True)

    if not stream_copy_ok:
        logger.info("Stream copy clipping failed or dropped audio; falling back to high-quality re-encode.")
        reencode_cmd = [
            ffmpeg_cmd,
            "-y",
            *time_args,
            "-i", str(source),
            "-map", "0:v:0",
            "-map", "0:a:0?",
            "-c:v", "libx264",
            "-crf", "18",
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "192k",
            str(output),
        ]
        res2 = subprocess.run(reencode_cmd, capture_output=True, text=True, timeout=300, check=False)
        if res2.returncode != 0 or not output.exists() or output.stat().st_size == 0:
            raise ClipFetchError("Failed to clip media file.", status_code=500)

    return output


def edit_video(
    source: Path,
    output: Path,
    start_time: str | None = None,
    end_time: str | None = None,
    resolution: str | None = None,
    quality: str = "high",
    output_format: str = "mp4",
    include_audio: bool = True,
) -> None:
    """
    Edits a video file with trimming, resolution resizing, quality control,
    and audio preservation:
    - start_time / end_time: video cut range
    - resolution: "original", "1080p", "720p", "480p", "1080x1920", "1080x1080", or custom WxH
    - quality: "high" (CRF 18), "medium" (CRF 23), "low" (CRF 28)
    - include_audio: whether to keep audio stream (True) or mute/strip (-an)
    - output_format: "mp4", "webm", etc.
    """
    ffmpeg_cmd = shutil.which("ffmpeg")
    if not ffmpeg_cmd:
        raise ClipFetchError("FFmpeg is not installed on the backend server.", status_code=503)

    target_ext = output_format.lower().lstrip(".")
    if target_ext not in {"mp4", "webm", "mov", "mkv"}:
        raise ClipFetchError("Unsupported output format for video editing", status_code=400)

    # Validate that the source file is readable
    validate_media_file(source, expect_video=True, expect_audio=False)

    time_args: list[str] = []
    if start_time and start_time.strip():
        time_args.extend(["-ss", start_time.strip()])
    if end_time and end_time.strip():
        time_args.extend(["-to", end_time.strip()])

    # Stream-copy fast-path: only possible if no scaling, default high quality, and keeping audio
    is_scale_requested = bool(resolution and resolution.strip().lower() not in {"", "original", "none"})
    is_lossless_trim = not is_scale_requested and quality.lower() == "high" and include_audio and target_ext == "mp4"

    if is_lossless_trim and time_args:
        copy_cmd = [
            ffmpeg_cmd,
            "-y",
            *time_args,
            "-i", str(source),
            "-c", "copy",
            "-map", "0",
            "-avoid_negative_ts", "make_zero",
            str(output),
        ]
        res = subprocess.run(copy_cmd, capture_output=True, text=True, timeout=300, check=False)
        if res.returncode == 0 and output.exists() and output.stat().st_size > 0:
            try:
                validate_media_file(output, expect_video=True, expect_audio=False)
                return
            except Exception:
                output.unlink(missing_ok=True)

    # Resolution scaling filters
    vf_filters: list[str] = []
    if is_scale_requested and resolution:
        res_clean = resolution.strip().lower()
        if res_clean == "1080p":
            vf_filters.append("scale=-2:1080")
        elif res_clean == "720p":
            vf_filters.append("scale=-2:720")
        elif res_clean == "480p":
            vf_filters.append("scale=-2:480")
        elif res_clean == "360p":
            vf_filters.append("scale=-2:360")
        elif res_clean in {"1080x1920", "9:16"}:
            vf_filters.append("scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2")
        elif res_clean in {"1080x1080", "1:1"}:
            vf_filters.append("scale=1080:1080:force_original_aspect_ratio=decrease,pad=1080:1080:(ow-iw)/2:(oh-ih)/2")
        elif "x" in res_clean:
            try:
                w, h = [int(p) for p in res_clean.split("x", 1)]
                if 64 <= w <= 4096 and 64 <= h <= 4096:
                    vf_filters.append(f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2")
            except ValueError:
                pass

    crf_map = {"high": "18", "medium": "23", "low": "28"}
    crf_val = crf_map.get(quality.lower(), "20")

    cmd = [
        ffmpeg_cmd,
        "-y",
        *time_args,
        "-i", str(source),
    ]

    if target_ext == "webm":
        cmd.extend(["-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0"])
    else:
        cmd.extend(["-c:v", "libx264", "-crf", crf_val, "-preset", "fast", "-pix_fmt", "yuv420p"])

    if vf_filters:
        cmd.extend(["-vf", ",".join(vf_filters)])

    if not include_audio:
        cmd.append("-an")
    else:
        if target_ext == "webm":
            cmd.extend(["-c:a", "libopus", "-b:a", "128k"])
        else:
            cmd.extend(["-c:a", "aac", "-b:a", "192k"])

    cmd.append(str(output))

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300, check=False)
    except subprocess.TimeoutExpired as exc:
        raise ClipFetchError("Video processing timed out", status_code=504) from exc

    if result.returncode != 0 or not output.exists() or output.stat().st_size == 0:
        logger.error("FFmpeg edit failed: %s", result.stderr)
        raise ClipFetchError(_conversion_error(result.stderr), status_code=400)

    validate_media_file(output, expect_video=True, expect_audio=include_audio)
