from __future__ import annotations

import io
import json
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def generate_synthetic_audio(duration: float = 2.0, with_noise: bool = True) -> bytes:
    """Generates a small in-memory WAV file with a tone and optional noise."""
    cmd = [
        "ffmpeg",
        "-y",
        "-f", "lavfi",
        "-i", f"sine=frequency=440:duration={duration}",
    ]
    if with_noise:
        cmd.extend([
            "-f", "lavfi",
            "-i", f"anoisesrc=d={duration}:c=white:a=0.08",
            "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first",
        ])
    cmd.extend(["-f", "wav", "-"])
    proc = subprocess.run(cmd, capture_output=True, check=True)
    return proc.stdout


def generate_synthetic_video(duration: float = 2.0) -> bytes:
    """Generates a small in-memory MP4 video file with audio and valid moov header."""
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tf:
        temp_path = Path(tf.name)
    try:
        cmd = [
            "ffmpeg",
            "-y",
            "-f", "lavfi",
            "-i", f"testsrc=duration={duration}:size=160x120:rate=15",
            "-f", "lavfi",
            "-i", f"sine=frequency=440:duration={duration}",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-c:a", "aac",
            "-movflags", "+faststart",
            str(temp_path),
        ]
        subprocess.run(cmd, capture_output=True, check=True)
        return temp_path.read_bytes()
    finally:
        temp_path.unlink(missing_ok=True)


def test_analyze_endpoint_audio():
    audio_data = generate_synthetic_audio(duration=1.5, with_noise=True)
    files = {"file": ("test_sample.wav", io.BytesIO(audio_data), "audio/wav")}

    response = client.post("/api/media/noise-remover/analyze", files=files)
    assert response.status_code == 200
    data = response.json()
    assert "duration" in data
    assert data["duration"] > 0
    assert "waveform" in data
    assert len(data["waveform"]) == 100
    assert data["has_video"] is False
    assert data["suggested_mode"] == "auto"


def test_analyze_endpoint_video():
    video_data = generate_synthetic_video(duration=1.0)
    files = {"file": ("test_sample.mp4", io.BytesIO(video_data), "video/mp4")}

    response = client.post("/api/media/noise-remover/analyze", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["has_video"] is True
    assert data["duration"] > 0
    assert len(data["waveform"]) == 100


def test_process_audio_balanced_mode():
    audio_data = generate_synthetic_audio(duration=2.0, with_noise=True)
    files = {"file": ("speech_noisy.wav", io.BytesIO(audio_data), "audio/wav")}
    data = {
        "mode": "balanced",
        "strength": "60",
        "voice_enhancement": "true",
        "hum_removal": "auto",
        "low_frequency_cleanup": "auto",
        "normalize": "true",
        "output_format": "mp3",
    }

    response = client.post("/api/media/noise-remover/process", files=files, data=data)
    assert response.status_code == 200
    assert "audio/mpeg" in response.headers.get("Content-Type", "")
    assert len(response.content) > 0
    # Cleaned peaks header
    peaks_header = response.headers.get("X-Cleaned-Peaks")
    assert peaks_header is not None
    peaks = json.loads(peaks_header)
    assert isinstance(peaks, list)
    assert len(peaks) == 100


def test_process_modes_and_strength():
    audio_data = generate_synthetic_audio(duration=1.0, with_noise=True)

    for mode in ["light", "strong", "auto"]:
        files = {"file": (f"test_{mode}.wav", io.BytesIO(audio_data), "audio/wav")}
        data = {
            "mode": mode,
            "strength": "75",
            "voice_enhancement": "false",
            "hum_removal": "50hz",
            "low_frequency_cleanup": "80hz",
            "normalize": "false",
            "output_format": "wav",
        }
        response = client.post("/api/media/noise-remover/process", files=files, data=data)
        assert response.status_code == 200
        assert len(response.content) > 0


def test_audio_noise_removal_alias_endpoint():
    audio_data = generate_synthetic_audio(duration=1.0, with_noise=False)
    files = {"file": ("alias_test.wav", io.BytesIO(audio_data), "audio/wav")}
    data = {"mode": "auto", "strength": "50"}

    response = client.post("/api/audio/noise-removal", files=files, data=data)
    assert response.status_code == 200
    assert len(response.content) > 0


def test_process_video():
    video_data = generate_synthetic_video(duration=1.0)
    files = {"file": ("noisy_video.mp4", io.BytesIO(video_data), "video/mp4")}
    data = {
        "mode": "auto",
        "strength": "60",
        "voice_enhancement": "true",
        "output_format": "video",
    }

    response = client.post("/api/media/noise-remover/process", files=files, data=data)
    assert response.status_code == 200
    assert "video/mp4" in response.headers.get("Content-Type", "")
    assert len(response.content) > 0


def test_unsupported_format_rejected():
    files = {"file": ("document.pdf", io.BytesIO(b"%PDF-1.4 dummy content"), "application/pdf")}
    response = client.post("/api/media/noise-remover/process", files=files)
    assert response.status_code == 400
    assert "Unsupported file type" in response.text


def test_empty_file_rejected():
    files = {"file": ("empty.mp3", io.BytesIO(b""), "audio/mpeg")}
    response = client.post("/api/media/noise-remover/process", files=files)
    assert response.status_code == 400
