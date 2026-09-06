"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  Volume2,
  Type,
  Layers,
} from "lucide-react";
import {
  AudioTrackItem,
  OverlayLayerItem,
  TextLayerItem,
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
}

export function Timeline({
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
}: TimelineProps) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);

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

  // Check if split is active at current playhead
  const canSplit = useMemo(() => {
    if (project.clips.length === 0) return false;
    const ranges = computeClipTimeRanges(project.clips);
    return ranges.some(
      (r) => currentTime > r.startTime + 0.15 && currentTime < r.endTime - 0.15
    );
  }, [project.clips, currentTime]);

  const hasSelection = Boolean(
    selectedClipId || selectedAudioId || selectedTextId || selectedOverlayId
  );

  return (
    <div className="flex flex-col w-full rounded-2xl border border-white/10 bg-slate-950/80 p-3 sm:p-4 text-white shadow-xl select-none">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
        {/* Left: Operations (Split, Duplicate, Delete, Undo, Redo) */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => onSplit(currentTime)}
            disabled={!canSplit}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 sm:px-3 text-xs font-semibold text-slate-200 transition hover:bg-cyan-400/20 hover:text-cyan-300 hover:border-cyan-400/30 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Split Clip at Playhead"
          >
            <Scissors className="h-3.5 w-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Split</span>
          </button>

          <button
            type="button"
            onClick={onDuplicate}
            disabled={!selectedClipId}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 sm:px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Duplicate Selected Clip"
          >
            <Copy className="h-3.5 w-3.5 text-slate-300" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={!hasSelection}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-400/20 bg-red-400/10 px-2.5 sm:px-3 text-xs font-semibold text-red-300 transition hover:bg-red-400/20 disabled:opacity-30 disabled:cursor-not-allowed"
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Right: Timecode & Zoom Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="font-mono text-xs text-slate-300 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-white/10">
            <span className="text-cyan-300 font-bold">{formatTimecode(currentTime)}</span>
            <span className="text-slate-500 mx-1">/</span>
            <span>{formatTimecode(totalDuration)}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => onZoomChange(Math.max(15, zoom - 15))}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
              title="Zoom Out"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-mono text-slate-400 w-8 text-center">{zoom}px</span>
            <button
              type="button"
              onClick={() => onZoomChange(Math.min(150, zoom + 15))}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
              title="Zoom In"
            >
              <Plus className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={handleFitToScreen}
              className="h-7 px-1.5 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition text-[10px]"
              title="Fit to Screen"
            >
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Horizontal Scrollable Tracks Area */}
      <div
        ref={scrollContainerRef}
        style={{ touchAction: "pan-x" }}
        className="relative mt-3 w-full overflow-x-auto overflow-y-hidden rounded-xl border border-white/5 bg-slate-950/60 pb-3 select-none"
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
            style={{ left: `${currentTime * zoom}px` }}
            className="absolute top-0 bottom-0 z-30 pointer-events-none flex flex-col items-center"
          >
            {/* Playhead Head */}
            <div className="h-4 w-3 -translate-y-0.5 bg-cyan-400 rounded-b shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
            {/* Vertical Line */}
            <div className="w-0.5 flex-1 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
          </div>

          {/* Track 1: Text Layers Track */}
          <div className="relative flex h-10 w-full items-center border-b border-white/5 px-1 py-1">
            <div className="absolute left-2 text-[10px] uppercase font-bold tracking-wider text-cyan-400/50 pointer-events-none flex items-center gap-1">
              <Type className="h-3 w-3" /> Text
            </div>
            {project.textLayers.map((textItem) => {
              const leftPx = textItem.timelineStart * zoom;
              const widthPx = Math.max(40, textItem.duration * zoom);
              const isSelected = selectedTextId === textItem.id;
              return (
                <div
                  key={textItem.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectText(textItem.id);
                  }}
                  style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                  className={`absolute h-7 cursor-pointer rounded-lg border px-2 text-[11px] font-medium truncate flex items-center transition ${
                    isSelected
                      ? "border-cyan-400 bg-cyan-500/30 text-white ring-1 ring-cyan-400"
                      : "border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                  }`}
                  title={textItem.text}
                >
                  <Type className="h-3 w-3 mr-1 shrink-0 text-cyan-300" />
                  <span className="truncate">{textItem.text}</span>
                </div>
              );
            })}
          </div>

          {/* Track 2: Overlays (PIP) Track */}
          <div className="relative flex h-10 w-full items-center border-b border-white/5 px-1 py-1">
            <div className="absolute left-2 text-[10px] uppercase font-bold tracking-wider text-amber-400/50 pointer-events-none flex items-center gap-1">
              <Layers className="h-3 w-3" /> Overlay
            </div>
            {project.overlayLayers.map((overlay) => {
              const leftPx = overlay.timelineStart * zoom;
              const widthPx = Math.max(40, overlay.duration * zoom);
              const isSelected = selectedOverlayId === overlay.id;
              return (
                <div
                  key={overlay.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectOverlay(overlay.id);
                  }}
                  style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                  className={`absolute h-7 cursor-pointer rounded-lg border px-2 text-[11px] font-medium truncate flex items-center transition ${
                    isSelected
                      ? "border-amber-400 bg-amber-500/30 text-white ring-1 ring-amber-400"
                      : "border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                  }`}
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
              // Click empty space to seek
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              onSeek(Math.max(0, clickX / zoom));
            }}
            className="relative flex min-h-[72px] w-full items-center border-b border-white/5 px-1 py-2 bg-slate-900/30"
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
                    onSelect={() => onSelectClip(clip.id)}
                    onTrim={(start, end) => onTrimClip(clip.id, start, end)}
                    onOpenTransitionModal={
                      onOpenTransitionModal ? () => onOpenTransitionModal(clip.id) : undefined
                    }
                    isLastClip={idx === project.clips.length - 1}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Track 4: Audio / Music Track */}
          <div className="relative flex h-11 w-full items-center px-1 py-1 bg-purple-950/10">
            <div className="absolute left-2 text-[10px] uppercase font-bold tracking-wider text-purple-400/50 pointer-events-none flex items-center gap-1">
              <Volume2 className="h-3 w-3" /> Audio
            </div>
            {project.audioTracks.map((audio) => {
              const leftPx = audio.timelineStart * zoom;
              const widthPx = Math.max(40, audio.duration * zoom);
              const isSelected = selectedAudioId === audio.id;
              return (
                <div
                  key={audio.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectAudio(audio.id);
                  }}
                  style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
                  className={`absolute h-8 cursor-pointer rounded-lg border px-2 text-[11px] font-medium truncate flex items-center justify-between transition ${
                    isSelected
                      ? "border-purple-400 bg-purple-500/30 text-white ring-1 ring-purple-400"
                      : "border-purple-400/30 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
                  }`}
                  title={audio.name}
                >
                  <div className="flex items-center min-w-0 truncate">
                    <Volume2 className="h-3 w-3 mr-1 shrink-0 text-purple-300" />
                    <span className="truncate">{audio.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300 ml-1 shrink-0">
                    {Math.round(audio.volume * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

