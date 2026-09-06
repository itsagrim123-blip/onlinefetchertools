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
        className={`relative flex h-14 cursor-pointer items-center justify-between rounded-xl border px-2 text-xs transition select-none overflow-hidden ${
          isSelected
            ? "border-cyan-400 bg-cyan-950/50 text-white ring-2 ring-cyan-400/50 shadow-lg shadow-cyan-950/50"
            : "border-white/10 bg-slate-900/90 text-slate-300 hover:border-white/30 hover:bg-slate-900"
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
          onMouseDown={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.clientX, "start");
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.touches[0].clientX, "start");
          }}
          title="Drag to trim start"
          className="absolute left-0 top-0 bottom-0 w-3 z-10 cursor-ew-resize flex items-center justify-center rounded-l-xl bg-white/5 hover:bg-cyan-400/40 transition group-hover:bg-white/10"
        >
          <div className="h-4 w-0.5 rounded-full bg-slate-400 group-hover:bg-cyan-300" />
        </div>

        {/* Clip Content Details */}
        <div className="relative z-10 flex-1 min-w-0 px-2 overflow-hidden drop-shadow">
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
          onMouseDown={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.clientX, "end");
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            handleStartTrimDrag(e.touches[0].clientX, "end");
          }}
          title="Drag to trim end"
          className="absolute right-0 top-0 bottom-0 w-3 z-10 cursor-ew-resize flex items-center justify-center rounded-r-xl bg-white/5 hover:bg-cyan-400/40 transition group-hover:bg-white/10"
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
          className={`z-20 -ml-2 -mr-2 h-6 w-6 rounded-full border flex items-center justify-center transition shadow-md ${
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

