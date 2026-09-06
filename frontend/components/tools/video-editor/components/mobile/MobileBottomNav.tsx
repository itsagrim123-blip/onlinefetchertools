"use client";

import {
  FolderPlus,
  Music,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
  Type,
  Wand2,
  Smile,
  Volume2,
  FastForward,
} from "lucide-react";
import { MobileSheetType } from "../../types";

interface MobileBottomNavProps {
  hasSelectedClip: boolean;
  canSplit: boolean;
  onOpenSheet: (sheet: MobileSheetType) => void;
  onSplit: () => void;
  onDelete: () => void;
}

export function MobileBottomNav({
  hasSelectedClip,
  canSplit,
  onOpenSheet,
  onSplit,
  onDelete,
}: MobileBottomNavProps) {
  if (hasSelectedClip) {
    return (
      <nav className="w-full shrink-0 z-40 flex items-center justify-around border-t border-white/10 bg-slate-950 px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden">
        <button
          type="button"
          onClick={onSplit}
          disabled={!canSplit}
          className="flex min-w-[54px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        >
          <Scissors className="h-5 w-5 text-cyan-400" />
          <span className="text-[10px] font-medium">Split</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenSheet("speed")}
          className="flex min-w-[54px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
        >
          <FastForward className="h-5 w-5 text-amber-400" />
          <span className="text-[10px] font-medium">Speed</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenSheet("clip_edit")}
          className="flex min-w-[54px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
        >
          <Volume2 className="h-5 w-5 text-purple-400" />
          <span className="text-[10px] font-medium">Volume</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenSheet("filters")}
          className="flex min-w-[54px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
        >
          <Sparkles className="h-5 w-5 text-emerald-400" />
          <span className="text-[10px] font-medium">Filter</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenSheet("adjust")}
          className="flex min-w-[54px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
        >
          <Sliders className="h-5 w-5 text-cyan-400" />
          <span className="text-[10px] font-medium">Adjust</span>
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="flex min-w-[54px] flex-col items-center gap-1 rounded-xl p-1 text-red-400 active:scale-95"
        >
          <Trash2 className="h-5 w-5" />
          <span className="text-[10px] font-medium">Delete</span>
        </button>
      </nav>
    );
  }

  return (
    <nav className="w-full shrink-0 z-40 flex items-center justify-around border-t border-white/10 bg-slate-950 px-1 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] lg:hidden">
      <button
        type="button"
        onClick={() => onOpenSheet("media")}
        className="flex min-w-[50px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
      >
        <FolderPlus className="h-5 w-5 text-cyan-400" />
        <span className="text-[10px] font-medium">Media</span>
      </button>

      <button
        type="button"
        onClick={() => onOpenSheet("audio")}
        className="flex min-w-[50px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
      >
        <Music className="h-5 w-5 text-purple-400" />
        <span className="text-[10px] font-medium">Audio</span>
      </button>

      <button
        type="button"
        onClick={() => onOpenSheet("text")}
        className="flex min-w-[50px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
      >
        <Type className="h-5 w-5 text-cyan-400" />
        <span className="text-[10px] font-medium">Text</span>
      </button>

      <button
        type="button"
        onClick={() => onOpenSheet("stickers")}
        className="flex min-w-[50px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
      >
        <Smile className="h-5 w-5 text-amber-400" />
        <span className="text-[10px] font-medium">Stickers</span>
      </button>

      <button
        type="button"
        onClick={() => onOpenSheet("effects")}
        className="flex min-w-[50px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
      >
        <Wand2 className="h-5 w-5 text-pink-400" />
        <span className="text-[10px] font-medium">Effects</span>
      </button>

      <button
        type="button"
        onClick={() => onOpenSheet("filters")}
        className="flex min-w-[50px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
      >
        <Sparkles className="h-5 w-5 text-emerald-400" />
        <span className="text-[10px] font-medium">Filters</span>
      </button>

      <button
        type="button"
        onClick={() => onOpenSheet("adjust")}
        className="flex min-w-[50px] flex-col items-center gap-1 rounded-xl p-1 text-slate-300 active:scale-95"
      >
        <Sliders className="h-5 w-5 text-sky-400" />
        <span className="text-[10px] font-medium">Adjust</span>
      </button>
    </nav>
  );
}

