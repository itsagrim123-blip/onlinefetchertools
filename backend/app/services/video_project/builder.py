from __future__ import annotations

import logging
from pathlib import Path
from typing import Tuple

from .models import (
    AudioTrackModel,
    ClipTransitionModel,
    ExportSettingsModel,
    OverlayLayerModel,
    TextLayerModel,
    VideoClipModel,
    VideoProjectManifest,
)

logger = logging.getLogger(__name__)


def compute_canvas_dimensions(manifest: VideoProjectManifest) -> Tuple[int, int]:
    res = manifest.export_settings.resolution
    aspect = manifest.settings.aspect_ratio

    base_w, base_h = 1920, 1080
    if aspect == "9:16":
        base_w, base_h = 1080, 1920
    elif aspect == "1:1":
        base_w, base_h = 1080, 1080
    elif aspect == "4:5":
        base_w, base_h = 1080, 1350
    elif aspect == "16:9":
        base_w, base_h = 1920, 1080

    scale_factor = 1.0
    if res == "720p":
        scale_factor = 720.0 / 1080.0
    elif res == "480p":
        scale_factor = 480.0 / 1080.0

    target_w = int(round(base_w * scale_factor))
    target_h = int(round(base_h * scale_factor))

    # Ensure dimensions are even numbers for H.264
    target_w = target_w if target_w % 2 == 0 else target_w + 1
    target_h = target_h if target_h % 2 == 0 else target_h + 1

    return target_w, target_h


def find_system_font() -> str | None:
    """Finds a reliable system TrueType font for drawtext without depending on fontconfig."""
    import os

    win_fonts = [
        Path(os.environ.get("WINDIR", "C:\\Windows")) / "Fonts" / "arial.ttf",
        Path(os.environ.get("WINDIR", "C:\\Windows")) / "Fonts" / "segoeui.ttf",
        Path(os.environ.get("WINDIR", "C:\\Windows")) / "Fonts" / "calibri.ttf",
    ]
    for wf in win_fonts:
        if wf.exists():
            return str(wf).replace("\\", "/").replace(":", "\\:")

    linux_fonts = [
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
        Path("/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"),
        Path("/usr/share/fonts/TTF/DejaVuSans.ttf"),
    ]
    for lf in linux_fonts:
        if lf.exists():
            return str(lf)

    return None


def escape_drawtext(text: str) -> str:
    """Escape special characters for FFmpeg drawtext filter."""
    text = text.replace("\\", "\\\\")
    text = text.replace("'", "\\'")
    text = text.replace(":", "\\:")
    text = text.replace("%", "\\%")
    return text



def build_atempo_filter(speed: float) -> str:
    """FFmpeg atempo filter accepts 0.5 to 2.0. Chain if outside range."""
    if speed <= 0.05:
        return "atempo=0.5,atempo=0.5"
    tempo = speed
    filters = []
    while tempo > 2.0:
        filters.append("atempo=2.0")
        tempo /= 2.0
    while tempo < 0.5:
        filters.append("atempo=0.5")
        tempo /= 0.5
    filters.append(f"atempo={tempo:.3f}")
    return ",".join(filters)


def build_ffmpeg_command(
    manifest: VideoProjectManifest,
    assets_map: dict[str, Path],
    output_path: Path,
) -> list[str]:
    """
    Constructs a complete single-pass FFmpeg command with -filter_complex
    translating the entire video project into the final rendered output.
    """
    canvas_w, canvas_h = compute_canvas_dimensions(manifest)
    fps = manifest.export_settings.fps or 30

    # Build unique input files list
    input_paths: list[Path] = []
    asset_to_input_idx: dict[str, int] = {}

    for asset_id, path in assets_map.items():
        if asset_id not in asset_to_input_idx:
            asset_to_input_idx[asset_id] = len(input_paths)
            input_paths.append(path)

    # Begin FFmpeg args
    cmd: list[str] = ["ffmpeg", "-y"]

    for path in input_paths:
        cmd.extend(["-i", str(path)])

    filter_chains: list[str] = []

    # If no clips, create a 3-second black video with silent audio
    if not manifest.clips:
        filter_chains.append(
            f"color=c=black:s={canvas_w}x{canvas_h}:d=3:r={fps}[v_main];"
            f"anullsrc=channel_layout=stereo:sample_rate=44100:d=3[a_main]"
        )
    else:
        # Process each clip
        clip_v_tags: list[str] = []
        clip_a_tags: list[str] = []

        for idx, clip in enumerate(manifest.clips):
            in_idx = asset_to_input_idx.get(clip.asset_id, 0)
            v_tag = f"v{idx}"
            a_tag = f"a{idx}"

            # Video chain
            v_filters: list[str] = []
            if clip.type == "image":
                # For still image, loop and set duration
                clip_dur = max(0.1, clip.end_trim - clip.start_trim)
                v_filters.append(f"loop=loop=-1:size=1:start=0,trim=duration={clip_dur:.3f}")
            else:
                v_filters.append(f"trim=start={clip.start_trim:.3f}:end={clip.end_trim:.3f},setpts=PTS-STARTPTS")

            # Speed adjustment
            if clip.speed != 1.0 and clip.speed > 0:
                v_filters.append(f"setpts={1.0 / clip.speed:.4f}*PTS")

            # Reverse
            if clip.is_reversed:
                v_filters.append("reverse")

            # Transforms: scale & pad into canvas
            scale_val = clip.scale or 1.0
            v_filters.append(
                f"scale={canvas_w}*{scale_val}:{canvas_h}*{scale_val}:force_original_aspect_ratio=decrease"
            )
            v_filters.append(f"pad={canvas_w}:{canvas_h}:(ow-iw)/2:(oh-ih)/2:black")

            # Rotation & Flips
            if clip.rotation == 90:
                v_filters.append("transpose=1")
            elif clip.rotation == 180:
                v_filters.append("hflip,vflip")
            elif clip.rotation == 270:
                v_filters.append("transpose=2")

            if clip.flip_horizontal:
                v_filters.append("hflip")
            if clip.flip_vertical:
                v_filters.append("vflip")

            # Filters / Color adjustments
            if clip.filter_preset == "warm":
                v_filters.append("eq=saturation=1.2,colorbalance=rs=0.08:gs=-0.03:bs=-0.08")
            elif clip.filter_preset == "cool":
                v_filters.append("eq=saturation=1.1,colorbalance=rs=-0.08:gs=0.0:bs=0.12")
            elif clip.filter_preset == "vintage":
                v_filters.append("curves=vintage")
            elif clip.filter_preset == "bw":
                v_filters.append("hue=s=0")
            elif clip.filter_preset == "fade":
                v_filters.append("eq=contrast=0.85:brightness=0.04")
            elif clip.filter_preset == "bright":
                v_filters.append("eq=brightness=0.12:contrast=1.05")
            elif clip.filter_preset == "contrast":
                v_filters.append("eq=contrast=1.3")

            # Custom user brightness, contrast, saturation
            if clip.brightness != 0 or clip.contrast != 0 or clip.saturation != 0:
                b_val = (clip.brightness / 100.0) * 0.4
                c_val = 1.0 + (clip.contrast / 100.0) * 0.5
                s_val = max(0.0, 1.0 + (clip.saturation / 100.0))
                v_filters.append(f"eq=brightness={b_val:.3f}:contrast={c_val:.3f}:saturation={s_val:.3f}")

            if clip.opacity < 1.0 and clip.opacity >= 0:
                v_filters.append(f"format=rgba,colorchannelmixer=aa={clip.opacity:.2f}")


            # Ensure fixed framerate and format
            v_filters.append(f"fps={fps},format=yuv420p")

            filter_chains.append(f"[{in_idx}:v]{','.join(v_filters)}[{v_tag}]")
            clip_v_tags.append(f"[{v_tag}]")

            # Audio chain
            effective_dur = max(0.1, (clip.end_trim - clip.start_trim) / max(0.1, clip.speed))
            a_filters: list[str] = []

            if clip.type == "video" and not clip.is_muted and clip.volume > 0:
                a_filters.append(
                    f"atrim=start={clip.start_trim:.3f}:end={clip.end_trim:.3f},asetpts=PTS-STARTPTS"
                )
                if clip.speed != 1.0:
                    a_filters.append(build_atempo_filter(clip.speed))
                if clip.is_reversed:
                    a_filters.append("areverse")
                if clip.volume != 1.0:
                    a_filters.append(f"volume={clip.volume:.3f}")
                if clip.fade_in_duration > 0:
                    a_filters.append(f"afade=t=in:ss=0:d={clip.fade_in_duration:.3f}")
                if clip.fade_out_duration > 0:
                    out_start = max(0.0, effective_dur - clip.fade_out_duration)
                    a_filters.append(f"afade=t=out:st={out_start:.3f}:d={clip.fade_out_duration:.3f}")
                filter_chains.append(f"[{in_idx}:a]{','.join(a_filters)}[{a_tag}]")
            else:
                # Silent audio placeholder to ensure symmetric concat
                filter_chains.append(
                    f"anullsrc=channel_layout=stereo:sample_rate=44100:d={effective_dur:.3f}[{a_tag}]"
                )

            clip_a_tags.append(f"[{a_tag}]")

        # Concat all clips into main track
        concat_inputs = "".join(f"{v}{a}" for v, a in zip(clip_v_tags, clip_a_tags))
        num_clips = len(manifest.clips)
        filter_chains.append(
            f"{concat_inputs}concat=n={num_clips}:v=1:a=1[v_concat][a_concat]"
        )

    last_v_tag = "[v_concat]" if manifest.clips else "[v_main]"
    last_a_tag = "[a_concat]" if manifest.clips else "[a_main]"

    # Apply Overlays (PIP)
    for o_idx, overlay in enumerate(manifest.overlay_layers):
        in_idx = asset_to_input_idx.get(overlay.asset_id, 0)
        ov_scaled_tag = f"ov_scaled_{o_idx}"
        next_v_tag = f"[v_ov_{o_idx}]"

        pos_x = f"(W*{overlay.position_x / 100.0:.3f})-(w/2)"
        pos_y = f"(H*{overlay.position_y / 100.0:.3f})-(h/2)"
        enable_expr = (
            f"between(t,{overlay.timeline_start:.3f},{overlay.timeline_start + overlay.duration:.3f})"
        )

        filter_chains.append(
            f"[{in_idx}:v]scale=iw*{overlay.scale:.2f}:-1,format=rgba[{ov_scaled_tag}]"
        )
        filter_chains.append(
            f"{last_v_tag}[{ov_scaled_tag}]overlay=x='{pos_x}':y='{pos_y}':enable='{enable_expr}'{next_v_tag}"
        )
        last_v_tag = next_v_tag

    # Apply Text Layers
    for t_idx, text_item in enumerate(manifest.text_layers):
        next_v_tag = f"[v_txt_{t_idx}]"
        clean_text = escape_drawtext(text_item.text)
        enable_expr = (
            f"between(t,{text_item.timeline_start:.3f},{text_item.timeline_start + text_item.duration:.3f})"
        )
        x_expr = f"(w*{text_item.position_x / 100.0:.3f})-(text_w/2)"
        y_expr = f"(h*{text_item.position_y / 100.0:.3f})-(text_h/2)"

        drawtext_parts = [
            f"text='{clean_text}'",
            f"fontsize={text_item.font_size}",
            f"fontcolor={text_item.font_color}",
            f"x='{x_expr}'",
            f"y='{y_expr}'",
            f"enable='{enable_expr}'",
        ]
        system_font = find_system_font()
        if system_font:
            drawtext_parts.append(f"fontfile='{system_font}'")
        if text_item.background_color:
            drawtext_parts.append("box=1:boxborderw=4")

        filter_chains.append(
            f"{last_v_tag}drawtext={':'.join(drawtext_parts)}{next_v_tag}"
        )
        last_v_tag = next_v_tag

    # Apply Background Audio Tracks
    if manifest.audio_tracks:
        audio_mix_inputs = [last_a_tag]
        for a_idx, track in enumerate(manifest.audio_tracks):
            in_idx = asset_to_input_idx.get(track.asset_id, 0)
            track_tag = f"[bg_a_{a_idx}]"
            a_filters: list[str] = [
                f"atrim=start={track.start_trim:.3f}:end={track.start_trim + track.duration:.3f},asetpts=PTS-STARTPTS"
            ]
            if track.volume != 1.0:
                a_filters.append(f"volume={track.volume:.3f}")
            if track.fade_in_duration > 0:
                a_filters.append(f"afade=t=in:ss=0:d={track.fade_in_duration:.3f}")
            if track.fade_out_duration > 0:
                out_start = max(0.0, track.duration - track.fade_out_duration)
                a_filters.append(f"afade=t=out:st={out_start:.3f}:d={track.fade_out_duration:.3f}")

            delay_ms = int(max(0, track.timeline_start) * 1000)
            if delay_ms > 0:
                a_filters.append(f"adelay={delay_ms}|{delay_ms}")

            filter_chains.append(f"[{in_idx}:a]{','.join(a_filters)}{track_tag}")
            audio_mix_inputs.append(track_tag)

        next_a_tag = "[a_final]"
        filter_chains.append(
            f"{''.join(audio_mix_inputs)}amix=inputs={len(audio_mix_inputs)}:duration=first:dropout_transition=2{next_a_tag}"
        )
        last_a_tag = next_a_tag

    # Combine filter chains into single filter_complex string
    complex_filter_str = ";".join(filter_chains)
    cmd.extend(["-filter_complex", complex_filter_str])

    # Map output streams
    cmd.extend(["-map", last_v_tag, "-map", last_a_tag])

    # Quality and Encoding Settings
    qual = manifest.export_settings.quality
    crf = "18" if qual == "high" else "23" if qual == "medium" else "28"
    preset = "medium" if qual == "high" else "fast" if qual == "medium" else "veryfast"

    out_fmt = manifest.export_settings.format.lower()
    if out_fmt == "webm":
        cmd.extend(["-c:v", "libvpx-vp9", "-crf", crf, "-b:v", "0", "-c:a", "libopus"])
    else:  # mp4 and mov default
        cmd.extend([
            "-c:v", "libx264",
            "-preset", preset,
            "-crf", crf,
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-movflags", "+faststart",
        ])

    cmd.append(str(output_path))
    return cmd
