"use client";

import { Folder, HelpCircle, MoreHorizontal, Settings, Upload, Video } from "lucide-react";
import { AspectRatioPreset } from "../types";

interface EditorTopBarProps {
  projectTitle: string;
  aspectRatio?: AspectRatioPreset;
  canExport?: boolean;
  onUpdateTitle?: (title: string) => void;
  onProjectTitleChange?: (title: string) => void;
  onAspectRatioChange?: (ratio: AspectRatioPreset) => void;
  onExportClick?: () => void;
  onOpenExport?: () => void;
  onSettingsClick?: () => void;
  onOpenProjectModal?: () => void;
  onHelpClick?: () => void;
}

export function EditorTopBar({
  projectTitle,
  aspectRatio,
  canExport = true,
  onUpdateTitle,
  onProjectTitleChange,
  onAspectRatioChange,
  onExportClick,
  onOpenExport,
  onSettingsClick,
  onOpenProjectModal,
  onHelpClick,
}: EditorTopBarProps) {
  const handleTitleChange = onProjectTitleChange || onUpdateTitle;
  const handleExport = onExportClick || onOpenExport;
  const handleSettings = onSettingsClick || onOpenProjectModal;

  return (
    <header className="flex items-center justify-between px-3 sm:px-4 py-2 bg-slate-950/90 border-b border-white/10 select-none text-white backdrop-blur-md">
      {/* Left: Video Editor Identity & Project Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 shadow-inner shrink-0">
          <Video className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {handleTitleChange ? (
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-bold text-white border-b border-transparent hover:border-white/20 focus:border-cyan-400 focus:outline-none transition truncate max-w-[130px] sm:max-w-[200px]"
                title="Click to rename project"
              />
            ) : (
              <h1 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                {projectTitle}
              </h1>
            )}
          </div>
          <p className="text-[10px] text-slate-400 hidden sm:block">Edit. Create. Export.</p>
        </div>
      </div>

      {/* Right: Aspect Ratio, Settings, Shortcuts & Export */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {aspectRatio && onAspectRatioChange && (
          <div className="hidden md:flex items-center gap-1 bg-slate-900 px-1.5 py-1 rounded-xl border border-white/10 text-xs">
            {(["16:9", "9:16", "1:1", "4:5"] as AspectRatioPreset[]).map((ratio) => (
              <button
                key={ratio}
                type="button"
                onClick={() => onAspectRatioChange(ratio)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition ${
                  aspectRatio === ratio
                    ? "bg-cyan-400 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {ratio}
              </button>
            ))}
          </div>
        )}

        {handleSettings && (
          <button
            type="button"
            onClick={handleSettings}
            className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border border-white/10 bg-slate-900/80 text-xs font-medium text-slate-200 hover:bg-white/5 hover:border-white/20 transition"
            title="Project Settings"
          >
            <Folder className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">Project</span>
          </button>
        )}

        {onHelpClick && (
          <button
            type="button"
            onClick={onHelpClick}
            className="hidden sm:inline-flex items-center justify-center h-9 w-9 rounded-xl border border-white/10 bg-slate-900/80 text-slate-400 hover:text-white hover:bg-white/5 transition"
            title="Keyboard Shortcuts & Help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        )}

        {handleExport && (
          <button
            type="button"
            onClick={handleExport}
            disabled={!canExport}
            className="inline-flex items-center gap-1.5 h-8 sm:h-9 px-3.5 sm:px-4 rounded-xl bg-cyan-400 text-xs font-bold text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.35)] hover:bg-cyan-300 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Export</span>
          </button>
        )}
      </div>
    </header>
  );
}
