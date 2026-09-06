from __future__ import annotations

import json
import logging
import math
import shutil
import subprocess
from pathlib import Path
from typing import Any

import numpy as np

from app.errors import ClipFetchError
from app.services.media_tools import validate_media_file

logger = logging.getLogger(__name__)

AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".mkv"}
ALL_EXTENSIONS = AUDIO_EXTENSIONS | VIDEO_EXTENSIONS


class NoiseRemoverService:
    _instance: NoiseRemoverService | None = None

    def __init__(self) -> None:
        self.models_dir = Path(__file__).resolve().parent.parent / "models" / "rnnoise"
        self.ffmpeg_cmd = shutil.which("ffmpeg") or "ffmpeg"
        self.ffprobe_cmd = shutil.which("ffprobe") or "ffprobe"
        self.available_models: dict[str, Path] = {}
        self.initialized = False

    @classmethod
    def get_instance(cls) -> NoiseRemoverService:
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def initialize(self) -> None:
        """Non-blocking background validation and indexing of RNNoise models."""
        try:
            self.models_dir.mkdir(parents=True, exist_ok=True)
            required = {
                "sh": self.models_dir / "sh.rnnn",
                "bd": self.models_dir / "bd.rnnn",
                "cb": self.models_dir / "cb.rnnn",
                "mp": self.models_dir / "mp.rnnn",
            }
            for key, path in required.items():
                if path.exists() and path.stat().st_size > 0:
                    self.available_models[key] = path
                else:
                    logger.warning("RNNoise model %s not found at %s", key, path)
            self.initialized = True
            logger.info("NoiseRemoverService initialized with models: %s", list(self.available_models.keys()))
        except Exception as exc:
            logger.error("Failed to initialize NoiseRemoverService: %s", exc)

    def _get_model_path(self, mode: str) -> Path:
        normalized_mode = (mode or "auto").lower().strip()
        model_map = {
            "light": "bd",      # Beguiling Drafter - maximizes original speech nuances
            "balanced": "sh",   # Somnolent Hogwash - standard general noise reduction
            "strong": "cb",     # Conjoined Burgers - aggressive stationary noise suppression
            "auto": "sh",
        }
        key = model_map.get(normalized_mode, "sh")
        if key in self.available_models:
            return self.available_models[key]

        fallback = self.models_dir / f"{key}.rnnn"
        if fallback.exists():
            return fallback

        # Fallback to any existing model in directory
        existing = list(self.models_dir.glob("*.rnnn"))
        if existing:
            return existing[0]

        raise ClipFetchError(
            "Noise reduction model files are not available on the server. Please contact system administrator.",
            status_code=503,
        )

    def extract_waveform_peaks(self, audio_path: Path, num_peaks: int = 100) -> list[float]:
        """
        Extracts lightweight normalized amplitude peaks (0.0 - 1.0) from an audio file
        by decoding downsampled 8kHz mono PCM float32. Extremely fast (<20ms).
        """
        try:
            cmd = [
                self.ffmpeg_cmd,
                "-v", "error",
                "-i", str(audio_path),
                "-ac", "1",
                "-ar", "8000",
                "-f", "f32le",
                "-",
            ]
            proc = subprocess.run(cmd, capture_output=True, timeout=30, check=False)
            if proc.returncode != 0 or not proc.stdout:
                return [0.05] * num_peaks

            raw_data = np.frombuffer(proc.stdout, dtype=np.float32)
            if len(raw_data) == 0:
                return [0.05] * num_peaks

            # Handle infinite/NaN
            raw_data = np.nan_to_num(raw_data, nan=0.0, posinf=1.0, neginf=-1.0)

            bin_size = max(1, len(raw_data) // num_peaks)
            peaks: list[float] = []
            for i in range(num_peaks):
                segment = raw_data[i * bin_size : (i + 1) * bin_size]
                if len(segment) > 0:
                    peaks.append(float(np.max(np.abs(segment))))
                else:
                    peaks.append(0.0)

            max_peak = max(peaks) if peaks else 1.0
            if max_peak <= 0.0001:
                return [0.02] * num_peaks

            # Normalize to 0.02 - 1.0 range
            return [round(max(0.02, min(1.0, p / max_peak)), 3) for p in peaks]
        except Exception as exc:
            logger.warning("Failed to extract waveform peaks for %s: %s", audio_path, exc)
            return [0.1] * num_peaks

    def analyze_media_sync(self, input_path: Path) -> dict[str, Any]:
        """
        Validates the uploaded media and returns metadata including duration,
        file size, format, whether it contains video, and waveform peaks.
        """
        probe = validate_media_file(input_path, expect_video=False, expect_audio=True)
        duration = float(probe.get("duration", 0.0))
        has_video = bool(probe.get("has_video", False))
        size = input_path.stat().st_size

        # Extract waveform peaks
        peaks = self.extract_waveform_peaks(input_path, num_peaks=100)

        # Estimate sample rate and channels from probe streams
        sample_rate = 44100
        channels = 2
        for s in probe.get("streams", []):
            if s.get("codec_type") == "audio":
                sample_rate = int(s.get("sample_rate", 44100))
                channels = int(s.get("channels", 2))
                break

        return {
            "duration": round(duration, 2),
            "size": size,
            "has_video": has_video,
            "sample_rate": sample_rate,
            "channels": channels,
            "waveform": peaks,
            "suggested_mode": "auto",
        }

    def build_audio_filter_chain(
        self,
        mode: str = "auto",
        strength: int = 60,
        voice_enhancement: bool = True,
        hum_removal: str = "auto",
        low_frequency_cleanup: str = "auto",
        normalize: bool = True,
    ) -> str:
        """
        Constructs an optimized FFmpeg audio filtergraph combining:
        1. 48kHz resampling (required by RNNoise models)
        2. Low-frequency rumble cleanup (highpass filter)
        3. Electrical hum removal (50Hz / 60Hz and harmonics notch filters)
        4. Neural network noise reduction (arnndn with selected model & wet/dry mix)
        5. Optional FFT noise gate in STRONG mode for residual background noise
        6. Vocal enhancement (clarity EQ + subtle smooth compression)
        7. Safe loudness normalization (EBU R128 loudnorm)
        """
        mode_clean = (mode or "auto").lower().strip()
        strength_clamped = max(0, min(100, int(strength)))

        filters: list[str] = ["aresample=48000"]

        # Step 1: Low-frequency rumble cleanup (removes AC rumble, handling noise, desk vibration)
        lfc_clean = (low_frequency_cleanup or "auto").lower().strip()
        if lfc_clean == "auto":
            cutoff = 75
        elif lfc_clean == "60hz":
            cutoff = 60
        elif lfc_clean == "80hz":
            cutoff = 80
        elif lfc_clean == "100hz":
            cutoff = 100
        else:
            cutoff = 0

        if cutoff > 0:
            filters.append(f"highpass=f={cutoff}:p=2")

        # Step 2: Electrical hum removal (50 Hz / 60 Hz + harmonics)
        hum_clean = (hum_removal or "auto").lower().strip()
        if hum_clean in ("auto", "50hz"):
            filters.extend([
                "bandreject=f=50:width_type=q:w=12",
                "bandreject=f=100:width_type=q:w=12",
                "bandreject=f=150:width_type=q:w=12",
            ])
        if hum_clean in ("auto", "60hz"):
            filters.extend([
                "bandreject=f=60:width_type=q:w=12",
                "bandreject=f=120:width_type=q:w=12",
                "bandreject=f=180:width_type=q:w=12",
            ])

        # Step 3: Neural network noise reduction (arnndn)
        model_path = self._get_model_path(mode_clean)
        # Escape path for FFmpeg filter parser (colons in Windows drive paths must be escaped with \:)
        escaped_model_path = str(model_path.resolve()).replace("\\", "/").replace(":", "\\:")

        # Calculate effective mix based on mode and strength slider (0% -> mix 0.0, 100% -> mix 1.0)
        base_strength = strength_clamped / 100.0
        if mode_clean == "light":
            # Cap mix to preserve maximum vocal characteristics
            mix_val = min(0.75, base_strength * 0.8)
        elif mode_clean == "balanced":
            mix_val = min(1.0, base_strength * 0.95)
        elif mode_clean == "strong":
            mix_val = min(1.0, 0.4 + base_strength * 0.6)
        else:  # auto
            mix_val = min(1.0, base_strength * 0.9)

        mix_val = round(max(0.0, min(1.0, mix_val)), 2)
        filters.append(f"arnndn=m='{escaped_model_path}':mix={mix_val}")

        # In STRONG mode with high strength, complement with subtle FFT spectral gating
        if mode_clean == "strong" and strength_clamped >= 70:
            filters.append("afftdn=nr=10:nf=-50:tn=1")

        # Step 4: Voice enhancement (EQ + gentle compression)
        if voice_enhancement:
            # - Remove vocal muddiness in low-mids: -2.5dB at 260Hz
            # - Boost vocal presence and consonant intelligibility: +3dB at 3200Hz
            # - Subtle air for open, natural sound: +1.5dB at 8000Hz
            # - Gentle transparent vocal leveling (prevents volume swings)
            filters.extend([
                "equalizer=f=260:t=q:w=1.2:g=-2.5",
                "equalizer=f=3200:t=q:w=1.4:g=3.0",
                "equalizer=f=8000:t=q:w=1.0:g=1.5",
                "acompressor=threshold=-18dB:ratio=2.5:attack=15:release=120:makeup=1.5dB",
            ])

        # Step 5: Safe loudness normalization (EBU R128 standard -16 LUFS, True Peak -1.5 dBFS)
        if normalize:
            filters.append("loudnorm=I=-16:LRA=11:TP=-1.5")

        return ",".join(filters)

    def process_media_sync(
        self,
        source_path: Path,
        work_dir: Path,
        mode: str = "auto",
        strength: int = 60,
        voice_enhancement: bool = True,
        hum_removal: str = "auto",
        low_frequency_cleanup: str = "auto",
        normalize: bool = True,
        output_format: str | None = None,
    ) -> tuple[Path, str, list[float]]:
        """
        Executes real noise reduction on audio or video files.
        Returns:
            - output_path: Path to the processed file
            - output_filename: Suggested downloadable filename
            - cleaned_peaks: 100 normalized waveform peak points of the cleaned audio
        """
        probe = validate_media_file(source_path, expect_video=False, expect_audio=True)
        has_video = bool(probe.get("has_video", False))
        stem = source_path.stem
        source_ext = source_path.suffix.lower()

        filter_graph = self.build_audio_filter_chain(
            mode=mode,
            strength=strength,
            voice_enhancement=voice_enhancement,
            hum_removal=hum_removal,
            low_frequency_cleanup=low_frequency_cleanup,
            normalize=normalize,
        )

        logger.info("Executing noise removal with filtergraph: %s", filter_graph)

        if has_video and (output_format is None or output_format.lower() in ("video", "original")):
            # VIDEO WORKFLOW:
            # 1. Process audio into intermediate 48kHz WAV
            clean_wav_path = work_dir / "cleaned_audio.wav"
            cmd_audio = [
                self.ffmpeg_cmd,
                "-y",
                "-i", str(source_path),
                "-vn",
                "-af", filter_graph,
                "-c:a", "pcm_s16le",
                "-ar", "48000",
                str(clean_wav_path),
            ]
            proc_audio = subprocess.run(cmd_audio, capture_output=True, text=True, timeout=300, check=False)
            if proc_audio.returncode != 0 or not clean_wav_path.exists():
                logger.error("FFmpeg audio denoising failed: %s", proc_audio.stderr)
                raise ClipFetchError("Audio noise removal processing failed. Please check your media file.", status_code=400)

            # 2. Extract cleaned peaks
            cleaned_peaks = self.extract_waveform_peaks(clean_wav_path, num_peaks=100)

            # 3. Mux cleaned audio back into original video container preserving video stream losslessly
            out_ext = source_ext if source_ext in VIDEO_EXTENSIONS else ".mp4"
            out_filename = f"{stem}_cleaned{out_ext}"
            final_output_path = work_dir / out_filename

            cmd_mux = [
                self.ffmpeg_cmd,
                "-y",
                "-i", str(source_path),
                "-i", str(clean_wav_path),
                "-map", "0:v:0",
                "-map", "1:a:0",
                "-c:v", "copy",
                "-c:a", "aac",
                "-b:a", "192k",
                "-shortest",
                str(final_output_path),
            ]
            proc_mux = subprocess.run(cmd_mux, capture_output=True, text=True, timeout=300, check=False)
            if proc_mux.returncode != 0 or not final_output_path.exists():
                logger.warning("Stream copy muxing failed, falling back to H.264 encode: %s", proc_mux.stderr)
                # Fallback to re-encode video if stream-copy fails on exotic codec
                cmd_mux_fallback = [
                    self.ffmpeg_cmd,
                    "-y",
                    "-i", str(source_path),
                    "-i", str(clean_wav_path),
                    "-map", "0:v:0",
                    "-map", "1:a:0",
                    "-c:v", "libx264",
                    "-crf", "20",
                    "-preset", "fast",
                    "-c:a", "aac",
                    "-b:a", "192k",
                    "-shortest",
                    str(final_output_path),
                ]
                proc_fallback = subprocess.run(cmd_mux_fallback, capture_output=True, text=True, timeout=300, check=False)
                if proc_fallback.returncode != 0 or not final_output_path.exists():
                    raise ClipFetchError("Failed to re-mux cleaned audio into video.", status_code=500)

            return final_output_path, out_filename, cleaned_peaks

        else:
            # AUDIO WORKFLOW:
            # Determine target output format
            target_fmt = (output_format or "").lower().lstrip(".")
            if not target_fmt or target_fmt == "original":
                target_ext = source_ext if source_ext in AUDIO_EXTENSIONS else ".mp3"
            elif target_fmt == "wav":
                target_ext = ".wav"
            elif target_fmt == "flac":
                target_ext = ".flac"
            elif target_fmt in ("m4a", "aac"):
                target_ext = ".m4a"
            elif target_fmt == "ogg":
                target_ext = ".ogg"
            else:
                target_ext = ".mp3"

            out_filename = f"{stem}_cleaned{target_ext}"
            final_output_path = work_dir / out_filename

            # Choose high-quality encoder options according to format
            codec_args: list[str] = []
            if target_ext == ".mp3":
                codec_args = ["-c:a", "libmp3lame", "-b:a", "256k"]
            elif target_ext == ".wav":
                codec_args = ["-c:a", "pcm_s16le"]
            elif target_ext == ".m4a":
                codec_args = ["-c:a", "aac", "-b:a", "256k"]
            elif target_ext == ".flac":
                codec_args = ["-c:a", "flac"]
            elif target_ext == ".ogg":
                codec_args = ["-c:a", "libvorbis", "-q:a", "6"]
            else:
                codec_args = ["-c:a", "libmp3lame", "-b:a", "256k"]

            cmd = [
                self.ffmpeg_cmd,
                "-y",
                "-i", str(source_path),
                "-vn",
                "-af", filter_graph,
                *codec_args,
                str(final_output_path),
            ]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300, check=False)
            if proc.returncode != 0 or not final_output_path.exists():
                logger.error("FFmpeg audio denoising failed: %s", proc.stderr)
                raise ClipFetchError("Audio noise removal processing failed. Make sure audio is valid.", status_code=400)

            # Extract waveform peaks of the final cleaned audio
            cleaned_peaks = self.extract_waveform_peaks(final_output_path, num_peaks=100)

            return final_output_path, out_filename, cleaned_peaks

