from __future__ import annotations

import asyncio
import json
import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any

from app.errors import ClipFetchError
from app.services.media_tools import validate_media_file

logger = logging.getLogger(__name__)


def format_ass_time(seconds: float) -> str:
    """Formats float seconds into ASS timestamp format: H:MM:SS.cc"""
    sec = max(0.0, float(seconds))
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    cs = int(round((sec - int(sec)) * 100))
    if cs >= 100:
        s += 1
        cs = 0
    if s >= 60:
        m += 1
        s = 0
    if m >= 60:
        h += 1
        m = 0
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def format_srt_time(seconds: float) -> str:
    """Formats float seconds into SRT timestamp format: HH:MM:SS,mmm"""
    sec = max(0.0, float(seconds))
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    if ms >= 1000:
        s += 1
        ms = 0
    if s >= 60:
        m += 1
        s = 0
    if m >= 60:
        h += 1
        m = 0
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_vtt_time(seconds: float) -> str:
    """Formats float seconds into WebVTT timestamp format: HH:MM:SS.mmm"""
    sec = max(0.0, float(seconds))
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    if ms >= 1000:
        s += 1
        ms = 0
    if s >= 60:
        m += 1
        s = 0
    if m >= 60:
        h += 1
        m = 0
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def hex_to_ass_color(hex_str: str, alpha: int = 0) -> str:
    """
    Converts CSS hex color '#RRGGBB' to ASS color format '&HAABBGGRR'.
    alpha: 0 = fully opaque, 255 = fully transparent in ASS.
    """
    clean = hex_str.strip().lstrip("#")
    if len(clean) == 3:
        clean = "".join(c * 2 for c in clean)
    if len(clean) != 6:
        clean = "FFFFFF"
    r = clean[0:2].upper()
    g = clean[2:4].upper()
    b = clean[4:6].upper()
    a = f"{max(0, min(255, alpha)):02X}"
    return f"&H{a}{b}{g}{r}"


class AutoCaptionsService:
    _instance: AutoCaptionsService | None = None
    _model: Any = None
    _lock = asyncio.Lock()
    _device: str = "cpu"
    _compute_type: str = "int8"
    _model_size: str = "base"

    @classmethod
    def get_instance(cls) -> AutoCaptionsService:
        if cls._instance is None:
            cls._instance = AutoCaptionsService()
        return cls._instance

    def initialize_sync(self, model_size: str = "base") -> None:
        """
        Loads the faster-whisper speech-to-text model once.
        Reuses cached model weights.
        Attempts CUDA GPU acceleration first, falling back cleanly to CPU int8.
        """
        if self._model is not None:
            return

        try:
            import ctranslate2
            from faster_whisper import WhisperModel

            self._model_size = model_size

            # Check if CUDA is available
            cuda_count = 0
            try:
                cuda_count = ctranslate2.get_cuda_device_count()
            except Exception as e:
                logger.warning("Could not check CUDA device count: %s", e)

            if cuda_count > 0:
                try:
                    logger.info("Initializing faster-whisper '%s' model on CUDA GPU...", model_size)
                    self._model = WhisperModel(model_size, device="cuda", compute_type="float16")
                    self._device = "cuda"
                    self._compute_type = "float16"
                    logger.info("faster-whisper '%s' initialized successfully on CUDA.", model_size)
                    return
                except Exception as cuda_err:
                    logger.warning("Failed to initialize on CUDA (%s). Falling back to CPU.", cuda_err)

            logger.info("Initializing faster-whisper '%s' model on CPU (int8)...", model_size)
            self._model = WhisperModel(model_size, device="cpu", compute_type="int8")
            self._device = "cpu"
            self._compute_type = "int8"
            logger.info("faster-whisper '%s' initialized successfully on CPU.", model_size)

        except Exception as exc:
            logger.error("Failed to initialize faster-whisper model: %s", exc, exc_info=True)
            self._model = None
            raise ClipFetchError(
                "Speech recognition model is currently unavailable. Please try again in a moment.",
                status_code=503,
            ) from exc

    async def initialize(self, model_size: str = "base") -> None:
        """Asynchronous initialization helper to prevent blocking FastAPI startup."""
        async with self._lock:
            if self._model is not None:
                return
            await asyncio.to_thread(self.initialize_sync, model_size)

    def is_ready(self) -> bool:
        return self._model is not None

    def extract_audio_sync(self, video_path: Path, output_audio_path: Path) -> None:
        """
        Extracts 16kHz mono audio from video file using FFmpeg.
        This provides the ideal input for Whisper.
        """
        ffmpeg_cmd = shutil.which("ffmpeg")
        if not ffmpeg_cmd:
            raise ClipFetchError("FFmpeg is not installed on the backend server.", status_code=503)

        cmd = [
            ffmpeg_cmd,
            "-y",
            "-i", str(video_path),
            "-vn",
            "-ac", "1",
            "-ar", "16000",
            "-c:a", "pcm_s16le",
            str(output_audio_path),
        ]

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=180, check=False)
        except subprocess.TimeoutExpired as exc:
            raise ClipFetchError("Audio extraction timed out", status_code=504) from exc

        if res.returncode != 0 or not output_audio_path.exists() or output_audio_path.stat().st_size == 0:
            stderr_lower = res.stderr.lower()
            if "does not contain any stream" in stderr_lower or "no audio" in stderr_lower:
                raise ClipFetchError("This video does not contain an audio track to transcribe.", status_code=400)
            logger.error("FFmpeg audio extraction failed: %s", res.stderr)
            raise ClipFetchError("Failed to extract audio track from video.", status_code=400)

    def transcribe_sync(
        self,
        audio_path: Path,
        language: str | None = None,
        translate: bool = False,
    ) -> dict[str, Any]:
        """
        Transcribes the audio file using the cached faster-whisper model.
        Returns dict containing detected language, duration, and timestamped segments.
        """
        if self._model is None:
            self.initialize_sync(self._model_size)

        task = "translate" if translate else "transcribe"
        lang = None if not language or language.lower() in {"auto", "auto detect", "none", ""} else language.lower().strip()

        try:
            logger.info("Starting transcription (task=%s, lang=%s)...", task, lang)
            segments_gen, info = self._model.transcribe(
                str(audio_path),
                language=lang,
                task=task,
                beam_size=5,
                word_timestamps=False,
                vad_filter=True,  # Voice activity detection to eliminate silence
                vad_parameters=dict(min_silence_duration_ms=400),
            )

            detected_lang = getattr(info, "language", "en")
            total_duration = getattr(info, "duration", 0.0)

            segments: list[dict[str, Any]] = []
            for idx, seg in enumerate(segments_gen):
                text = seg.text.strip()
                if not text:
                    continue
                start_ts = round(float(seg.start), 2)
                end_ts = round(float(seg.end), 2)
                if end_ts <= start_ts:
                    end_ts = round(start_ts + 0.5, 2)

                segments.append({
                    "id": idx + 1,
                    "start": start_ts,
                    "end": end_ts,
                    "text": text,
                })

            logger.info(
                "Transcription complete. Language: %s, Segments: %d, Duration: %.2fs",
                detected_lang,
                len(segments),
                total_duration,
            )

            if not segments:
                raise ClipFetchError(
                    "No speech was detected in this video. Please ensure the video contains clear audible speech.",
                    status_code=400,
                )

            return {
                "language": detected_lang,
                "duration": round(float(total_duration), 2),
                "segments": segments,
            }

        except ClipFetchError:
            raise
        except Exception as exc:
            logger.error("Transcription inference failed: %s", exc, exc_info=True)
            raise ClipFetchError(
                "Speech recognition failed while transcribing the video.",
                status_code=500,
            ) from exc

    def generate_ass_subtitles(
        self,
        segments: list[dict[str, Any]],
        video_width: int = 1920,
        video_height: int = 1080,
        position: str = "bottom",
        style_preset: str = "classic",
        font_size: int = 28,
        font_color: str = "#FFFFFF",
        background_box: bool = False,
        outline_color: str = "#000000",
        font_family: str = "Arial",
    ) -> str:
        """
        Generates Advanced SubStation Alpha (.ass) subtitle content.
        Supports exact positioning (Top, Center, Bottom with safe margins),
        font sizes scaled to video height, outline, box background, and custom colors.
        """
        pos = position.lower().strip()
        if pos == "top":
            alignment = 8  # Top-center
            margin_v = int(video_height * 0.09)  # ~9% safe margin from top
        elif pos == "center":
            alignment = 5  # Middle-center
            margin_v = 0
        else:
            alignment = 2  # Bottom-center
            margin_v = int(video_height * 0.09)  # ~9% safe margin from bottom

        margin_h = max(30, int(video_width * 0.05))

        # Scale font size relative to PlayResY (default 1080)
        # Standard input font_size ranges roughly 18 - 48
        ass_font_size = max(16, min(96, int(font_size)))

        # BorderStyle: 1 = Outline + Shadow; 3 = Opaque/semi-opaque Box
        border_style = 3 if background_box else 1

        bold_val = 0
        outline_val = 2.0
        shadow_val = 1.0

        preset = style_preset.lower().strip()
        primary_color_ass = hex_to_ass_color(font_color, alpha=0)
        outline_color_ass = hex_to_ass_color(outline_color, alpha=0)
        # Background box color: semi-transparent black (&H80000000) or user outline
        back_color_ass = "&H90000000" if background_box else "&H80000000"

        if preset == "clean":
            bold_val = 0
            outline_val = 1.2
            shadow_val = 0.5
        elif preset == "bold":
            bold_val = 1
            outline_val = 3.5
            shadow_val = 0.0
        elif preset == "social":
            bold_val = 1
            outline_val = 3.0
            shadow_val = 1.5
            ass_font_size = int(ass_font_size * 1.15)
        elif preset == "highlight":
            bold_val = 1
            primary_color_ass = "&H0000D7FF"  # Bright vibrant yellow-gold in ASS
            outline_val = 2.5
            shadow_val = 1.0
        else:  # classic
            bold_val = 0
            outline_val = 2.0
            shadow_val = 1.0

        header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {video_width}
PlayResY: {video_height}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_family},{ass_font_size},{primary_color_ass},&H000000FF,{outline_color_ass},{back_color_ass},{bold_val},0,0,0,100,100,0,0,{border_style},{outline_val},{shadow_val},{alignment},{margin_h},{margin_h},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        dialogue_lines: list[str] = []
        for seg in segments:
            start_str = format_ass_time(seg["start"])
            end_str = format_ass_time(seg["end"])
            # Escape newlines and braces for ASS format
            text = str(seg["text"]).replace("\r\n", "\\N").replace("\n", "\\N").replace("{", "(").replace("}", ")")
            dialogue_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text}")

        return header + "\n".join(dialogue_lines) + "\n"

    def generate_srt_subtitles(self, segments: list[dict[str, Any]]) -> str:
        """Generates standard SubRip (.srt) subtitle string."""
        blocks: list[str] = []
        for idx, seg in enumerate(segments, 1):
            start_str = format_srt_time(seg["start"])
            end_str = format_srt_time(seg["end"])
            text = str(seg["text"]).strip()
            blocks.append(f"{idx}\n{start_str} --> {end_str}\n{text}\n")
        return "\n".join(blocks)

    def generate_vtt_subtitles(self, segments: list[dict[str, Any]]) -> str:
        """Generates WebVTT (.vtt) subtitle string."""
        blocks: list[str] = ["WEBVTT\n"]
        for idx, seg in enumerate(segments, 1):
            start_str = format_vtt_time(seg["start"])
            end_str = format_vtt_time(seg["end"])
            text = str(seg["text"]).strip()
            blocks.append(f"{idx}\n{start_str} --> {end_str}\n{text}\n")
        return "\n".join(blocks)

    def burn_captions_sync(
        self,
        video_path: Path,
        ass_path: Path,
        output_path: Path,
        work_dir: Path,
    ) -> None:
        """
        Uses FFmpeg to burn ASS subtitles directly into the video stream frames.
        Executes inside work_dir to avoid Windows path colon/escaping pitfalls.
        """
        ffmpeg_cmd = shutil.which("ffmpeg")
        if not ffmpeg_cmd:
            raise ClipFetchError("FFmpeg is not installed on the backend server.", status_code=503)

        probe = validate_media_file(video_path, expect_video=True, expect_audio=False)
        has_audio = bool(probe.get("has_audio", False))

        # Relative filename inside work_dir ensures platform independence and avoids backslash escaping
        ass_filename = ass_path.name
        video_filename = video_path.name
        output_filename = output_path.name

        cmd = [
            ffmpeg_cmd,
            "-y",
            "-i", video_filename,
            "-vf", f"ass={ass_filename}",
            "-c:v", "libx264",
            "-crf", "20",
            "-preset", "fast",
            "-pix_fmt", "yuv420p",
        ]

        if has_audio:
            cmd.extend(["-c:a", "aac", "-b:a", "192k"])
        else:
            cmd.append("-an")

        cmd.extend(["-movflags", "+faststart", output_filename])

        logger.info("Executing subtitle burn FFmpeg command in %s...", work_dir)
        try:
            res = subprocess.run(cmd, cwd=str(work_dir), capture_output=True, text=True, timeout=600, check=False)
        except subprocess.TimeoutExpired as exc:
            raise ClipFetchError("Video caption rendering timed out", status_code=504) from exc

        if res.returncode != 0 or not output_path.exists() or output_path.stat().st_size == 0:
            logger.error("FFmpeg caption burn failed: %s", res.stderr)
            # Try fallback to 'subtitles' filter
            cmd_fallback = [
                ffmpeg_cmd,
                "-y",
                "-i", video_filename,
                "-vf", f"subtitles={ass_filename}",
                "-c:v", "libx264",
                "-crf", "20",
                "-preset", "fast",
                "-pix_fmt", "yuv420p",
            ]
            if has_audio:
                cmd_fallback.extend(["-c:a", "aac", "-b:a", "192k"])
            else:
                cmd_fallback.append("-an")
            cmd_fallback.extend(["-movflags", "+faststart", output_filename])

            res2 = subprocess.run(cmd_fallback, cwd=str(work_dir), capture_output=True, text=True, timeout=600, check=False)
            if res2.returncode != 0 or not output_path.exists() or output_path.stat().st_size == 0:
                logger.error("FFmpeg subtitle fallback burn also failed: %s", res2.stderr)
                raise ClipFetchError("Failed to burn captions into video frames.", status_code=500)

        validate_media_file(output_path, expect_video=True, expect_audio=has_audio)

