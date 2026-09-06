"use client";

import { useUISoundContext } from "./SoundContext";
import { UISoundType } from "./soundManager";

export function useUISound() {
  const { soundEnabled, toggleSound, playSound } = useUISoundContext();

  return {
    soundEnabled,
    toggleSound,
    playSound,
    playClick: () => playSound("click"),
    playUpload: () => playSound("upload"),
    playSuccess: () => playSound("success"),
    playError: () => playSound("error"),
    playDownload: () => playSound("download"),
    playToggle: () => playSound("toggle"),
  };
}

export type { UISoundType };

