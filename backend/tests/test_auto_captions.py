from __future__ import annotations

import json
from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.errors import ClipFetchError
from app.main import app
from app.services.captions import (
    AutoCaptionsService,
    format_ass_time,
    format_srt_time,
    format_vtt_time,
    hex_to_ass_color,
)

client = TestClient(app)


def test_time_formatters():
    # 0 seconds
    assert format_ass_time(0.0) == "0:00:00.00"
    assert format_srt_time(0.0) == "00:00:00,000"
    assert format_vtt_time(0.0) == "00:00:00.000"

    # 65.45 seconds = 1 minute 5.45 seconds
    assert format_ass_time(65.45) == "0:01:05.45"
    assert format_srt_time(65.45) == "00:01:05,450"
    assert format_vtt_time(65.45) == "00:01:05.450"

    # 3661.12 seconds = 1 hour 1 minute 1.12 seconds
    assert format_ass_time(3661.12) == "1:01:01.12"
    assert format_srt_time(3661.12) == "01:01:01,120"
    assert format_vtt_time(3661.12) == "01:01:01.120"


def test_hex_to_ass_color():
    # White #FFFFFF -> &H00FFFFFF
    assert hex_to_ass_color("#FFFFFF") == "&H00FFFFFF"
    assert hex_to_ass_color("FFF") == "&H00FFFFFF"
    # Pure Red #FF0000 -> B=00, G=00, R=FF -> &H000000FF
    assert hex_to_ass_color("#FF0000") == "&H000000FF"
    # Pure Blue #0000FF -> B=FF, G=00, R=00 -> &H00FF0000
    assert hex_to_ass_color("#0000FF") == "&H00FF0000"


def test_generate_ass_subtitles():
    service = AutoCaptionsService.get_instance()
    segments = [
        {"id": 1, "start": 1.0, "end": 3.5, "text": "Hello world"},
        {"id": 2, "start": 3.5, "end": 6.0, "text": "Second line with {special} characters"},
    ]

    ass_text = service.generate_ass_subtitles(
        segments=segments,
        video_width=1920,
        video_height=1080,
        position="bottom",
        style_preset="bold",
        font_size=32,
        font_color="#FFFF00",
        background_box=False,
    )

    assert "[Script Info]" in ass_text
    assert "PlayResX: 1920" in ass_text
    assert "PlayResY: 1080" in ass_text
    assert "[V4+ Styles]" in ass_text
    assert "Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Hello world" in ass_text
    # Braces should be escaped to parentheses
    assert "Second line with (special) characters" in ass_text


def test_generate_srt_and_vtt_subtitles():
    service = AutoCaptionsService.get_instance()
    segments = [
        {"id": 1, "start": 1.25, "end": 3.5, "text": "Welcome to my video."},
        {"id": 2, "start": 4.0, "end": 7.1, "text": "Next caption here."},
    ]

    srt_text = service.generate_srt_subtitles(segments)
    assert "1\n00:00:01,250 --> 00:00:03,500\nWelcome to my video." in srt_text
    assert "2\n00:00:04,000 --> 00:00:07,100\nNext caption here." in srt_text

    vtt_text = service.generate_vtt_subtitles(segments)
    assert vtt_text.startswith("WEBVTT\n")
    assert "1\n00:00:01.250 --> 00:00:03.500\nWelcome to my video." in vtt_text


def test_srt_download_endpoint():
    captions = json.dumps([
        {"id": 1, "start": 0.5, "end": 2.5, "text": "Test speech"},
    ])
    response = client.post(
        "/api/media/auto-captions/srt",
        data={"captions": captions, "filename": "demo.srt"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-subrip")
    assert "00:00:00,500 --> 00:00:02,500" in response.text
    assert "Test speech" in response.text


def test_vtt_download_endpoint():
    captions = json.dumps([
        {"id": 1, "start": 1.0, "end": 3.0, "text": "Web VTT speech"},
    ])
    response = client.post(
        "/api/media/auto-captions/vtt",
        data={"captions": captions, "filename": "demo.vtt"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/vtt")
    assert "WEBVTT" in response.text
    assert "00:00:01.000 --> 00:00:03.000" in response.text


def test_transcribe_endpoint_with_mock(monkeypatch):
    mock_service = MagicMock()
    mock_service.extract_audio_sync.return_value = None
    mock_service.transcribe_sync.return_value = {
        "language": "hi",
        "duration": 5.0,
        "segments": [
            {"id": 1, "start": 0.5, "end": 4.5, "text": "आज हम एक नया वीडियो बनाएंगे।"}
        ],
    }

    monkeypatch.setattr(
        "app.routes.auto_captions.AutoCaptionsService.get_instance",
        lambda: mock_service,
    )
    monkeypatch.setattr(
        "app.routes.auto_captions.validate_media_file",
        lambda *args, **kwargs: {"has_video": True, "has_audio": True},
    )

    fake_video = BytesIO(b"dummy video content for test")
    response = client.post(
        "/api/media/auto-captions/transcribe",
        files={"file": ("speech.mp4", fake_video, "video/mp4")},
        data={"language": "hi", "translate": "false"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["language"] == "hi"
    assert len(data["segments"]) == 1
    assert data["segments"][0]["text"] == "आज हम एक नया वीडियो बनाएंगे।"


def test_transcribe_no_speech_error(monkeypatch):
    mock_service = MagicMock()
    mock_service.extract_audio_sync.return_value = None
    mock_service.transcribe_sync.side_effect = ClipFetchError(
        "No speech was detected in this video. Please ensure the video contains clear audible speech.",
        status_code=400,
    )

    monkeypatch.setattr(
        "app.routes.auto_captions.AutoCaptionsService.get_instance",
        lambda: mock_service,
    )
    monkeypatch.setattr(
        "app.routes.auto_captions.validate_media_file",
        lambda *args, **kwargs: {"has_video": True, "has_audio": True},
    )

    fake_video = BytesIO(b"dummy silent video")
    response = client.post(
        "/api/media/auto-captions/transcribe",
        files={"file": ("silent.mp4", fake_video, "video/mp4")},
        data={"language": "auto"},
    )

    assert response.status_code == 400
    assert "No speech was detected" in response.json()["detail"]

