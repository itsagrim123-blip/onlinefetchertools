"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  Film,
  GripVertical,
  Layers,
  Lock,
  Magnet,
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
  onTrimClip: (clipId: string, startTrim: number, endTrim: number, newTimelineStart?: number) => void;
  onMoveClip?: (clipId: string, newTimelineStart: number) => void;
  onMoveAudio?: (audioId: string, newTimelineStart: number) => void;
  onResizeAudio?: (audioId: string, newDuration: number, newStartTrim?: number, newTimelineStart?: number) => void;
  onMoveText?: (textId: string, newTimelineStart: number) => void;
  onResizeText?: (textId: string, newDuration: number, newTimelineStart?: number) => void;
  onMoveOverlay?: (overlayId: string, newTimelineStart: number) => void;
  onResizeOverlay?: (overlayId: string, newDuration: number, newTimelineStart?: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomChange: (zoom: number) => void;
  onOpenTransitionModal?: (clipId: string) => void;
  onToggleTrackVisibility?: (track: "video" | "audio" | "text" | "overlay") => void;
  onToggleTrackLock?: (track: "video" | "audio" | "text" | "overlay") => void;
  onToggleSnap?: () => void;
  onAddMediaClick?: () => void;
  hideTopToolbar?: boolean;
}

function snapValue(time: number, points: number[], threshold: number, enabled: boolean): number {
  if (!enabled || points.length === 0) return Math.max(0, time);
  let best = Math.max(0, time);
  let minDiff = threshold;
  for (const pt of points) {
    const diff = Math.abs(time - pt);
    if (diff < minDiff) {
      minDiff = diff;
      best = pt;
    }
  }
  return Math.max(0, best);
}

// --- Text Track Item with Drag & Left/Right Resize Handles ---
const TimelineTextTrackItem = memo(function TimelineTextTrackItem({
  textItem,
  zoom,
  isSelected,
  isTextLocked,
  snapPoints = [],
  snapEnabled = true,
  onSelect,
  onMove,
  onResize,
}: {
  textItem: TextLayerItem;
  zoom: number;
  isSelected: boolean;
  isTextLocked: boolean;
  snapPoints?: number[];
  snapEnabled?: boolean;
  onSelect: () => void;
  onMove?: (newStart: number) => void;
  onResize?: (newDur: number, newStart?: number) => void;
}) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffsetPx, setDragOffsetPx] = useState<number>(0);
  const startXRef = useRef<number>(0);
  const movedRef = useRef<boolean>(false);

  const [resizingSide, setResizingSide] = useState<"start" | "end" | null>(null);
  const resizeStartXRef = useRef<number>(0);
  const initialDurRef = useRef<number>(textItem.duration);
  const initialStartRef = useRef<number>(textItem.timelineStart);

  // Body move
  const handleBodyPointerDown = (e: React.PointerEvent) => {
    if (isTextLocked || e.button !== 0) return;
    startXRef.current = e.clientX;
    movedRef.current = false;
    setIsDragging(true);
    setDragOffsetPx(0);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleBodyPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > 3) movedRef.current = true;
    setDragOffsetPx(delta);
  };

  const handleBodyPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    if (movedRef.current && onMove) {
      const deltaSec = dragOffsetPx / zoom;
      const raw = Math.max(0, textItem.timelineStart + deltaSec);
      const otherPoints = snapPoints.filter((p) => Math.abs(p - textItem.timelineStart) > 0.05);
      const snapped = snapValue(raw, otherPoints, 12 / zoom, snapEnabled);
      onMove(snapped);
    } else {
      onSelect();
    }
    setDragOffsetPx(0);
  };

  // Resize handles
  const handleResizeStart = (e: React.PointerEvent, side: "start" | "end") => {
    e.stopPropagation();
    if (isTextLocked || e.button !== 0) return;
    setResizingSide(side);
    resizeStartXRef.current = e.clientX;
    initialDurRef.current = textItem.duration;
    initialStartRef.current = textItem.timelineStart;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizingSide || !onResize) return;
    const deltaPx = e.clientX - resizeStartXRef.current;
    const deltaSec = deltaPx / zoom;

    if (resizingSide === "end") {
      const newDur = Math.max(0.3, initialDurRef.current + deltaSec);
      onResize(newDur);
    } else {
      const newStart = Math.max(0, initialStartRef.current + deltaSec);
      const newDur = Math.max(0.3, initialDurRef.current - deltaSec);
      onResize(newDur, newStart);
    }
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    if (!resizingSide) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setResizingSide(null);
  };

  const leftPx = Math.max(0, textItem.timelineStart * zoom + (isDragging ? dragOffsetPx : 0));
  const widthPx = Math.max(36, textItem.duration * zoom);

  return (
    <div
      onPointerDown={handleBodyPointerDown}
      onPointerMove={handleBodyPointerMove}
      onPointerUp={handleBodyPointerUp}
      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
      className={`absolute h-7 cursor-grab rounded-lg border px-1.5 text-[11px] font-medium flex items-center justify-between select-none group transition-shadow ${
        isSelected
          ? "border-cyan-400 bg-cyan-500/35 text-white ring-1 ring-cyan-400 shadow-md shadow-cyan-950/40 z-20"
          : "border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 z-10"
      } ${isTextLocked ? "cursor-not-allowed opacity-60" : ""} ${isDragging ? "cursor-grabbing opacity-90 shadow-xl" : ""}`}
      title={textItem.text}
    >
      {/* Left Resize Handle */}
      {!isTextLocked && (
        <div
          onPointerDown={(e) => handleResizeStart(e, "start")}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center rounded-l-lg hover:bg-cyan-300/30 transition opacity-0 group-hover:opacity-100 z-30"
          title="Drag to adjust start"
        >
          <div className="w-0.5 h-3 bg-cyan-300 rounded-full" />
        </div>
      )}

      <div className="flex items-center min-w-0 truncate px-1 pointer-events-none">
        <Type className="h-3 w-3 mr-1 shrink-0 text-cyan-300" />
        <span className="truncate">{textItem.text}</span>
      </div>
      <span className="text-[9px] font-mono text-cyan-300/80 shrink-0 pointer-events-none">
        {textItem.duration.toFixed(1)}s
      </span>

      {/* Right Resize Handle */}
      {!isTextLocked && (
        <div
          onPointerDown={(e) => handleResizeStart(e, "end")}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center rounded-r-lg hover:bg-cyan-300/30 transition opacity-0 group-hover:opacity-100 z-30"
          title="Drag to extend duration"
        >
          <div className="w-0.5 h-3 bg-cyan-300 rounded-full" />
        </div>
      )}
    </div>
  );
});

// --- Overlay Track Item with Drag & Left/Right Resize Handles ---
const TimelineOverlayTrackItem = memo(function TimelineOverlayTrackItem({
  overlay,
  zoom,
  isSelected,
  isOverlayLocked,
  snapPoints = [],
  snapEnabled = true,
  onSelect,
  onMove,
  onResize,
}: {
  overlay: OverlayLayerItem;
  zoom: number;
  isSelected: boolean;
  isOverlayLocked: boolean;
  snapPoints?: number[];
  snapEnabled?: boolean;
  onSelect: () => void;
  onMove?: (newStart: number) => void;
  onResize?: (newDur: number, newStart?: number) => void;
}) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffsetPx, setDragOffsetPx] = useState<number>(0);
  const startXRef = useRef<number>(0);
  const movedRef = useRef<boolean>(false);

  const [resizingSide, setResizingSide] = useState<"start" | "end" | null>(null);
  const resizeStartXRef = useRef<number>(0);
  const initialDurRef = useRef<number>(overlay.duration);
  const initialStartRef = useRef<number>(overlay.timelineStart);

  const handleBodyPointerDown = (e: React.PointerEvent) => {
    if (isOverlayLocked || e.button !== 0) return;
    startXRef.current = e.clientX;
    movedRef.current = false;
    setIsDragging(true);
    setDragOffsetPx(0);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleBodyPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > 3) movedRef.current = true;
    setDragOffsetPx(delta);
  };

  const handleBodyPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    if (movedRef.current && onMove) {
      const deltaSec = dragOffsetPx / zoom;
      const raw = Math.max(0, overlay.timelineStart + deltaSec);
      const otherPoints = snapPoints.filter((p) => Math.abs(p - overlay.timelineStart) > 0.05);
      const snapped = snapValue(raw, otherPoints, 12 / zoom, snapEnabled);
      onMove(snapped);
    } else {
      onSelect();
    }
    setDragOffsetPx(0);
  };

  const handleResizeStart = (e: React.PointerEvent, side: "start" | "end") => {
    e.stopPropagation();
    if (isOverlayLocked || e.button !== 0) return;
    setResizingSide(side);
    resizeStartXRef.current = e.clientX;
    initialDurRef.current = overlay.duration;
    initialStartRef.current = overlay.timelineStart;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizingSide || !onResize) return;
    const deltaPx = e.clientX - resizeStartXRef.current;
    const deltaSec = deltaPx / zoom;

    if (resizingSide === "end") {
      const newDur = Math.max(0.3, initialDurRef.current + deltaSec);
      onResize(newDur);
    } else {
      const newStart = Math.max(0, initialStartRef.current + deltaSec);
      const newDur = Math.max(0.3, initialDurRef.current - deltaSec);
      onResize(newDur, newStart);
    }
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    if (!resizingSide) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setResizingSide(null);
  };

  const leftPx = Math.max(0, overlay.timelineStart * zoom + (isDragging ? dragOffsetPx : 0));
  const widthPx = Math.max(36, overlay.duration * zoom);

  return (
    <div
      onPointerDown={handleBodyPointerDown}
      onPointerMove={handleBodyPointerMove}
      onPointerUp={handleBodyPointerUp}
      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
      className={`absolute h-7 cursor-grab rounded-lg border px-1.5 text-[11px] font-medium flex items-center justify-between select-none group transition-shadow ${
        isSelected
          ? "border-amber-400 bg-amber-500/35 text-white ring-1 ring-amber-400 shadow-md shadow-amber-950/40 z-20"
          : "border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 z-10"
      } ${isOverlayLocked ? "cursor-not-allowed opacity-60" : ""} ${isDragging ? "cursor-grabbing opacity-90 shadow-xl" : ""}`}
      title={overlay.name}
    >
      {!isOverlayLocked && (
        <div
          onPointerDown={(e) => handleResizeStart(e, "start")}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center rounded-l-lg hover:bg-amber-300/30 transition opacity-0 group-hover:opacity-100 z-30"
          title="Drag to adjust start"
        >
          <div className="w-0.5 h-3 bg-amber-300 rounded-full" />
        </div>
      )}

      <div className="flex items-center min-w-0 truncate px-1 pointer-events-none">
        <Layers className="h-3 w-3 mr-1 shrink-0 text-amber-300" />
        <span className="truncate">{overlay.name}</span>
      </div>
      <span className="text-[9px] font-mono text-amber-300/80 shrink-0 pointer-events-none">
        {overlay.duration.toFixed(1)}s
      </span>

      {!isOverlayLocked && (
        <div
          onPointerDown={(e) => handleResizeStart(e, "end")}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize flex items-center justify-center rounded-r-lg hover:bg-amber-300/30 transition opacity-0 group-hover:opacity-100 z-30"
          title="Drag to extend duration"
        >
          <div className="w-0.5 h-3 bg-amber-300 rounded-full" />
        </div>
      )}
    </div>
  );
});

// --- Audio Track Item with Drag & Left/Right Resize Handles ---
interface TimelineAudioTrackItemProps {
  audio: AudioTrackItem;
  zoom: number;
  isSelected: boolean;
  isAudioLocked: boolean;
  snapPoints?: number[];
  snapEnabled?: boolean;
  onSelect: () => void;
  onMove?: (newStart: number) => void;
  onResize?: (newDur: number, newStartTrim?: number, newTimelineStart?: number) => void;
}

const TimelineAudioTrackItem = memo(function TimelineAudioTrackItem({
  audio,
  zoom,
  isSelected,
  isAudioLocked,
  snapPoints = [],
  snapEnabled = true,
  onSelect,
  onMove,
  onResize,
}: TimelineAudioTrackItemProps) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffsetPx, setDragOffsetPx] = useState<number>(0);
  const startXRef = useRef<number>(0);
  const movedRef = useRef<boolean>(false);

  const [resizingSide, setResizingSide] = useState<"start" | "end" | null>(null);
  const resizeStartXRef = useRef<number>(0);
  const initialDurRef = useRef<number>(audio.duration);
  const initialStartRef = useRef<number>(audio.timelineStart);
  const initialTrimRef = useRef<number>(audio.startTrim);

  const handleBodyPointerDown = (e: React.PointerEvent) => {
    if (isAudioLocked || e.button !== 0) return;
    startXRef.current = e.clientX;
    movedRef.current = false;
    setIsDragging(true);
    setDragOffsetPx(0);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleBodyPointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - startXRef.current;
    if (Math.abs(delta) > 3) movedRef.current = true;
    setDragOffsetPx(delta);
  };

  const handleBodyPointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    if (movedRef.current && onMove) {
      const deltaSec = dragOffsetPx / zoom;
      const raw = Math.max(0, audio.timelineStart + deltaSec);
      const otherPoints = snapPoints.filter((p) => Math.abs(p - audio.timelineStart) > 0.05);
      const snapped = snapValue(raw, otherPoints, 12 / zoom, snapEnabled);
      onMove(snapped);
    } else {
      onSelect();
    }
    setDragOffsetPx(0);
  };

  const handleResizeStart = (e: React.PointerEvent, side: "start" | "end") => {
    e.stopPropagation();
    if (isAudioLocked || e.button !== 0) return;
    setResizingSide(side);
    resizeStartXRef.current = e.clientX;
    initialDurRef.current = audio.duration;
    initialStartRef.current = audio.timelineStart;
    initialTrimRef.current = audio.startTrim;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleResizeMove = (e: React.PointerEvent) => {
    if (!resizingSide || !onResize) return;
    const deltaPx = e.clientX - resizeStartXRef.current;
    const deltaSec = deltaPx / zoom;

    if (resizingSide === "end") {
      const newDur = Math.max(0.3, Math.min(audio.sourceDuration - audio.startTrim, initialDurRef.current + deltaSec));
      onResize(newDur);
    } else {
      const newTrim = Math.max(0, initialTrimRef.current + deltaSec);
      const newStart = Math.max(0, initialStartRef.current + deltaSec);
      const newDur = Math.max(0.3, initialDurRef.current - deltaSec);
      onResize(newDur, newTrim, newStart);
    }
  };

  const handleResizeUp = (e: React.PointerEvent) => {
    if (!resizingSide) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setResizingSide(null);
  };

  const leftPx = Math.max(0, audio.timelineStart * zoom + (isDragging ? dragOffsetPx : 0));
  const widthPx = Math.max(40, audio.duration * zoom);
  const barCount = Math.max(6, Math.floor(widthPx / 5));

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
      onPointerDown={handleBodyPointerDown}
      onPointerMove={handleBodyPointerMove}
      onPointerUp={handleBodyPointerUp}
      style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
      className={`absolute h-8 cursor-grab rounded-lg border px-2 text-[11px] font-medium flex items-center justify-between select-none group transition-shadow overflow-hidden ${
        isSelected
          ? "border-purple-400 bg-purple-500/30 text-white ring-1 ring-purple-400 shadow-lg shadow-purple-950/50 z-20"
          : "border-purple-400/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 z-10"
      } ${isAudioLocked ? "cursor-not-allowed opacity-60" : ""} ${isDragging ? "cursor-grabbing opacity-90 shadow-xl" : ""}`}
      title={audio.name}
    >
      {!isAudioLocked && (
        <div
          onPointerDown={(e) => handleResizeStart(e, "start")}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center rounded-l-lg hover:bg-purple-300/30 transition opacity-0 group-hover:opacity-100 z-30"
          title="Drag to trim audio start"
        >
          <div className="w-0.5 h-4 bg-purple-300 rounded-full" />
        </div>
      )}

      {/* Simulated Waveform background */}
      <div className="absolute inset-0 flex items-center justify-around px-1 opacity-20 pointer-events-none">
        {waveformBars}
      </div>

      <div className="relative z-10 flex items-center min-w-0 truncate pointer-events-none">
        <Volume2 className="h-3 w-3 mr-1 shrink-0 text-purple-300" />
        <span className="truncate">{audio.name}</span>
      </div>
      <span className="relative z-10 text-[10px] font-mono text-purple-300 ml-1 shrink-0 pointer-events-none">
        {audio.duration.toFixed(1)}s
      </span>

      {!isAudioLocked && (
        <div
          onPointerDown={(e) => handleResizeStart(e, "end")}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center rounded-r-lg hover:bg-purple-300/30 transition opacity-0 group-hover:opacity-100 z-30"
          title="Drag to extend audio duration"
        >
          <div className="w-0.5 h-4 bg-purple-300 rounded-full" />
        </div>
      )}
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
  onMoveClip,
  onMoveAudio,
  onResizeAudio,
  onMoveText,
  onResizeText,
  onMoveOverlay,
  onResizeOverlay,
  onDuplicate,
  onDelete,
  onUndo,
  onRedo,
  onZoomChange,
  onOpenTransitionModal,
  onToggleTrackVisibility,
  onToggleTrackLock,
  onToggleSnap,
  onAddMediaClick,
  hideTopToolbar = false,
}: TimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

  const snapPoints = useMemo(() => {
    const pts: number[] = [0, currentTime];
    project.clips.forEach((c) => {
      const start = c.timelineStart || 0;
      const end = start + getEffectiveClipDuration(c);
      pts.push(start, end);
    });
    project.audioTracks.forEach((a) => {
      pts.push(a.timelineStart, a.timelineStart + a.duration);
    });
    project.textLayers.forEach((t) => {
      pts.push(t.timelineStart, t.timelineStart + t.duration);
    });
    project.overlayLayers.forEach((o) => {
      pts.push(o.timelineStart, o.timelineStart + o.duration);
    });
    return Array.from(new Set(pts)).sort((a, b) => a - b);
  }, [project, currentTime]);

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

            {onToggleSnap && (
              <button
                type="button"
                onClick={onToggleSnap}
                className={`inline-flex h-8 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-semibold transition ${
                  project.settings.snapEnabled ?? true
                    ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.2)]"
                    : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                }`}
                title="Toggle Magnet / Snapping"
              >
                <Magnet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Snap</span>
              </button>
            )}

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
              className={`relative h-10 w-full border-b border-white/5 px-1 py-1 ${
                !isTextVisible ? "opacity-30 pointer-events-none" : ""
              }`}
            >
              {project.textLayers.map((textItem) => (
                <TimelineTextTrackItem
                  key={textItem.id}
                  textItem={textItem}
                  zoom={zoom}
                  isSelected={selectedTextId === textItem.id}
                  isTextLocked={isTextLocked}
                  snapPoints={snapPoints}
                  snapEnabled={project.settings.snapEnabled ?? true}
                  onSelect={() => onSelectText(textItem.id)}
                  onMove={(newStart) => {
                    if (!isTextLocked && onMoveText) onMoveText(textItem.id, newStart);
                  }}
                  onResize={(newDur, newStart) => {
                    if (!isTextLocked && onResizeText) onResizeText(textItem.id, newDur, newStart);
                  }}
                />
              ))}
            </div>

            {/* Track 2: Overlays (PIP) Track */}
            <div
              className={`relative h-10 w-full border-b border-white/5 px-1 py-1 ${
                !isOverlayVisible ? "opacity-30 pointer-events-none" : ""
              }`}
            >
              {project.overlayLayers.map((overlay) => (
                <TimelineOverlayTrackItem
                  key={overlay.id}
                  overlay={overlay}
                  zoom={zoom}
                  isSelected={selectedOverlayId === overlay.id}
                  isOverlayLocked={isOverlayLocked}
                  snapPoints={snapPoints}
                  snapEnabled={project.settings.snapEnabled ?? true}
                  onSelect={() => onSelectOverlay(overlay.id)}
                  onMove={(newStart) => {
                    if (!isOverlayLocked && onMoveOverlay) onMoveOverlay(overlay.id, newStart);
                  }}
                  onResize={(newDur, newStart) => {
                    if (!isOverlayLocked && onResizeOverlay) onResizeOverlay(overlay.id, newDur, newStart);
                  }}
                />
              ))}
            </div>

            {/* Track 3: Main Video Track */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                onSeek(Math.max(0, clickX / zoom));
              }}
              className={`relative h-[72px] w-full border-b border-white/5 px-1 py-2 bg-slate-900/30 ${
                !isVideoVisible ? "opacity-30" : ""
              }`}
            >
              {project.clips.length === 0 ? (
                <div className="flex h-14 w-full items-center justify-center text-xs text-slate-500">
                  Main track empty. Add video or image clips from Project Media.
                </div>
              ) : (
                <>
                  {project.clips.map((clip, idx) => {
                    const prevClip = idx > 0 ? project.clips[idx - 1] : undefined;
                    const nextClip = idx < project.clips.length - 1 ? project.clips[idx + 1] : undefined;
                    const prevClipEnd = prevClip
                      ? (prevClip.timelineStart || 0) + getEffectiveClipDuration(prevClip)
                      : 0;
                    const nextClipStart = nextClip ? (nextClip.timelineStart || 0) : Infinity;
                    const clipDur = getEffectiveClipDuration(clip);
                    const minStartSec = prevClipEnd;
                    const maxStartSec = nextClip ? Math.max(minStartSec, nextClipStart - clipDur) : Infinity;
                    const clipEnd = (clip.timelineStart || 0) + clipDur;
                    const isAdjacent = nextClip && Math.abs((nextClip.timelineStart || 0) - clipEnd) <= 0.25;
                    return (
                      <TimelineClipItem
                        key={clip.id}
                        clip={clip}
                        index={idx}
                        zoom={zoom}
                        snapPoints={snapPoints}
                        snapEnabled={project.settings.snapEnabled ?? true}
                        minStartSec={minStartSec}
                        maxStartSec={maxStartSec}
                        isSelected={selectedClipId === clip.id}
                        onSelect={() => {
                          if (!isVideoLocked) onSelectClip(clip.id);
                        }}
                        onMove={(newStart) => {
                          if (!isVideoLocked && onMoveClip) onMoveClip(clip.id, newStart);
                        }}
                        onTrim={(start, end, newStart) => {
                          if (!isVideoLocked) onTrimClip(clip.id, start, end, newStart);
                        }}
                        onOpenTransitionModal={
                          onOpenTransitionModal ? () => onOpenTransitionModal(clip.id) : undefined
                        }
                        isAdjacentToNext={Boolean(isAdjacent)}
                      />
                    );
                  })}

                  {/* + Add clip button at end of video track */}
                  {onAddMediaClick && (
                    <button
                      type="button"
                      style={{
                        left: `${
                          project.clips.reduce(
                            (max, c) => Math.max(max, (c.timelineStart || 0) + getEffectiveClipDuration(c)),
                            0
                          ) * zoom + 12
                        }px`,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddMediaClick();
                      }}
                      className="absolute top-2 h-14 w-12 rounded-xl border border-dashed border-white/20 hover:border-cyan-400 bg-white/5 hover:bg-cyan-400/10 flex flex-col items-center justify-center text-slate-400 hover:text-cyan-300 transition shrink-0 z-10"
                      title="Add Media / Clip to Track"
                    >
                      <Plus className="h-4 w-4 mb-0.5" />
                      <span className="text-[9px] font-semibold">Add</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Track 4: Audio / Music Track */}
            <div
              className={`relative h-11 w-full px-1 py-1 bg-purple-950/10 ${
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
                  snapPoints={snapPoints}
                  snapEnabled={project.settings.snapEnabled ?? true}
                  onSelect={() => onSelectAudio(audio.id)}
                  onMove={(newStart) => {
                    if (!isAudioLocked && onMoveAudio) onMoveAudio(audio.id, newStart);
                  }}
                  onResize={(newDur, newTrim, newStart) => {
                    if (!isAudioLocked && onResizeAudio) onResizeAudio(audio.id, newDur, newTrim, newStart);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

