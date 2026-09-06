"use client";

import { useEffect, useRef, useState } from "react";
import {
  FastForward,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Shuffle,
} from "lucide-react";
import { VideoClip } from "../types";
import { getEffectiveClipDuration } from "../state/projectDefaults";

interface TimelineClipItemProps {
  clip: VideoClip;
  index: number;
  isSelected: boolean;
  zoom: number; // pixels per second
  onSelect: () => void;
  onTrim: (newStartTrim: number, newEndTrim: number) => void;
  onOpenTransitionModal?: () => void;
  isLastClip: boolean;
}

export function TimelineClipItem({
  clip,
  isSelected,
  zoom,
  onSelect,
  onTrim,
  onOpenTransitionModal,
  isLastClip,
}: TimelineClipItemProps) {
  const effectiveDuration = getEffectiveClipDuration(clip);
  const widthPx = Math.max(56, effectiveDuration * zoom);

  const [trimmingSide, setTrimmingSide] = useState<"start" | "end" | null>(null);
  const startXRef = useRef<number>(0);
  const initialStartTrimRef = useRef<number>(0);
  const initialEndTrimRef = useRef<number>(0);

  const handleStartTrimDrag = (clientX: number, side: "start" | "end") => {
    setTrimmingSide(side);
    startXRef.current = clientX;
    initialStartTrimRef.current = clip.startTrim;
    initialEndTrimRef.current = clip.endTrim;
  };

  useEffect(() => {
    if (!trimmingSide) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const deltaPx = clientX - startXRef.current;
      const deltaSec = (deltaPx / zoom) * (clip.speed || 1.0);

      if (trimmingSide === "start") {
        const newStart = Math.max(
          0,
          Math.min(initialStartTrimRef.current + deltaSec, initialEndTrimRef.current - 0.2)
        );
        onTrim(newStart, initialEndTrimRef.current);
      } else if (trimmingSide === "end") {
        const newEnd = Math.max(
          initialStartTrimRef.current + 0.2,
          Math.min(initialEndTrimRef.current + deltaSec, clip.sourceDuration)
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
  }, [trimmingSide, zoom, clip.speed, clip.sourceDuration, onTrim]);

  return (
    <div className="relative inline-flex items-center select-none shrink-0 group">
      {/* Clip Body */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        style={{ width: `${widthPx}px` }}
        className={`relative flex h-14 cursor-pointer items-center justify-between rounded-xl border px-2 text-xs transition select-none ${
          isSelected
            ? "border-cyan-400 bg-cyan-950/40 text-white ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-950/50"
            : "border-white/10 bg-slate-900/80 text-slate-300 hover:border-white/30 hover:bg-slate-900"
        }`}
      >
        {/* Left Trim Handle */}
        <div
          onMouseDown={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.clientX, "start");
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.touches[0].clientX, "start");
          }}
          title="Drag to trim start"
          className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center rounded-l-xl bg-white/5 hover:bg-cyan-400/30 transition group-hover:bg-white/10"
        >
          <div className="h-4 w-0.5 rounded-full bg-slate-400 group-hover:bg-cyan-300" />
        </div>

        {/* Clip Content Details */}
        <div className="flex-1 min-w-0 px-2 overflow-hidden">
          <p className="truncate font-medium text-[11px] text-slate-200" title={clip.name}>
            {clip.name}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
            <span className="text-cyan-300 font-semibold">{effectiveDuration.toFixed(1)}s</span>
            {clip.speed !== 1.0 && (
              <span className="inline-flex items-center text-amber-300 bg-amber-400/10 px-1 rounded">
                <FastForward className="h-2.5 w-2.5 mr-0.5" />
                {clip.speed}x
              </span>
            )}
            {clip.isReversed && (
              <span className="inline-flex items-center text-pink-300 bg-pink-400/10 px-1 rounded">
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
          onMouseDown={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.clientX, "end");
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.touches[0].clientX, "end");
          }}
          title="Drag to trim end"
          className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize flex items-center justify-center rounded-r-xl bg-white/5 hover:bg-cyan-400/30 transition group-hover:bg-white/10"
        >
          <div className="h-4 w-0.5 rounded-full bg-slate-400 group-hover:bg-cyan-300" />
        </div>
      </div>

      {/* Transition indicator button between clips */}
      {!isLastClip && onOpenTransitionModal && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenTransitionModal();
          }}
          title={clip.transition ? `Transition: ${clip.transition.type}` : "Add Transition"}
          className={`z-10 -ml-2 -mr-2 h-6 w-6 rounded-full border flex items-center justify-center transition shadow ${
            clip.transition && clip.transition.type !== "none"
              ? "border-cyan-400 bg-cyan-400 text-slate-950 hover:bg-cyan-300"
              : "border-white/20 bg-slate-800 text-slate-400 hover:border-cyan-400 hover:text-white"
          }`}
        >
          <Shuffle className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

