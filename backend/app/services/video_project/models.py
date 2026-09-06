from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


class ProjectSettingsModel(BaseModel):
    aspect_ratio: Literal["16:9", "9:16", "1:1", "4:5", "original"] = "16:9"
    canvas_width: int = 1920
    canvas_height: int = 1080
    fps: int = 30


class ClipTransitionModel(BaseModel):
    type: Literal["none", "fade", "dissolve", "crossfade", "blur", "slide_left", "slide_right", "zoom"] = "none"
    duration: float = 0.5


class VideoClipModel(BaseModel):
    id: str
    asset_id: str
    name: str = "Clip"
    type: Literal["video", "image"] = "video"
    source_duration: float = 5.0
    start_trim: float = 0.0
    end_trim: float = 5.0
    speed: float = 1.0
    is_reversed: bool = False
    volume: float = 1.0
    is_muted: bool = False
    fade_in_duration: float = 0.0
    fade_out_duration: float = 0.0

    # Transforms
    scale: float = 1.0
    rotation: int = 0
    flip_horizontal: bool = False
    flip_vertical: bool = False
    offset_x: float = 0.0
    offset_y: float = 0.0
    opacity: float = 1.0
    crop_preset: str = "original"

    # Filters & Adjustments
    filter_preset: str = "original"
    brightness: int = 0
    contrast: int = 0
    saturation: int = 0
    exposure: float = 0.0
    temperature: float = 0.0
    tint: float = 0.0
    highlights: float = 0.0
    shadows: float = 0.0
    vignette: float = 0.0
    grain: float = 0.0
    filter_intensity: float = 100.0

    # Transition to next clip
    transition: ClipTransitionModel | None = None


class AudioTrackModel(BaseModel):
    id: str
    asset_id: str
    name: str = "Audio"
    source_duration: float = 10.0
    timeline_start: float = 0.0
    start_trim: float = 0.0
    duration: float = 10.0
    volume: float = 1.0
    is_muted: bool = False
    fade_in_duration: float = 0.0
    fade_out_duration: float = 0.0
    voice_effect: Literal["none", "deep", "high", "robot", "echo", "radio"] = "none"
    noise_reduction: bool = False


class TextLayerModel(BaseModel):
    id: str
    text: str
    timeline_start: float = 0.0
    duration: float = 3.0
    font_size: int = 28
    font_color: str = "#ffffff"
    font_family: str = "Arial"
    background_color: str | None = None
    alignment: Literal["left", "center", "right"] = "center"
    is_bold: bool = False
    is_italic: bool = False
    stroke_color: str | None = None
    stroke_width: int = 0
    shadow_color: str | None = None
    shadow_blur: int = 0
    animation: Literal["none", "fade", "slide_bottom", "slide_top", "slide_left", "slide_right", "scale_up"] = "none"
    position_x: float = 50.0
    position_y: float = 82.0


class OverlayLayerModel(BaseModel):
    id: str
    asset_id: str
    name: str = "Overlay"
    timeline_start: float = 0.0
    duration: float = 4.0
    scale: float = 0.4
    opacity: float = 1.0
    position_x: float = 75.0
    position_y: float = 25.0
    rotation: int = 0
    blend_mode: Literal["normal", "multiply", "screen", "overlay", "darken", "lighten"] = "normal"


class ExportSettingsModel(BaseModel):
    format: Literal["mp4", "webm", "mov"] = "mp4"
    resolution: Literal["original", "1440p", "1080p", "720p", "480p"] = "1080p"
    quality: Literal["high", "medium", "low"] = "high"
    fps: int = 30


class VideoProjectManifest(BaseModel):
    title: str = "Untitled Project"
    settings: ProjectSettingsModel = Field(default_factory=ProjectSettingsModel)
    clips: list[VideoClipModel] = Field(default_factory=list)
    audio_tracks: list[AudioTrackModel] = Field(default_factory=list)
    text_layers: list[TextLayerModel] = Field(default_factory=list)
    overlay_layers: list[OverlayLayerModel] = Field(default_factory=list)
    export_settings: ExportSettingsModel = Field(default_factory=ExportSettingsModel)

