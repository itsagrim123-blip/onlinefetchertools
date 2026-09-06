from __future__ import annotations

import asyncio
import logging
from typing import Any
from PIL import Image, ImageColor

from app.errors import ClipFetchError

logger = logging.getLogger(__name__)


class BackgroundRemoverService:
    _instance: BackgroundRemoverService | None = None
    _session: Any = None
    _lock = asyncio.Lock()
    _is_initializing: bool = False
    _model_name: str = "u2net"

    @classmethod
    def get_instance(cls) -> BackgroundRemoverService:
        if cls._instance is None:
            cls._instance = BackgroundRemoverService()
        return cls._instance

    def initialize_sync(self, model_name: str = "u2net") -> None:
        """
        Loads and pre-warms the ONNX Runtime session once.
        Reuses cached model weights from ~/.u2net/
        """
        if self._session is not None:
            return

        try:
            from rembg import new_session

            self._model_name = model_name
            logger.info("Initializing AI Background Remover model '%s'...", model_name)
            self._session = new_session(model_name)
            logger.info("AI Background Remover model '%s' initialized successfully.", model_name)
        except Exception as exc:
            logger.error("Failed to initialize AI Background Remover model: %s", exc, exc_info=True)
            self._session = None
            raise ClipFetchError(
                "AI background removal model is currently unavailable. Please try again in a moment.",
                status_code=503,
            ) from exc

    async def initialize(self, model_name: str = "u2net") -> None:
        """Asynchronous initialization helper to avoid blocking the event loop."""
        async with self._lock:
            if self._session is not None:
                return
            await asyncio.to_thread(self.initialize_sync, model_name)

    def is_ready(self) -> bool:
        return self._session is not None

    def remove_background_sync(
        self,
        image: Image.Image,
        alpha_matting: bool = False,
        background_color: str | None = None,
    ) -> Image.Image:
        """
        Executes AI background removal using the cached ONNX session.
        Returns a PIL Image with true alpha transparency by default, or composited onto background_color.
        """
        if self._session is None:
            self.initialize_sync(self._model_name)

        try:
            from rembg import remove

            # rembg expects RGB or RGBA PIL Image
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGBA")

            result: Image.Image = remove(
                image,
                session=self._session,
                alpha_matting=alpha_matting,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
                alpha_matting_erode_size=10,
            )

            # Ensure the output has an alpha channel
            if result.mode != "RGBA":
                result = result.convert("RGBA")

            # Handle optional solid background replacement if requested
            if background_color and background_color.strip().lower() not in {"transparent", "none", ""}:
                try:
                    bg_rgb = ImageColor.getrgb(background_color.strip())
                    # Create solid canvas with requested color
                    canvas = Image.new("RGBA", result.size, (*bg_rgb[:3], 255))
                    canvas.alpha_composite(result)
                    return canvas
                except Exception as color_err:
                    logger.warning("Invalid background_color '%s', returning transparent PNG: %s", background_color, color_err)

            return result

        except ClipFetchError:
            raise
        except Exception as exc:
            logger.error("AI background removal inference failed: %s", exc, exc_info=True)
            raise ClipFetchError(
                "Unable to remove the background from this image. Please try another image.",
                status_code=500,
            ) from exc

