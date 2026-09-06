"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Download,
  Maximize,
  Minimize,
  Move,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  AspectRatioPreset,
  MediaAsset,
  OverlayLayerItem,
  TextLayerItem,
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
  selectedOverlayId?: string | null;
  onSelectOverlay?: (id: string | null) => void;
  onUpdateOverlay?: (id: string, partial: Partial<OverlayLayerItem>) => void;
  onDeleteOverlay?: (id: string) => void;
  selectedTextId?: string | null;
  onSelectText?: (id: string | null) => void;
  onUpdateText?: (id: string, partial: Partial<TextLayerItem>) => void;
}

export const CanvasPreview = memo(function CanvasPreview({
  project,
  currentTime,
  totalDuration,
  isPlaying,
  onTimeUpdate,
  onTogglePlay,
  onSeek,
  onUpdateSettings,
  onOpenSettings,
  selectedOverlayId,
  onSelectOverlay,
  onUpdateOverlay,
  onDeleteOverlay,
  selectedTextId,
  onSelectText,
  onUpdateText,
}: CanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [frameFormat, setFrameFormat] = useState<"jpg" | "png">("jpg");
  const [capturedFrame, setCapturedFrame] = useState<{ url: string; name: string } | null>(null);
  const [masterVolume, setMasterVolume] = useState<number>(1.0);
  const [isMasterMuted, setIsMasterMuted] = useState<boolean>(false);

  const clipRanges = useMemo(() => computeClipTimeRanges(project.clips), [project.clips]);
  const activeClipInfo = useMemo(() => findClipAtTime(clipRanges, currentTime), [clipRanges, currentTime]);

  const activeAssetId = activeClipInfo?.clip.assetId;
  const activeAsset: MediaAsset | undefined = useMemo(() => {
    if (!activeAssetId) return undefined;
    return project.assets.find((a) => a.id === activeAssetId);
  }, [activeAssetId, project.assets]);

  // Determine active background audio
  const activeAudioTrack = useMemo(() => {
    return project.audioTracks.find(
      (a) => currentTime >= a.timelineStart && currentTime <= a.timelineStart + a.duration
    );
  }, [project.audioTracks, currentTime]);

  const activeAudioAssetId = activeAudioTrack?.assetId;
  const activeAudioAsset = useMemo(() => {
    if (!activeAudioAssetId) return undefined;
    return project.assets.find((a) => a.id === activeAudioAssetId);
  }, [activeAudioAssetId, project.assets]);

  const currentVideoSrcRef = useRef<string | null>(null);
  const currentClipIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // 1. Sync Video/Audio Sources and Volumes (without forced seeks during playback)
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClipInfo || !activeAsset || activeClipInfo.clip.type !== "video") {
      return;
    }

    const isDifferentSrc = currentVideoSrcRef.current !== activeAsset.objectUrl;
    const isDifferentClip = currentClipIdRef.current !== activeClipInfo.clip.id;

    if (isDifferentSrc) {
      currentVideoSrcRef.current = activeAsset.objectUrl;
      video.src = activeAsset.objectUrl;
      video.currentTime = activeClipInfo.localSourceTime;
      if (isPlayingRef.current) {
        video.play().catch(() => {});
      }
    } else if (isDifferentClip) {
      video.currentTime = activeClipInfo.localSourceTime;
    }

    currentClipIdRef.current = activeClipInfo.clip.id;
    video.playbackRate = Math.max(0.25, Math.min(4.0, activeClipInfo.clip.speed || 1.0));
    const clipVol = activeClipInfo.clip.isMuted ? 0 : activeClipInfo.clip.volume;
    video.volume = isMasterMuted ? 0 : Math.min(1, clipVol * masterVolume);
  }, [
    activeClipInfo?.clip.id,
    activeClipInfo?.localSourceTime,
    activeAsset?.objectUrl,
    activeClipInfo?.clip.speed,
    activeClipInfo?.clip.volume,
    activeClipInfo?.clip.isMuted,
    isMasterMuted,
    masterVolume,
  ]);

  // 2. Play / Pause Control
  useEffect(() => {
    const video = videoRef.current;
    const audio = bgAudioRef.current;

    if (isPlaying) {
      if (video && activeClipInfo?.clip.type === "video") {
        video.play().catch(() => {});
      }
      if (audio && activeAudioTrack && activeAudioAsset) {
        audio.play().catch(() => {});
      }
    } else {
      if (video) video.pause();
      if (audio) audio.pause();
    }
  }, [isPlaying, activeClipInfo?.clip.type, activeAudioTrack, activeAudioAsset]);

  // 3. Seek Synchronization (ONLY when paused to completely eliminate playback stutter)
  useEffect(() => {
    if (isPlaying) return;

    const video = videoRef.current;
    if (video && activeClipInfo && activeClipInfo.clip.type === "video") {
      const desiredTime = activeClipInfo.localSourceTime;
      if (Math.abs(video.currentTime - desiredTime) > 0.05) {
        video.currentTime = desiredTime;
      }
    }

    const audio = bgAudioRef.current;
    if (audio && activeAudioTrack && activeAudioAsset) {
      if (audio.src !== activeAudioAsset.objectUrl) {
        audio.src = activeAudioAsset.objectUrl;
      }
      const desiredAudioTime = currentTime - activeAudioTrack.timelineStart + activeAudioTrack.startTrim;
      if (Math.abs(audio.currentTime - desiredAudioTime) > 0.1) {
        audio.currentTime = Math.max(0, desiredAudioTime);
      }
      const effectiveVol = isMasterMuted ? 0 : Math.min(1, (activeAudioTrack.isMuted ? 0 : activeAudioTrack.volume) * masterVolume);
      audio.volume = effectiveVol;
    }
  }, [currentTime, isPlaying, activeClipInfo, activeAudioTrack, activeAudioAsset, isMasterMuted, masterVolume]);

  // Playback refs for uninterrupted, non-tearing 60fps RAF loop
  const currentTimeRef = useRef<number>(currentTime);
  currentTimeRef.current = currentTime;
  const activeClipInfoRef = useRef(activeClipInfo);
  activeClipInfoRef.current = activeClipInfo;
  const activeAssetRef = useRef(activeAsset);
  activeAssetRef.current = activeAsset;
  const totalDurationRef = useRef<number>(totalDuration);
  totalDurationRef.current = totalDuration;
  const onTimeUpdateRef = useRef(onTimeUpdate);
  onTimeUpdateRef.current = onTimeUpdate;
  const onTogglePlayRef = useRef(onTogglePlay);
  onTogglePlayRef.current = onTogglePlay;
  const onSeekRef = useRef(onSeek);
  onSeekRef.current = onSeek;

  // 4. Smooth Hardware-Accelerated Playback Loop (Video element drives time)
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let lastWallTime = performance.now();
    let lastThrottledTime = 0;

    const tick = (now: number) => {
      const video = videoRef.current;
      const curClipInfo = activeClipInfoRef.current;
      const curAsset = activeAssetRef.current;
      const maxDuration = totalDurationRef.current;

      if (curClipInfo && curAsset && curClipInfo.clip.type === "video" && video) {
        const speed = Math.max(0.25, Math.min(4.0, curClipInfo.clip.speed || 1.0));
        const clip = curClipInfo.clip;
        const currentSourceTime = video.currentTime;
        const startTime = curClipInfo.startTime;
        const endTime = curClipInfo.endTime;
        const isReversed = Boolean(clip.isReversed);

        let elapsedInClip: number;
        let isClipEnded: boolean;

        if (isReversed) {
          elapsedInClip = Math.max(0, (clip.endTrim - currentSourceTime) / speed);
          isClipEnded = currentSourceTime <= clip.startTrim + 0.04;
        } else {
          elapsedInClip = Math.max(0, (currentSourceTime - clip.startTrim) / speed);
          isClipEnded = currentSourceTime >= clip.endTrim - 0.04;
        }

        const currentProjectTime = startTime + elapsedInClip;

        // Clip boundary completion check
        if (isClipEnded || currentProjectTime >= endTime - 0.03) {
          if (endTime >= maxDuration - 0.05) {
            onTimeUpdateRef.current(maxDuration);
            onTogglePlayRef.current();
            return;
          } else {
            // Smoothly jump to next clip
            onSeekRef.current(endTime + 0.02);
            return;
          }
        }

        // Throttle React timeline state updates to ~30 FPS (~33ms)
        // prevents React from starving the main thread with 60 re-renders/sec
        if (now - lastThrottledTime >= 33) {
          lastThrottledTime = now;
          onTimeUpdateRef.current(currentProjectTime);
        }
      } else {
        // Image clip or gap: advance using delta time
        const delta = (now - lastWallTime) / 1000;
        lastWallTime = now;
        const nextTime = currentTimeRef.current + delta;

        if (nextTime >= maxDuration) {
          onTimeUpdateRef.current(maxDuration);
          onTogglePlayRef.current();
          return;
        } else {
          currentTimeRef.current = nextTime;
          if (now - lastThrottledTime >= 33) {
            lastThrottledTime = now;
            onTimeUpdateRef.current(nextTime);
          }
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  const activeClip = activeClipInfo?.clip;

  // CSS Filter string calculation - cached and only recalculated when visual filter settings change
  const filterStyle = useMemo(() => {
    if (!activeClip) return "none";
    const parts: string[] = [];

    // Presets
    switch (activeClip.filterPreset) {
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
    if (activeClip.brightness !== 0) {
      parts.push(`brightness(${1 + activeClip.brightness / 100})`);
    }
    if (activeClip.contrast !== 0) {
      parts.push(`contrast(${1 + activeClip.contrast / 100})`);
    }
    if (activeClip.saturation !== 0) {
      parts.push(`saturate(${1 + activeClip.saturation / 100})`);
    }

    return parts.length > 0 ? parts.join(" ") : "none";
  }, [
    activeClip?.filterPreset,
    activeClip?.brightness,
    activeClip?.contrast,
    activeClip?.saturation,
    activeClip?.id,
  ]);

  // CSS Transform string calculation - cached and only recalculated when transform values change
  const transformStyle = useMemo(() => {
    if (!activeClip) return "none";
    const scale = activeClip.scale || 1.0;
    const rot = activeClip.rotation || 0;
    const flipX = activeClip.flipHorizontal ? -1 : 1;
    const flipY = activeClip.flipVertical ? -1 : 1;
    const offX = activeClip.offsetX || 0;
    const offY = activeClip.offsetY || 0;

    return `translate(${offX}%, ${offY}%) scale(${scale}) scale(${flipX}, ${flipY}) rotate(${rot}deg)`;
  }, [
    activeClip?.scale,
    activeClip?.rotation,
    activeClip?.flipHorizontal,
    activeClip?.flipVertical,
    activeClip?.offsetX,
    activeClip?.offsetY,
    activeClip?.id,
  ]);

  // Aspect ratio styling (fills available flex height & width preserving ratio)
  const aspectRatioStyle = useMemo(() => {
    switch (project.settings.aspectRatio) {
      case "9:16":
        return { aspectRatio: "9/16", maxHeight: "100%", maxWidth: "100%" };
      case "1:1":
        return { aspectRatio: "1/1", maxHeight: "100%", maxWidth: "100%" };
      case "4:5":
        return { aspectRatio: "4/5", maxHeight: "100%", maxWidth: "100%" };
      case "16:9":
      default:
        return { aspectRatio: "16/9", maxHeight: "100%", maxWidth: "100%" };
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
      className="relative flex flex-col items-center w-full h-full min-h-0 justify-between text-white select-none overflow-hidden"
    >
      {/* Hidden audio element for background track */}
      <audio ref={bgAudioRef} preload="auto" className="hidden" />

      {/* Main Aspect Ratio Canvas Viewport */}
      <div
        onClick={() => {
          onSelectOverlay?.(null);
          onSelectText?.(null);
        }}
        className="relative w-full flex-1 min-h-0 flex items-center justify-center bg-black/95 rounded-xl overflow-hidden border border-white/10 shadow-inner"
      >
        <div
          ref={stageRef}
          style={aspectRatioStyle}
          className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden bg-black select-none"
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
                  willChange: "transform, filter",
                  transformOrigin: "center center",
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
                  willChange: "transform, filter",
                  transformOrigin: "center center",
                }}
                className="w-full h-full object-contain pointer-events-none"
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 pointer-events-none">
              <p className="text-xs">No media on timeline at {formatTimecode(currentTime)}</p>
            </div>
          )}

          {/* Active Overlays & Stickers (Draggable on screen) */}
          {activeOverlayLayers.map((overlay) => {
            const asset = project.assets.find((a) => a.id === overlay.assetId);
            if (!asset) return null;
            const isSelected = selectedOverlayId === overlay.id;

            const handlePointerDown = (e: React.PointerEvent) => {
              e.stopPropagation();
              e.preventDefault();
              onSelectOverlay?.(overlay.id);

              if (!stageRef.current) return;
              const stageRect = stageRef.current.getBoundingClientRect();
              const startClientX = e.clientX;
              const startClientY = e.clientY;
              const initialX = overlay.positionX;
              const initialY = overlay.positionY;

              const handlePointerMove = (moveEv: PointerEvent) => {
                const deltaX = moveEv.clientX - startClientX;
                const deltaY = moveEv.clientY - startClientY;
                const percentDeltaX = (deltaX / stageRect.width) * 100;
                const percentDeltaY = (deltaY / stageRect.height) * 100;

                const newX = Math.max(2, Math.min(98, Math.round((initialX + percentDeltaX) * 10) / 10));
                const newY = Math.max(2, Math.min(98, Math.round((initialY + percentDeltaY) * 10) / 10));

                onUpdateOverlay?.(overlay.id, { positionX: newX, positionY: newY });
              };

              const handlePointerUp = () => {
                window.removeEventListener("pointermove", handlePointerMove);
                window.removeEventListener("pointerup", handlePointerUp);
              };

              window.addEventListener("pointermove", handlePointerMove);
              window.addEventListener("pointerup", handlePointerUp);
            };

            return (
              <div
                key={overlay.id}
                onPointerDown={handlePointerDown}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectOverlay?.(overlay.id);
                }}
                style={{
                  position: "absolute",
                  left: `${overlay.positionX}%`,
                  top: `${overlay.positionY}%`,
                  transform: `translate(-50%, -50%) scale(${overlay.scale}) rotate(${overlay.rotation}deg)`,
                  opacity: overlay.opacity,
                  maxWidth: "60%",
                  maxHeight: "60%",
                  touchAction: "none",
                }}
                className={`group cursor-grab active:cursor-grabbing select-none rounded-lg pointer-events-auto transition-shadow ${
                  isSelected
                    ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-black/70 shadow-2xl z-30"
                    : "hover:ring-1 hover:ring-amber-400/60 z-20"
                }`}
                title={`Sticker: ${overlay.name} (Click & drag to reposition)`}
              >
                {/* Active selection bounding handles and live coordinates */}
                {isSelected && (
                  <>
                    <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-950 shadow pointer-events-none" />
                    <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-950 shadow pointer-events-none" />
                    <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-950 shadow pointer-events-none" />
                    <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-950 shadow pointer-events-none" />

                    {/* Position readout pill floating above sticker */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-950/90 border border-amber-400/60 text-[10px] font-mono text-amber-300 font-bold whitespace-nowrap shadow-xl pointer-events-none flex items-center gap-1">
                      <Move className="w-2.5 h-2.5" />
                      <span>X:{Math.round(overlay.positionX)}% Y:{Math.round(overlay.positionY)}%</span>
                    </div>

                    {/* Quick Delete action button */}
                    {onDeleteOverlay && (
                      <button
                        type="button"
                        onClick={(delEv) => {
                          delEv.stopPropagation();
                          onDeleteOverlay(overlay.id);
                        }}
                        className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg border border-white/20 transition hover:scale-110"
                        title="Delete Sticker"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </>
                )}

                {asset.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.objectUrl}
                    alt={overlay.name}
                    draggable={false}
                    className="w-full h-auto object-contain pointer-events-none select-none rounded-lg"
                  />
                ) : (
                  <video
                    src={asset.objectUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-auto pointer-events-none select-none rounded-lg"
                  />
                )}
              </div>
            );
          })}

          {/* Active Text Layers (Draggable on screen) */}
          {activeTextLayers.map((layer) => {
            const isSelected = selectedTextId === layer.id;

            const handlePointerDown = (e: React.PointerEvent) => {
              e.stopPropagation();
              e.preventDefault();
              onSelectText?.(layer.id);

              if (!stageRef.current) return;
              const stageRect = stageRef.current.getBoundingClientRect();
              const startClientX = e.clientX;
              const startClientY = e.clientY;
              const initialX = layer.positionX;
              const initialY = layer.positionY;

              const handlePointerMove = (moveEv: PointerEvent) => {
                const deltaX = moveEv.clientX - startClientX;
                const deltaY = moveEv.clientY - startClientY;
                const percentDeltaX = (deltaX / stageRect.width) * 100;
                const percentDeltaY = (deltaY / stageRect.height) * 100;

                const newX = Math.max(5, Math.min(95, Math.round((initialX + percentDeltaX) * 10) / 10));
                const newY = Math.max(5, Math.min(95, Math.round((initialY + percentDeltaY) * 10) / 10));

                onUpdateText?.(layer.id, { positionX: newX, positionY: newY });
              };

              const handlePointerUp = () => {
                window.removeEventListener("pointermove", handlePointerMove);
                window.removeEventListener("pointerup", handlePointerUp);
              };

              window.addEventListener("pointermove", handlePointerMove);
              window.addEventListener("pointerup", handlePointerUp);
            };

            let animationClass = "";
            if (layer.animation === "fade") animationClass = "animate-in fade-in duration-300";
            if (layer.animation === "slide_bottom")
              animationClass = "animate-in slide-in-from-bottom-2 duration-300";
            if (layer.animation === "scale_up")
              animationClass = "animate-in zoom-in-90 duration-300";

            return (
              <div
                key={layer.id}
                onPointerDown={handlePointerDown}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectText?.(layer.id);
                }}
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
                  touchAction: "none",
                }}
                className={`cursor-grab active:cursor-grabbing select-none px-2.5 py-1 rounded-md max-w-[90%] whitespace-pre-wrap pointer-events-auto transition-shadow ${animationClass} ${
                  isSelected
                    ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-black/70 shadow-2xl z-30"
                    : "hover:ring-1 hover:ring-cyan-400/60 z-20"
                }`}
                title="Text Layer (Click & drag to reposition)"
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

      {/* Scrubber Line directly beneath Video */}
      <div className="mt-1 flex items-center gap-2 w-full px-1 shrink-0 h-7 sm:h-8">
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
      <div className="mt-0.5 flex flex-wrap items-center justify-between gap-2 w-full border-t border-white/5 pt-1 px-1 shrink-0 h-7 sm:h-8 text-xs">
        {/* Playback step buttons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSeek(0)}
            className="h-6 w-6 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition text-xs"
            title="Jump to Start"
          >
            |◀
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.max(0, currentTime - 1.0))}
            className="h-6 w-6 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition"
            title="Seek Back 1s"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(Math.min(totalDuration, currentTime + 1.0))}
            className="h-6 w-6 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition"
            title="Seek Forward 1s"
          >
            <RotateCw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onSeek(totalDuration)}
            className="h-6 w-6 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition text-xs"
            title="Jump to End"
          >
            ▶|
          </button>

          <div className="h-4 w-px bg-white/10 mx-1" />

          {/* Volume Mute & Slider */}
          <button
            type="button"
            onClick={() => setIsMasterMuted(!isMasterMuted)}
            className="h-6 w-6 flex items-center justify-center rounded text-slate-300 hover:text-white hover:bg-white/5 transition"
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
            className="inline-flex h-6 sm:h-7 items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-400/20 transition disabled:opacity-30 disabled:cursor-not-allowed"
            title="Capture Video Frame"
          >
            <Camera className="h-3 w-3" />
            <span className="hidden sm:inline">Snapshot</span>
          </button>
        </div>
      </div>

      {/* Floating Captured Frame Notification Toast */}
      {capturedFrame && (
        <div className="absolute bottom-16 left-4 right-4 z-40 max-w-md mx-auto flex items-center justify-between gap-3 rounded-xl border border-cyan-400/40 bg-slate-950/95 p-2.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={capturedFrame.url}
              alt="Captured Frame"
              className="h-10 w-16 rounded-lg object-cover border border-white/10 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">Frame Captured!</p>
              <p className="truncate text-[10px] text-slate-400 font-mono">{capturedFrame.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={capturedFrame.url}
              download={capturedFrame.name}
              className="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-400 px-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-300 transition"
            >
              <Download className="h-3 w-3" /> Download
            </a>
            <button
              type="button"
              onClick={() => setCapturedFrame(null)}
              className="inline-flex h-7 px-2 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

