"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  Film,
  Layers,
  Lock,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  Type,
  Unlock,
  Volume2,
} from "lucide-react";
import {
  AudioTrackItem,
  OverlayLayerItem,
  TextLayerItem,
  TrackControls,
  VideoClip,
  VideoProject,
} from "../types";
import { formatTimecode, getEffectiveClipDuration } from "../state/projectDefaults";
import { TimelineClipItem } from "./TimelineClipItem";
import { computeClipTimeRanges } from "../state/useProjectState";

interface TimelineProps {
  project: VideoProject;
  currentTime: number;
  totalDuration: number;
  selectedClipId: string | null;
  selectedAudioId: string | null;
  selectedTextId: string | null;
  selectedOverlayId: string | null;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onSeek: (time: number) => void;
  onSelectClip: (id: string | null) => void;
  onSelectAudio: (id: string | null) => void;
  onSelectText: (id: string | null) => void;
  onSelectOverlay: (id: string | null) => void;
  onSplit: (time: number) => void;
  onTrimClip: (clipId: string, startTrim: number, endTrim: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomChange: (zoom: number) => void;
  onOpenTransitionModal?: (clipId: string) => void;
  onToggleTrackVisibility?: (track: "video" | "audio" | "text" | "overlay") => void;
  onToggleTrackLock?: (track: "video" | "audio" | "text" | "overlay") => void;
  onAddMediaClick?: () => void;
  hideTopToolbar?: boolean;
}

interface TimelineAudioTrackItemProps {
  audio: AudioTrackItem;
  zoom: number;
  isSelected: boolean;
  isAudioLocked: boolean;
  onSelect: () => void;
}

const TimelineAudioTrackItem = memo(function TimelineAudioTrackItem({
  audio,
  zoom,
  isSelected,
  isAudioLocked,
  onSelect,
}: TimelineAudioTrackItemProps) {
  const leftPx = audio.timelineStart * zoom;
  const widthPx = Math.max(40, audio.duration * zoom);
  const barCount = Math.max(6, Math.floor(widthPx / 5));

  // Memoize waveform bars so array and JSX are only computed when width changes
  const waveformBars = useMemo(() => {
    return Array.from({ length: barCount }, (_, bIdx) => {
      const h = 20 + ((bIdx * 17) % 65);
      return (
        <div
          key={bIdx}
          style={{ height: `${h}%` }}
          className="w-0.5 bg-purple-300 rounded-full"
        />
      );
    });
  }, [barCount]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (!isAudioLocked) onSelect();
      }}
      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
      className={`absolute h-8 cursor-pointer rounded-lg border px-2 text-[11px] font-medium truncate flex items-center justify-between transition overflow-hidden ${
        isSelected
          ? "border-purple-400 bg-purple-500/30 text-white ring-1 ring-purple-400"
          : "border-purple-400/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
      } ${isAudioLocked ? "cursor-not-allowed opacity-60" : ""}`}
      title={audio.name}
    >
      {/* Simulated Waveform background */}
      <div className="absolute inset-0 flex items-center justify-around px-1 opacity-20 pointer-events-none">
        {waveformBars}
      </div>

      <div className="relative z-10 flex items-center min-w-0 truncate">
        <Volume2 className="h-3 w-3 mr-1 shrink-0 text-purple-300" />
        <span className="truncate">{audio.name}</span>
      </div>
      <span className="relative z-10 text-[10px] font-mono text-purple-300 ml-1 shrink-0">
        {Math.round(audio.volume * 100)}%
      </span>
    </div>
  );
});

export const Timeline = memo(function Timeline({
  project,
  currentTime,
  totalDuration,
  selectedClipId,
  selectedAudioId,
  selectedTextId,
  selectedOverlayId,
  zoom,
  canUndo,
  canRedo,
  onSeek,
  onSelectClip,
  onSelectAudio,
  onSelectText,
  onSelectOverlay,
  onSplit,
  onTrimClip,
  onDuplicate,
  onDelete,
  onUndo,
  onRedo,
  onZoomChange,
  onOpenTransitionModal,
  onToggleTrackVisibility,
  onToggleTrackLock,
  onAddMediaClick,
  hideTopToolbar = false,
}: TimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  const trackControls: TrackControls = project.trackControls || {
    video: { visible: true, locked: false },
    audio: { visible: true, locked: false },
    text: { visible: true, locked: false },
    overlay: { visible: true, locked: false },
  };

  const isVideoVisible = trackControls.video?.visible ?? true;
  const isVideoLocked = trackControls.video?.locked ?? false;
  const isAudioVisible = trackControls.audio?.visible ?? true;
  const isAudioLocked = trackControls.audio?.locked ?? false;
  const isTextVisible = trackControls.text?.visible ?? true;
  const isTextLocked = trackControls.text?.locked ?? false;
  const isOverlayVisible = trackControls.overlay?.visible ?? true;
  const isOverlayLocked = trackControls.overlay?.locked ?? false;

  // Compute width needed for tracks
  const timelineContentWidth = useMemo(() => {
    return Math.max(800, (totalDuration + 5) * zoom);
  }, [totalDuration, zoom]);

  // Compute ruler marks
  const rulerTicks = useMemo(() => {
    const step = zoom >= 60 ? 1 : zoom >= 30 ? 2 : zoom >= 15 ? 5 : 10;
    const count = Math.ceil((totalDuration + 5) / step);
    return Array.from({ length: count }, (_, i) => i * step);
  }, [totalDuration, zoom]);

  // Handle playhead scrubbing across the timeline
  const handleStartScrub = (clientX: number) => {
    if (!scrollContainerRef.current) return;
    setIsScrubbing(true);

    const rect = scrollContainerRef.current.getBoundingClientRect();
    const scrollLeft = scrollContainerRef.current.scrollLeft;
    const offsetX = clientX - rect.left + scrollLeft;
    const time = Math.max(0, Math.min(totalDuration, offsetX / zoom));
    onSeek(time);
  };

  useEffect(() => {
    if (!isScrubbing) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      if (!scrollContainerRef.current) return;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const rect = scrollContainerRef.current.getBoundingClientRect();
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const offsetX = clientX - rect.left + scrollLeft;
      const time = Math.max(0, Math.min(totalDuration, offsetX / zoom));
      onSeek(time);
    };

    const handlePointerUp = () => {
      setIsScrubbing(false);
    };

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove);
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isScrubbing, totalDuration, zoom, onSeek]);

  // Fit to screen helper
  const handleFitToScreen = () => {
    if (!scrollContainerRef.current || totalDuration <= 0) return;
    const containerWidth = scrollContainerRef.current.clientWidth - 40;
    const calculatedZoom = Math.max(10, Math.min(150, containerWidth / (totalDuration + 1)));
    onZoomChange(Math.round(calculatedZoom));
  };

  // Memoize clip ranges from project.clips so computeClipTimeRanges isn't rerun on every frame
  const clipRanges = useMemo(() => computeClipTimeRanges(project.clips), [project.clips]);

  // Check if split is active at current playhead
  const canSplit = useMemo(() => {
    if (clipRanges.length === 0) return false;
    return clipRanges.some(
      (r) => currentTime > r.startTime + 0.15 && currentTime < r.endTime - 0.15
    );
  }, [clipRanges, currentTime]);

  const hasSelection = Boolean(
    selectedClipId || selectedAudioId || selectedTextId || selectedOverlayId
  );

  return (
    <div
      className={
        hideTopToolbar
          ? "flex flex-col w-full h-full bg-slate-950 text-white select-none overflow-hidden"
          : "flex flex-col w-full rounded-2xl border border-white/10 bg-slate-950/80 p-2.5 sm:p-3 text-white shadow-xl select-none"
      }
    >
      {/* Top Toolbar (optional if parent renders EditorToolbar) */}
      {!hideTopToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2 border-b border-white/10">
          {/* Left: Operations (Split, Duplicate, Delete, Undo, Redo) */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => onSplit(currentTime)}
              disabled={!canSplit}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-slate-200 transition hover:bg-cyan-400/20 hover:text-cyan-300 hover:border-cyan-400/30 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Split Clip at Playhead"
            >
              <Scissors className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Split</span>
            </button>

            <button
              type="button"
              onClick={onDuplicate}
              disabled={!selectedClipId}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Duplicate Selected Clip"
            >
              <Copy className="h-3.5 w-3.5 text-slate-300" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>

            <button
              type="button"
              onClick={onDelete}
              disabled={!hasSelection}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-red-400/20 bg-red-400/10 px-2.5 text-xs font-semibold text-red-300 transition hover:bg-red-400/20 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Delete Selected Item"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            <div className="h-5 w-px bg-white/10 mx-1 hidden sm:block" />

            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Undo (Ctrl+Z)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
              title="Redo (Ctrl+Y)"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Right: Timecode & Zoom Controls */}
          <div className="flex items-center gap-2">
            <div className="font-mono text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded-lg border border-white/10">
              <span className="text-cyan-300 font-bold">{formatTimecode(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{formatTimecode(totalDuration)}</span>
            </div>

            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => onZoomChange(Math.max(15, zoom - 15))}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                title="Zoom Out"
              >
                <Minus className="h-3 w-3" />
              </button>
              <span className="text-[10px] font-mono text-slate-400 w-7 text-center">{zoom}px</span>
              <button
                type="button"
                onClick={() => onZoomChange(Math.min(150, zoom + 15))}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                title="Zoom In"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={handleFitToScreen}
                className="h-6 px-1.5 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition text-[10px]"
                title="Fit to Screen"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Track Workspace: Fixed Left Header Column + Right Scrollable Tracks */}
      <div
        className={
          hideTopToolbar
            ? "flex w-full h-full overflow-hidden bg-slate-950"
            : "flex w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/60"
        }
      >
        {/* Left Track Headers (Sticky / Fixed Column) */}
        <div className="w-24 sm:w-32 shrink-0 border-r border-white/10 bg-slate-900/80 flex flex-col select-none">
          {/* Ruler Corner */}
          <div className="h-7 border-b border-white/10 px-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Tracks</span>
          </div>

          {/* Text Track Header */}
          <div className="h-10 border-b border-white/5 px-2 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-1.5 min-w-0">
              <Type className="h-3 w-3 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-medium truncate">Text</span>
            </div>
            {onToggleTrackVisibility && onToggleTrackLock && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleTrackVisibility("text")}
                  className={`p-1 rounded hover:bg-white/10 transition ${
                    isTextVisible ? "text-slate-400 hover:text-white" : "text-amber-400"
                  }`}
                  title={isTextVisible ? "Hide Text Track" : "Show Text Track"}
                >
                  {isTextVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTrackLock("text")}
                  className={`p-1 rounded hover:bg-white/10 transition ${
                    isTextLocked ? "text-red-400" : "text-slate-400 hover:text-white"
                  }`}
                  title={isTextLocked ? "Unlock Text Track" : "Lock Text Track"}
                >
                  {isTextLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
              </div>
            )}
          </div>

          {/* Overlay Track Header */}
          <div className="h-10 border-b border-white/5 px-2 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-1.5 min-w-0">
              <Layers className="h-3 w-3 text-amber-400 shrink-0" />
              <span className="text-[11px] font-medium truncate">Overlay</span>
            </div>
            {onToggleTrackVisibility && onToggleTrackLock && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleTrackVisibility("overlay")}
                  className={`p-1 rounded hover:bg-white/10 transition ${
                    isOverlayVisible ? "text-slate-400 hover:text-white" : "text-amber-400"
                  }`}
                  title={isOverlayVisible ? "Hide Overlay Track" : "Show Overlay Track"}
                >
                  {isOverlayVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTrackLock("overlay")}
                  className={`p-1 rounded hover:bg-white/10 transition ${
                    isOverlayLocked ? "text-red-400" : "text-slate-400 hover:text-white"
                  }`}
                  title={isOverlayLocked ? "Unlock Overlay Track" : "Lock Overlay Track"}
                >
                  {isOverlayLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
              </div>
            )}
          </div>

          {/* Main Video Track Header */}
          <div className="min-h-[72px] border-b border-white/5 px-2 flex items-center justify-between text-xs text-slate-300 bg-slate-900/60">
            <div className="flex items-center gap-1.5 min-w-0">
              <Film className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-200 truncate">Video</span>
            </div>
            {onToggleTrackVisibility && onToggleTrackLock && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleTrackVisibility("video")}
                  className={`p-1 rounded hover:bg-white/10 transition ${
                    isVideoVisible ? "text-slate-400 hover:text-white" : "text-amber-400"
                  }`}
                  title={isVideoVisible ? "Hide Video Track" : "Show Video Track"}
                >
                  {isVideoVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTrackLock("video")}
                  className={`p-1 rounded hover:bg-white/10 transition ${
                    isVideoLocked ? "text-red-400" : "text-slate-400 hover:text-white"
                  }`}
                  title={isVideoLocked ? "Unlock Video Track" : "Lock Video Track"}
                >
                  {isVideoLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
              </div>
            )}
          </div>

          {/* Audio Track Header */}
          <div className="h-11 px-2 flex items-center justify-between text-xs text-slate-300 bg-purple-950/20">
            <div className="flex items-center gap-1.5 min-w-0">
              <Volume2 className="h-3 w-3 text-purple-400 shrink-0" />
              <span className="text-[11px] font-medium truncate">Audio</span>
            </div>
            {onToggleTrackVisibility && onToggleTrackLock && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleTrackVisibility("audio")}
                  className={`p-1 rounded hover:bg-white/10 transition ${
                    isAudioVisible ? "text-slate-400 hover:text-white" : "text-amber-400"
                  }`}
                  title={isAudioVisible ? "Mute / Hide Audio" : "Unmute Audio Track"}
                >
                  {isAudioVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTrackLock("audio")}
                  className={`p-1 rounded hover:bg-white/10 transition ${
                    isAudioLocked ? "text-red-400" : "text-slate-400 hover:text-white"
                  }`}
                  title={isAudioLocked ? "Unlock Audio Track" : "Lock Audio Track"}
                >
                  {isAudioLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Horizontal Scrollable Tracks Area */}
        <div
          ref={scrollContainerRef}
          style={{ touchAction: "pan-x" }}
          className="relative flex-1 overflow-x-auto overflow-y-hidden pb-1 select-none sleek-scrollbar"
        >
          <div
            style={{ width: `${timelineContentWidth}px` }}
            className="relative flex flex-col min-h-[220px]"
          >
            {/* Time Ruler */}
            <div
              onMouseDown={(e) => handleStartScrub(e.clientX)}
              onTouchStart={(e) => handleStartScrub(e.touches[0].clientX)}
              className="relative h-7 w-full cursor-pointer border-b border-white/10 bg-slate-900/50"
            >
              {rulerTicks.map((sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * zoom}px` }}
                  className="absolute top-0 bottom-0 flex flex-col items-center pointer-events-none"
                >
                  <span className="text-[10px] font-mono text-slate-400 pl-1 leading-none pt-1">
                    {formatTimecode(sec)}
                  </span>
                  <div className="mt-auto h-2 w-px bg-white/20" />
                </div>
              ))}
            </div>

            {/* Draggable Playhead Needle */}
            <div
              style={{
                transform: `translate3d(${currentTime * zoom}px, 0, 0)`,
                willChange: "transform",
              }}
              className="absolute top-0 bottom-0 left-0 -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center"
            >
              {/* Playhead Head */}
              <div className="h-4 w-3 -translate-y-0.5 bg-cyan-400 rounded-b shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              {/* Vertical Line */}
              <div className="w-0.5 flex-1 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
            </div>

            {/* Track 1: Text Layers Track */}
            <div
              className={`relative flex h-10 w-full items-center border-b border-white/5 px-1 py-1 ${
                !isTextVisible ? "opacity-30 pointer-events-none" : ""
              }`}
            >
              {project.textLayers.map((textItem) => {
                const leftPx = textItem.timelineStart * zoom;
                const widthPx = Math.max(40, textItem.duration * zoom);
                const isSelected = selectedTextId === textItem.id;
                return (
                  <div
                    key={textItem.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isTextLocked) onSelectText(textItem.id);
                    }}
                    style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                    className={`absolute h-7 cursor-pointer rounded-lg border px-2 text-[11px] font-medium truncate flex items-center transition ${
                      isSelected
                        ? "border-cyan-400 bg-cyan-500/30 text-white ring-1 ring-cyan-400"
                        : "border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                    } ${isTextLocked ? "cursor-not-allowed opacity-60" : ""}`}
                    title={textItem.text}
                  >
                    <Type className="h-3 w-3 mr-1 shrink-0 text-cyan-300" />
                    <span className="truncate">{textItem.text}</span>
                  </div>
                );
              })}
            </div>

            {/* Track 2: Overlays (PIP) Track */}
            <div
              className={`relative flex h-10 w-full items-center border-b border-white/5 px-1 py-1 ${
                !isOverlayVisible ? "opacity-30 pointer-events-none" : ""
              }`}
            >
              {project.overlayLayers.map((overlay) => {
                const leftPx = overlay.timelineStart * zoom;
                const widthPx = Math.max(40, overlay.duration * zoom);
                const isSelected = selectedOverlayId === overlay.id;
                return (
                  <div
                    key={overlay.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isOverlayLocked) onSelectOverlay(overlay.id);
                    }}
                    style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                    className={`absolute h-7 cursor-pointer rounded-lg border px-2 text-[11px] font-medium truncate flex items-center transition ${
                      isSelected
                        ? "border-amber-400 bg-amber-500/30 text-white ring-1 ring-amber-400"
                        : "border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                    } ${isOverlayLocked ? "cursor-not-allowed opacity-60" : ""}`}
                    title={overlay.name}
                  >
                    <Layers className="h-3 w-3 mr-1 shrink-0 text-amber-300" />
                    <span className="truncate">{overlay.name}</span>
                  </div>
                );
              })}
            </div>

            {/* Track 3: Main Video Track */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                onSeek(Math.max(0, clickX / zoom));
              }}
              className={`relative flex min-h-[72px] w-full items-center border-b border-white/5 px-1 py-2 bg-slate-900/30 ${
                !isVideoVisible ? "opacity-30" : ""
              }`}
            >
              {project.clips.length === 0 ? (
                <div className="flex h-14 w-full items-center justify-center text-xs text-slate-500">
                  Main track empty. Add video or image clips from Project Media.
                </div>
              ) : (
                <div className="flex items-center">
                  {project.clips.map((clip, idx) => (
                    <TimelineClipItem
                      key={clip.id}
                      clip={clip}
                      index={idx}
                      zoom={zoom}
                      isSelected={selectedClipId === clip.id}
                      onSelect={() => {
                        if (!isVideoLocked) onSelectClip(clip.id);
                      }}
                      onTrim={(start, end) => {
                        if (!isVideoLocked) onTrimClip(clip.id, start, end);
                      }}
                      onOpenTransitionModal={
                        onOpenTransitionModal ? () => onOpenTransitionModal(clip.id) : undefined
                      }
                      isLastClip={idx === project.clips.length - 1}
                    />
                  ))}

                  {/* + Add clip button at end of video track */}
                  {onAddMediaClick && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddMediaClick();
                      }}
                      className="ml-2 h-14 w-12 rounded-xl border border-dashed border-white/20 hover:border-cyan-400 bg-white/5 hover:bg-cyan-400/10 flex flex-col items-center justify-center text-slate-400 hover:text-cyan-300 transition shrink-0"
                      title="Add Media / Clip to Track"
                    >
                      <Plus className="h-4 w-4 mb-0.5" />
                      <span className="text-[9px] font-semibold">Add</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Track 4: Audio / Music Track */}
            <div
              className={`relative flex h-11 w-full items-center px-1 py-1 bg-purple-950/10 ${
                !isAudioVisible ? "opacity-30" : ""
              }`}
            >
              {project.audioTracks.map((audio) => (
                <TimelineAudioTrackItem
                  key={audio.id}
                  audio={audio}
                  zoom={zoom}
                  isSelected={selectedAudioId === audio.id}
                  isAudioLocked={isAudioLocked}
                  onSelect={() => onSelectAudio(audio.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

