"use client";

import { ChangeEvent, DragEvent, ReactNode, useMemo, useState } from "react";
import { CheckCircle2, Download, FileUp, Loader2, RotateCcw, UploadCloud } from "lucide-react";
import { runFileTool } from "@/lib/api";
import { useUISound } from "@/lib/sounds/useUISound";

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
  "image-compressor": { slug: "image-compressor", title: "Image Compressor", description: "Shrink JPG, PNG and WebP files while keeping them crisp.", accept: ".jpg,.jpeg,.png,.webp", action: "Compress image", output: "compressed.jpg", options: "image" },
  "image-resizer": { slug: "image-resizer", title: "Image Resizer", description: "Resize an image to exact dimensions or a responsive width.", accept: ".jpg,.jpeg,.png,.webp", action: "Resize image", output: "resized.jpg", options: "resize" },
  "jpg-to-png": { slug: "jpg-to-png", title: "JPG to PNG", description: "Convert JPG images to transparent-friendly PNG files.", accept: ".jpg,.jpeg", action: "Convert to PNG", output: "converted.png" },
  "png-to-jpg": { slug: "png-to-jpg", title: "PNG to JPG", description: "Create compact JPG images from PNG files.", accept: ".png", action: "Convert to JPG", output: "converted.jpg" },
  "webp-to-jpg": { slug: "webp-to-jpg", title: "WebP to JPG", description: "Turn WebP images into widely compatible JPG files.", accept: ".webp", action: "Convert to JPG", output: "converted.jpg" },
  "webp-to-png": { slug: "webp-to-png", title: "WebP to PNG", description: "Convert WebP files to lossless PNG images.", accept: ".webp", action: "Convert to PNG", output: "converted.png" },
  "jpg-to-webp": { slug: "jpg-to-webp", title: "JPG to WebP", description: "Convert JPG photos to modern, lightweight WebP format.", accept: ".jpg,.jpeg", action: "Convert to WebP", output: "converted.webp", options: "image" },
  "png-to-webp": { slug: "png-to-webp", title: "PNG to WebP", description: "Convert PNG images to WebP while preserving transparency.", accept: ".png", action: "Convert to WebP", output: "converted.webp", options: "image" },
  "heic-to-jpg": { slug: "heic-to-jpg", title: "HEIC to JPG", description: "Convert Apple HEIC photos into standard JPG images.", accept: ".heic,.heif", action: "Convert to JPG", output: "converted.jpg", options: "image" },
  "image-to-pdf": { slug: "image-to-pdf", title: "Images to PDF", description: "Combine JPG, PNG or WebP images into one PDF.", accept: ".jpg,.jpeg,.png,.webp", multiple: true, action: "Create PDF", output: "images.pdf" },
  "pdf-merge": { slug: "pdf-merge", title: "Merge PDF", description: "Combine multiple PDF files in the order you choose.", accept: ".pdf", multiple: true, action: "Merge PDFs", output: "merged.pdf" },
  "pdf-split": { slug: "pdf-split", title: "Split PDF", description: "Split every page or export custom page ranges as a ZIP.", accept: ".pdf", action: "Split PDF", output: "split.zip", options: "pdf-split" },
  "pdf-compressor": { slug: "pdf-compressor", title: "Compress PDF", description: "Rewrite a PDF with compressed content streams and report the result.", accept: ".pdf", action: "Compress PDF", output: "compressed.pdf" },
  "pdf-to-images": { slug: "pdf-to-images", title: "PDF to Images", description: "Render PDF pages to a downloadable PNG ZIP.", accept: ".pdf", action: "Render pages", output: "images.zip" },
  "pdf-to-text": { slug: "pdf-to-text", title: "PDF to Text", description: "Extract readable text content from PDF pages into a plain text file.", accept: ".pdf", action: "Extract text", output: "extracted-text.txt" },
  "media-converter": { slug: "media-converter", title: "Media Converter", description: "Convert common video and audio formats with FFmpeg.", accept: "video/*,audio/*", action: "Convert media", output: "converted.mp4", options: "media" },
  "audio-extractor": { slug: "audio-extractor", title: "Extract Audio", description: "Pull an MP3 audio track from a video file.", accept: "video/*", action: "Extract audio", output: "extracted-audio.mp3", options: "media" },
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
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const { playUpload, playSuccess, playError, playDownload, playClick } = useUISound();

  const totalSize = useMemo(() => files.reduce((total, file) => total + file.size, 0), [files]);
  const addFiles = (incoming: File[]) => {
    if (result?.url) URL.revokeObjectURL(result.url);
    setError(null);
    setResult(null);
    setTextPreview(null);
    if (incoming.length > 0) {
      playUpload();
      setFiles(config.multiple ? incoming : incoming.slice(0, 1));
    }
  };
  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };
  const onChoose = (event: ChangeEvent<HTMLInputElement>) => addFiles(Array.from(event.target.files ?? []));

  const process = async () => {
    if (!files.length) {
      playError();
      return setError("Choose at least one file first.");
    }
    playClick();
    setBusy(true); setError(null); setTextPreview(null);
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

      const firstFile = files[0];
      const stem = firstFile ? firstFile.name.replace(/\.[^/.]+$/, "") : "file";
      const ext = config.output ? config.output.match(/\.[^/.]+$/)?.[0] || "" : "";
      const fallbackName = `${stem}_${slug}${ext}`;

      const response = await runFileTool(slug, form, fallbackName);
      if (result?.url) URL.revokeObjectURL(result.url);
      const url = URL.createObjectURL(response.blob);
      setResult({ url, name: response.filename, size: response.blob.size });
      playSuccess();

      if (slug === "pdf-to-text") {
        try {
          const text = await response.blob.text();
          setTextPreview(text);
        } catch {
          // ignore preview error
        }
      }
    } catch (cause) {
      playError();
      setError(cause instanceof Error ? cause.message : "Processing failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 sm:pb-20 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        <label
          onDrop={onDrop}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          className={`dropzone-interactive flex min-h-48 sm:min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed p-4 sm:px-6 text-center transition ${
            isDragging
              ? "border-cyan-300 bg-cyan-400/[0.12] scale-[1.01]"
              : "border-cyan-400/30 bg-cyan-400/[0.04] hover:border-cyan-300 hover:bg-cyan-400/[0.08]"
          }`}
        >
          <input type="file" className="sr-only" accept={config.accept} multiple={config.multiple} onChange={onChoose} />
          <UploadCloud className={`h-8 w-8 sm:h-9 sm:w-9 text-cyan-300 transition-transform duration-200 ${isDragging ? "scale-110 -translate-y-1" : "group-hover:-translate-y-0.5"}`} />
          <h2 className="mt-3 sm:mt-4 text-base sm:text-lg font-semibold text-white">Drop your file{config.multiple ? "s" : ""} here</h2>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-400">or click to choose {config.multiple ? "files" : "a file"}</p>
          <span className="mt-3 sm:mt-4 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] sm:text-xs text-slate-500 break-all max-w-full">
            {config.accept === "*/*" ? "All files supported" : config.accept.replaceAll(",", " · ")}
          </span>
        </label>

        {files.length > 0 && (
          <div className="animate-subtle-enter mt-5 space-y-2 max-h-56 overflow-y-auto">
            {files.map((file, idx) => (
              <div key={`${file.name}-${file.size}-${idx}`} className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3 transition hover:border-cyan-500/30 hover:bg-slate-900/60">
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

        {error && <p role="alert" className="animate-error-shake mt-5 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}

        <button
          type="button"
          onClick={process}
          disabled={busy || !files.length}
          className="btn-interactive mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4 transition-transform hover:-translate-y-0.5" />}
          {busy ? "Processing..." : config.action}
        </button>

        {textPreview !== null && (
          <div className="animate-subtle-enter mt-6 space-y-2 rounded-2xl border border-white/10 bg-slate-950/80 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Extracted Text Preview</span>
              <span className="text-xs text-slate-500">{textPreview.length} characters</span>
            </div>
            <textarea
              readOnly
              value={textPreview}
              rows={8}
              className="w-full resize-y rounded-xl border border-white/10 bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none focus:border-cyan-500/40"
            />
          </div>
        )}

        {result && (
          <div className="animate-subtle-enter mt-5 flex flex-col gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4 sm:flex-row sm:items-center">
            <CheckCircle2 className="animate-check-pop h-5 w-5 text-emerald-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">Ready to download</p>
              <p className="truncate text-xs text-slate-400">{result.name} · {formatSize(result.size)}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto shrink-0">
              <a
                href={result.url}
                download={result.name}
                onClick={() => playDownload()}
                className="btn-interactive inline-flex h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200 active:scale-[0.98] transition shadow-md shadow-emerald-950/20"
              >
                <Download className="h-4 w-4" /> Download
              </a>
              <button
                type="button"
                onClick={() => {
                  playClick();
                  if (result?.url) URL.revokeObjectURL(result.url);
                  setFiles([]);
                  setResult(null);
                  setTextPreview(null);
                }}
                className="btn-interactive inline-flex h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/10 active:scale-[0.98] transition"
              >
                <RotateCcw className="h-4 w-4" /> Another
              </button>
            </div>
          </div>
        )}

        {files.length > 0 && <p className="mt-4 text-xs text-slate-500">Selected {files.length} file{files.length === 1 ? "" : "s"} · {formatSize(totalSize)}</p>}
      </div>
    </section>
  );
}

function OptionRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 rounded-xl border border-white/10 bg-slate-950/50 p-3.5 sm:p-4 text-sm text-slate-300">
      <span className="shrink-0">{label}</span>
      <div className="w-full sm:w-auto flex items-center">{children}</div>
    </label>
  );
}
function formatSize(bytes: number) { if (!bytes) return "0 B"; const units = ["B", "KB", "MB", "GB"]; const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1); return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`; }
