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
    if res == "1440p":
        scale_factor = 1440.0 / 1080.0
    elif res == "720p":
        scale_factor = 720.0 / 1080.0
    elif res == "480p":
        scale_factor = 480.0 / 1080.0

    target_w = int(round(base_w * scale_factor))
    target_h = int(round(base_h * scale_factor))

    # Ensure dimensions are even numbers for H.264
    target_w = target_w if target_w % 2 == 0 else target_w + 1
    target_h = target_h if target_h % 2 == 0 else target_h + 1

    return target_w, target_h


def build_voice_and_noise_filters(voice_effect: str = "none", noise_reduction: bool = False) -> list[str]:
    """Constructs audio DSP filter chain for voice changer presets and noise reduction."""
    filters: list[str] = []
    if noise_reduction:
        filters.append("afftdn=nf=-25")
    if voice_effect == "deep":
        filters.append("asetrate=44100*0.8,aresample=44100,atempo=1.25")
    elif voice_effect == "high":
        filters.append("asetrate=44100*1.25,aresample=44100,atempo=0.8")
    elif voice_effect == "robot":
        filters.append("flanger=delay=10:depth=5:regen=70:width=70:speed=0.5")
    elif voice_effect == "echo":
        filters.append("aecho=0.8:0.88:60:0.4")
    elif voice_effect == "radio":
        filters.append("highpass=f=300,lowpass=f=3000")
    return filters


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

            # Transforms: scale & pad into canvas with offset
            scale_val = clip.scale or 1.0
            v_filters.append(
                f"scale={canvas_w}*{scale_val}:{canvas_h}*{scale_val}:force_original_aspect_ratio=decrease"
            )
            off_x = clip.offset_x or 0.0
            off_y = clip.offset_y or 0.0
            pad_x = f"(ow-iw)/2+({off_x:.2f}*ow/100)"
            pad_y = f"(oh-ih)/2+({off_y:.2f}*oh/100)"
            v_filters.append(f"pad={canvas_w}:{canvas_h}:{pad_x}:{pad_y}:black")

            # Rotation & Flips
            if clip.rotation == 90:
                v_filters.append("transpose=1")
            elif clip.rotation == 180:
                v_filters.append("hflip,vflip")
            elif clip.rotation == 270:
                v_filters.append("transpose=2")
            elif clip.rotation != 0:
                v_filters.append(f"rotate={clip.rotation}*PI/180:c=black:ow='hypot(iw,ih)':oh=ow")
                v_filters.append(f"scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=decrease,pad={canvas_w}:{canvas_h}:(ow-iw)/2:(oh-ih)/2:black")

            if clip.flip_horizontal:
                v_filters.append("hflip")
            if clip.flip_vertical:
                v_filters.append("vflip")

            # Filters / Color presets
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
            elif clip.filter_preset == "cinematic":
                v_filters.append("eq=contrast=1.18:saturation=1.1,colorbalance=rs=0.04:gs=-0.02:bs=0.08")
            elif clip.filter_preset == "retro":
                v_filters.append("curves=vintage,colorbalance=rs=0.08:gs=0.04:bs=-0.08,eq=saturation=0.9")
            elif clip.filter_preset == "film":
                v_filters.append("eq=contrast=1.12:saturation=0.88,colorbalance=rs=0.05:bs=-0.05")
            elif clip.filter_preset == "soft":
                v_filters.append("boxblur=1:1,eq=brightness=0.04:contrast=0.95")

            # Custom user brightness, contrast, saturation, exposure, highlights, shadows
            b_val = (clip.brightness / 100.0) * 0.4 + (clip.exposure / 100.0) * 0.35
            c_val = 1.0 + (clip.contrast / 100.0) * 0.5
            s_val = max(0.0, 1.0 + (clip.saturation / 100.0))

            if clip.highlights != 0 or clip.shadows != 0:
                gamma_val = max(0.2, min(2.5, 1.0 - (clip.shadows / 100.0) * 0.35 + (clip.highlights / 100.0) * 0.35))
                v_filters.append(f"eq=brightness={b_val:.3f}:contrast={c_val:.3f}:saturation={s_val:.3f}:gamma={gamma_val:.3f}")
            elif clip.brightness != 0 or clip.contrast != 0 or clip.saturation != 0 or clip.exposure != 0:
                v_filters.append(f"eq=brightness={b_val:.3f}:contrast={c_val:.3f}:saturation={s_val:.3f}")

            # Temperature and Tint
            if clip.temperature != 0 or clip.tint != 0:
                t_r = (clip.temperature / 100.0) * 0.15
                t_b = -(clip.temperature / 100.0) * 0.15
                tint_g = -(clip.tint / 100.0) * 0.15
                tint_rb = (clip.tint / 100.0) * 0.08
                v_filters.append(f"colorbalance=rs={(t_r + tint_rb):.3f}:gs={tint_g:.3f}:bs={(t_b + tint_rb):.3f}")

            # Vignette
            if clip.vignette > 0:
                v_filters.append(f"vignette=PI/4*{min(2.0, clip.vignette / 50.0):.2f}")

            # Grain / Noise
            if clip.grain > 0:
                grain_str = max(1, int(clip.grain * 0.35))
                v_filters.append(f"noise=alls={grain_str}:allf=t+u")

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

        ov_filters = [f"scale=iw*{overlay.scale:.2f}:-1"]
        if overlay.rotation != 0:
            ov_filters.append(f"rotate={overlay.rotation}*PI/180:c=none:ow='hypot(iw,ih)':oh=ow")
        if overlay.opacity < 1.0 and overlay.opacity >= 0:
            ov_filters.append(f"colorchannelmixer=aa={overlay.opacity:.2f}")
        ov_filters.append("format=rgba")

        filter_chains.append(
            f"[{in_idx}:v]{','.join(ov_filters)}[{ov_scaled_tag}]"
        )
        filter_chains.append(
            f"{last_v_tag}[{ov_scaled_tag}]overlay=x='{pos_x}':y='{pos_y}':enable='{enable_expr}'{next_v_tag}"
        )
        last_v_tag = next_v_tag

    # Apply Text Layers
    for t_idx, text_item in enumerate(manifest.text_layers):
        next_v_tag = f"[v_txt_{t_idx}]"
        clean_text = escape_drawtext(text_item.text)
        st = text_item.timeline_start
        et = text_item.timeline_start + text_item.duration
        dur = max(0.1, text_item.duration)

        base_x = f"(w*{text_item.position_x / 100.0:.3f})-(text_w/2)"
        base_y = f"(h*{text_item.position_y / 100.0:.3f})-(text_h/2)"

        drawtext_parts = [
            f"text='{clean_text}'",
            f"fontsize={text_item.font_size}",
            f"fontcolor={text_item.font_color}",
        ]

        if text_item.stroke_width > 0 and text_item.stroke_color:
            drawtext_parts.append(f"borderw={text_item.stroke_width}")
            drawtext_parts.append(f"bordercolor={text_item.stroke_color}")

        if text_item.shadow_color:
            drawtext_parts.append(f"shadowcolor={text_item.shadow_color}")
            drawtext_parts.append("shadowx=2:shadowy=2")

        if text_item.animation == "slide_bottom":
            y_anim = f"if(lt(t-{st:.3f},0.4),({base_y})+(1-(t-{st:.3f})/0.4)*60,{base_y})"
            drawtext_parts.extend([f"x='{base_x}'", f"y='{y_anim}'"])
        elif text_item.animation == "slide_top":
            y_anim = f"if(lt(t-{st:.3f},0.4),({base_y})-(1-(t-{st:.3f})/0.4)*60,{base_y})"
            drawtext_parts.extend([f"x='{base_x}'", f"y='{y_anim}'"])
        elif text_item.animation == "slide_left":
            x_anim = f"if(lt(t-{st:.3f},0.4),({base_x})-(1-(t-{st:.3f})/0.4)*100,{base_x})"
            drawtext_parts.extend([f"x='{x_anim}'", f"y='{base_y}'"])
        elif text_item.animation == "slide_right":
            x_anim = f"if(lt(t-{st:.3f},0.4),({base_x})+(1-(t-{st:.3f})/0.4)*100,{base_x})"
            drawtext_parts.extend([f"x='{x_anim}'", f"y='{base_y}'"])
        else:
            drawtext_parts.extend([f"x='{base_x}'", f"y='{base_y}'"])

        if text_item.animation == "fade":
            fade_dur = min(0.4, dur / 3.0)
            drawtext_parts.append(
                f"alpha='if(lt(t-{st:.3f},{fade_dur:.2f}),(t-{st:.3f})/{fade_dur:.2f},if(gt(t,{et:.3f}-{fade_dur:.2f}),({et:.3f}-t)/{fade_dur:.2f},1))'"
            )
        elif text_item.animation == "scale_up":
            pop_dur = min(0.3, dur / 3.0)
            drawtext_parts.append(
                f"alpha='if(lt(t-{st:.3f},{pop_dur:.2f}),(t-{st:.3f})/{pop_dur:.2f},1)'"
            )

        drawtext_parts.append(f"enable='between(t,{st:.3f},{et:.3f})'")

        system_font = find_system_font()
        if system_font:
            drawtext_parts.append(f"fontfile='{system_font}'")
        if text_item.background_color:
            drawtext_parts.append("box=1:boxborderw=4")

        filter_chains.append(
            f"{last_v_tag}drawtext={':'.join(drawtext_parts)}{next_v_tag}"
        )
        last_v_tag = next_v_tag

    # Apply Background Audio Tracks (skipping muted tracks)
    valid_tracks = [t for t in manifest.audio_tracks if not t.is_muted and t.volume > 0]
    if valid_tracks:
        audio_mix_inputs = [last_a_tag]
        for a_idx, track in enumerate(valid_tracks):
            in_idx = asset_to_input_idx.get(track.asset_id, 0)
            track_tag = f"[bg_a_{a_idx}]"
            a_filters: list[str] = [
                f"atrim=start={track.start_trim:.3f}:end={track.start_trim + track.duration:.3f},asetpts=PTS-STARTPTS"
            ]

            # Voice effects and noise reduction
            vn_filters = build_voice_and_noise_filters(track.voice_effect, track.noise_reduction)
            a_filters.extend(vn_filters)

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
