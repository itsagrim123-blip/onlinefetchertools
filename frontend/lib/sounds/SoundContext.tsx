"use client";

import React, { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import {
  isSoundEnabled,
  playUISound,
  setSoundEnabled,
  subscribeSoundEnabled,
  UISoundType,
} from "./soundManager";

interface SoundContextValue {
  soundEnabled: boolean;
  toggleSound: () => void;
  playSound: (type: UISoundType) => void;
}

const SoundContext = createContext<SoundContextValue>({
  soundEnabled: true,
  toggleSound: () => {},
  playSound: () => {},
});

const getServerSnapshot = () => true;

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const soundEnabled = useSyncExternalStore(
    subscribeSoundEnabled,
    isSoundEnabled,
    getServerSnapshot
  );

  const toggleSound = useCallback(() => {
    const next = !isSoundEnabled();
    setSoundEnabled(next);
    if (next) {
      // Subtle confirmation sound when turning sounds on
      playUISound("toggle");
    }
  }, []);

  const playSound = useCallback(
    (type: UISoundType) => {
      if (soundEnabled) {
        playUISound(type);
      }
    },
    [soundEnabled]
  );

  return (
    <SoundContext.Provider value={{ soundEnabled, toggleSound, playSound }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useUISoundContext(): SoundContextValue {
  return useContext(SoundContext);
}
