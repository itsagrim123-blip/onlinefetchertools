import { memo } from "react";
import { Sparkles, Sliders, RotateCcw } from "lucide-react";
import { VideoClip } from "../../types";

interface FilterInspectorProps {
  clip: VideoClip;
  onUpdateClip: (partial: Partial<VideoClip>) => void;
}

const FILTER_PRESETS = [
  { id: "original", label: "Original" },
  { id: "warm", label: "Warm" },
  { id: "cool", label: "Cool" },
  { id: "vintage", label: "Vintage" },
  { id: "bw", label: "B&W" },
  { id: "fade", label: "Fade" },
  { id: "bright", label: "Bright" },
  { id: "contrast", label: "Contrast" },
];

export const FilterInspector = memo(function FilterInspector({ clip, onUpdateClip }: FilterInspectorProps) {
  const handleReset = () => {
    onUpdateClip({
      filterPreset: "original",
      brightness: 0,
      contrast: 0,
      saturation: 0,
    });
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            Filters & Color Adjustments
          </span>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      {/* Preset Filters Grid */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300">Preset Filters</label>
        <div className="grid grid-cols-4 gap-1.5">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onUpdateClip({ filterPreset: preset.id })}
              className={`h-8 rounded-lg text-xs font-medium transition ${
                clip.filterPreset === preset.id
                  ? "bg-emerald-400 text-slate-950 font-bold"
                  : "bg-slate-900 border border-white/10 text-slate-300 hover:bg-white/5"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Sliders */}
      <div className="space-y-3 border-t border-white/10 pt-3">
        <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-emerald-400" /> Adjustments
        </label>

        {/* Brightness */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Brightness</span>
            <span className="text-emerald-300 font-bold">{clip.brightness > 0 ? `+${clip.brightness}` : clip.brightness}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={clip.brightness}
            onChange={(e) => onUpdateClip({ brightness: parseInt(e.target.value) || 0 })}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>

        {/* Contrast */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Contrast</span>
            <span className="text-emerald-300 font-bold">{clip.contrast > 0 ? `+${clip.contrast}` : clip.contrast}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={clip.contrast}
            onChange={(e) => onUpdateClip({ contrast: parseInt(e.target.value) || 0 })}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>

        {/* Saturation */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>Saturation</span>
            <span className="text-emerald-300 font-bold">{clip.saturation > 0 ? `+${clip.saturation}` : clip.saturation}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={clip.saturation}
            onChange={(e) => onUpdateClip({ saturation: parseInt(e.target.value) || 0 })}
            className="w-full accent-emerald-400 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
});

