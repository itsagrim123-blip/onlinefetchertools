"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { ToolCard } from "./ToolCard";

const categories = [
  { name: "Video & Audio", accent: "from-cyan-400/20", tools: [
    { slug: "youtube", name: "YouTube Downloader", description: "Analyze metadata and download permitted media in your chosen format.", formats: "YouTube · MP4 · MP3", icon: "video" as const, featured: true },
    { slug: "audio-extractor", name: "Extract Audio", description: "Pull an audio track from a video file for offline listening.", formats: "MP3 · WAV · M4A · OGG", icon: "audio" as const },
  ]},
  { name: "Images", accent: "from-blue-400/20", tools: [
    { slug: "jpg-to-png", name: "JPG to PNG", description: "Convert JPG images to clean, lossless PNG files.", formats: "JPG → PNG", icon: "image" as const },
    { slug: "png-to-jpg", name: "PNG to JPG", description: "Create compact JPG files from PNG images.", formats: "PNG → JPG", icon: "image" as const },
    { slug: "image-compressor", name: "Image Compressor", description: "Reduce image size with a quality control you can see.", formats: "JPG · PNG · WebP", icon: "compress" as const },
    { slug: "image-resizer", name: "Image Resizer", description: "Set exact dimensions or preserve the original aspect ratio.", formats: "JPG · PNG · WebP", icon: "image" as const },
    { slug: "image-to-pdf", name: "Images to PDF", description: "Bundle images into a portable PDF document.", formats: "JPG · PNG · WebP", icon: "file" as const },
  ]},
  { name: "PDF", accent: "from-violet-400/20", tools: [
    { slug: "pdf-merge", name: "Merge PDF", description: "Combine multiple documents into one ordered PDF.", formats: "PDF · Multiple files", icon: "pdf" as const },
    { slug: "pdf-split", name: "Split PDF", description: "Export every page or specify custom page ranges.", formats: "PDF → ZIP", icon: "scan" as const },
    { slug: "pdf-compressor", name: "PDF Compressor", description: "Reduce PDF stream overhead and keep the document usable.", formats: "PDF → PDF", icon: "compress" as const },
    { slug: "pdf-to-images", name: "PDF to Images", description: "Render document pages into a downloadable image archive.", formats: "PDF → PNG ZIP", icon: "image" as const },
  ]},
  { name: "File Tools", accent: "from-emerald-400/20", tools: [
    { slug: "media-converter", name: "File Converter", description: "Convert common media files with a clean, focused workflow.", formats: "MP4 · WebM · MP3 · WAV", icon: "convert" as const },
  ]},
];

export function ToolCatalog() {
  const [query, setQuery] = useState("");
  return <div className="space-y-16"><label className="mx-auto flex h-14 max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-left shadow-2xl shadow-cyan-950/20"><Search className="h-5 w-5 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools..." className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500" aria-label="Search tools" /></label>{categories.map((category) => { const tools = category.tools.filter((tool) => `${tool.name} ${tool.description} ${category.name}`.toLowerCase().includes(query.toLowerCase())); if (!tools.length) return null; return <section key={category.name}><div className="mb-5 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Explore</p><h2 className="mt-2 text-2xl font-semibold text-white">{category.name}</h2></div><span className="text-xs text-slate-500">{tools.length} tools</span></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{tools.map((tool) => <ToolCard key={tool.slug} category={category.name} {...tool} />)}</div></section>; })}</div>;
}
