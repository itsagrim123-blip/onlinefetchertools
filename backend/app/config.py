from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "ClipFetch"
    backend_port: int = 8000
    frontend_origin: str = "http://localhost:3000,http://127.0.0.1:3000"
    max_download_size_mb: int = 2048
    max_upload_size_mb: int = 200
    max_concurrent_downloads: int = 2
    temp_file_retention_minutes: int = 30
    max_analyze_requests_per_minute: int = 20
    max_download_requests_per_minute: int = 10
    download_dir: str = "downloads"
    request_timeout_seconds: int = 45
    rate_limit_window_seconds: int = 60

    @property
    def download_path(self) -> Path:
        path = Path(self.download_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def frontend_origins(self) -> list[str]:
        return [origin.strip() for origin in self.frontend_origin.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
