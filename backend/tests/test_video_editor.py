import shutil
import subprocess
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.media_tools import edit_video, validate_media_file

client = TestClient(app)


def make_test_video(path: Path, duration: int = 4) -> None:
    ffmpeg_cmd = shutil.which("ffmpeg")
    assert ffmpeg_cmd, "FFmpeg must be installed to run media tests"
    cmd = [
        ffmpeg_cmd,
        "-y",
        "-f", "lavfi", "-i", f"testsrc=duration={duration}:size=640x360:rate=30",
        "-f", "lavfi", "-i", f"sine=frequency=1000:duration={duration}",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-pix_fmt", "yuv420p",
        str(path),
    ]
    subprocess.run(cmd, capture_output=True, check=True)


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg required")
def test_edit_video_trim_and_scale(tmp_path):
    source = tmp_path / "sample.mp4"
    make_test_video(source, duration=5)

    output = tmp_path / "edited.mp4"
    edit_video(
        source=source,
        output=output,
        start_time="1",
        end_time="3",
        resolution="720p",
        quality="high",
        output_format="mp4",
        include_audio=True,
    )

    assert output.exists()
    assert output.stat().st_size > 0
    validation = validate_media_file(output, expect_video=True, expect_audio=True)
    assert validation["has_video"] is True
    assert validation["has_audio"] is True


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg required")
def test_edit_video_mute_audio(tmp_path):
    source = tmp_path / "sample.mp4"
    make_test_video(source, duration=3)

    output = tmp_path / "muted.mp4"
    edit_video(
        source=source,
        output=output,
        start_time=None,
        end_time=None,
        resolution="original",
        quality="medium",
        output_format="mp4",
        include_audio=False,
    )

    assert output.exists()
    validation = validate_media_file(output, expect_video=True, expect_audio=False)
    assert validation["has_video"] is True
    assert validation["has_audio"] is False


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg required")
def test_api_media_edit_endpoint(tmp_path):
    source = tmp_path / "upload_sample.mp4"
    make_test_video(source, duration=3)

    with open(source, "rb") as f:
        file_bytes = f.read()

    response = client.post(
        "/api/media/edit",
        files={"file": ("video.mp4", BytesIO(file_bytes), "video/mp4")},
        data={
            "start_time": "0.5",
            "end_time": "2.0",
            "resolution": "480p",
            "quality": "high",
            "output_format": "mp4",
            "include_audio": "true",
        },
    )

    assert response.status_code == 200
    assert response.headers["content-disposition"]
    assert len(response.content) > 0


def test_api_media_edit_rejects_unsupported_file():
    response = client.post(
        "/api/media/edit",
        files={"file": ("document.txt", BytesIO(b"not a video"), "text/plain")},
        data={"output_format": "mp4"},
    )
    assert response.status_code == 400

