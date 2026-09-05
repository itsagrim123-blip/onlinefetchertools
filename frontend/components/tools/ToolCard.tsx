import Link from "next/link";
import { ArrowUpRight, Clapperboard, FileImage, FileText, Film, Gauge, Image, Music2, ScanText, Wrench } from "lucide-react";

export type ToolIconType = "video" | "image" | "compress" | "pdf" | "convert" | "audio" | "scan" | "file" | "editor";

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
};

export type ToolCardProps = {
  slug: string;
  name: string;
  description: string;
  formats: string;
  category: string;
  icon?: ToolIconType;
  featured?: boolean;
};

export function ToolCard({ slug, name, description, formats, category, icon = "file", featured }: ToolCardProps) {
  const Icon = icons[icon];
  return (
    <Link
      href={`/tools/${slug}`}
      className={`group relative flex min-h-48 sm:min-h-52 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-cyan-400/[0.06] ${
        featured ? "border-cyan-400/25 bg-cyan-400/[0.05]" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <span className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-cyan-300">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
      </div>
      <div className="mt-auto pt-3 sm:pt-0">
        <p className="mb-1.5 sm:mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">{category}</p>
        <h3 className="text-base sm:text-lg font-semibold text-white">{name}</h3>
        <p className="mt-1.5 sm:mt-2 max-w-none sm:max-w-[28ch] text-xs sm:text-sm leading-5 sm:leading-6 text-slate-400">{description}</p>
        <p className="mt-3 sm:mt-4 text-[11px] sm:text-xs text-slate-500">{formats}</p>
      </div>
    </Link>
  );
}
