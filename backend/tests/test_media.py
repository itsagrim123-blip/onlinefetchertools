from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.errors import ClipFetchError
from app.main import app
from app.models import VideoFormat, VideoMetadata
from app.routes import media

client = TestClient(app)


def test_analyze_returns_mocked_metadata(monkeypatch):
    metadata = VideoMetadata(
        id="abc123",
        title="Test video",
        thumbnail="https://i.ytimg.com/vi/abc123/hqdefault.jpg",
        formats=[VideoFormat(format_id="18", resolution="360p", ext="mp4", type="video")],
    )
    monkeypatch.setattr(media.extractor, "analyze_url", AsyncMock(return_value=metadata))

    response = client.post("/api/analyze", json={"url": "https://youtu.be/abc123"})

    assert response.status_code == 200
    assert response.json()["title"] == "Test video"
    assert response.json()["formats"][0]["format_id"] == "18"


def test_analyze_propagates_friendly_extractor_error(monkeypatch):
    monkeypatch.setattr(
        media.extractor,
        "analyze_url",
        AsyncMock(side_effect=ClipFetchError("Video unavailable", status_code=404)),
    )

    response = client.post("/api/analyze", json={"url": "https://youtu.be/abc123"})

    assert response.status_code == 404
    assert response.json() == {"detail": "Video unavailable"}


def test_analyze_rejects_malformed_url():
    response = client.post("/api/analyze", json={"url": "not a real url"})

    assert response.status_code == 400
    assert response.json()["detail"] in {"Invalid URL", "Unsupported URL"}


def test_analyze_requires_url():
    response = client.post("/api/analyze", json={})

    assert response.status_code == 422