"use client";

import { ChangeEvent, DragEvent, ReactNode, useMemo, useState } from "react";
import { CheckCircle2, Download, FileUp, Loader2, RotateCcw, UploadCloud } from "lucide-react";
import { runFileTool } from "@/lib/api";

type ToolConfig = {
  slug: string;
  title: string;
  description: string;
  accept: string;
  multiple?: boolean;
  action: string;
  output?: string;
  options?: "image" | "resize" | "pdf-split" | "media" | "video-gif";
};

const configs: Record<string, ToolConfig> = {
  "image-compressor": { slug: "image-compressor", title: "Image Compressor", description: "Shrink JPG, PNG and WebP files while keeping them crisp.", accept: ".jpg,.jpeg,.png,.webp", action: "Compress image", output: "Compressed image", options: "image" },
  "image-resizer": { slug: "image-resizer", title: "Image Resizer", description: "Resize an image to exact dimensions or a responsive width.", accept: ".jpg,.jpeg,.png,.webp", action: "Resize image", output: "Resized image", options: "resize" },
  "jpg-to-png": { slug: "jpg-to-png", title: "JPG to PNG", description: "Convert JPG images to transparent-friendly PNG files.", accept: ".jpg,.jpeg", action: "Convert to PNG", output: "PNG image" },
  "png-to-jpg": { slug: "png-to-jpg", title: "PNG to JPG", description: "Create compact JPG images from PNG files.", accept: ".png", action: "Convert to JPG", output: "JPG image" },
  "webp-to-jpg": { slug: "webp-to-jpg", title: "WebP to JPG", description: "Turn WebP images into widely compatible JPG files.", accept: ".webp", action: "Convert to JPG", output: "JPG image" },
  "webp-to-png": { slug: "webp-to-png", title: "WebP to PNG", description: "Convert WebP files to lossless PNG images.", accept: ".webp", action: "Convert to PNG", output: "PNG image" },
  "jpg-to-webp": { slug: "jpg-to-webp", title: "JPG to WebP", description: "Convert JPG photos to modern, lightweight WebP format.", accept: ".jpg,.jpeg", action: "Convert to WebP", output: "WebP image", options: "image" },
  "png-to-webp": { slug: "png-to-webp", title: "PNG to WebP", description: "Convert PNG images to WebP while preserving transparency.", accept: ".png", action: "Convert to WebP", output: "WebP image", options: "image" },
  "heic-to-jpg": { slug: "heic-to-jpg", title: "HEIC to JPG", description: "Convert Apple HEIC photos into standard JPG images.", accept: ".heic,.heif", action: "Convert to JPG", output: "JPG image", options: "image" },
  "image-to-pdf": { slug: "image-to-pdf", title: "Images to PDF", description: "Combine JPG, PNG or WebP images into one PDF.", accept: ".jpg,.jpeg,.png,.webp", multiple: true, action: "Create PDF", output: "PDF document" },
  "pdf-merge": { slug: "pdf-merge", title: "Merge PDF", description: "Combine multiple PDF files in the order you choose.", accept: ".pdf", multiple: true, action: "Merge PDFs", output: "Merged PDF" },
  "pdf-split": { slug: "pdf-split", title: "Split PDF", description: "Split every page or export custom page ranges as a ZIP.", accept: ".pdf", action: "Split PDF", output: "ZIP archive", options: "pdf-split" },
  "pdf-compressor": { slug: "pdf-compressor", title: "Compress PDF", description: "Rewrite a PDF with compressed content streams and report the result.", accept: ".pdf", action: "Compress PDF", output: "Compressed PDF" },
  "pdf-to-images": { slug: "pdf-to-images", title: "PDF to Images", description: "Render PDF pages to a downloadable PNG ZIP.", accept: ".pdf", action: "Render pages", output: "Images ZIP" },
  "pdf-to-text": { slug: "pdf-to-text", title: "PDF to Text", description: "Extract readable text content from PDF pages into a plain text file.", accept: ".pdf", action: "Extract text", output: "extracted-text.txt" },
  "media-converter": { slug: "media-converter", title: "Media Converter", description: "Convert common video and audio formats with FFmpeg.", accept: "video/*,audio/*", action: "Convert media", output: "Converted media", options: "media" },
  "audio-extractor": { slug: "audio-extractor", title: "Extract Audio", description: "Pull an MP3 audio track from a video file.", accept: "video/*", action: "Extract audio", output: "MP3 audio", options: "media" },
  "video-to-gif": { slug: "video-to-gif", title: "Video to GIF", description: "Convert video clips into animated, shareable GIFs.", accept: ".mp4,.webm,.mov,.mkv,.avi,video/*", action: "Create GIF", output: "clip.gif", options: "video-gif" },
  "zip-creator": { slug: "zip-creator", title: "ZIP Creator", description: "Package multiple files into a clean, portable ZIP archive.", accept: "*/*", multiple: true, action: "Create ZIP archive", output: "archive.zip" },
};

export function FileToolWorkspace({ slug }: { slug: string }) {
  const config = configs[slug] ?? configs["image-compressor"];
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(75);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState("");
  const [ranges, setRanges] = useState("");
  const [gifFps, setGifFps] = useState(10);
  const [gifWidth, setGifWidth] = useState(480);
  const [gifStart, setGifStart] = useState("");
  const [gifEnd, setGifEnd] = useState("");
  const [outputFormat, setOutputFormat] = useState(
    slug.includes("png") ? "png" : slug.includes("jpg") ? "jpg" : slug.includes("webp") ? "webp" : slug === "audio-extractor" ? "mp3" : "mp4"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);

  const totalSize = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);
  const addFiles = (incoming: File[]) => {
    setError(null);
    setResult(null);
    setTextPreview(null);
    setFiles(config.multiple ? incoming : incoming.slice(0, 1));
  };
  const onDrop = (event: DragEvent<HTMLLabelElement>) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); };
  const onChoose = (event: ChangeEvent<HTMLInputElement>) => addFiles(Array.from(event.target.files ?? []));

  const process = async () => {
    if (!files.length) return setError("Choose at least one file first.");
    setBusy(true); setError(null); setResult(null); setTextPreview(null);
    try {
      const form = new FormData();
      files.forEach((file) => form.append(config.multiple ? "files" : "file", file));
      if (config.options === "image") form.append("quality", String(quality));
      if (config.options === "resize") {
        form.append("width", String(width));
        if (height) form.append("height", height);
        form.append("quality", String(quality));
      }
      if (config.options === "pdf-split") form.append("ranges", ranges);
      if (config.options === "media") form.append("output_format", outputFormat);
      if (config.options === "video-gif") {
        form.append("fps", String(gifFps));
        form.append("width", String(gifWidth));
        if (gifStart) form.append("start_time", gifStart);
        if (gifEnd) form.append("end_time", gifEnd);
      }
      if (!config.options && slug.includes("to-")) form.append("output_format", outputFormat);
      if (slug === "jpg-to-webp" || slug === "png-to-webp") form.append("output_format", "webp");
      if (slug === "heic-to-jpg") form.append("output_format", "jpg");

      const response = await runFileTool(slug, form);
      const url = URL.createObjectURL(response.blob);
      setResult({ url, name: response.filename || config.output || "download", size: response.blob.size });

      if (slug === "pdf-to-text") {
        try {
          const text = await response.blob.text();
          setTextPreview(text);
        } catch {
          // ignore preview error
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Processing failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        <label onDrop={onDrop} onDragOver={(event) => event.preventDefault()} className="flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.04] px-6 text-center transition hover:border-cyan-300 hover:bg-cyan-400/[0.08]">
          <input type="file" className="sr-only" accept={config.accept} multiple={config.multiple} onChange={onChoose} />
          <UploadCloud className="h-9 w-9 text-cyan-300" />
          <h2 className="mt-4 text-lg font-semibold text-white">Drop your file{config.multiple ? "s" : ""} here</h2>
          <p className="mt-2 text-sm text-slate-400">or click to choose {config.multiple ? "files" : "a file"}</p>
          <span className="mt-4 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-500">
            {config.accept === "*/*" ? "All files supported" : config.accept.replaceAll(",", " · ")}
          </span>
        </label>

        {files.length > 0 && (
          <div className="mt-5 space-y-2 max-h-56 overflow-y-auto">
            {files.map((file, idx) => (
              <div key={`${file.name}-${file.size}-${idx}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
                <FileUp className="h-4 w-4 text-cyan-300 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-sm text-white">{file.name}</span>
                <span className="text-xs text-slate-500 shrink-0">{formatSize(file.size)}</span>
              </div>
            ))}
          </div>
        )}

        {config.options === "image" && (
          <OptionRow label={`Quality ${quality}%`}>
            <input type="range" min="20" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} className="accent-cyan-400" />
          </OptionRow>
        )}

        {config.options === "resize" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-slate-400">Width<input value={width} onChange={(event) => setWidth(Number(event.target.value))} type="number" min="1" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white" /></label>
            <label className="text-xs text-slate-400">Height (optional)<input value={height} onChange={(event) => setHeight(event.target.value)} type="number" min="1" placeholder="Keep ratio" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white" /></label>
          </div>
        )}

        {config.options === "video-gif" && (
          <div className="mt-5 space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-300">GIF Controls</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs text-slate-400">
                Frame Rate (FPS): {gifFps}
                <input type="range" min="5" max="30" value={gifFps} onChange={(e) => setGifFps(Number(e.target.value))} className="mt-2 w-full accent-cyan-400" />
              </label>
              <label className="text-xs text-slate-400">
                Width (pixels)
                <select value={gifWidth} onChange={(e) => setGifWidth(Number(e.target.value))} className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white">
                  <option value={320}>320px (Compact)</option>
                  <option value={480}>480px (Standard)</option>
                  <option value={640}>640px (High Quality)</option>
                  <option value={800}>800px (Large)</option>
                </select>
              </label>
              <label className="text-xs text-slate-400">
                Start time (optional)
                <input placeholder="00:00 or 1.5" value={gifStart} onChange={(e) => setGifStart(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white" />
              </label>
              <label className="text-xs text-slate-400">
                End time (optional)
                <input placeholder="00:05 or 6.0" value={gifEnd} onChange={(e) => setGifEnd(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-xs text-white" />
              </label>
            </div>
          </div>
        )}

        {config.options === "pdf-split" && (
          <label className="mt-5 block text-xs text-slate-400">Page ranges (optional)<input value={ranges} onChange={(event) => setRanges(event.target.value)} placeholder="1-3, 5, 7-10" className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white placeholder:text-slate-600" /></label>
        )}

        {config.options === "media" && (
          <label className="mt-5 block text-xs text-slate-400">Output format<select value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 text-white"><option value="mp4">MP4</option><option value="webm">WebM</option><option value="mp3">MP3</option><option value="wav">WAV</option><option value="m4a">M4A</option></select></label>
        )}

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}

        <button type="button" onClick={process} disabled={busy || !files.length} className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {busy ? "Processing..." : config.action}
        </button>

        {textPreview !== null && (
          <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-slate-950/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Extracted Text Preview</span>
              <span className="text-xs text-slate-500">{textPreview.length} characters</span>
            </div>
            <textarea
              readOnly
              value={textPreview}
              rows={8}
              className="w-full resize-y rounded-xl border border-white/10 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none"
            />
          </div>
        )}

        {result && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4 sm:flex-row sm:items-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Ready to download</p>
              <p className="truncate text-xs text-slate-400">{result.name} · {formatSize(result.size)}</p>
            </div>
            <a href={result.url} download={result.name} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200 transition">
              <Download className="h-4 w-4" /> Download
            </a>
            <button type="button" onClick={() => { setFiles([]); setResult(null); setTextPreview(null); }} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/10">
              <RotateCcw className="h-4 w-4" /> Another
            </button>
          </div>
        )}

        {files.length > 0 && <p className="mt-4 text-xs text-slate-500">Selected {files.length} file{files.length === 1 ? "" : "s"} · {formatSize(totalSize)}</p>}
      </div>
    </section>
  );
}

function OptionRow({ label, children }: { label: string; children: ReactNode }) { return <label className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">{label}{children}</label>; }
function formatSize(bytes: number) { if (!bytes) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
