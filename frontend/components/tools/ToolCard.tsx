"use client";

import Link from "next/link";
import { ArrowUpRight, Clapperboard, FileImage, FileText, Film, Gauge, Image, Music2, ScanText, Subtitles, Wrench } from "lucide-react";
import { useUISound } from "@/lib/sounds/useUISound";

export type ToolIconType = "video" | "image" | "compress" | "pdf" | "convert" | "audio" | "scan" | "file" | "editor" | "captions";

const icons: Record<ToolIconType, typeof Film> = {
  video: Film,
  image: Image,
  compress: Gauge,
  pdf: FileText,
  convert: Wrench,
  audio: Music2,
  scan: ScanText,
  file: FileImage,
  editor: Clapperboard,
  captions: Subtitles,
};

export type ToolCardProps = {
  slug: string;
  name: string;
  description: string;
  formats: string;
  category: string;
  icon?: ToolIconType;
  featured?: boolean;
  index?: number;
};

export function ToolCard({ slug, name, description, formats, category, icon = "file", featured, index = 0 }: ToolCardProps) {
  const Icon = icons[icon];
  const { playClick } = useUISound();
  const delayMs = Math.min(index * 50, 350);

  return (
    <Link
      href={`/tools/${slug}`}
      onClick={playClick}
      style={{ animationDelay: `${delayMs}ms` }}
      className={`card-interactive animate-card-enter group relative flex min-h-48 sm:min-h-52 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:border-cyan-400/40 hover:bg-cyan-400/[0.06] hover:shadow-lg hover:shadow-cyan-950/30 active:scale-[0.98] ${
        featured ? "border-cyan-400/25 bg-cyan-400/[0.05]" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-cyan-300 transition-all duration-200 group-hover:scale-105 group-hover:text-cyan-200 group-hover:border-cyan-500/30">
          <Icon className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-slate-500 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
      </div>
      <div className="mt-auto pt-3 sm:pt-0">
        <p className="mb-1.5 sm:mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75 transition-colors group-hover:text-cyan-300">{category}</p>
        <h3 className="text-base sm:text-lg font-semibold text-white transition-colors group-hover:text-cyan-50">{name}</h3>
        <p className="mt-1.5 sm:mt-2 max-w-none sm:max-w-[28ch] text-xs sm:text-sm leading-5 sm:leading-6 text-slate-400 transition-colors group-hover:text-slate-300">{description}</p>
        <p className="mt-3 sm:mt-4 text-[11px] sm:text-xs text-slate-500">{formats}</p>
      </div>
    </Link>
  );
}
