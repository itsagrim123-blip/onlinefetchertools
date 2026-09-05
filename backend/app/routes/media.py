from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from app.errors import ClipFetchError, InvalidUrlError, to_http_exception
from app.models import AnalyzeRequest, DownloadRequest, DownloadStatus, VideoMetadata
from app.services.downloader import DownloadService, get_download_service
from app.services.extractor import ExtractorService
from app.utils.rate_limit import rate_limit_analyze, rate_limit_download

router = APIRouter()
logger = logging.getLogger(__name__)
extractor = ExtractorService()
downloader = get_download_service()


@router.post("/api/analyze", response_model=VideoMetadata, dependencies=[Depends(rate_limit_analyze)])
async def analyze(payload: AnalyzeRequest) -> VideoMetadata:
    logger.info("Analyze request received")
    try:
        result = await extractor.analyze_url(payload.url)
        logger.info("Analyze response generated for %s", result.id)
        return result
    except ClipFetchError as exc:
        logger.warning("Analyze request failed: %s", exc.message)
        raise to_http_exception(exc)
    except ValueError as exc:
        logger.warning("Analyze URL validation failed: %s", exc)
        raise to_http_exception(InvalidUrlError(str(exc)))


@router.post("/api/download", dependencies=[Depends(rate_limit_download)])
async def create_download(payload: DownloadRequest) -> dict[str, str]:
    try:
        job = downloader.create_job(
            payload.url,
            payload.format_id,
            payload.filename_preference,
            start_time=payload.start_time,
            end_time=payload.end_time,
        )
        downloader.start(job)
        return {"job_id": job.id, "status": job.status}
    except ClipFetchError as exc:
        raise to_http_exception(exc)
    except ValueError as exc:
        raise to_http_exception(InvalidUrlError(str(exc)))


@router.get("/api/download/{job_id}/status", response_model=DownloadStatus)
async def get_status(job_id: str) -> DownloadStatus:
    try:
        return downloader.get_status(job_id)
    except ClipFetchError as exc:
        raise to_http_exception(exc)


@router.get("/api/download/{job_id}/file")
async def get_file(job_id: str):
    try:
        file_path = downloader.get_file_path(job_id)
        return FileResponse(file_path, filename=file_path.name, media_type="application/octet-stream")
    except ClipFetchError as exc:
        raise to_http_exception(exc)
