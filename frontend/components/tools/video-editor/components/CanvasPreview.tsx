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
  TransitionType,
  VideoClip,
  VideoProject,
} from "../types";
import { formatTimecode } from "../state/projectDefaults";
import { computeClipTimeRanges, findPlaybackStateAtTime } from "../state/useProjectState";
import { captureVideoFrame } from "../utils/mediaUtils";

function getClipFilter(clip: VideoClip | undefined): string {
  if (!clip) return "none";
  const parts: string[] = [];
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
  if (clip.brightness !== 0) parts.push(`brightness(${1 + clip.brightness / 100})`);
  if (clip.contrast !== 0) parts.push(`contrast(${1 + clip.contrast / 100})`);
  if (clip.saturation !== 0) parts.push(`saturate(${1 + clip.saturation / 100})`);
  return parts.length > 0 ? parts.join(" ") : "none";
}

function getClipTransform(clip: VideoClip | undefined): string {
  if (!clip) return "none";
  const scale = clip.scale || 1.0;
  const rot = clip.rotation || 0;
  const flipX = clip.flipHorizontal ? -1 : 1;
  const flipY = clip.flipVertical ? -1 : 1;
  const offX = clip.offsetX || 0;
  const offY = clip.offsetY || 0;
  return `translate(${offX}%, ${offY}%) scale(${scale}) scale(${flipX}, ${flipY}) rotate(${rot}deg)`;
}

function getTransitionStyles(type: TransitionType, progress: number): {
  fromWrapperStyle: React.CSSProperties;
  toWrapperStyle: React.CSSProperties;
} {
  const p = Math.max(0, Math.min(1, progress));
  switch (type) {
    case "fade":
    case "dissolve":
    case "crossfade":
      return {
        fromWrapperStyle: { opacity: 1 - p, zIndex: 1 },
        toWrapperStyle: { opacity: p, zIndex: 2 },
      };
    case "slide_left":
      return {
        fromWrapperStyle: { transform: `translateX(-${p * 100}%)`, zIndex: 1 },
        toWrapperStyle: { transform: `translateX(${(1 - p) * 100}%)`, zIndex: 2 },
      };
    case "slide_right":
      return {
        fromWrapperStyle: { transform: `translateX(${p * 100}%)`, zIndex: 1 },
        toWrapperStyle: { transform: `translateX(-${(1 - p) * 100}%)`, zIndex: 2 },
      };
    case "wipe":
    case "wipe_left":
      return {
        fromWrapperStyle: { zIndex: 1 },
        toWrapperStyle: { clipPath: `inset(0 0 0 ${(1 - p) * 100}%)`, zIndex: 2 },
      };
    case "wipe_right":
      return {
        fromWrapperStyle: { zIndex: 1 },
        toWrapperStyle: { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`, zIndex: 2 },
      };
    case "zoom":
      return {
        fromWrapperStyle: { transform: `scale(${1 + p * 0.25})`, opacity: 1 - p, zIndex: 1 },
        toWrapperStyle: { transform: `scale(${0.8 + p * 0.2})`, opacity: p, zIndex: 2 },
      };
    case "blur":
      return {
        fromWrapperStyle: { filter: `blur(${p * 16}px)`, opacity: 1 - p * 0.3, zIndex: 1 },
        toWrapperStyle: { filter: `blur(${(1 - p) * 16}px)`, opacity: p, zIndex: 2 },
      };
    default:
      return {
        fromWrapperStyle: { opacity: 1 - p, zIndex: 1 },
        toWrapperStyle: { opacity: p, zIndex: 2 },
      };
  }
}

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
  const secondaryVideoRef = useRef<HTMLVideoElement | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [frameFormat, setFrameFormat] = useState<"jpg" | "png">("jpg");
  const [capturedFrame, setCapturedFrame] = useState<{ url: string; name: string } | null>(null);
  const [masterVolume, setMasterVolume] = useState<number>(1.0);
  const [isMasterMuted, setIsMasterMuted] = useState<boolean>(false);

  const clipRanges = useMemo(() => computeClipTimeRanges(project.clips), [project.clips]);
  const playbackState = useMemo(() => findPlaybackStateAtTime(clipRanges, currentTime), [clipRanges, currentTime]);
  const activeClipInfo = playbackState.activeClipInfo;
  const activeTransition = playbackState.activeTransition;

  const primaryClip = activeTransition ? activeTransition.fromClip : activeClipInfo?.clip;
  const secondaryClip = activeTransition ? activeTransition.toClip : null;

  const primaryAsset: MediaAsset | undefined = useMemo(() => {
    if (!primaryClip) return undefined;
    return project.assets.find((a) => a.id === primaryClip.assetId);
  }, [primaryClip?.assetId, project.assets]);

  const secondaryAsset: MediaAsset | undefined = useMemo(() => {
    if (!secondaryClip) return undefined;
    return project.assets.find((a) => a.id === secondaryClip.assetId);
  }, [secondaryClip?.assetId, project.assets]);

  const primaryLocalTime = activeTransition
    ? activeTransition.fromLocalTime
    : (activeClipInfo?.localSourceTime ?? 0);

  const secondaryLocalTime = activeTransition ? activeTransition.toLocalTime : 0;

  const transStyles = useMemo(() => {
    if (!activeTransition) return null;
    return getTransitionStyles(activeTransition.type, activeTransition.progress);
  }, [activeTransition]);

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

  const primaryLocalTimeRef = useRef<number>(primaryLocalTime);
  primaryLocalTimeRef.current = primaryLocalTime;
  const secondaryLocalTimeRef = useRef<number>(secondaryLocalTime);
  secondaryLocalTimeRef.current = secondaryLocalTime;
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const handlePrimaryLoadedData = () => {
    const video = videoRef.current;
    if (video && !isPlayingRef.current) {
      if (Math.abs(video.currentTime - primaryLocalTimeRef.current) > 0.04) {
        video.currentTime = primaryLocalTimeRef.current;
      }
    }
  };

  const handleSecondaryLoadedData = () => {
    const secVideo = secondaryVideoRef.current;
    if (secVideo && !isPlayingRef.current) {
      if (Math.abs(secVideo.currentTime - secondaryLocalTimeRef.current) > 0.04) {
        secVideo.currentTime = secondaryLocalTimeRef.current;
      }
    }
  };

  // 1. Sync Video/Audio Playback Rates, Volumes, and Transitions
  useEffect(() => {
    const video = videoRef.current;
    const secVideo = secondaryVideoRef.current;

    if (video && primaryClip && primaryAsset && primaryClip.type === "video") {
      video.playbackRate = Math.max(0.25, Math.min(4.0, primaryClip.speed || 1.0));
      const baseVol = primaryClip.isMuted ? 0 : (primaryClip.volume ?? 1.0);
      const factor = activeTransition ? (1 - activeTransition.progress) : 1;
      video.volume = isMasterMuted ? 0 : Math.min(1, baseVol * masterVolume * factor);
    }

    if (secVideo && secondaryClip && secondaryAsset && secondaryClip.type === "video") {
      secVideo.playbackRate = Math.max(0.25, Math.min(4.0, secondaryClip.speed || 1.0));
      const baseVol = secondaryClip.isMuted ? 0 : (secondaryClip.volume ?? 1.0);
      secVideo.volume = isMasterMuted ? 0 : Math.min(1, baseVol * masterVolume * (activeTransition?.progress ?? 1));
    } else if (secVideo && !secVideo.paused) {
      secVideo.pause();
    }
  }, [
    primaryClip,
    primaryAsset,
    secondaryClip,
    secondaryAsset,
    activeTransition,
    isMasterMuted,
    masterVolume,
  ]);

  // 2. Play / Pause Control
  useEffect(() => {
    const video = videoRef.current;
    const secVideo = secondaryVideoRef.current;
    const audio = bgAudioRef.current;

    if (isPlaying) {
      if (video && primaryClip?.type === "video") {
        video.play().catch(() => {});
      }
      if (activeTransition && secVideo && secondaryClip?.type === "video") {
        secVideo.play().catch(() => {});
      }
      if (audio && activeAudioTrack && activeAudioAsset) {
        audio.play().catch(() => {});
      }
    } else {
      if (video && !video.paused) video.pause();
      if (secVideo && !secVideo.paused) secVideo.pause();
      if (audio && !audio.paused) audio.pause();
    }
  }, [
    isPlaying,
    primaryClip?.type,
    secondaryClip?.type,
    activeTransition,
    activeAudioTrack,
    activeAudioAsset,
  ]);

  // 3. Seek Synchronization (ONLY when paused to eliminate playback stutter)
  useEffect(() => {
    if (isPlaying) return;

    const video = videoRef.current;
    const secVideo = secondaryVideoRef.current;

    if (video && primaryClip?.type === "video") {
      if (Math.abs(video.currentTime - primaryLocalTime) > 0.04) {
        video.currentTime = primaryLocalTime;
      }
    }

    if (activeTransition && secVideo && secondaryClip?.type === "video") {
      if (Math.abs(secVideo.currentTime - secondaryLocalTime) > 0.04) {
        secVideo.currentTime = secondaryLocalTime;
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
  }, [
    currentTime,
    isPlaying,
    primaryClip?.type,
    primaryLocalTime,
    secondaryClip?.type,
    secondaryLocalTime,
    activeTransition,
    activeAudioTrack,
    activeAudioAsset,
    isMasterMuted,
    masterVolume,
  ]);

  // Playback refs for uninterrupted, non-tearing 60fps RAF loop
  const currentTimeRef = useRef<number>(currentTime);
  currentTimeRef.current = currentTime;
  const activeClipInfoRef = useRef(activeClipInfo);
  activeClipInfoRef.current = activeClipInfo;
  const activeAssetRef = useRef(primaryAsset);
  activeAssetRef.current = primaryAsset;
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
      const delta = (now - lastWallTime) / 1000;
      lastWallTime = now;

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

  // Filter and Transform styles for Primary and Secondary layers
  const primaryFilter = useMemo(
    () => getClipFilter(primaryClip),
    [primaryClip?.filterPreset, primaryClip?.brightness, primaryClip?.contrast, primaryClip?.saturation]
  );
  const primaryTransform = useMemo(
    () => getClipTransform(primaryClip),
    [
      primaryClip?.scale,
      primaryClip?.rotation,
      primaryClip?.flipHorizontal,
      primaryClip?.flipVertical,
      primaryClip?.offsetX,
      primaryClip?.offsetY,
    ]
  );

  const secondaryFilter = useMemo(
    () => getClipFilter(secondaryClip || undefined),
    [secondaryClip?.filterPreset, secondaryClip?.brightness, secondaryClip?.contrast, secondaryClip?.saturation]
  );
  const secondaryTransform = useMemo(
    () => getClipTransform(secondaryClip || undefined),
    [
      secondaryClip?.scale,
      secondaryClip?.rotation,
      secondaryClip?.flipHorizontal,
      secondaryClip?.flipVertical,
      secondaryClip?.offsetX,
      secondaryClip?.offsetY,
    ]
  );

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
          {/* Layer 1: Outgoing or Primary Clip (Permanent DOM node) */}
          <div
            style={{
              ...(activeTransition && transStyles ? transStyles.fromWrapperStyle : { zIndex: 1, opacity: 1 }),
              display: primaryClip && primaryAsset ? "flex" : "none",
              transformOrigin: "center center",
              willChange: "transform, opacity, clip-path, filter",
            }}
            className="absolute inset-0 items-center justify-center pointer-events-none overflow-hidden"
          >
            <video
              ref={videoRef}
              src={primaryAsset?.type === "video" ? primaryAsset.objectUrl : undefined}
              preload="auto"
              playsInline
              muted={primaryClip?.isMuted || isMasterMuted}
              onLoadedData={handlePrimaryLoadedData}
              style={{
                filter: primaryFilter,
                transform: primaryTransform,
                opacity: primaryClip?.opacity ?? 1.0,
                display: primaryClip?.type === "video" ? "block" : "none",
                willChange: "transform, filter",
                transformOrigin: "center center",
              }}
              className="w-full h-full object-contain"
            />
            {primaryClip?.type === "image" && primaryAsset && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primaryAsset.objectUrl}
                alt=""
                style={{
                  filter: primaryFilter,
                  transform: primaryTransform,
                  opacity: primaryClip.opacity ?? 1.0,
                  transformOrigin: "center center",
                }}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Layer 2: Incoming or Secondary Clip during Transitions (Permanent DOM node) */}
          <div
            style={{
              ...(activeTransition && transStyles ? transStyles.toWrapperStyle : { zIndex: 2, opacity: 0 }),
              display: activeTransition && secondaryClip && secondaryAsset ? "flex" : "none",
              transformOrigin: "center center",
              willChange: "transform, opacity, clip-path, filter",
            }}
            className="absolute inset-0 items-center justify-center pointer-events-none overflow-hidden"
          >
            <video
              ref={secondaryVideoRef}
              src={secondaryAsset?.type === "video" ? secondaryAsset.objectUrl : undefined}
              preload="auto"
              playsInline
              muted={secondaryClip?.isMuted || isMasterMuted}
              onLoadedData={handleSecondaryLoadedData}
              style={{
                filter: secondaryFilter,
                transform: secondaryTransform,
                opacity: secondaryClip?.opacity ?? 1.0,
                display: secondaryClip?.type === "video" ? "block" : "none",
                willChange: "transform, filter",
                transformOrigin: "center center",
              }}
              className="w-full h-full object-contain"
            />
            {secondaryClip?.type === "image" && secondaryAsset && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={secondaryAsset.objectUrl}
                alt=""
                style={{
                  filter: secondaryFilter,
                  transform: secondaryTransform,
                  opacity: secondaryClip.opacity ?? 1.0,
                  transformOrigin: "center center",
                }}
                className="w-full h-full object-contain"
              />
            )}
          </div>

          {/* Empty Timeline Gap indicator */}
          {!primaryClip && !activeTransition && (
            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-500 pointer-events-none">
              <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center mb-1.5 bg-white/[0.03]">
                <div className="w-2 h-2 rounded-full bg-slate-600" />
              </div>
              <p className="text-xs font-mono text-slate-400">Empty Timeline Gap</p>
              <p className="text-[10px] font-mono text-slate-600 mt-0.5">{formatTimecode(currentTime)}</p>
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

