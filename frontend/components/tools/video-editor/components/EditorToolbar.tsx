"use client";

import { useState } from "react";
import {
  Copy,
  Crop,
  FastForward,
  MoreHorizontal,
  RotateCcw,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
  Volume2,
  Camera,
} from "lucide-react";
import { ClipPropertyTab, SidebarTab, VideoClip } from "../types";

interface EditorToolbarProps {
  selectedClip?: VideoClip;
  hasSelectedClip?: boolean;
  hasSelectedItem?: boolean;
  canSplit: boolean;
  onSplit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTrim?: () => void;
  onCrop?: () => void;
  onSpeed?: () => void;
  onVolume?: () => void;
  onFilters?: () => void;
  onAdjust?: () => void;
  onOpenCrop?: () => void;
  onOpenSpeed?: () => void;
  onOpenVolume?: () => void;
  onOpenFilters?: () => void;
  onOpenAdjust?: () => void;
  onReverse?: () => void;
  onFreezeFrame?: () => void;
}

export function EditorToolbar({
  selectedClip,
  hasSelectedClip,
  hasSelectedItem,
  canSplit,
  onSplit,
  onDelete,
  onDuplicate,
  onTrim,
  onCrop,
  onSpeed,
  onVolume,
  onFilters,
  onAdjust,
  onOpenCrop,
  onOpenSpeed,
  onOpenVolume,
  onOpenFilters,
  onOpenAdjust,
  onReverse,
  onFreezeFrame,
}: EditorToolbarProps) {
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);

  const isClipActive = Boolean(selectedClip || hasSelectedClip);
  const isItemActive = Boolean(isClipActive || hasSelectedItem);

  const handleCrop = onCrop || onOpenCrop;
  const handleSpeed = onSpeed || onOpenSpeed;
  const handleVolume = onVolume || onOpenVolume;
  const handleFilters = onFilters || onOpenFilters;
  const handleAdjust = onAdjust || onOpenAdjust;

  const tools = [
    {
      id: "split",
      label: "Split",
      icon: Scissors,
      onClick: onSplit,
      disabled: !canSplit,
    },
    {
      id: "delete",
      label: "Delete",
      icon: Trash2,
      onClick: onDelete,
      disabled: !isItemActive,
      danger: true,
    },
    {
      id: "duplicate",
      label: "Duplicate",
      icon: Copy,
      onClick: onDuplicate,
      disabled: !isClipActive,
    },
    {
      id: "trim",
      label: "Trim",
      icon: Scissors,
      onClick: onTrim || (() => {}),
      disabled: !isClipActive,
    },
    {
      id: "crop",
      label: "Crop",
      icon: Crop,
      onClick: handleCrop || (() => {}),
      disabled: !isClipActive,
    },
    {
      id: "speed",
      label: "Speed",
      icon: FastForward,
      onClick: handleSpeed || (() => {}),
      disabled: !isClipActive,
    },
    {
      id: "volume",
      label: "Volume",
      icon: Volume2,
      onClick: handleVolume || (() => {}),
      disabled: !isClipActive,
    },
    {
      id: "filters",
      label: "Filters",
      icon: Sparkles,
      onClick: handleFilters || (() => {}),
      disabled: !isClipActive,
    },
    {
      id: "adjust",
      label: "Adjust",
      icon: Sliders,
      onClick: handleAdjust || (() => {}),
      disabled: !isClipActive,
    },
  ];

  return (
    <div className="relative flex items-center justify-between px-4 py-2 bg-slate-950/90 border-y border-white/10 select-none overflow-x-auto">
      <div className="flex items-center gap-1 sm:gap-2 min-w-max">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={tool.onClick}
              disabled={tool.disabled}
              className={`flex flex-col items-center justify-center w-12 h-11 rounded-xl transition ${
                tool.disabled
                  ? "text-slate-600 opacity-40 cursor-not-allowed"
                  : tool.danger
                  ? "text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                  : "text-slate-400 hover:text-cyan-300 hover:bg-cyan-400/10"
              }`}
              title={tool.label}
            >
              <Icon className="h-4 w-4" />
              <span className="text-[10px] font-medium mt-0.5">{tool.label}</span>
            </button>
          );
        })}

        {/* More Menu Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            disabled={!selectedClip}
            className={`flex flex-col items-center justify-center w-12 h-11 rounded-xl transition ${
              !selectedClip
                ? "text-slate-600 opacity-40 cursor-not-allowed"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
            title="More Options"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="text-[10px] font-medium mt-0.5">More</span>
          </button>

          {showMoreMenu && selectedClip && (
            <div className="absolute left-0 bottom-12 z-30 w-44 rounded-xl border border-white/10 bg-slate-950 p-1.5 shadow-2xl text-xs space-y-1">
              <button
                type="button"
                onClick={() => {
                  onReverse?.();
                  setShowMoreMenu(false);
                }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-white/10 text-left"
              >
                <RotateCcw className="h-3.5 w-3.5 text-pink-400" />
                <span>{selectedClip.isReversed ? "Normal Playback" : "Reverse Playback"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onFreezeFrame?.();
                  setShowMoreMenu(false);
                }}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-slate-300 hover:bg-white/10 text-left"
              >
                <Camera className="h-3.5 w-3.5 text-cyan-400" />
                <span>Freeze Frame (3s)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
