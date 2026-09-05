import os
import shutil
import subprocess
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import mkdtemp
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.errors import ClipFetchError
from app.main import app
from app.models import DownloadJob
from app.services.archive_tools import _validate_zip_entry
from app.services.cleanup import CleanupService
from app.services.downloader import JobStore
from app.services.media_tools import edit_video, video_to_gif
from app.utils.rate_limit import SlidingWindowRateLimiter
from app.utils.validation import sanitize_filename

client = TestClient(app)


def test_sanitize_filename_windows_reserved_names():
    assert sanitize_filename('con.png') == 'file_con.png'
    assert sanitize_filename('aux.pdf') == 'file_aux.pdf'
    assert sanitize_filename('NUL') == 'file_NUL'
    assert sanitize_filename('prn.jpg') == 'file_prn.jpg'
    assert sanitize_filename('com1.txt') == 'file_com1.txt'
    assert sanitize_filename('normal_file.png') == 'normal_file.png'


def test_cleanup_service_prunes_clipfetch_tool_and_tmp_directories():
    settings = get_settings()
    download_dir = Path(settings.download_dir)
    download_dir.mkdir(parents=True, exist_ok=True)

    tool_dir = Path(mkdtemp(prefix='clipfetch_tool_', dir=str(download_dir)))
    tmp_dir = Path(mkdtemp(prefix='tmp_', dir=str(download_dir)))
    normal_dir = Path(mkdtemp(prefix='keep_me_', dir=str(download_dir)))

    # Backdate mtime by 2 hours
    past_time = time.time() - 7200
    os.utime(tool_dir, (past_time, past_time))
    os.utime(tmp_dir, (past_time, past_time))
    os.utime(normal_dir, (past_time, past_time))

    cleanup_service = CleanupService()
    cleanup_service.cleanup()
    cleanup_service.stop()

    assert not tool_dir.exists(), 'clipfetch_tool_ directory should have been pruned'
    assert not tmp_dir.exists(), 'tmp_ directory should have been pruned'
    assert normal_dir.exists(), 'Directories without temporary prefixes should be retained'

    shutil.rmtree(normal_dir, ignore_errors=True)


def test_job_store_eviction():
    store = JobStore()
    now = datetime.now(timezone.utc)
    old_time = now - timedelta(hours=2)

    job1 = DownloadJob(id='job-old', url='https://youtube.com/watch?v=111', format_id='best', completed_at=old_time)
    job2 = DownloadJob(id='job-new', url='https://youtube.com/watch?v=222', format_id='best', completed_at=now)

    store.create(job1)
    store.create(job2)

    evicted = store.evict_expired(max_age_seconds=3600)
    assert evicted == 1

    with pytest.raises(Exception):
        store.get('job-old')

    assert store.get('job-new').id == 'job-new'


def test_sliding_window_rate_limiter():
    limiter = SlidingWindowRateLimiter(limit=2, window_seconds=60)

    class DummyRequest:
        class DummyClient:
            host = '192.168.1.50'
        client = DummyClient()

    req = DummyRequest()
    limiter.check(req)
    limiter.check(req)

    with pytest.raises(ClipFetchError) as exc_info:
        limiter.check(req)
    assert exc_info.value.status_code == 429


def test_silent_video_speed_editing(tmp_path):
    if not shutil.which('ffmpeg'):
        pytest.skip('FFmpeg not installed')

    source = tmp_path / 'silent.mp4'
    cmd = [
        'ffmpeg', '-y',
        '-f', 'lavfi', '-i', 'color=c=black:s=160x120:d=1',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
        str(source),
    ]
    subprocess.run(cmd, capture_output=True, check=True)

    output = tmp_path / 'speed_1_5x.mp4'
    edit_video(source, output, speed=1.5, include_audio=True)
    assert output.exists()
    assert output.stat().st_size > 0


def test_zero_compress_size_zip_bomb_detection(tmp_path):
    import zipfile

    dummy_info = zipfile.ZipInfo('huge.bin')
    dummy_info.file_size = 20 * 1024 * 1024  # 20 MB
    dummy_info.compress_size = 0  # Suspicious 0-byte compressed size

    with pytest.raises(ClipFetchError) as exc_info:
        _validate_zip_entry(dummy_info, tmp_path)
    assert exc_info.value.status_code == 400
    assert 'zero compressed size' in exc_info.value.message.lower()
