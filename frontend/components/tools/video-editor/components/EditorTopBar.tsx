"use client";

import Link from "next/link";
import { ChevronLeft, Folder, HelpCircle, Settings, Upload, Video } from "lucide-react";
import { AspectRatioPreset } from "../types";
import { BackendStatus } from "@/components/BackendStatus";

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
    <header className="h-12 shrink-0 flex items-center justify-between px-3 sm:px-4 bg-slate-950 border-b border-white/10 select-none text-white z-20">
      {/* Left: All Tools Back Navigation + Video Editor Identity */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300 transition py-1 px-1.5 rounded-lg hover:bg-white/5 shrink-0"
          title="Back to all Online Fetcher Tools"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline font-medium">All tools</span>
        </Link>

        <div className="h-4 w-px bg-white/10 shrink-0" />

        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 shadow-inner shrink-0">
          <Video className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {handleTitleChange ? (
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-bold text-white border-b border-transparent hover:border-white/20 focus:border-cyan-400 focus:outline-none transition truncate max-w-[120px] sm:max-w-[180px]"
                title="Click to rename project"
              />
            ) : (
              <h1 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate">
                {projectTitle}
              </h1>
            )}
          </div>
          <p className="text-[10px] text-slate-400 hidden md:block leading-none mt-0.5">Studio Editor</p>
        </div>
      </div>

      {/* Right: BackendStatus, Aspect Ratio, Settings, Shortcuts & Export */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Backend Status indicator */}
        <div className="hidden sm:block">
          <BackendStatus />
        </div>

        {aspectRatio && onAspectRatioChange && (
          <div className="hidden xl:flex items-center gap-1 bg-slate-900 px-1.5 py-1 rounded-xl border border-white/10 text-xs">
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
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl border border-white/10 bg-slate-900/80 text-xs font-medium text-slate-200 hover:bg-white/5 hover:border-white/20 transition"
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
            className="hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-xl border border-white/10 bg-slate-900/80 text-slate-400 hover:text-white hover:bg-white/5 transition"
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
            className="inline-flex items-center gap-1.5 h-8 px-3.5 sm:px-4 rounded-xl bg-cyan-400 text-xs font-bold text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.35)] hover:bg-cyan-300 active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Upload className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Export</span>
          </button>
        )}
      </div>
    </header>
  );
}

