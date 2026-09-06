import json
import shutil
import subprocess
from io import BytesIO
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.media_tools import validate_media_file
from app.services.video_project import (
    AudioTrackModel,
    ExportSettingsModel,
    ProjectSettingsModel,
    TextLayerModel,
    VideoClipModel,
    VideoProjectManifest,
)
from app.services.video_project.builder import build_ffmpeg_command, compute_canvas_dimensions
from app.services.video_project.executor import execute_project_render

client = TestClient(app)


def make_synthetic_video(path: Path, duration: int = 3) -> None:
    ffmpeg_cmd = shutil.which("ffmpeg")
    assert ffmpeg_cmd, "FFmpeg must be installed"
    cmd = [
        ffmpeg_cmd,
        "-y",
        "-f", "lavfi", "-i", f"testsrc=duration={duration}:size=320x240:rate=25",
        "-f", "lavfi", "-i", f"sine=frequency=800:duration={duration}",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-pix_fmt", "yuv420p",
        str(path),
    ]
    subprocess.run(cmd, capture_output=True, check=True)


def make_synthetic_audio(path: Path, duration: int = 4) -> None:
    ffmpeg_cmd = shutil.which("ffmpeg")
    assert ffmpeg_cmd, "FFmpeg must be installed"
    codec = "libmp3lame" if path.suffix.lower() == ".mp3" else "aac"
    cmd = [
        ffmpeg_cmd,
        "-y",
        "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration}",
        "-c:a", codec,
        str(path),
    ]
    subprocess.run(cmd, capture_output=True, check=True)


def test_manifest_validation():
    manifest_dict = {
        "title": "My Vacation Reel",
        "settings": {
            "aspect_ratio": "9:16",
            "canvas_width": 1080,
            "canvas_height": 1920,
            "fps": 30,
        },
        "clips": [
            {
                "id": "clip_1",
                "asset_id": "asset_1",
                "name": "Intro.mp4",
                "type": "video",
                "source_duration": 10.0,
                "start_trim": 1.0,
                "end_trim": 5.0,
                "speed": 1.5,
                "scale": 1.1,
                "rotation": 0,
                "flip_horizontal": False,
                "flip_vertical": False,
                "filter_preset": "warm",
                "brightness": 10,
                "contrast": 5,
                "saturation": 15,
            }
        ],
        "audio_tracks": [
            {
                "id": "audio_1",
                "asset_id": "asset_bgm",
                "name": "BGM.mp3",
                "source_duration": 30.0,
                "timeline_start": 0.0,
                "start_trim": 0.0,
                "duration": 4.0,
                "volume": 0.8,
                "is_muted": False,
                "fade_in_duration": 0.5,
                "fade_out_duration": 0.5,
            }
        ],
        "text_layers": [
            {
                "id": "txt_1",
                "text": "Hello Summer!",
                "timeline_start": 0.5,
                "duration": 2.5,
                "font_size": 32,
                "font_color": "#ffffff",
                "alignment": "center",
                "is_bold": True,
                "position_x": 50,
                "position_y": 80,
            }
        ],
        "export_settings": {
            "format": "mp4",
            "resolution": "720p",
            "quality": "high",
            "fps": 30,
        },
    }

    manifest = VideoProjectManifest.model_validate(manifest_dict)
    assert manifest.title == "My Vacation Reel"
    assert manifest.settings.aspect_ratio == "9:16"
    assert len(manifest.clips) == 1
    assert manifest.clips[0].speed == 1.5
    assert len(manifest.audio_tracks) == 1
    assert len(manifest.text_layers) == 1


def test_compute_canvas_dimensions():
    # 16:9
    m1 = VideoProjectManifest(
        settings=ProjectSettingsModel(aspect_ratio="16:9"),
        export_settings=ExportSettingsModel(resolution="1080p"),
    )
    w, h = compute_canvas_dimensions(m1)
    assert (w, h) == (1920, 1080)

    # 9:16
    m2 = VideoProjectManifest(
        settings=ProjectSettingsModel(aspect_ratio="9:16"),
        export_settings=ExportSettingsModel(resolution="1080p"),
    )
    w, h = compute_canvas_dimensions(m2)
    assert (w, h) == (1080, 1920)

    # 1:1 at 720p
    m3 = VideoProjectManifest(
        settings=ProjectSettingsModel(aspect_ratio="1:1"),
        export_settings=ExportSettingsModel(resolution="720p"),
    )
    w, h = compute_canvas_dimensions(m3)
    assert (w, h) == (720, 720)


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg required")
def test_build_ffmpeg_command_and_render(tmp_path):
    vid1 = tmp_path / "vid1.mp4"
    vid2 = tmp_path / "vid2.mp4"
    bgm = tmp_path / "bgm.mp3"
    make_synthetic_video(vid1, duration=3)
    make_synthetic_video(vid2, duration=3)
    make_synthetic_audio(bgm, duration=5)

    manifest = VideoProjectManifest(
        title="Test Multi Clip Project",
        settings=ProjectSettingsModel(aspect_ratio="16:9"),
        clips=[
            VideoClipModel(
                id="c1",
                asset_id="a1",
                name="Clip 1",
                source_duration=3.0,
                start_trim=0.5,
                end_trim=2.5,
                speed=1.0,
                scale=1.0,
                filter_preset="warm",
                brightness=5,
            ),
            VideoClipModel(
                id="c2",
                asset_id="a2",
                name="Clip 2",
                source_duration=3.0,
                start_trim=0.0,
                end_trim=2.0,
                speed=1.5,
                scale=1.0,
                filter_preset="bw",
            ),
        ],
        audio_tracks=[
            AudioTrackModel(
                id="aud1",
                asset_id="a_bgm",
                name="Music",
                source_duration=5.0,
                timeline_start=0.0,
                start_trim=0.0,
                duration=3.0,
                volume=0.5,
            )
        ],
        text_layers=[
            TextLayerModel(
                id="t1",
                text="Online Fetcher Video Editor",
                timeline_start=0.5,
                duration=1.5,
                font_size=24,
                font_color="#ffffff",
                position_x=50,
                position_y=50,
            )
        ],
        export_settings=ExportSettingsModel(
            format="mp4",
            resolution="480p",
            quality="medium",
            fps=25,
        ),
    )

    assets_map = {
        "a1": vid1,
        "a2": vid2,
        "a_bgm": bgm,
    }

    out_file = tmp_path / "rendered_output.mp4"
    execute_project_render(manifest, assets_map, out_file)

    assert out_file.exists()
    assert out_file.stat().st_size > 0
    meta = validate_media_file(out_file, expect_video=True, expect_audio=True)
    assert meta["has_video"] is True
    assert meta["has_audio"] is True


@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="FFmpeg required")
def test_api_project_render_endpoint(tmp_path):
    vid = tmp_path / "sample.mp4"
    make_synthetic_video(vid, duration=2)

    manifest = VideoProjectManifest(
        title="API Test Project",
        settings=ProjectSettingsModel(aspect_ratio="16:9"),
        clips=[
            VideoClipModel(
                id="c1",
                asset_id="asset_test",
                name="sample.mp4",
                source_duration=2.0,
                start_trim=0.0,
                end_trim=1.5,
            )
        ],
        export_settings=ExportSettingsModel(
            format="mp4",
            resolution="480p",
            quality="low",
            fps=24,
        ),
    )

    with open(vid, "rb") as f:
        response = client.post(
            "/api/media/project-render",
            data={"manifest": manifest.model_dump_json()},
            files={"asset_asset_test": ("sample.mp4", f, "video/mp4")},
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "video/mp4"
    assert "content-disposition" in response.headers
    assert "x-filename" in response.headers
    assert len(response.content) > 0
