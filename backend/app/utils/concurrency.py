from __future__ import annotations

import asyncio

# Limit simultaneous heavy CPU / subprocess tasks to avoid server starvation
MEDIA_SEMAPHORE = asyncio.Semaphore(3)
ARCHIVE_SEMAPHORE = asyncio.Semaphore(4)
PDF_SEMAPHORE = asyncio.Semaphore(5)