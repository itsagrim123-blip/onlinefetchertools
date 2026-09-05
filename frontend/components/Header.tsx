import Link from "next/link";
import { ChevronDown, Moon, Sparkles, SunMedium } from "lucide-react";
import { BackendStatus } from "@/components/BackendStatus";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Online Fetcher Tools home">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20">
            <Sparkles className="h-4 w-4 text-slate-950" />
          </div>
          <div>
            <div className="text-lg font-semibold tracking-tight text-white">Online Fetcher Tools</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Fast &amp; Simple</div>
          </div>
        </Link>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <BackendStatus />
          <details className="relative hidden sm:block">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">Tools <ChevronDown className="h-3.5 w-3.5" /></summary>
            <div className="absolute right-0 top-12 z-30 grid w-56 gap-1 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl">
              <Link href="/tools/youtube" className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white">Video &amp; Audio</Link>
              <Link href="/tools/image-compressor" className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white">Image tools</Link>
              <Link href="/tools/pdf-merge" className="rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-white/5 hover:text-white">PDF tools</Link>
            </div>
          </details>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 transition hover:border-cyan-400/60 hover:bg-cyan-500/10"
            aria-label="Toggle color theme"
          >
            <SunMedium className="h-4 w-4" />
            <Moon className="h-4 w-4" />
          </button>
          <a
            href="https://github.com"
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
