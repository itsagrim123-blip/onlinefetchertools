import Link from "next/link";
import { ChevronDown, Clock, Sparkles } from "lucide-react";
import { BackendStatus } from "@/components/BackendStatus";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-3.5 py-3 sm:px-6 sm:py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 sm:gap-3 shrink-0 min-w-0" aria-label="Online Fetcher Tools home">
          <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-4 w-4 text-slate-950" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-white sm:text-lg">Online Fetcher Tools</div>
            <div className="hidden text-[10px] uppercase tracking-[0.18em] text-slate-400 sm:block">Fast &amp; Simple</div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-slate-300 shadow-sm">
          <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
          <span className="text-slate-400">Server Running Time:</span>
          <span className="font-medium text-white">7:30 PM – 12:00 AM IST</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <BackendStatus />
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 sm:px-4 sm:py-2 sm:text-sm">
              <span>Tools</span>
              <ChevronDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </summary>
            <div className="absolute right-0 top-11 z-30 grid w-48 sm:w-56 gap-1 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl sm:top-12">
              <Link href="/tools/youtube" className="rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 hover:bg-white/5 hover:text-white">Video &amp; Audio</Link>
              <Link href="/tools/image-compressor" className="rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 hover:bg-white/5 hover:text-white">Image Tools</Link>
              <Link href="/tools/image-cropper" className="rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 hover:bg-white/5 hover:text-white">Photo Editor</Link>
              <Link href="/tools/pdf-merge" className="rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 hover:bg-white/5 hover:text-white">PDF Tools</Link>
              <Link href="/tools/zip-creator" className="rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-300 hover:bg-white/5 hover:text-white">File &amp; Archive</Link>
            </div>
          </details>
          <ThemeToggle />
          <a
            href="https://github.com/itsagrim123-blip/onlinefetchertools"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full border border-white/10 bg-slate-900 px-4 py-2 text-sm text-slate-200 transition hover:border-white/20 hover:bg-slate-800 sm:inline-flex"
          >
            Source
          </a>
        </div>
      </div>
    </header>
  );
}
