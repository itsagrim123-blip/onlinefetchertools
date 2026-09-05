"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  FileUp,
  GripVertical,
  Loader2,
  RotateCcw,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { fetchPdfThumbnails, runFileTool } from "@/lib/api";

type PageItem = {
  originalIndex: number; // 1-based index
  thumbnail?: string;
};

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function PdfPageManagerWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [originalPages, setOriginalPages] = useState<PageItem[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setResult(null);
    setFile(selectedFile);
    setLoadingThumbs(true);

    try {
      const data = await fetchPdfThumbnails(selectedFile);
      const items: PageItem[] = data.thumbnails.map((thumb, idx) => ({
        originalIndex: idx + 1,
        thumbnail: thumb,
      }));
      setPages(items);
      setOriginalPages(items);
    } catch {
      // Fallback if thumbnails couldn't be generated
      const placeholderCount = 10;
      const items: PageItem[] = Array.from({ length: placeholderCount }, (_, i) => ({
        originalIndex: i + 1,
      }));
      setPages(items);
      setOriginalPages(items);
    } finally {
      setLoadingThumbs(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) handleFileSelect(dropped);
  };

  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    if (chosen) handleFileSelect(chosen);
  };

  const movePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;
    const updated = [...pages];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setPages(updated);
  };

  const deletePage = (indexToRemove: number) => {
    if (pages.length <= 1) {
      setError("You must keep at least one page in the document.");
      return;
    }
    setError(null);
    setPages(pages.filter((_, idx) => idx !== indexToRemove));
  };

  const resetPages = () => {
    setPages([...originalPages]);
    setError(null);
    setResult(null);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDropOnPage = (targetIndex: number) => {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    movePage(draggedIndex, targetIndex);
    setDraggedIndex(null);
  };

  const handleExport = async () => {
    if (!file || !pages.length) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const order = pages.map((p) => p.originalIndex).join(",");
      const form = new FormData();
      form.append("file", file);
      form.append("order", order);

      const response = await runFileTool("pdf-page-manager", form);
      const url = URL.createObjectURL(response.blob);
      const cleanStem = file.name.replace(/\.[^/.]+$/, "");
      setResult({
        url,
        name: response.filename || `${cleanStem}_managed.pdf`,
        size: response.blob.size,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to export modified PDF.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        {!file ? (
          <label
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.04] px-6 text-center transition hover:border-cyan-300 hover:bg-cyan-400/[0.08]"
          >
            <input type="file" className="sr-only" accept=".pdf" onChange={onChoose} />
            <UploadCloud className="h-10 w-10 text-cyan-300" />
            <h2 className="mt-4 text-xl font-semibold text-white">Choose a PDF to manage pages</h2>
            <p className="mt-2 text-sm text-slate-400">Drag &amp; drop or click to upload your document</p>
            <span className="mt-4 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-400">
              Visual previews · Reorder · Delete · Export
            </span>
          </label>
        ) : (
          <div className="space-y-6">
            {/* Header / Info bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300 border border-violet-400/20">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatSize(file.size)} · {pages.length} of {originalPages.length} pages kept
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetPages}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset order
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPages([]);
                    setOriginalPages([]);
                    setResult(null);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <FileUp className="h-3.5 w-3.5" /> Choose another
                </button>
              </div>
            </div>

            {loadingThumbs ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-300 mb-3" />
                <p className="text-sm">Rendering page thumbnails...</p>
              </div>
            ) : (
              <div>
                <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Drag pages or use arrows to reorder · Click trash to delete
                </p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {pages.map((page, idx) => (
                    <div
                      key={`page-${page.originalIndex}-${idx}`}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDropOnPage(idx)}
                      className={`group relative flex flex-col items-center rounded-2xl border p-3 transition duration-200 ${
                        draggedIndex === idx
                          ? "border-cyan-400 bg-cyan-400/10 opacity-50 scale-95"
                          : "border-white/10 bg-slate-950/70 hover:border-cyan-400/40 hover:bg-cyan-400/[0.04]"
                      }`}
                    >
                      {/* Drag handle */}
                      <div className="absolute top-2 left-2 cursor-grab text-slate-500 group-hover:text-cyan-300">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => deletePage(idx)}
                        title="Delete page"
                        className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-red-400/10 text-red-300 hover:bg-red-400/20 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      {/* Thumbnail or fallback */}
                      <div className="my-6 flex h-36 w-full items-center justify-center overflow-hidden rounded-lg bg-slate-900 border border-white/5">
                        {page.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={page.thumbnail}
                            alt={`Page ${page.originalIndex}`}
                            className="h-full w-full object-contain pointer-events-none"
                          />
                        ) : (
                          <FileText className="h-10 w-10 text-slate-600" />
                        )}
                      </div>

                      {/* Page Info & Reorder controls */}
                      <div className="w-full flex items-center justify-between pt-2 border-t border-white/5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => movePage(idx, idx - 1)}
                          title="Move left"
                          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
                        >
                          <ArrowLeft className="h-3 w-3" />
                        </button>
                        <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[11px] font-mono font-medium text-cyan-300">
                          P.{page.originalIndex}
                        </span>
                        <button
                          type="button"
                          disabled={idx === pages.length - 1}
                          onClick={() => movePage(idx, idx + 1)}
                          title="Move right"
                          className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent"
                        >
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3.5 text-sm text-red-200">
                {error}
              </p>
            )}

            {/* Export button */}
            <button
              type="button"
              onClick={handleExport}
              disabled={busy || loadingThumbs || pages.length === 0}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Exporting Modified PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Export Modified PDF ({pages.length} Pages)
                </>
              )}
            </button>

            {/* Result */}
            {result && (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-5 sm:flex-row sm:items-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Your PDF is ready!</p>
                  <p className="truncate text-xs text-slate-400">
                    {result.name} · {formatSize(result.size)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={result.url}
                    download={result.name}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200 transition"
                  >
                    <Download className="h-4 w-4" /> Download
                  </a>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300 hover:bg-white/10"
                  >
                    Manage more
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

