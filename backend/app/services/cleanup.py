from __future__ import annotations

import shutil
import threading
import time
from pathlib import Path

from app.config import get_settings


class CleanupService:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self) -> None:
        while not self._stop.is_set():
            self.cleanup()
            time.sleep(60)

    def cleanup(self) -> None:
        settings = get_settings()
        retention_seconds = settings.temp_file_retention_minutes * 60
        root = Path(settings.download_dir)
        root.mkdir(parents=True, exist_ok=True)

        now = time.time()
        for path in root.iterdir():
            try:
                if path.is_dir():
                    is_temp_dir = (
                        path.name.startswith("tmp_")
                        or path.name.startswith("clipfetch_tool_")
                        or path.name.startswith("clipfetch_")
                    )
                    if is_temp_dir and now - path.stat().st_mtime > retention_seconds:
                        shutil.rmtree(path, ignore_errors=True)
                    continue
                if path.is_file() and now - path.stat().st_mtime > retention_seconds:
                    path.unlink(missing_ok=True)
            except OSError:
                continue

        try:
            from app.services.downloader import get_download_service

            get_download_service().evict_expired_jobs(max_age_seconds=max(3600, retention_seconds))
        except Exception:
            pass

    def stop(self) -> None:
        self._stop.set()
