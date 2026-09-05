from __future__ import annotations

import time
from collections import defaultdict

from fastapi import Request

from app.config import get_settings
from app.errors import ClipFetchError


class SlidingWindowRateLimiter:
    def __init__(self, limit: int = 60, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._records: dict[str, list[float]] = defaultdict(list)

    def check(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        timestamps = self._records[client_ip]
        cutoff = now - self.window_seconds
        valid = [t for t in timestamps if t > cutoff]
        if len(valid) >= self.limit:
            self._records[client_ip] = valid
            raise ClipFetchError(
                "Rate limit exceeded. Please wait a moment before trying again.",
                status_code=429,
            )
        valid.append(now)
        self._records[client_ip] = valid

    def reset(self) -> None:
        self._records.clear()


_analyze_limiter = SlidingWindowRateLimiter(limit=20, window_seconds=60)
_download_limiter = SlidingWindowRateLimiter(limit=10, window_seconds=60)


def rate_limit_analyze(request: Request) -> None:
    settings = get_settings()
    _analyze_limiter.limit = settings.max_analyze_requests_per_minute
    _analyze_limiter.window_seconds = settings.rate_limit_window_seconds
    _analyze_limiter.check(request)


def rate_limit_download(request: Request) -> None:
    settings = get_settings()
    _download_limiter.limit = settings.max_download_requests_per_minute
    _download_limiter.window_seconds = settings.rate_limit_window_seconds
    _download_limiter.check(request)