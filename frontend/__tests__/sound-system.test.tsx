import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SoundProvider } from "@/lib/sounds/SoundContext";
import { SoundToggle } from "@/components/SoundToggle";
import {
  isSoundEnabled,
  setSoundEnabled,
  SOUND_STORAGE_KEY,
  playUISound,
} from "@/lib/sounds/soundManager";

describe("Web Audio Sound System & SoundToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe("soundManager utility functions", () => {
    it("defaults sound enabled to true when no localStorage item is present", () => {
      expect(isSoundEnabled()).toBe(true);
    });

    it("persists sound disabled state in localStorage", () => {
      setSoundEnabled(false);
      expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe("false");
      expect(isSoundEnabled()).toBe(false);
    });

    it("persists sound enabled state in localStorage", () => {
      setSoundEnabled(true);
      expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe("true");
      expect(isSoundEnabled()).toBe(true);
    });

    it("playUISound does not throw when AudioContext is unavailable or disabled", () => {
      expect(() => {
        playUISound("click");
        playUISound("upload");
        playUISound("success");
        playUISound("error");
        playUISound("download");
        playUISound("toggle");
      }).not.toThrow();

      setSoundEnabled(false);
      expect(() => {
        playUISound("click");
      }).not.toThrow();
    });
  });

  describe("SoundProvider & SoundToggle Component", () => {
    it("renders SoundToggle button with default enabled state (Mute UI sounds)", () => {
      render(
        <SoundProvider>
          <SoundToggle />
        </SoundProvider>
      );

      const button = screen.getByRole("button", { name: /mute ui sounds/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("title", "Mute UI sounds");
    });

    it("toggles sound off on click and updates localStorage", () => {
      render(
        <SoundProvider>
          <SoundToggle />
        </SoundProvider>
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe("false");
      expect(button).toHaveAttribute("aria-label", "Enable UI sounds");

      // Click again to turn back on
      fireEvent.click(button);
      expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe("true");
      expect(button).toHaveAttribute("aria-label", "Mute UI sounds");
    });

    it("restores disabled state from localStorage on mount", () => {
      localStorage.setItem(SOUND_STORAGE_KEY, "false");

      render(
        <SoundProvider>
          <SoundToggle />
        </SoundProvider>
      );

      expect(screen.getByRole("button", { name: /enable ui sounds/i })).toBeInTheDocument();
    });
  });
});

