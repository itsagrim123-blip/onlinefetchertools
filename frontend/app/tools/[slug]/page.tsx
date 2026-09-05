import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { FileToolWorkspace } from "@/components/tools/FileToolWorkspace";
import { DownloaderCard } from "@/components/DownloaderCard";

const toolTitles: Record<string, string> = {
  youtube: "YouTube Downloader",
  "image-compressor": "Image Compressor",
  "image-resizer": "Image Resizer",
  "jpg-to-png": "JPG to PNG",
  "png-to-jpg": "PNG to JPG",
  "webp-to-jpg": "WebP to JPG",
  "webp-to-png": "WebP to PNG",
  "image-to-pdf": "Images to PDF",
  "pdf-merge": "Merge PDF Files",
  "pdf-split": "Split PDF",
  "pdf-compressor": "Compress PDF",
  "pdf-to-images": "PDF to Images",
  "media-converter": "Media Converter",
  "audio-extractor": "Extract Audio from Video",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = toolTitles[slug] ?? "File Tool";
  return { title: `${title} | Online Fetcher Tools`, description: `${title} — a fast, private Online Fetcher Tools utility.` };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = toolTitles[slug] ?? "File Tool";
  const isYoutube = slug === "youtube";
  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.13),_transparent_34%),linear-gradient(180deg,#020817_0%,#0f172a_100%)] text-slate-100">
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-cyan-300"><ChevronLeft className="h-4 w-4" /> All tools</Link>
      <div className="mx-auto max-w-4xl pb-10 pt-16 text-center"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Online Fetcher Tools utility</p><h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-400">{isYoutube ? "Analyze a public YouTube URL, choose a format, and download content you are permitted to use." : "A focused, privacy-friendly utility that processes your files through the Online Fetcher Tools backend."}</p></div>
      {isYoutube ? <DownloaderCard /> : <FileToolWorkspace slug={slug} />}
      <div className="mx-auto mt-8 flex max-w-4xl items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Files are processed temporarily and cleaned up after delivery.</div>
    </div>
  </main>;
}
