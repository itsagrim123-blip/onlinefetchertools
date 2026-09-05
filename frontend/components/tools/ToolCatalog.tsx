"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { ToolCard } from "./ToolCard";

const categories = [
  { name: "Video & Audio", accent: "from-cyan-400/20", tools: [
    { slug: "youtube", name: "YouTube Downloader", description: "Analyze metadata and download permitted media in your chosen format.", formats: "YouTube · MP4 · MP3", icon: "video" as const, featured: true },
    { slug: "video-editor", name: "Video Editor", description: "Trim, cut, adjust speed, extract frames, resize and edit videos", formats: "MP4 · WebM · MOV", icon: "editor" as const },
    { slug: "video-to-gif", name: "Video to GIF", description: "Convert video clips into animated, shareable GIFs.", formats: "MP4 · WebM · MOV → GIF", icon: "convert" as const },
    { slug: "audio-extractor", name: "Extract Audio", description: "Pull an audio track from a video file for offline listening.", formats: "MP3 · WAV · M4A · OGG", icon: "audio" as const },
  ]},
  { name: "Image / Converter", accent: "from-blue-400/20", tools: [
    { slug: "jpg-to-png", name: "JPG to PNG", description: "Convert JPG images to clean, lossless PNG files.", formats: "JPG → PNG", icon: "image" as const },
    { slug: "png-to-jpg", name: "PNG to JPG", description: "Create compact JPG files from PNG images.", formats: "PNG → JPG", icon: "image" as const },
    { slug: "webp-to-jpg", name: "WebP to JPG", description: "Turn WebP images into widely compatible JPG files.", formats: "WebP → JPG", icon: "image" as const },
    { slug: "webp-to-png", name: "WebP to PNG", description: "Convert WebP files to lossless PNG images.", formats: "WebP → PNG", icon: "image" as const },
    { slug: "jpg-to-webp", name: "JPG to WebP", description: "Convert JPG photos to modern, lightweight WebP format.", formats: "JPG → WebP", icon: "image" as const },
    { slug: "png-to-webp", name: "PNG to WebP", description: "Convert PNG images to WebP while preserving transparency.", formats: "PNG → WebP", icon: "image" as const },
    { slug: "heic-to-jpg", name: "HEIC to JPG", description: "Convert Apple HEIC photos into standard JPG images.", formats: "HEIC → JPG", icon: "image" as const },
    { slug: "image-compressor", name: "Image Compressor", description: "Reduce image size with a quality control you can see.", formats: "JPG · PNG · WebP", icon: "compress" as const },
    { slug: "image-resizer", name: "Image Resizer", description: "Set exact dimensions or preserve the original aspect ratio.", formats: "JPG · PNG · WebP", icon: "image" as const },
  ]},
  { name: "Photo Editor", accent: "from-amber-400/20", tools: [
    { slug: "image-cropper", name: "Image Cropper", description: "Crop photos with custom dimensions or popular aspect ratios.", formats: "JPG · PNG · WebP", icon: "image" as const },
    { slug: "image-rotator", name: "Image Rotator", description: "Rotate 90°, 180°, 270° and flip images horizontally or vertically.", formats: "JPG · PNG · WebP", icon: "convert" as const },
  ]},
  { name: "PDF", accent: "from-violet-400/20", tools: [
    { slug: "pdf-merge", name: "Merge PDF", description: "Combine multiple documents into one ordered PDF.", formats: "PDF · Multiple files", icon: "pdf" as const },
    { slug: "pdf-split", name: "Split PDF", description: "Export every page or specify custom page ranges.", formats: "PDF → ZIP", icon: "scan" as const },
    { slug: "pdf-compressor", name: "PDF Compressor", description: "Reduce PDF stream overhead and keep the document usable.", formats: "PDF → PDF", icon: "compress" as const },
    { slug: "pdf-to-images", name: "PDF to Images", description: "Render document pages into a downloadable image archive.", formats: "PDF → PNG ZIP", icon: "image" as const },
    { slug: "image-to-pdf", name: "Images to PDF", description: "Bundle images into a portable PDF document.", formats: "JPG · PNG · WebP", icon: "file" as const },
    { slug: "pdf-page-manager", name: "PDF Page Manager", description: "Reorder pages, delete unwanted sheets, and export modified PDFs.", formats: "PDF · Reorder & Delete", icon: "pdf" as const },
    { slug: "pdf-to-text", name: "PDF to Text", description: "Extract readable text content from PDF pages into a .txt file.", formats: "PDF → TXT", icon: "scan" as const },
  ]},
  { name: "File Tools", accent: "from-emerald-400/20", tools: [
    { slug: "media-converter", name: "File Converter", description: "Convert common media files with a clean, focused workflow.", formats: "MP4 · WebM · MP3 · WAV", icon: "convert" as const },
    { slug: "zip-creator", name: "ZIP Creator", description: "Package multiple files into a clean, portable ZIP archive.", formats: "Multiple files → ZIP", icon: "file" as const },
    { slug: "zip-extractor", name: "ZIP Extractor", description: "Inspect archive contents and extract files securely.", formats: "ZIP → Files", icon: "scan" as const },
  ]},
];

export function ToolCatalog() {
  const [query, setQuery] = useState("");
  return (
    <div className="space-y-16">
      <label className="mx-auto flex h-14 max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 text-left shadow-2xl shadow-cyan-950/20">
        <Search className="h-5 w-5 text-slate-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools..."
          className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          aria-label="Search tools"
        />
      </label>
      {categories.map((category) => {
        const tools = category.tools.filter((tool) =>
          `${tool.name} ${tool.description} ${category.name}`.toLowerCase().includes(query.toLowerCase())
        );
        if (!tools.length) return null;
        return (
          <section key={category.name}>
            <div className="mb-5 flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Explore</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{category.name}</h2>
              </div>
              <span className="text-xs text-slate-500">{tools.length} tools</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tools.map((tool) => (
                <ToolCard key={tool.slug} category={category.name} {...tool} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
