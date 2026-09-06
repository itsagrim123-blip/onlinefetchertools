"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Download,
  FastForward,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  AspectRatioPreset,
  MediaAsset,
  VideoClip,
  VideoProject,
} from "../types";
import { formatTimecode } from "../state/projectDefaults";
import { computeClipTimeRanges, findClipAtTime } from "../state/useProjectState";
import { captureVideoFrame } from "../utils/mediaUtils";

interface CanvasPreviewProps {
  project: VideoProject;
  currentTime: number;
  totalDuration: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onUpdateSettings?: (settings: Partial<import("../types").ProjectSettings>) => void;
  onOpenSettings?: () => void;
}

export function CanvasPreview({
  project,
  currentTime,
  totalDuration,
  isPlaying,
  onTimeUpdate,
  onTogglePlay,
  onSeek,
  onUpdateSettings,
  onOpenSettings,
}: CanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [frameFormat, setFrameFormat] = useState<"jpg" | "png">("jpg");
  const [capturedFrame, setCapturedFrame] = useState<{ url: string; name: string } | null>(null);
  const [masterVolume, setMasterVolume] = useState<number>(1.0);
  const [isMasterMuted, setIsMasterMuted] = useState<boolean>(false);

  const clipRanges = useMemo(() => computeClipTimeRanges(project.clips), [project.clips]);
  const activeClipInfo = useMemo(() => findClipAtTime(clipRanges, currentTime), [clipRanges, currentTime]);

  const activeAsset: MediaAsset | undefined = useMemo(() => {
    if (!activeClipInfo) return undefined;
    return project.assets.find((a) => a.id === activeClipInfo.clip.assetId);
  }, [activeClipInfo, project.assets]);

  // Determine active background audio
  const activeAudioTrack = useMemo(() => {
    return project.audioTracks.find(
      (a) => currentTime >= a.timelineStart && currentTime <= a.timelineStart + a.duration
    );
  }, [project.audioTracks, currentTime]);

  const activeAudioAsset = useMemo(() => {
    if (!activeAudioTrack) return undefined;
    return project.assets.find((a) => a.id === activeAudioTrack.assetId);
  }, [activeAudioTrack, project.assets]);

  // Sync background audio playback
  useEffect(() => {
    const audioEl = bgAudioRef.current;
    if (!audioEl) return;

    if (!activeAudioTrack || !activeAudioAsset) {
      audioEl.pause();
      return;
    }

    if (audioEl.src !== activeAudioAsset.objectUrl) {
      audioEl.src = activeAudioAsset.objectUrl;
    }

    const audioLocalTime = currentTime - activeAudioTrack.timelineStart + activeAudioTrack.startTrim;
    if (Math.abs(audioEl.currentTime - audioLocalTime) > 0.3) {
      audioEl.currentTime = Math.max(0, audioLocalTime);
    }

    const effectiveVol = isMasterMuted ? 0 : Math.min(1, (activeAudioTrack.isMuted ? 0 : activeAudioTrack.volume) * masterVolume);
    audioEl.volume = effectiveVol;

    if (isPlaying) {
      audioEl.play().catch(() => {});
    } else {
      audioEl.pause();
    }
  }, [activeAudioTrack, activeAudioAsset, currentTime, isPlaying, isMasterMuted, masterVolume]);

  // Sync video element playback & position
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClipInfo || !activeAsset || activeClipInfo.clip.type !== "video") {
      return;
    }

    if (video.src !== activeAsset.objectUrl) {
      video.src = activeAsset.objectUrl;
    }

    // Set playback speed
    video.playbackRate = Math.max(0.25, Math.min(4.0, activeClipInfo.clip.speed || 1.0));

    // Set volume
    const clipVol = activeClipInfo.clip.isMuted ? 0 : activeClipInfo.clip.volume;
    video.volume = isMasterMuted ? 0 : Math.min(1, clipVol * masterVolume);

    // Sync seek
    const desiredSourceTime = activeClipInfo.localSourceTime;
    if (Math.abs(video.currentTime - desiredSourceTime) > 0.25) {
      video.currentTime = desiredSourceTime;
    }

    if (isPlaying) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [activeClipInfo, activeAsset, isPlaying, isMasterMuted, masterVolume]);

  // Playhead update loop during playback
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let lastTimestamp = performance.now();

    const loop = (now: number) => {
      const deltaSeconds = (now - lastTimestamp) / 1000;
      lastTimestamp = now;

      const nextTime = currentTime + deltaSeconds;
      if (nextTime >= totalDuration) {
        onTimeUpdate(totalDuration);
        onTogglePlay(); // stop at end
      } else {
        onTimeUpdate(nextTime);
        animId = requestAnimationFrame(loop);
      }
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, currentTime, totalDuration, onTimeUpdate, onTogglePlay]);

  // CSS Filter string calculation
  const filterStyle = useMemo(() => {
    if (!activeClipInfo) return "none";
    const clip = activeClipInfo.clip;
    const parts: string[] = [];

    // Presets
    switch (clip.filterPreset) {
      case "warm":
        parts.push("sepia(0.3) saturate(1.2) hue-rotate(-10deg)");
        break;
      case "cool":
        parts.push("hue-rotate(20deg) saturate(1.1)");
        break;
      case "vintage":
        parts.push("sepia(0.6) contrast(1.1) brightness(0.9)");
        break;
      case "bw":
        parts.push("grayscale(1)");
        break;
      case "fade":
        parts.push("contrast(0.85) brightness(1.1)");
        break;
      case "bright":
        parts.push("brightness(1.25) contrast(1.05)");
        break;
      case "contrast":
        parts.push("contrast(1.3)");
        break;
      default:
        break;
    }

    // Adjustments
    if (clip.brightness !== 0) {
      parts.push(`brightness(${1 + clip.brightness / 100})`);
    }
    if (clip.contrast !== 0) {
      parts.push(`contrast(${1 + clip.contrast / 100})`);
    }
    if (clip.saturation !== 0) {
      parts.push(`saturate(${1 + clip.saturation / 100})`);
    }

    return parts.length > 0 ? parts.join(" ") : "none";
  }, [activeClipInfo]);

  // CSS Transform string calculation
  const transformStyle = useMemo(() => {
    if (!activeClipInfo) return "none";
    const clip = activeClipInfo.clip;
    const scale = clip.scale || 1.0;
    const rot = clip.rotation || 0;
    const flipX = clip.flipHorizontal ? -1 : 1;
    const flipY = clip.flipVertical ? -1 : 1;
    const offX = clip.offsetX || 0;
    const offY = clip.offsetY || 0;

    return `translate(${offX}%, ${offY}%) scale(${scale}) scale(${flipX}, ${flipY}) rotate(${rot}deg)`;
  }, [activeClipInfo]);

  // Aspect ratio class / styles
  const aspectRatioStyle = useMemo(() => {
    switch (project.settings.aspectRatio) {
      case "9:16":
        return { aspectRatio: "9/16", maxWidth: "270px" };
      case "1:1":
        return { aspectRatio: "1/1", maxWidth: "420px" };
      case "4:5":
        return { aspectRatio: "4/5", maxWidth: "350px" };
      case "16:9":
      default:
        return { aspectRatio: "16/9", maxWidth: "100%" };
    }
  }, [project.settings.aspectRatio]);

  // Active Text Layers
  const activeTextLayers = useMemo(() => {
    return project.textLayers.filter(
      (t) => currentTime >= t.timelineStart && currentTime <= t.timelineStart + t.duration
    );
  }, [project.textLayers, currentTime]);

  // Active Overlay Layers
  const activeOverlayLayers = useMemo(() => {
    return project.overlayLayers.filter(
      (o) => currentTime >= o.timelineStart && currentTime <= o.timelineStart + o.duration
    );
  }, [project.overlayLayers, currentTime]);

  // Frame Capture Handler
  const handleCaptureFrame = () => {
    if (!videoRef.current) return;
    const captured = captureVideoFrame(videoRef.current, frameFormat);
    if (captured) {
      const filename = `frame_${formatTimecode(currentTime).replace(":", "-")}.${frameFormat}`;
      setCapturedFrame({
        url: captured.dataUrl,
        name: filename,
      });
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center w-full rounded-2xl border border-white/10 bg-slate-950/80 p-2.5 sm:p-3 text-white shadow-xl"
    >
      {/* Hidden audio element for background track */}
      <audio ref={bgAudioRef} preload="auto" className="hidden" />

      {/* Main Aspect Ratio Canvas Viewport */}
      <div className="relative w-full flex items-center justify-center bg-black/90 rounded-xl overflow-hidden min-h-[240px] sm:min-h-[340px] max-h-[420px] border border-white/5">
        <div
          style={aspectRatioStyle}
          className="relative w-full h-full max-h-[420px] flex items-center justify-center overflow-hidden bg-black"
        >
          {/* Active Clip Video or Image */}
          {activeClipInfo && activeAsset ? (
            activeClipInfo.clip.type === "video" ? (
              <video
                ref={videoRef}
                playsInline
                muted={activeClipInfo.clip.isMuted || isMasterMuted}
                style={{
                  filter: filterStyle,
                  transform: transformStyle,
                  opacity: activeClipInfo.clip.opacity ?? 1.0,
                  transition: "filter 0.1s ease, transform 0.1s ease",
                }}
                className="w-full h-full object-contain pointer-events-none"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeAsset.objectUrl}
                alt={activeAsset.name}
                style={{
                  filter: filterStyle,
                  transform: transformStyle,
                  opacity: activeClipInfo.clip.opacity ?? 1.0,
                  transition: "filter 0.1s ease, transform 0.1s ease",
                }}
                className="w-full h-full object-contain pointer-events-none"
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500">
              <p className="text-xs">No media on timeline at {formatTimecode(currentTime)}</p>
            </div>
          )}

          {/* Active Overlays (PIP) */}
          {activeOverlayLayers.map((overlay) => {
            const asset = project.assets.find((a) => a.id === overlay.assetId);
            if (!asset) return null;
            return (
              <div
                key={overlay.id}
                style={{
                  position: "absolute",
                  left: `${overlay.positionX}%`,
                  top: `${overlay.positionY}%`,
                  transform: `translate(-50%, -50%) scale(${overlay.scale}) rotate(${overlay.rotation}deg)`,
                  opacity: overlay.opacity,
                  maxWidth: "50%",
                  maxHeight: "50%",
                }}
                className="pointer-events-none rounded-lg overflow-hidden border border-white/20 shadow-lg"
              >
                {asset.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.objectUrl} alt={overlay.name} className="w-full h-auto object-cover" />
                ) : (
                  <video src={asset.objectUrl} autoPlay loop muted playsInline className="w-full h-auto" />
                )}
              </div>
            );
          })}

          {/* Active Text Layers */}
          {activeTextLayers.map((layer) => {
            let animationClass = "";
            if (layer.animation === "fade") animationClass = "animate-in fade-in duration-300";
            if (layer.animation === "slide_bottom")
              animationClass = "animate-in slide-in-from-bottom-2 duration-300";
            if (layer.animation === "scale_up")
              animationClass = "animate-in zoom-in-90 duration-300";

            return (
              <div
                key={layer.id}
                style={{
                  position: "absolute",
                  left: `${layer.positionX}%`,
                  top: `${layer.positionY}%`,
                  transform: "translate(-50%, -50%)",
                  color: layer.fontColor,
                  backgroundColor: layer.backgroundColor || "transparent",
                  fontSize: `${layer.fontSize}px`,
                  textAlign: layer.alignment,
                  fontWeight: layer.isBold ? "bold" : "normal",
                  fontStyle: layer.isItalic ? "italic" : "normal",
                }}
                className={`pointer-events-none px-2.5 py-1 rounded-md max-w-[90%] whitespace-pre-wrap ${animationClass}`}
              >
                {layer.text}
              </div>
            );
          })}
        </div>

        {/* Center Big Play Button Overlay when paused */}
        {!isPlaying && totalDuration > 0 && (
          <button
            type="button"
            onClick={onTogglePlay}
            className="absolute inset-0 m-auto h-14 w-14 flex items-center justify-center rounded-full bg-cyan-400/90 text-slate-950 shadow-2xl hover:scale-105 transition active:scale-95"
            title="Play"
          >
            <Play className="h-6 w-6 fill-current translate-x-0.5" />
          </button>
        )}
      </div>

      {/* Scrubber Line directly beneath Video (matching reference image) */}
      <div className="mt-2.5 flex items-center gap-2.5 w-full px-1">
        <button
          type="button"
          onClick={onTogglePlay}
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg bg-white/5 hover:bg-cyan-400/20 text-slate-300 hover:text-cyan-300 transition"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current ml-0.5" />}
        </button>

        <div className="font-mono text-[11px] text-slate-300 shrink-0">
          <span className="text-cyan-300 font-bold">{formatTimecode(currentTime)}</span>
          <span className="text-slate-500 mx-1">/</span>
          <span>{formatTimecode(totalDuration)}</span>
        </div>

        {/* Scrubber Range Slider */}
        <input
          type="range"
          min={0}
          max={Math.max(0.1, totalDuration)}
          step={0.05}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
        />

        {/* Aspect Ratio Selector Dropdown */}
        {onUpdateSettings && (
          <select
            value={project.settings.aspectRatio}
            onChange={(e) => onUpdateSettings({ aspectRatio: e.target.value as AspectRatioPreset })}
            className="h-7 rounded-lg border border-white/10 bg-slate-900 px-2 text-[11px] font-semibold text-cyan-300 focus:border-cyan-400 focus:outline-none cursor-pointer shrink-0"
            title="Canvas Aspect Ratio"
          >
            <option value="9:16">9:16 Portrait</option>
            <option value="16:9">16:9 Landscape</option>
            <option value="1:1">1:1 Square</option>
            <option value="4:5">4:5 Social</option>
          </select>
        )}

        <button
          type="button"
          onClick={toggleFullscreen}
          className="h-7 w-7 shrink-0 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition"
          title="Fullscreen Preview"
        >
          {isFullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Secondary Playback Strip: Skip, Step, Master Volume, Capture Frame */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 w-full border-t border-white/5 pt-2 px-1">
        {/* Playback step buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSeek(0)}
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition text-xs"
            title="Jump to Start"
          >
            |◀
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentTime - 1.0))}
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition"
            title="Seek Back 1s"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.min(totalDuration, currentTime + 1.0))}
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition"
            title="Seek Forward 1s"
          >
            <RotateCw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(totalDuration)}
            className="h-7 w-7 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition text-xs"
            title="Jump to End"
          >
            ▶|
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Volume Mute & Slider */}
          <button
            type="button"
            onClick={() => setIsMasterMuted(!isMasterMuted)}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition"
            title={isMasterMuted ? "Unmute All" : "Mute All"}
          >
            {isMasterMuted ? <VolumeX className="h-3.5 w-3.5 text-red-400" /> : <Volume2 className="h-3.5 w-3.5 text-cyan-300" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMasterMuted ? 0 : masterVolume}
            onChange={(e) => {
              setMasterVolume(parseFloat(e.target.value));
              if (isMasterMuted) setIsMasterMuted(false);
            }}
            className="w-14 sm:w-20 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-cyan-400"
            title={`Preview Volume: ${Math.round((isMasterMuted ? 0 : masterVolume) * 100)}%`}
          />
        </div>

        {/* Right side: Capture Frame & Settings */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-slate-900 p-0.5">
            <button
              type="button"
              onClick={() => setFrameFormat("jpg")}
              className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition ${
                frameFormat === "jpg" ? "bg-cyan-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              JPG
            </button>
            <button
              type="button"
              onClick={() => setFrameFormat("png")}
              className={`px-1.5 py-0.5 text-[10px] rounded font-medium transition ${
                frameFormat === "png" ? "bg-cyan-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
            >
              PNG
            </button>
          </div>

          <button
            type="button"
            onClick={handleCaptureFrame}
            disabled={!activeClipInfo || activeClipInfo.clip.type !== "video"}
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-400/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
            title="Capture Video Frame"
          >
            <Camera className="h-3 w-3" />
            <span className="hidden sm:inline">Snapshot</span>
          </button>
        </div>
      </div>

      {/* Captured Frame Card Notification */}
      {capturedFrame && (
        <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full rounded-xl border border-cyan-400/30 bg-cyan-950/40 p-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedFrame.url}
              alt="Captured Frame"
              className="h-12 w-20 rounded-lg object-cover border border-white/10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">Frame Captured Successfully!</p>
              <p className="truncate text-[11px] text-slate-400 font-mono">{capturedFrame.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={capturedFrame.url}
              download={capturedFrame.name}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-400 px-3 text-xs font-semibold text-slate-950 hover:bg-emerald-300 transition"
            >
              <Download className="h-3.5 w-3.5" /> Download Frame
            </a>
            <button
              type="button"
              onClick={() => setCapturedFrame(null)}
              className="inline-flex h-8 px-2.5 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

