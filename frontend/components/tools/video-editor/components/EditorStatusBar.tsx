"use client";

import { Minus, Plus, RotateCcw, RotateCw, Settings } from "lucide-react";
import { formatTimecode } from "../state/projectDefaults";
import { VideoProject } from "../types";

interface EditorStatusBarProps {
  project: VideoProject;
  totalDuration: number;
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoomChange: (zoom: number) => void;
  onOpenSettings?: () => void;
}

export function EditorStatusBar({
  project,
  totalDuration,
  zoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoomChange,
  onOpenSettings,
}: EditorStatusBarProps) {
  return (
    <footer className="flex flex-wrap items-center justify-between px-4 py-2 bg-slate-950 border-t border-white/10 select-none text-xs text-slate-400">
      {/* Left: Project Metadata Info */}
      <div className="flex items-center gap-4 text-[11px] font-mono">
        <div>
          <span>Duration: </span>
          <span className="text-white font-semibold">{formatTimecode(totalDuration)}</span>
        </div>
        <div>
          <span>Resolution: </span>
          <span className="text-white">
            {project.settings.canvasWidth}×{project.settings.canvasHeight}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5">
          <span>Format: </span>
          <span className="text-white">MP4 (H.264)</span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="hover:text-white transition"
            title="Settings"
          >
            <Settings className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Right: Undo, Redo & Timeline Zoom */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1 rounded-lg hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Undo (Ctrl+Z)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1 rounded-lg hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition"
            title="Redo (Ctrl+Y)"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded-lg border border-white/10">
          <button
            type="button"
            onClick={() => onZoomChange(Math.max(15, zoom - 15))}
            className="p-0.5 hover:text-white"
            title="Zoom Out"
          >
            <Minus className="h-3 w-3" />
          </button>
          <input
            type="range"
            min="15"
            max="150"
            value={zoom}
            onChange={(e) => onZoomChange(parseInt(e.target.value) || 50)}
            className="w-16 sm:w-24 accent-cyan-400 cursor-pointer h-1"
          />
          <button
            type="button"
            onClick={() => onZoomChange(Math.min(150, zoom + 15))}
            className="p-0.5 hover:text-white"
            title="Zoom In"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
    </footer>
  );
}

