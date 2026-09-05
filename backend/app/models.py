from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2000)


class VideoFormat(BaseModel):
    format_id: str
    language: str | None = None
    resolution: str | None = None
    ext: str = "mp4"
    filesize: int | None = None
    type: Literal["video", "audio"] = "video"
    quality_label: str | None = None


class VideoMetadata(BaseModel):
    success: bool = True
    id: str = Field(default_factory=lambda: str(uuid4()))
    title: str
    thumbnail: str | None = None
    duration: int | None = None
    uploader: str | None = None
    formats: list[VideoFormat] = Field(default_factory=list)


class DownloadRequest(BaseModel):
    url: str = Field(..., min_length=8, max_length=2000)
    format_id: str = Field(..., min_length=1, max_length=200)
    filename_preference: str | None = Field(default=None, max_length=255)


class DownloadStatus(BaseModel):
    job_id: str
    status: Literal["queued", "downloading", "processing", "complete", "failed"]
    progress: int = 0
    filename: str | None = None
    error: str | None = None
    downloaded_size: str | None = None
    speed: str | None = None
    eta: str | None = None


class DownloadJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    url: str
    format_id: str
    status: Literal["queued", "downloading", "processing", "complete", "failed"] = "queued"
    progress: int = 0
    filename: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: datetime | None = None
    error: str | None = None
    temp_dir: str | None = None
    downloaded_size: str | None = None
    speed: str | None = None
    eta: str | None = None
