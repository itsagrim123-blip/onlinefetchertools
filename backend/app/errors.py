from __future__ import annotations

from fastapi import HTTPException


class ClipFetchError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class InvalidUrlError(ClipFetchError):
    def __init__(self, message: str = "Invalid URL"):
        super().__init__(message, status_code=400)


class UnsupportedUrlError(ClipFetchError):
    def __init__(self, message: str = "Unsupported URL"):
        super().__init__(message, status_code=400)


class DownloadFailedError(ClipFetchError):
    def __init__(self, message: str = "Download failed"):
        super().__init__(message, status_code=500)


class RateLimitError(ClipFetchError):
    def __init__(self, message: str = "Server busy"):
        super().__init__(message, status_code=429)


class JobNotFoundError(ClipFetchError):
    def __init__(self, message: str = "Download not found"):
        super().__init__(message, status_code=404)


def to_http_exception(exc: ClipFetchError) -> HTTPException:
    return HTTPException(status_code=exc.status_code, detail=exc.message)
