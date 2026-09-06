"use client";

import {
  Film,
  Music,
  Type,
  Smile,
  Sparkles,
  Wand2,
  Shuffle,
  Subtitles,
  Settings,
} from "lucide-react";
import { SidebarTab } from "../types";

interface EditorSidebarProps {
  activeTab: SidebarTab;
  onSelectTab: (tab: SidebarTab) => void;
}

const SIDEBAR_ITEMS: { id: SidebarTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "media", label: "Media", icon: Film },
  { id: "audio", label: "Audio", icon: Music },
  { id: "text", label: "Text", icon: Type },
  { id: "stickers", label: "Stickers", icon: Smile },
  { id: "filters", label: "Filters", icon: Sparkles },
  { id: "effects", label: "Effects", icon: Wand2 },
  { id: "transitions", label: "Transitions", icon: Shuffle },
  { id: "captions", label: "Captions", icon: Subtitles },
  { id: "settings", label: "Settings", icon: Settings },
];

export function EditorSidebar({ activeTab, onSelectTab }: EditorSidebarProps) {
  return (
    <aside className="w-20 shrink-0 bg-slate-950/90 border-r border-white/10 flex flex-col items-center py-3 gap-2 select-none">
      {SIDEBAR_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectTab(item.id)}
            className={`flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition ${
              isActive
                ? "border border-cyan-400 bg-cyan-950/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.25)]"
                : "border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5"
            }`}
          >
            <Icon className={`h-5 w-5 ${isActive ? "text-cyan-300" : "text-slate-400"}`} />
            <span className="text-[10px] font-medium mt-1">{item.label}</span>
          </button>
        );
      })}
    </aside>
  );
}

