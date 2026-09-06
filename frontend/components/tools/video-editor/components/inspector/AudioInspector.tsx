"use client";

import { Volume2, VolumeX, Sliders, Trash2 } from "lucide-react";
import { AudioTrackItem } from "../../types";

interface AudioInspectorProps {
  track: AudioTrackItem;
  onUpdateTrack: (partial: Partial<AudioTrackItem>) => void;
  onRemoveTrack: () => void;
}

export function AudioInspector({
  track,
  onUpdateTrack,
  onRemoveTrack,
}: AudioInspectorProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-white">
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-purple-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-300">
            Audio Track: <span className="text-white normal-case font-medium">{track.name}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onRemoveTrack}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20"
          title="Delete audio track"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Volume & Mute */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            {track.isMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-purple-400" />
            )}
            Volume
          </label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-purple-300 font-bold">
              {Math.round(track.volume * 100)}%
            </span>
            <button
              type="button"
              onClick={() => onUpdateTrack({ isMuted: !track.isMuted })}
              className={`text-[11px] px-2 py-0.5 rounded-lg font-medium transition ${
                track.isMuted
                  ? "bg-red-400/20 text-red-300 border border-red-400/30"
                  : "bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              {track.isMuted ? "Muted" : "Mute"}
            </button>
          </div>
        </div>

        {!track.isMuted && (
          <input
            type="range"
            min="0"
            max="200"
            value={Math.round(track.volume * 100)}
            onChange={(e) => onUpdateTrack({ volume: parseFloat(e.target.value) / 100 })}
            className="w-full accent-purple-400 cursor-pointer"
          />
        )}
      </div>

      {/* Audio Fades */}
      <div className="space-y-3 border-t border-white/10 pt-3">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-purple-400" /> Fade Transitions
        </label>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Fade In</span>
            <span className="text-purple-300">{track.fadeInDuration.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={track.fadeInDuration}
            onChange={(e) => onUpdateTrack({ fadeInDuration: parseFloat(e.target.value) })}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Fade Out</span>
            <span className="text-purple-300">{track.fadeOutDuration.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={track.fadeOutDuration}
            onChange={(e) => onUpdateTrack({ fadeOutDuration: parseFloat(e.target.value) })}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

