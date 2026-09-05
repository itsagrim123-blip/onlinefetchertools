import Link from "next/link";
import { ArrowUpRight, FileImage, FileText, Film, Gauge, Image, Music2, ScanText, Wrench } from "lucide-react";

const icons = { video: Film, image: Image, compress: Gauge, pdf: FileText, convert: Wrench, audio: Music2, scan: ScanText, file: FileImage };

type ToolCardProps = { slug: string; name: string; description: string; formats: string; category: string; icon?: keyof typeof icons; featured?: boolean };

export function ToolCard({ slug, name, description, formats, category, icon = "file", featured }: ToolCardProps) {
  const Icon = icons[icon];
  return (
    <Link href={`/tools/${slug}`} className={`group relative flex min-h-52 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-cyan-400/[0.06] ${featured ? "border-cyan-400/25 bg-cyan-400/[0.05]" : ""}`}>
      <div className="flex items-start justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-cyan-300"><Icon className="h-5 w-5" /></span><ArrowUpRight className="h-4 w-4 text-slate-500 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" /></div>
      <div className="mt-auto"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/75">{category}</p><h3 className="text-lg font-semibold text-white">{name}</h3><p className="mt-2 max-w-[28ch] text-sm leading-6 text-slate-400">{description}</p><p className="mt-4 text-xs text-slate-500">{formats}</p></div>
    </Link>
  );
}
