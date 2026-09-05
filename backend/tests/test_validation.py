import pytest
from app.utils.validation import sanitize_filename, validate_url


def test_invalid_url_rejected():
    with pytest.raises(ValueError):
        validate_url("ftp://example.com/video.mp4")


def test_malformed_request_rejected():
    with pytest.raises(ValueError):
        validate_url("not a real url")


def test_filename_sanitization():
    assert sanitize_filename("../bad name?.mp4") == "bad_name.mp4"
    assert sanitize_filename("video title.mp4") == "video_title.mp4"


def test_youtube_urls_are_normalized():
    assert validate_url("https://www.youtube.com/watch?v=abc123") == "https://www.youtube.com/watch?v=abc123"
    assert validate_url("https://youtu.be/abc123") == "https://www.youtube.com/watch?v=abc123"
    assert validate_url("https://www.youtube.com/shorts/abc123") == "https://www.youtube.com/watch?v=abc123"
