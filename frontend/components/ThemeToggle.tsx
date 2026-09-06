"use client";

import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center justify-center h-8 w-8 sm:h-9 sm:w-auto sm:px-1 rounded-full border border-white/10 bg-white/5 text-sm text-slate-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/10 cursor-pointer shrink-0"
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="sm:hidden flex items-center justify-center">
        {theme === "dark" ? (
          <Moon className="h-3.5 w-3.5 text-cyan-300" />
        ) : (
          <SunMedium className="h-3.5 w-3.5 text-amber-500" />
        )}
      </span>
      <span
        className={`hidden sm:flex h-6 w-6 items-center justify-center rounded-full transition-all ${
          theme === "light"
            ? "bg-amber-400/20 text-amber-500 shadow-sm"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        <SunMedium className="h-3.5 w-3.5" />
      </span>
      <span
        className={`hidden sm:flex h-6 w-6 items-center justify-center rounded-full transition-all ${
          theme === "dark"
            ? "bg-cyan-400/20 text-cyan-300 shadow-sm"
            : "text-slate-400 hover:text-slate-600"
        }`}
      >
        <Moon className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

