"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  FastForward,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Shuffle,
  GripVertical,
} from "lucide-react";
import { VideoClip } from "../types";
import { getEffectiveClipDuration } from "../state/projectDefaults";

interface TimelineClipItemProps {
  clip: VideoClip;
  index: number;
  isSelected: boolean;
  zoom: number; // pixels per second
  snapPoints?: number[];
  snapEnabled?: boolean;
  minStartSec?: number;
  maxStartSec?: number;
  onSelect: () => void;
  onMove: (newTimelineStart: number) => void;
  onTrim: (newStartTrim: number, newEndTrim: number, newTimelineStart?: number) => void;
  onOpenTransitionModal?: () => void;
  isAdjacentToNext?: boolean;
}

function calculateSnapped(
  time: number,
  points: number[],
  threshold: number,
  enabled: boolean = true
): number {
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

export const TimelineClipItem = memo(function TimelineClipItem({
  clip,
  isSelected,
  zoom,
  snapPoints = [],
  snapEnabled = true,
  minStartSec = 0,
  maxStartSec = Infinity,
  onSelect,
  onMove,
  onTrim,
  onOpenTransitionModal,
  isAdjacentToNext = false,
}: TimelineClipItemProps) {
  const effectiveDuration = getEffectiveClipDuration(clip);
  const widthPx = Math.max(48, effectiveDuration * zoom);
  const clipStartSec = clip.timelineStart || 0;

  // Trim handle drag state
  const [trimmingSide, setTrimmingSide] = useState<"start" | "end" | null>(null);
  const trimStartXRef = useRef<number>(0);
  const initialStartTrimRef = useRef<number>(0);
  const initialEndTrimRef = useRef<number>(0);
  const initialTimelineStartRef = useRef<number>(0);

  // Clip body move drag state
  const [isDraggingBody, setIsDraggingBody] = useState<boolean>(false);
  const [dragOffsetPx, setDragOffsetPx] = useState<number>(0);
  const bodyStartXRef = useRef<number>(0);
  const hasMovedRef = useRef<boolean>(false);

  const handleStartTrimDrag = (clientX: number, side: "start" | "end") => {
    setTrimmingSide(side);
    trimStartXRef.current = clientX;
    initialStartTrimRef.current = clip.startTrim;
    initialEndTrimRef.current = clip.endTrim;
    initialTimelineStartRef.current = clip.timelineStart || 0;
  };

  useEffect(() => {
    if (!trimmingSide) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const deltaPx = clientX - trimStartXRef.current;
      const speed = Math.max(0.1, clip.speed || 1.0);

      if (trimmingSide === "start") {
        const deltaSec = (deltaPx / zoom) * speed;
        // Don't allow start trim to expand earlier than the previous clip
        const maxShift = Math.max(0, initialTimelineStartRef.current - minStartSec);
        const maxSourceShift = maxShift * speed;
        const minAllowedStart = Math.max(0, initialStartTrimRef.current - maxSourceShift);
        const newStart = Math.max(
          minAllowedStart,
          Math.min(initialStartTrimRef.current + deltaSec, initialEndTrimRef.current - 0.2)
        );
        const actualSourceDelta = newStart - initialStartTrimRef.current;
        const timelineShift = actualSourceDelta / speed;
        const newTimelineStart = Math.max(minStartSec, initialTimelineStartRef.current + timelineShift);
        onTrim(newStart, initialEndTrimRef.current, newTimelineStart);
      } else if (trimmingSide === "end") {
        const deltaSec = (deltaPx / zoom) * speed;
        // Don't allow end trim to expand into the next clip
        const maxAllowedDuration =
          maxStartSec === Infinity
            ? clip.sourceDuration
            : Math.max(0.2, maxStartSec + effectiveDuration - clipStartSec);
        const maxAllowedEnd = initialStartTrimRef.current + maxAllowedDuration * speed;
        const newEnd = Math.max(
          initialStartTrimRef.current + 0.2,
          Math.min(initialEndTrimRef.current + deltaSec, clip.sourceDuration, maxAllowedEnd)
        );
        onTrim(initialStartTrimRef.current, newEnd);
      }
    };

    const handlePointerUp = () => {
      setTrimmingSide(null);
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
  }, [
    trimmingSide,
    zoom,
    clip.speed,
    clip.sourceDuration,
    effectiveDuration,
    clipStartSec,
    minStartSec,
    maxStartSec,
    onTrim,
  ]);

  // Body Dragging Handlers
  const handleBodyPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    bodyStartXRef.current = e.clientX;
    hasMovedRef.current = false;
    setIsDraggingBody(true);
    setDragOffsetPx(0);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleBodyPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBody) return;
    const delta = e.clientX - bodyStartXRef.current;
    if (Math.abs(delta) > 3) {
      hasMovedRef.current = true;
    }
    setDragOffsetPx(delta);
  };

  const handleBodyPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingBody) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDraggingBody(false);

    if (hasMovedRef.current) {
      const deltaSec = dragOffsetPx / zoom;
      const rawStart = clipStartSec + deltaSec;
      const clampedRawStart = Math.max(minStartSec, Math.min(maxStartSec, rawStart));
      const otherSnapPoints = snapPoints.filter((p) => Math.abs(p - clipStartSec) > 0.05);
      const snapTargets = [...otherSnapPoints, minStartSec];
      if (maxStartSec !== Infinity) snapTargets.push(maxStartSec);
      const snapped = calculateSnapped(clampedRawStart, snapTargets, 12 / zoom, snapEnabled);
      const finalStart = Math.max(minStartSec, Math.min(maxStartSec, snapped));
      onMove(finalStart);
    } else {
      onSelect();
    }
    setDragOffsetPx(0);
  };

  const minLeftPx = minStartSec * zoom;
  const maxLeftPx = maxStartSec === Infinity ? Infinity : maxStartSec * zoom;
  const rawLeftPx = clipStartSec * zoom + (isDraggingBody ? dragOffsetPx : 0);
  const displayedLeftPx = Math.max(minLeftPx, Math.min(maxLeftPx, rawLeftPx));

  return (
    <div
      style={{ left: `${displayedLeftPx}px`, width: `${widthPx}px` }}
      className={`absolute top-2 h-14 select-none group z-10 ${
        isDraggingBody ? "opacity-90 shadow-2xl z-30 cursor-grabbing" : ""
      }`}
    >
      {/* Clip Body */}
      <div
        onPointerDown={handleBodyPointerDown}
        onPointerMove={handleBodyPointerMove}
        onPointerUp={handleBodyPointerUp}
        className={`relative flex h-full w-full cursor-grab items-center justify-between rounded-xl border px-2 text-xs transition-shadow select-none overflow-hidden ${
          isSelected
            ? "border-cyan-400 bg-cyan-950/60 text-white ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-950/50"
            : "border-white/10 bg-slate-900/95 text-slate-300 hover:border-white/30 hover:bg-slate-900"
        }`}
      >
        {/* Background Filmstrip Frames if available */}
        {clip.filmstripFrames && clip.filmstripFrames.length > 0 && (
          <div className="absolute inset-0 pointer-events-none flex overflow-hidden opacity-30 group-hover:opacity-40 transition">
            {clip.filmstripFrames.map((frameUrl, fIdx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={fIdx}
                src={frameUrl}
                alt=""
                className="h-full flex-1 object-cover border-r border-black/40 last:border-r-0"
              />
            ))}
          </div>
        )}

        {/* Left Trim Handle */}
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.clientX, "start");
          }}
          title="Drag to trim start"
          className="absolute left-0 top-0 bottom-0 w-3.5 z-20 cursor-ew-resize flex items-center justify-center rounded-l-xl bg-white/5 hover:bg-cyan-400/40 transition group-hover:bg-white/10"
        >
          <GripVertical className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-300" />
        </div>

        {/* Clip Content Details */}
        <div className="relative z-10 flex-1 min-w-0 px-2 pointer-events-none overflow-hidden drop-shadow">
          <p className="truncate font-semibold text-[11px] text-slate-100" title={clip.name}>
            {clip.name}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-300 font-mono mt-0.5">
            <span className="text-cyan-300 font-semibold">{effectiveDuration.toFixed(1)}s</span>
            {clip.speed !== 1.0 && (
              <span className="inline-flex items-center text-amber-300 bg-amber-400/20 px-1 rounded backdrop-blur-sm">
                <FastForward className="h-2.5 w-2.5 mr-0.5" />
                {clip.speed}x
              </span>
            )}
            {clip.isReversed && (
              <span className="inline-flex items-center text-pink-300 bg-pink-400/20 px-1 rounded backdrop-blur-sm">
                <RotateCcw className="h-2.5 w-2.5 mr-0.5" />
                REV
              </span>
            )}
            {clip.isMuted ? (
              <VolumeX className="h-3 w-3 text-red-400" />
            ) : clip.volume !== 1.0 ? (
              <Volume2 className="h-3 w-3 text-cyan-400" />
            ) : null}
            {clip.filterPreset !== "original" && (
              <Sparkles className="h-2.5 w-2.5 text-emerald-400" />
            )}
          </div>
        </div>

        {/* Right Trim Handle */}
        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.clientX, "end");
          }}
          title="Drag to trim end"
          className="absolute right-0 top-0 bottom-0 w-3.5 z-20 cursor-ew-resize flex items-center justify-center rounded-r-xl bg-white/5 hover:bg-cyan-400/40 transition group-hover:bg-white/10"
        >
          <GripVertical className="h-3.5 w-3.5 text-slate-400 group-hover:text-cyan-300" />
        </div>
      </div>

      {/* Transition indicator button between adjacent clips */}
      {isAdjacentToNext && onOpenTransitionModal && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpenTransitionModal();
          }}
          title={clip.transition ? `Transition: ${clip.transition.type} (${clip.transition.duration}s)` : "Add Transition"}
          className={`absolute -right-3 top-1/2 -translate-y-1/2 z-30 h-6 w-6 rounded-full border flex items-center justify-center transition shadow-lg ${
            clip.transition && clip.transition.type !== "none"
              ? "border-cyan-300 bg-cyan-400 text-slate-950 hover:bg-cyan-300 ring-2 ring-cyan-400/40 scale-105"
              : "border-white/20 bg-slate-800 text-slate-400 hover:border-cyan-400 hover:text-white"
          }`}
        >
          <Shuffle className="h-3 w-3" />
        </button>
      )}
    </div>
  );
});

