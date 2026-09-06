"use client";

import { memo } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Crop,
  FastForward,
  FlipHorizontal,
  FlipVertical,
  Italic,
  RotateCcw,
  RotateCw,
  Scissors,
  Sliders,
  Sparkles,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  Layers,
  Camera,
  Move,
} from "lucide-react";
import {
  AspectRatioPreset,
  AudioTrackItem,
  ClipPropertyTab,
  OverlayLayerItem,
  TextAnimationType,
  TextLayerItem,
  VideoClip,
  VideoProject,
} from "../types";
import { formatTimecode } from "../state/projectDefaults";

interface RightPropertiesPanelProps {
  project?: VideoProject;
  selectedClip?: VideoClip;
  selectedAudio?: AudioTrackItem;
  selectedText?: TextLayerItem;
  selectedOverlay?: OverlayLayerItem;
  clipTab?: ClipPropertyTab;
  activeTab?: ClipPropertyTab;
  onSelectClipTab?: (tab: ClipPropertyTab) => void;
  onTabChange?: (tab: ClipPropertyTab) => void;
  onUpdateClip: (partial: Partial<VideoClip>) => void;
  onUpdateAudio: (partial: Partial<AudioTrackItem>) => void;
  onRemoveAudio?: () => void;
  onUpdateText: (partial: Partial<TextLayerItem>) => void;
  onRemoveText?: () => void;
  onUpdateOverlay: (partial: Partial<OverlayLayerItem>) => void;
  onRemoveOverlay?: () => void;
  onSetAspectRatio?: (ratio: AspectRatioPreset) => void;
  onDeleteSelected?: () => void;
  onReverseClip?: () => void;
  onFreezeFrame?: () => void;
  onExtractAudio?: (clipId: string) => void;
  onDuplicateSelected?: () => void;
}

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 4.0];
const COLOR_PRESETS = ["#ffffff", "#facc15", "#22d3ee", "#f43f5e", "#4ade80", "#a855f7", "#fb923c", "#0f172a"];
const FONT_FAMILIES = [
  "Arial",
  "Inter",
  "Roboto",
  "Impact",
  "Georgia",
  "Courier New",
  "Times New Roman",
  "Trebuchet MS",
];

const ANIMATIONS: { id: TextAnimationType; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "slide_bottom", label: "Slide Up" },
  { id: "slide_top", label: "Slide Down" },
  { id: "slide_left", label: "Slide Left" },
  { id: "slide_right", label: "Slide Right" },
  { id: "scale_up", label: "Pop" },
];

const VOICE_EFFECTS = [
  { id: "none", label: "Normal" },
  { id: "deep", label: "Deep / Male" },
  { id: "high", label: "High / Chipmunk" },
  { id: "robot", label: "Robot" },
  { id: "echo", label: "Echo / Reverb" },
  { id: "radio", label: "Radio Vintage" },
] as const;

const BLEND_MODES = [
  { id: "normal", label: "Normal" },
  { id: "multiply", label: "Multiply" },
  { id: "screen", label: "Screen" },
  { id: "overlay", label: "Overlay" },
  { id: "darken", label: "Darken" },
  { id: "lighten", label: "Lighten" },
] as const;

export const RightPropertiesPanel = memo(function RightPropertiesPanel({
  project,
  selectedClip,
  selectedAudio,
  selectedText,
  selectedOverlay,
  clipTab,
  activeTab,
  onSelectClipTab,
  onTabChange,
  onUpdateClip,
  onUpdateAudio,
  onRemoveAudio,
  onUpdateText,
  onRemoveText,
  onUpdateOverlay,
  onRemoveOverlay,
  onSetAspectRatio,
  onDeleteSelected,
  onReverseClip,
  onFreezeFrame,
  onExtractAudio,
  onDuplicateSelected,
}: RightPropertiesPanelProps) {
  const currentTab: ClipPropertyTab = clipTab || activeTab || "video";
  const handleSelectTab = onSelectClipTab || onTabChange || (() => {});
  const handleRemoveText = onRemoveText || onDeleteSelected || (() => {});
  const handleRemoveAudio = onRemoveAudio || onDeleteSelected || (() => {});
  const handleRemoveOverlay = onRemoveOverlay || onDeleteSelected || (() => {});
  const handleDeleteClip = onDeleteSelected || (() => {});
  // If Text is selected
  if (selectedText) {
    return (
      <div className="w-80 shrink-0 bg-slate-950/80 border-l border-white/10 flex flex-col h-full p-4 overflow-y-auto space-y-4 select-none text-white">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Text Properties</h3>
          </div>
          <button
            type="button"
            onClick={onRemoveText}
            className="p-1.5 rounded-lg border border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Text Content</label>
          <textarea
            rows={2}
            value={selectedText.text}
            onChange={(e) => onUpdateText({ text: e.target.value })}
            className="w-full rounded-xl border border-white/10 bg-slate-900 p-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
          />
        </div>

        {/* Font Family Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-300">Font Family</label>
          <select
            value={selectedText.fontFamily || "Arial"}
            onChange={(e) => onUpdateText({ fontFamily: e.target.value })}
            className="w-full h-8 rounded-xl border border-white/10 bg-slate-900 px-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none"
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Font Size</span>
            <span className="text-xs font-mono text-cyan-300 font-bold">{selectedText.fontSize}px</span>
          </div>
          <input
            type="range"
            min="14"
            max="96"
            value={selectedText.fontSize}
            onChange={(e) => onUpdateText({ fontSize: parseInt(e.target.value) || 28 })}
            className="w-full accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* Style & Alignment */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/10">
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10">
            <button
              type="button"
              onClick={() => onUpdateText({ isBold: !selectedText.isBold })}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition ${
                selectedText.isBold ? "bg-cyan-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onUpdateText({ isItalic: !selectedText.isItalic })}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition ${
                selectedText.isItalic ? "bg-cyan-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
              }`}
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-white/10">
            {(["left", "center", "right"] as const).map((align) => {
              const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
              return (
                <button
                  key={align}
                  type="button"
                  onClick={() => onUpdateText({ alignment: align })}
                  className={`h-7 w-7 flex items-center justify-center rounded-lg transition ${
                    selectedText.alignment === align
                      ? "bg-cyan-400 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={`Align ${align}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Text Colors */}
        <div className="space-y-1.5 pt-1 border-t border-white/10">
          <label className="text-xs text-slate-300">Text Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onUpdateText({ fontColor: color })}
                style={{ backgroundColor: color }}
                className={`h-6 w-6 rounded-full border transition ${
                  selectedText.fontColor.toLowerCase() === color.toLowerCase()
                    ? "border-cyan-400 ring-2 ring-cyan-400/50 scale-110"
                    : "border-white/20 hover:scale-105"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Text Stroke / Outline */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">Text Stroke / Border</span>
            <span className="text-xs font-mono text-cyan-300">{selectedText.strokeWidth || 0}px</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="0"
              max="8"
              value={selectedText.strokeWidth || 0}
              onChange={(e) => onUpdateText({ strokeWidth: parseInt(e.target.value) || 0 })}
              className="flex-1 accent-cyan-400 cursor-pointer"
            />
            {(selectedText.strokeWidth || 0) > 0 && (
              <input
                type="color"
                value={selectedText.strokeColor || "#000000"}
                onChange={(e) => onUpdateText({ strokeColor: e.target.value })}
                className="h-6 w-6 rounded cursor-pointer border border-white/20 bg-transparent"
                title="Stroke Color"
              />
            )}
          </div>
        </div>

        {/* Animation */}
        <div className="space-y-1.5 pt-2 border-t border-white/10">
          <label className="text-xs text-slate-300">Text Animation</label>
          <div className="grid grid-cols-2 gap-1.5">
            {ANIMATIONS.map((anim) => (
              <button
                key={anim.id}
                type="button"
                onClick={() => onUpdateText({ animation: anim.id })}
                className={`h-8 rounded-lg text-xs font-medium transition ${
                  selectedText.animation === anim.id
                    ? "bg-cyan-400 text-slate-950 font-bold shadow-md shadow-cyan-950/30"
                    : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {anim.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duplicate Action */}
        {onDuplicateSelected && (
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onDuplicateSelected}
              className="flex items-center justify-center gap-1.5 w-full h-8 px-3 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10 transition"
            >
              Duplicate Text Layer
            </button>
          </div>
        )}
      </div>
    );
  }

  // If Audio is selected
  if (selectedAudio) {
    return (
      <div className="w-80 shrink-0 bg-slate-950/80 border-l border-white/10 flex flex-col h-full p-4 overflow-y-auto space-y-4 select-none text-white">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-purple-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300">Audio Track</h3>
          </div>
          <button
            type="button"
            onClick={handleRemoveAudio}
            className="p-1.5 rounded-lg border border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-xs font-semibold text-white truncate">{selectedAudio.name}</p>

        {/* Volume */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-300">Volume</label>
            <span className="text-xs font-mono text-purple-300 font-bold">
              {Math.round(selectedAudio.volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="200"
            value={Math.round(selectedAudio.volume * 100)}
            onChange={(e) => onUpdateAudio({ volume: parseFloat(e.target.value) / 100 })}
            className="w-full accent-purple-400 cursor-pointer"
          />
        </div>

        {/* Fades */}
        <div className="space-y-3 pt-2 border-t border-white/10">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Fade In</span>
              <span className="text-purple-300 font-mono">{selectedAudio.fadeInDuration.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={selectedAudio.fadeInDuration}
              onChange={(e) => onUpdateAudio({ fadeInDuration: parseFloat(e.target.value) })}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Fade Out</span>
              <span className="text-purple-300 font-mono">{selectedAudio.fadeOutDuration.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={selectedAudio.fadeOutDuration}
              onChange={(e) => onUpdateAudio({ fadeOutDuration: parseFloat(e.target.value) })}
              className="w-full accent-purple-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Voice Effects Section */}
        <div className="space-y-1.5 pt-2 border-t border-white/10">
          <label className="text-xs text-slate-300">Voice Effect Preset</label>
          <div className="grid grid-cols-2 gap-1.5">
            {VOICE_EFFECTS.map((fx) => (
              <button
                key={fx.id}
                type="button"
                onClick={() => onUpdateAudio({ voiceEffect: fx.id })}
                className={`h-8 rounded-lg text-xs font-medium transition ${
                  (selectedAudio.voiceEffect || "none") === fx.id
                    ? "bg-purple-500 text-white font-bold shadow-md shadow-purple-950/30"
                    : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {fx.label}
              </button>
            ))}
          </div>
        </div>

        {/* Noise Reduction Toggle */}
        <div className="pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={() => onUpdateAudio({ noiseReduction: !selectedAudio.noiseReduction })}
            className={`flex items-center justify-between w-full h-9 px-3 rounded-xl border text-xs font-medium transition ${
              selectedAudio.noiseReduction
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                : "border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5"
            }`}
          >
            <span>AI Noise Reduction (Denoise)</span>
            <span className="font-mono">{selectedAudio.noiseReduction ? "ON" : "OFF"}</span>
          </button>
        </div>

        {/* Duplicate Action */}
        {onDuplicateSelected && (
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onDuplicateSelected}
              className="flex items-center justify-center gap-1.5 w-full h-8 px-3 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10 transition"
            >
              Duplicate Audio Track
            </button>
          </div>
        )}
      </div>
    );
  }

  // If Overlay / Sticker is selected
  if (selectedOverlay) {
    return (
      <div className="w-80 shrink-0 bg-slate-950/80 border-l border-white/10 flex flex-col h-full p-4 overflow-y-auto space-y-4 select-none text-white">
        <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">Overlay Properties</h3>
          </div>
          <button
            type="button"
            onClick={handleRemoveOverlay}
            className="p-1.5 rounded-lg border border-red-400/20 bg-red-400/10 text-red-400 hover:bg-red-400/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <p className="text-xs font-semibold text-white truncate">{selectedOverlay.name}</p>

        {/* Drag Hint Banner */}
        <div className="p-2.5 rounded-xl border border-amber-400/20 bg-amber-400/10 text-xs text-amber-200/90 flex items-start gap-2">
          <Move className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>Click and drag this sticker directly on the video preview screen to place it anywhere!</span>
        </div>

        {/* Blend Mode Selector */}
        <div className="space-y-1.5">
          <label className="text-xs text-slate-300">Blend Mode</label>
          <div className="grid grid-cols-3 gap-1">
            {BLEND_MODES.map((bm) => (
              <button
                key={bm.id}
                type="button"
                onClick={() => onUpdateOverlay({ blendMode: bm.id })}
                className={`h-7 rounded-lg text-[11px] font-medium transition ${
                  (selectedOverlay.blendMode || "normal") === bm.id
                    ? "bg-amber-400 text-slate-950 font-bold"
                    : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                }`}
              >
                {bm.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scale */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Scale</span>
            <span className="text-amber-300 font-mono">{Math.round(selectedOverlay.scale * 100)}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="150"
            value={Math.round(selectedOverlay.scale * 100)}
            onChange={(e) => onUpdateOverlay({ scale: parseFloat(e.target.value) / 100 })}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Opacity */}
        <div className="space-y-1 pt-2 border-t border-white/10">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Opacity</span>
            <span className="text-amber-300 font-mono">{Math.round(selectedOverlay.opacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={Math.round(selectedOverlay.opacity * 100)}
            onChange={(e) => onUpdateOverlay({ opacity: parseFloat(e.target.value) / 100 })}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Position Controls */}
        <div className="space-y-2.5 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-300 font-medium">Position Coordinates</label>
            <span className="text-[11px] font-mono text-amber-300">
              {Math.round(selectedOverlay.positionX)}%, {Math.round(selectedOverlay.positionY)}%
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Horizontal (X)</span>
              <span>{Math.round(selectedOverlay.positionX)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(selectedOverlay.positionX)}
              onChange={(e) => onUpdateOverlay({ positionX: parseFloat(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>Vertical (Y)</span>
              <span>{Math.round(selectedOverlay.positionY)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={Math.round(selectedOverlay.positionY)}
              onChange={(e) => onUpdateOverlay({ positionY: parseFloat(e.target.value) })}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Quick Position Presets */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            <button
              type="button"
              onClick={() => onUpdateOverlay({ positionX: 20, positionY: 20 })}
              className="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] text-slate-300 hover:text-white hover:border-amber-400/40"
            >
              Top-Left
            </button>
            <button
              type="button"
              onClick={() => onUpdateOverlay({ positionX: 50, positionY: 20 })}
              className="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] text-slate-300 hover:text-white hover:border-amber-400/40"
            >
              Top-Center
            </button>
            <button
              type="button"
              onClick={() => onUpdateOverlay({ positionX: 80, positionY: 20 })}
              className="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] text-slate-300 hover:text-white hover:border-amber-400/40"
            >
              Top-Right
            </button>
            <button
              type="button"
              onClick={() => onUpdateOverlay({ positionX: 20, positionY: 80 })}
              className="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] text-slate-300 hover:text-white hover:border-amber-400/40"
            >
              Bottom-Left
            </button>
            <button
              type="button"
              onClick={() => onUpdateOverlay({ positionX: 50, positionY: 50 })}
              className="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] text-amber-300 font-semibold hover:border-amber-400/40"
            >
              Center
            </button>
            <button
              type="button"
              onClick={() => onUpdateOverlay({ positionX: 80, positionY: 80 })}
              className="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] text-slate-300 hover:text-white hover:border-amber-400/40"
            >
              Bottom-Right
            </button>
          </div>
        </div>

        {/* Rotation */}
        <div className="space-y-1 pt-2 border-t border-white/10">
          <div className="flex justify-between text-xs text-slate-300">
            <span>Rotation</span>
            <span className="text-amber-300 font-mono">{selectedOverlay.rotation}°</span>
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="5"
            value={selectedOverlay.rotation}
            onChange={(e) => onUpdateOverlay({ rotation: parseInt(e.target.value) })}
            className="w-full accent-amber-400 cursor-pointer"
          />
        </div>

        {/* Duplicate Action */}
        {onDuplicateSelected && (
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onDuplicateSelected}
              className="flex items-center justify-center gap-1.5 w-full h-8 px-3 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10 transition"
            >
              Duplicate Overlay Layer
            </button>
          </div>
        )}
      </div>
    );
  }

  // If Main Clip is selected
  if (selectedClip) {
    return (
      <div className="w-80 shrink-0 bg-slate-950/80 border-l border-white/10 flex flex-col h-full overflow-y-auto select-none text-white">
        {/* Top contextual tabs: Video, Audio, Speed, Adjust */}
        <div className="flex items-center justify-between border-b border-white/10 px-3 pt-3">
          {(["video", "audio", "speed", "adjust"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleSelectTab(tab)}
              className={`pb-2.5 text-xs font-semibold capitalize transition relative ${
                currentTab === tab ? "text-cyan-300" : "text-slate-400 hover:text-white"
              }`}
            >
              {tab}
              {currentTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4 flex-1">
          {/* --- VIDEO SUB-TAB --- */}
          {currentTab === "video" && (
            <>
              {/* Transform Section matching reference image */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-200">Transform</h4>

                {/* Position X / Y */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-400">Position</span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-lg px-2 py-1">
                      <span className="text-[10px] text-slate-500 font-mono">X</span>
                      <input
                        type="number"
                        value={selectedClip.offsetX || 0}
                        onChange={(e) => onUpdateClip({ offsetX: parseInt(e.target.value) || 0 })}
                        className="w-10 bg-transparent text-center font-mono text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1 bg-slate-900 border border-white/10 rounded-lg px-2 py-1">
                      <span className="text-[10px] text-slate-500 font-mono">Y</span>
                      <input
                        type="number"
                        value={selectedClip.offsetY || 0}
                        onChange={(e) => onUpdateClip({ offsetY: parseInt(e.target.value) || 0 })}
                        className="w-10 bg-transparent text-center font-mono text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Scale Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Scale</span>
                    <span className="text-cyan-300 font-mono font-bold">
                      {Math.round((selectedClip.scale || 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="300"
                    value={Math.round((selectedClip.scale || 1) * 100)}
                    onChange={(e) => onUpdateClip({ scale: parseFloat(e.target.value) / 100 })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                {/* Rotate Slider & Quick 90° */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Rotation</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-cyan-300 font-bold bg-slate-900 px-2 py-0.5 rounded-lg border border-white/10">
                        {selectedClip.rotation || 0}°
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateClip({ rotation: ((selectedClip.rotation || 0) + 90) % 360 })}
                        className="p-1 rounded-lg border border-white/10 bg-slate-900 hover:bg-white/5"
                        title="Rotate 90°"
                      >
                        <RotateCw className="h-3 w-3 text-slate-300" />
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={selectedClip.rotation || 0}
                    onChange={(e) => onUpdateClip({ rotation: parseInt(e.target.value) || 0 })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400">Flip</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateClip({ flipHorizontal: !selectedClip.flipHorizontal })}
                      className={`h-7 px-2.5 rounded-lg border transition text-xs flex items-center gap-1 ${
                        selectedClip.flipHorizontal
                          ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                          : "border-white/10 bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      <FlipHorizontal className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateClip({ flipVertical: !selectedClip.flipVertical })}
                      className={`h-7 px-2.5 rounded-lg border transition text-xs flex items-center gap-1 ${
                        selectedClip.flipVertical
                          ? "border-cyan-400 bg-cyan-400/20 text-cyan-300"
                          : "border-white/10 bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      <FlipVertical className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Crop Section matching reference image */}
              <div className="space-y-2 pt-3 border-t border-white/10">
                <h4 className="text-xs font-semibold text-slate-200">Crop</h4>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedClip.cropPreset || "original"}
                    onChange={(e) => onUpdateClip({ cropPreset: e.target.value as VideoClip["cropPreset"] })}
                    className="flex-1 h-9 rounded-xl border border-white/10 bg-slate-900 px-3 text-xs text-white focus:outline-none"
                  >
                    <option value="original">Original</option>
                    <option value="16:9">16:9 Landscape</option>
                    <option value="9:16">9:16 Portrait</option>
                    <option value="1:1">1:1 Square</option>
                    <option value="4:5">4:5 Vertical</option>
                  </select>
                </div>
              </div>

              {/* Aspect Ratio Presets matching reference image */}
              <div className="space-y-2 pt-3 border-t border-white/10">
                <h4 className="text-xs font-semibold text-slate-200">Aspect Ratio</h4>
                <div className="grid grid-cols-4 gap-1.5">
                  {(["16:9", "9:16", "1:1", "4:5"] as AspectRatioPreset[]).map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      onClick={() => onSetAspectRatio?.(ratio)}
                      className={`h-8 rounded-lg text-xs font-semibold transition ${
                        project?.settings?.aspectRatio === ratio
                          ? "border border-cyan-400 bg-cyan-950/50 text-cyan-300 ring-1 ring-cyan-400"
                          : "border border-white/10 bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opacity Slider */}
              <div className="space-y-1.5 pt-3 border-t border-white/10">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Opacity</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {Math.round((selectedClip.opacity ?? 1) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round((selectedClip.opacity ?? 1) * 100)}
                  onChange={(e) => onUpdateClip({ opacity: parseFloat(e.target.value) / 100 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </>
          )}

          {/* --- AUDIO SUB-TAB --- */}
          {currentTab === "audio" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Volume</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-cyan-300 font-bold">
                      {Math.round(selectedClip.volume * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => onUpdateClip({ isMuted: !selectedClip.isMuted })}
                      className={`text-[10px] px-2 py-0.5 rounded-md ${
                        selectedClip.isMuted ? "bg-red-500/20 text-red-300" : "bg-white/5 text-slate-400"
                      }`}
                    >
                      {selectedClip.isMuted ? "Muted" : "Mute"}
                    </button>
                  </div>
                </div>
                {!selectedClip.isMuted && (
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={Math.round(selectedClip.volume * 100)}
                    onChange={(e) => onUpdateClip({ volume: parseFloat(e.target.value) / 100 })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                )}
              </div>

              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Fade In</span>
                    <span className="text-cyan-300 font-mono">{selectedClip.fadeInDuration.toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.5"
                    value={selectedClip.fadeInDuration}
                    onChange={(e) => onUpdateClip({ fadeInDuration: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Fade Out</span>
                    <span className="text-cyan-300 font-mono">{selectedClip.fadeOutDuration.toFixed(1)}s</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.5"
                    value={selectedClip.fadeOutDuration}
                    onChange={(e) => onUpdateClip({ fadeOutDuration: parseFloat(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              {/* Extract Audio Button */}
              {onExtractAudio && selectedClip.type === "video" && (
                <div className="pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => onExtractAudio(selectedClip.id)}
                    className="flex items-center justify-center gap-1.5 w-full h-9 px-3 rounded-xl border border-purple-400/30 bg-purple-500/10 hover:bg-purple-500/20 text-xs font-semibold text-purple-200 transition"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-purple-400" />
                    Separate Audio to Timeline Track
                  </button>
                </div>
              )}
            </div>
          )}

          {/* --- SPEED SUB-TAB --- */}
          {currentTab === "speed" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300">Playback Speed</span>
                  <span className="font-mono text-xs text-cyan-300 font-bold">{selectedClip.speed}x</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {SPEED_PRESETS.map((sp) => (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => onUpdateClip({ speed: sp })}
                      className={`h-8 rounded-lg text-xs font-mono font-medium transition ${
                        selectedClip.speed === sp
                          ? "bg-cyan-400 text-slate-950 font-bold"
                          : "bg-slate-900 border border-white/10 text-slate-400 hover:text-white"
                      }`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Speed Slider */}
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Custom Speed</span>
                  <span className="text-cyan-300 font-mono font-bold">{selectedClip.speed.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="4.0"
                  step="0.05"
                  value={selectedClip.speed}
                  onChange={(e) => onUpdateClip({ speed: parseFloat(e.target.value) || 1.0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Reverse & Freeze Frame */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => onUpdateClip({ isReversed: !selectedClip.isReversed })}
                  className={`flex items-center justify-between w-full h-9 px-3 rounded-xl border text-xs font-medium transition ${
                    selectedClip.isReversed
                      ? "border-pink-500/50 bg-pink-500/20 text-pink-300"
                      : "border-white/10 bg-slate-900 text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <RotateCcw className="h-3.5 w-3.5" /> Reverse Clip
                  </span>
                  <span className="font-mono">{selectedClip.isReversed ? "ON" : "OFF"}</span>
                </button>

                {onFreezeFrame && (
                  <button
                    type="button"
                    onClick={onFreezeFrame}
                    className="flex items-center justify-center gap-1.5 w-full h-9 px-3 rounded-xl border border-white/10 bg-slate-900 text-xs text-slate-300 hover:bg-white/5 hover:text-white transition"
                  >
                    <Camera className="h-3.5 w-3.5 text-cyan-400" /> Insert Freeze Frame (3s)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* --- ADJUST SUB-TAB --- */}
          {currentTab === "adjust" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between pb-1 border-b border-white/10">
                <span className="text-xs font-semibold text-slate-300">Color Adjustments</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateClip({
                      brightness: 0,
                      contrast: 0,
                      saturation: 0,
                      exposure: 0,
                      temperature: 0,
                      tint: 0,
                      highlights: 0,
                      shadows: 0,
                      vignette: 0,
                      grain: 0,
                    })
                  }
                  className="text-[11px] text-slate-400 hover:text-cyan-300"
                >
                  Reset All
                </button>
              </div>

              {/* Exposure */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Exposure</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {(selectedClip.exposure || 0) > 0 ? `+${selectedClip.exposure}` : selectedClip.exposure || 0}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={selectedClip.exposure || 0}
                  onChange={(e) => onUpdateClip({ exposure: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Brightness */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Brightness</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {selectedClip.brightness > 0 ? `+${selectedClip.brightness}` : selectedClip.brightness}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={selectedClip.brightness}
                  onChange={(e) => onUpdateClip({ brightness: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Contrast</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {selectedClip.contrast > 0 ? `+${selectedClip.contrast}` : selectedClip.contrast}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={selectedClip.contrast}
                  onChange={(e) => onUpdateClip({ contrast: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Saturation */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Saturation</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {selectedClip.saturation > 0 ? `+${selectedClip.saturation}` : selectedClip.saturation}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={selectedClip.saturation}
                  onChange={(e) => onUpdateClip({ saturation: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Temperature */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Temperature (Cool / Warm)</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {(selectedClip.temperature || 0) > 0 ? `+${selectedClip.temperature}` : selectedClip.temperature || 0}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={selectedClip.temperature || 0}
                  onChange={(e) => onUpdateClip({ temperature: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Tint */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Tint (Green / Magenta)</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {(selectedClip.tint || 0) > 0 ? `+${selectedClip.tint}` : selectedClip.tint || 0}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={selectedClip.tint || 0}
                  onChange={(e) => onUpdateClip({ tint: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Highlights */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Highlights</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {(selectedClip.highlights || 0) > 0 ? `+${selectedClip.highlights}` : selectedClip.highlights || 0}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={selectedClip.highlights || 0}
                  onChange={(e) => onUpdateClip({ highlights: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Shadows */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Shadows</span>
                  <span className="text-cyan-300 font-mono font-bold">
                    {(selectedClip.shadows || 0) > 0 ? `+${selectedClip.shadows}` : selectedClip.shadows || 0}
                  </span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={selectedClip.shadows || 0}
                  onChange={(e) => onUpdateClip({ shadows: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Vignette */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Vignette</span>
                  <span className="text-cyan-300 font-mono font-bold">{selectedClip.vignette || 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedClip.vignette || 0}
                  onChange={(e) => onUpdateClip({ vignette: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              {/* Grain */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Film Grain</span>
                  <span className="text-cyan-300 font-mono font-bold">{selectedClip.grain || 0}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={selectedClip.grain || 0}
                  onChange={(e) => onUpdateClip({ grain: parseInt(e.target.value) || 0 })}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Nothing selected: Default project summary
  return (
    <div className="w-80 shrink-0 bg-slate-950/80 border-l border-white/10 flex flex-col items-center justify-center p-6 text-center text-slate-500 select-none">
      <Sliders className="h-8 w-8 text-slate-700 mb-2" />
      <p className="text-xs font-semibold text-slate-300">No Element Selected</p>
      <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
        Select any clip, text layer, or audio track on the timeline to edit properties.
      </p>
    </div>
  );
});
