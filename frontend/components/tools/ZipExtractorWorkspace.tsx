"use client";

import { ChangeEvent, DragEvent, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Download,
  File,
  FileUp,
  Folder,
  Loader2,
  RotateCcw,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { inspectZipArchive, runFileTool, ZipEntry } from "@/lib/api";

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function ZipExtractorWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [entries, setEntries] = useState<ZipEntry[]>([]);
  const [loadingInspect, setLoadingInspect] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);

  const handleFileSelect = async (selected: File) => {
    setError(null);
    setResult(null);
    setFile(selected);
    setLoadingInspect(true);

    try {
      const data = await inspectZipArchive(selected);
      setEntries(data.entries);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to inspect ZIP archive.");
      setEntries([]);
    } finally {
      setLoadingInspect(false);
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

  const handleExtract = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await runFileTool("zip-extractor", form);
      const url = URL.createObjectURL(response.blob);
      const stem = file.name.replace(/\.[^/.]+$/, "");
      setResult({
        url,
        name: response.filename || `${stem}_extracted.zip`,
        size: response.blob.size,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to extract archive.");
    } finally {
      setBusy(false);
    }
  };

  const totalUncompressed = entries.reduce((acc, e) => acc + (e.is_dir ? 0 : e.size), 0);

  return (
    <section className="mx-auto max-w-4xl px-4 pb-16 sm:pb-20 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        {!file ? (
          <label
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className="flex min-h-48 sm:min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.04] p-4 sm:px-6 text-center transition hover:border-cyan-300 hover:bg-cyan-400/[0.08]"
          >
            <input type="file" className="sr-only" accept=".zip" onChange={onChoose} />
            <UploadCloud className="h-8 w-8 sm:h-10 sm:w-10 text-cyan-300" />
            <h2 className="mt-3 sm:mt-4 text-lg sm:text-xl font-semibold text-white">Choose a ZIP archive to inspect &amp; extract</h2>
            <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-slate-400">Drag &amp; drop or click to upload your archive</p>
            <span className="mt-3 sm:mt-4 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-[11px] sm:text-xs text-slate-400">
              Zip Slip protected · Safe extraction · File listing
            </span>
          </label>
        ) : (
          <div className="space-y-6">
            {/* Archive details header */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
                  <Archive className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatSize(file.size)} archive {entries.length > 0 && `· ${entries.length} items (${formatSize(totalUncompressed)})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setEntries([]);
                  setResult(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <FileUp className="h-3.5 w-3.5" /> Choose another
              </button>
            </div>

            {loadingInspect ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-300 mb-3" />
                <p className="text-sm">Inspecting archive structure safely...</p>
              </div>
            ) : entries.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-semibold uppercase tracking-wider text-cyan-300">Archive Contents</span>
                  <span>{entries.length} files and folders</span>
                </div>
                <div className="max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/60 divide-y divide-white/5">
                  {entries.map((entry, idx) => (
                    <div
                      key={`${entry.name}-${idx}`}
                      className="flex items-center justify-between px-3.5 sm:px-4 py-2.5 text-xs transition hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2 sm:pr-4 flex-1">
                        {entry.is_dir ? (
                          <Folder className="h-4 w-4 text-cyan-400 shrink-0" />
                        ) : (
                          <File className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                        <span className="truncate text-slate-200 font-mono text-[11px] min-w-0">{entry.name}</span>
                      </div>
                      <span className="text-slate-500 font-mono shrink-0 ml-2">
                        {entry.is_dir ? "folder" : formatSize(entry.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {error && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3.5 text-sm text-red-200">
                {error}
              </p>
            )}

            {/* Extract button */}
            <button
              type="button"
              onClick={handleExtract}
              disabled={busy || loadingInspect || entries.length === 0}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Extracting Archive...
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Extract Files ({entries.length} items)
                </>
              )}
            </button>

            {/* Result */}
            {result && (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-4 sm:p-5 sm:flex-row sm:items-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Extracted successfully!</p>
                  <p className="truncate text-xs text-slate-400">
                    {result.name} · {formatSize(result.size)}
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                  <a
                    href={result.url}
                    download={result.name}
                    className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-200 transition"
                  >
                    <Download className="h-4 w-4" /> Download
                  </a>
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-slate-300 hover:bg-white/10"
                  >
                    <RotateCcw className="h-4 w-4" /> Reset
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 pt-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Protected against path traversal, symlink hijacking, and zip decompression bombs.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

