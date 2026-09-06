"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { TextAnimationType, TextLayerItem } from "../../types";

interface TextInspectorProps {
  layer: TextLayerItem;
  onUpdateLayer: (partial: Partial<TextLayerItem>) => void;
  onRemoveLayer: () => void;
}

const COLOR_PRESETS = [
  "#ffffff",
  "#facc15", // yellow
  "#22d3ee", // cyan
  "#f43f5e", // rose
  "#4ade80", // green
  "#0f172a", // slate 900
];

const ANIMATION_OPTIONS: { id: TextAnimationType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "slide_bottom", label: "Slide Up" },
  { id: "scale_up", label: "Pop / Scale" },
];

export function TextInspector({
  layer,
  onUpdateLayer,
  onRemoveLayer,
}: TextInspectorProps) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <Type className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
            Text & Captions
          </span>
        </div>
        <button
          type="button"
          onClick={onRemoveLayer}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20"
          title="Delete text layer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Text Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-300">Text Content</label>
        <textarea
          rows={2}
          value={layer.text}
          onChange={(e) => onUpdateLayer({ text: e.target.value })}
          placeholder="Enter title, caption, or subtitle..."
          className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-xs text-white placeholder:text-slate-600 focus:border-cyan-400 focus:outline-none"
        />
      </div>

      {/* Font Styling & Alignment */}
      <div className="space-y-3 border-t border-white/10 pt-3">
        <div className="flex items-center justify-between gap-2">
          {/* Bold & Italic */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => onUpdateLayer({ isBold: !layer.isBold })}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition ${
                layer.isBold ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onUpdateLayer({ isItalic: !layer.isItalic })}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition ${
                layer.isItalic ? "bg-cyan-400 text-slate-950" : "text-slate-400 hover:text-white"
              }`}
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Alignment */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => onUpdateLayer({ alignment: "left" })}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition ${
                layer.alignment === "left"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onUpdateLayer({ alignment: "center" })}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition ${
                layer.alignment === "center"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onUpdateLayer({ alignment: "right" })}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition ${
                layer.alignment === "right"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Font Size */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 font-mono">Size:</span>
            <input
              type="number"
              min="12"
              max="72"
              value={layer.fontSize}
              onChange={(e) => onUpdateLayer({ fontSize: parseInt(e.target.value) || 24 })}
              className="w-14 h-8 rounded-lg border border-white/10 bg-slate-900 text-center font-mono text-xs text-white"
            />
          </div>
        </div>

        {/* Color Presets */}
        <div className="space-y-1">
          <label className="text-[11px] text-slate-400">Text Color</label>
          <div className="flex items-center gap-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onUpdateLayer({ fontColor: color })}
                style={{ backgroundColor: color }}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  layer.fontColor.toLowerCase() === color.toLowerCase()
                    ? "border-cyan-400 scale-110 shadow"
                    : "border-white/20 hover:scale-105"
                }`}
              />
            ))}
            <input
              type="color"
              value={layer.fontColor}
              onChange={(e) => onUpdateLayer({ fontColor: e.target.value })}
              className="h-7 w-7 rounded-lg border border-white/10 bg-transparent cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Animation & Position Presets */}
      <div className="space-y-3 border-t border-white/10 pt-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" /> Entrance Animation
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {ANIMATION_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdateLayer({ animation: opt.id })}
                className={`h-8 rounded-lg text-xs font-medium transition ${
                  layer.animation === opt.id
                    ? "bg-cyan-400 text-slate-950 font-bold"
                    : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Position Presets */}
        <div className="space-y-1.5">
          <label className="text-[11px] text-slate-400">Position Preset</label>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => onUpdateLayer({ positionX: 50, positionY: 18 })}
              className="h-7 rounded-lg border border-white/10 bg-slate-900 text-xs text-slate-300 hover:bg-white/5"
            >
              Top Header
            </button>
            <button
              type="button"
              onClick={() => onUpdateLayer({ positionX: 50, positionY: 50 })}
              className="h-7 rounded-lg border border-white/10 bg-slate-900 text-xs text-slate-300 hover:bg-white/5"
            >
              Center
            </button>
            <button
              type="button"
              onClick={() => onUpdateLayer({ positionX: 50, positionY: 82 })}
              className="h-7 rounded-lg border border-white/10 bg-slate-900 text-xs text-slate-300 hover:bg-white/5"
            >
              Bottom Subtitle
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

