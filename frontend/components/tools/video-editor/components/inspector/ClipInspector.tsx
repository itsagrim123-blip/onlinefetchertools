import { memo } from "react";
import {
  FastForward,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  Sliders,
  Volume2,
  VolumeX,
  Scissors,
} from "lucide-react";
import { VideoClip } from "../../types";
import { formatTimecode, parseTimecode } from "../../state/projectDefaults";

interface ClipInspectorProps {
  clip: VideoClip;
  onUpdateClip: (partial: Partial<VideoClip>) => void;
}

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 4.0];

export const ClipInspector = memo(function ClipInspector({ clip, onUpdateClip }: ClipInspectorProps) {
  const rotateClockwise = () => {
    const current = clip.rotation || 0;
    const next = (current + 90) % 360;
    onUpdateClip({ rotation: next });
  };

  const rotateCounterClockwise = () => {
    const current = clip.rotation || 0;
    const next = (current - 90 + 360) % 360;
    onUpdateClip({ rotation: next });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-white">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            Clip Settings: <span className="text-white normal-case font-medium">{clip.name}</span>
          </span>
        </div>
      </div>

      {/* Speed & Reverse Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <FastForward className="h-3.5 w-3.5 text-cyan-400" /> Speed
          </label>
          <span className="font-mono text-xs text-cyan-300 font-bold">{clip.speed}x</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SPEED_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onUpdateClip({ speed: preset })}
              className={`h-8 rounded-lg text-xs font-mono font-medium transition ${
                clip.speed === preset
                  ? "bg-cyan-400 text-slate-950 font-bold"
                  : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {preset}x
            </button>
          ))}
        </div>

        {/* Reverse Clip Toggle */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => onUpdateClip({ isReversed: !clip.isReversed })}
            className={`flex items-center justify-between w-full h-9 px-3 rounded-xl border transition text-xs font-medium ${
              clip.isReversed
                ? "border-pink-500/50 bg-pink-500/20 text-pink-300"
                : "border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Reverse Clip (Playback backwards)
            </span>
            <span className="font-mono">{clip.isReversed ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* Video Transforms: Scale, Rotation, Flip */}
      <div className="space-y-2.5 border-t border-white/10 pt-3">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          Transforms & Orientation
        </label>

        {/* Scale Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Scale / Zoom</span>
            <span className="text-cyan-300 font-bold">{Math.round((clip.scale || 1) * 100)}%</span>
          </div>
          <input
            type="range"
            min="50"
            max="200"
            value={Math.round((clip.scale || 1) * 100)}
            onChange={(e) => onUpdateClip({ scale: parseFloat(e.target.value) / 100 })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Rotation and Flip Buttons */}
        <div className="grid grid-cols-4 gap-1.5 pt-1">
          <button
            type="button"
            onClick={rotateCounterClockwise}
            className="flex items-center justify-center gap-1 h-9 rounded-xl border border-white/10 bg-slate-900 text-xs text-slate-300 hover:bg-white/5 transition"
            title="Rotate -90°"
          >
            <RotateCcw className="h-3.5 w-3.5" /> -90°
          </button>
          <button
            type="button"
            onClick={rotateClockwise}
            className="flex items-center justify-center gap-1 h-9 rounded-xl border border-white/10 bg-slate-900 text-xs text-slate-300 hover:bg-white/5 transition"
            title="Rotate +90°"
          >
            <RotateCw className="h-3.5 w-3.5" /> +90°
          </button>
          <button
            type="button"
            onClick={() => onUpdateClip({ flipHorizontal: !clip.flipHorizontal })}
            className={`flex items-center justify-center gap-1 h-9 rounded-xl border transition text-xs ${
              clip.flipHorizontal
                ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                : "border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5"
            }`}
            title="Flip Horizontal"
          >
            <FlipHorizontal className="h-3.5 w-3.5" /> Flip H
          </button>
          <button
            type="button"
            onClick={() => onUpdateClip({ flipVertical: !clip.flipVertical })}
            className={`flex items-center justify-center gap-1 h-9 rounded-xl border transition text-xs ${
              clip.flipVertical
                ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                : "border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5"
            }`}
            title="Flip Vertical"
          >
            <FlipVertical className="h-3.5 w-3.5" /> Flip V
          </button>
        </div>
      </div>

      {/* Audio Controls for Clip */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            {clip.isMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-red-400" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
            )}
            Clip Audio
          </label>
          <button
            type="button"
            onClick={() => onUpdateClip({ isMuted: !clip.isMuted })}
            className={`text-[11px] px-2 py-0.5 rounded-lg font-medium transition ${
              clip.isMuted
                ? "bg-red-400/20 text-red-300 border border-red-400/30"
                : "bg-white/5 text-slate-400 hover:text-white"
            }`}
          >
            {clip.isMuted ? "Muted" : "Mute"}
          </button>
        </div>

        {!clip.isMuted && (
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span>Volume</span>
              <span className="text-cyan-300 font-bold">{Math.round(clip.volume * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="200"
              value={Math.round(clip.volume * 100)}
              onChange={(e) => onUpdateClip({ volume: parseFloat(e.target.value) / 100 })}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* Precise Trim Inputs */}
      <div className="space-y-2 border-t border-white/10 pt-3">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Scissors className="h-3.5 w-3.5 text-cyan-400" /> Precise Trim Boundaries
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400">Start Time</span>
            <input
              type="text"
              defaultValue={formatTimecode(clip.startTrim)}
              onBlur={(e) => {
                const parsed = parseTimecode(e.target.value);
                onUpdateClip({ startTrim: Math.max(0, Math.min(parsed, clip.endTrim - 0.2)) });
              }}
              className="w-full h-8 rounded-lg border border-white/10 bg-slate-900 px-2 font-mono text-xs text-white"
            />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400">End Time</span>
            <input
              type="text"
              defaultValue={formatTimecode(clip.endTrim)}
              onBlur={(e) => {
                const parsed = parseTimecode(e.target.value);
                onUpdateClip({
                  endTrim: Math.max(clip.startTrim + 0.2, Math.min(parsed, clip.sourceDuration)),
                });
              }}
              className="w-full h-8 rounded-lg border border-white/10 bg-slate-900 px-2 font-mono text-xs text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
});
