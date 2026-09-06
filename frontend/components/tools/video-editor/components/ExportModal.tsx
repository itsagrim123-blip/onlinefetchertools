"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Sliders,
  X,
} from "lucide-react";
import { ExportSettings, VideoProject } from "../types";
import { formatBytes } from "../state/projectDefaults";

interface ExportModalProps {
  project: VideoProject;
  isOpen: boolean;
  onClose: () => void;
  onExport: (settings: ExportSettings) => Promise<{ url: string; name: string; size: number } | null>;
}

export function ExportModal({
  isOpen,
  onClose,
  onExport,
}: ExportModalProps) {
  const [format, setFormat] = useState<"mp4" | "webm" | "mov">("mp4");
  const [resolution, setResolution] = useState<"original" | "1080p" | "720p" | "480p">("1080p");
  const [quality, setQuality] = useState<"high" | "medium" | "low">("high");
  const [fps, setFps] = useState<number>(30);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const res = await onExport({
        format,
        resolution,
        quality,
        fps,
      });
      if (res) {
        setResult(res);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to export project.";
      setError(errorMsg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    if (isExporting) return;
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-5 text-white shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-cyan-400" />
            <h3 className="text-sm font-semibold">Export Video Project</h3>
          </div>
          {!isExporting && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {result ? (
          /* Rendered Result View */
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-300 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">Export Finished!</p>
                <p className="truncate text-xs text-slate-400">
                  {result.name} · {formatBytes(result.size)}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResult(null)}
                className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10"
              >
                Export Again
              </button>
              <a
                href={result.url}
                download={result.name}
                className="inline-flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-emerald-400 text-xs font-semibold text-slate-950 hover:bg-emerald-300 transition"
              >
                <Download className="h-4 w-4" /> Download Video
              </a>
            </div>
          </div>
        ) : (
          /* Export Configuration Options */
          <div className="space-y-4">
            {/* Format Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Format</label>
              <div className="grid grid-cols-3 gap-2">
                {(["mp4", "webm", "mov"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    disabled={isExporting}
                    onClick={() => setFormat(fmt)}
                    className={`h-9 rounded-xl border text-xs font-semibold uppercase transition ${
                      format === fmt
                        ? "border-cyan-400 bg-cyan-400 text-slate-950"
                        : "border-white/10 bg-slate-900 text-slate-400 hover:text-white"
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Resolution</label>
              <div className="grid grid-cols-4 gap-2">
                {(["original", "1080p", "720p", "480p"] as const).map((res) => (
                  <button
                    key={res}
                    type="button"
                    disabled={isExporting}
                    onClick={() => setResolution(res)}
                    className={`h-9 rounded-xl border text-xs font-semibold transition ${
                      resolution === res
                        ? "border-cyan-400 bg-cyan-400 text-slate-950"
                        : "border-white/10 bg-slate-900 text-slate-400 hover:text-white"
                    }`}
                  >
                    {res}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality & FPS */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Quality</label>
                <div className="grid grid-cols-3 gap-1">
                  {(["high", "medium", "low"] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={isExporting}
                      onClick={() => setQuality(q)}
                      className={`h-8 rounded-lg border text-xs capitalize transition ${
                        quality === q
                          ? "border-cyan-400 bg-cyan-400 text-slate-950 font-semibold"
                          : "border-white/10 bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Frame Rate</label>
                <div className="grid grid-cols-3 gap-1">
                  {[24, 30, 60].map((f) => (
                    <button
                      key={f}
                      type="button"
                      disabled={isExporting}
                      onClick={() => setFps(f)}
                      className={`h-8 rounded-lg border text-xs font-mono transition ${
                        fps === f
                          ? "border-cyan-400 bg-cyan-400 text-slate-950 font-bold"
                          : "border-white/10 bg-slate-900 text-slate-400 hover:text-white"
                      }`}
                    >
                      {f}fps
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="p-3 rounded-xl border border-red-400/30 bg-red-400/10 text-xs text-red-200">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={handleClose}
                disabled={isExporting}
                className="h-10 px-4 rounded-xl border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartExport}
                disabled={isExporting}
                className="inline-flex h-10 px-5 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-xs font-semibold text-slate-950 hover:brightness-110 transition disabled:opacity-40"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Rendering with FFmpeg...
                  </>
                ) : (
                  <>
                    <Sliders className="h-4 w-4" /> Export Video
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

