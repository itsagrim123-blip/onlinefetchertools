"use client";

import { useState } from "react";
import { Shuffle, X, Check } from "lucide-react";
import { ClipTransition, TransitionType } from "../../types";

interface TransitionModalProps {
  initialTransition?: ClipTransition;
  isOpen: boolean;
  onClose: () => void;
  onApply: (transition: ClipTransition | undefined) => void;
}

const TRANSITIONS: { type: TransitionType; label: string; desc: string }[] = [
  { type: "none", label: "Cut (None)", desc: "Instant cut transition without effect" },
  { type: "fade", label: "Fade / Dip to Black", desc: "Smooth black dip fade transition" },
  { type: "dissolve", label: "Dissolve", desc: "Classic optical dissolve blend" },
  { type: "crossfade", label: "Crossfade", desc: "Smooth crossfade blend between video & audio" },
  { type: "slide_left", label: "Slide Left", desc: "Incoming clip slides in from the right" },
  { type: "slide_right", label: "Slide Right", desc: "Incoming clip slides in from the left" },
  { type: "wipe_left", label: "Wipe Left", desc: "Sharp linear wipe reveal from the right" },
  { type: "wipe_right", label: "Wipe Right", desc: "Sharp linear wipe reveal from the left" },
  { type: "zoom", label: "Zoom Cross", desc: "Dynamic zoom transition between clips" },
  { type: "blur", label: "Motion Blur", desc: "High-speed directional blur transition" },
];

export function TransitionModal({
  initialTransition,
  isOpen,
  onClose,
  onApply,
}: TransitionModalProps) {
  const [selectedType, setSelectedType] = useState<TransitionType>(
    initialTransition?.type || "fade"
  );
  const [duration, setDuration] = useState<number>(initialTransition?.duration || 0.5);

  if (!isOpen) return null;

  const handleSave = () => {
    if (selectedType === "none") {
      onApply(undefined);
    } else {
      onApply({
        type: selectedType,
        duration,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Shuffle className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-semibold">Clip Transition</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Transition Types */}
        <div className="space-y-2">
          {TRANSITIONS.map((item) => (
            <button
              key={item.type}
              type="button"
              onClick={() => setSelectedType(item.type)}
              className={`flex items-center justify-between w-full p-3 rounded-xl border text-left transition ${
                selectedType === item.type
                  ? "border-cyan-400 bg-cyan-950/40 text-white ring-1 ring-cyan-400"
                  : "border-white/10 bg-slate-900/60 text-slate-300 hover:bg-white/5"
              }`}
            >
              <div>
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="text-[11px] text-slate-400">{item.desc}</p>
              </div>
              {selectedType === item.type && <Check className="h-4 w-4 text-cyan-400" />}
            </button>
          ))}
        </div>

        {/* Duration Slider */}
        {selectedType !== "none" && (
          <div className="space-y-1.5 pt-2 border-t border-white/10">
            <div className="flex justify-between text-xs text-slate-300">
              <span>Transition Duration</span>
              <span className="font-mono text-cyan-300 font-bold">{duration.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.5"
              step="0.1"
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-9 px-4 rounded-xl bg-cyan-400 text-xs font-semibold text-slate-950 hover:bg-cyan-300 transition"
          >
            Apply Transition
          </button>
        </div>
      </div>
    </div>
  );
}

