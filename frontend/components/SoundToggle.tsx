"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useUISound } from "@/lib/sounds/useUISound";

export function SoundToggle() {
  const { soundEnabled, toggleSound } = useUISound();

  return (
    <button
      type="button"
      onClick={toggleSound}
      className="btn-interactive inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-auto sm:px-1 rounded-full border border-white/10 bg-white/5 text-sm text-slate-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/10 cursor-pointer shrink-0"
      aria-label={soundEnabled ? "Mute UI sounds" : "Enable UI sounds"}
      title={soundEnabled ? "Mute UI sounds" : "Enable UI sounds"}
    >
      <span className="sm:hidden flex items-center justify-center">
        {soundEnabled ? (
          <Volume2 className="h-3.5 w-3.5 text-cyan-300" />
        ) : (
          <VolumeX className="h-3.5 w-3.5 text-slate-500" />
        )}
      </span>
      <span
        className={`hidden sm:flex h-6 w-6 items-center justify-center rounded-full transition-all ${
          soundEnabled
            ? "bg-cyan-400/20 text-cyan-300 shadow-sm"
            : "text-slate-500 hover:text-slate-300"
        }`}
      >
        <Volume2 className="h-3.5 w-3.5" />
      </span>
      <span
        className={`hidden sm:flex h-6 w-6 items-center justify-center rounded-full transition-all ${
          !soundEnabled
            ? "bg-slate-700/50 text-slate-300 shadow-sm"
            : "text-slate-500 hover:text-slate-400"
        }`}
      >
        <VolumeX className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

