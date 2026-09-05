"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Download, Loader2, Sparkles, Trash2 } from "lucide-react";
import { analyzeUrl, createDownload, getDownloadFileUrl, getDownloadStatus, type VideoMetadata } from "@/lib/api";

export function DownloaderCard() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [downloadInfo, setDownloadInfo] = useState<{ downloaded_size?: string | null; speed?: string | null; eta?: string | null; filename?: string | null } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const canSubmit = url.trim().length > 0 && !loading;

  const formatCards = useMemo(() => {
    if (!metadata) return [];

    return metadata.formats.map((format) => ({
      id: format.format_id,
      label: format.resolution ? format.resolution : format.type === "audio" ? "Audio only" : "Format",
      description: `${format.ext.toUpperCase()} • ${format.type}`,
      available: true,
    }));
  }, [metadata]);

  useEffect(() => {
    if (!jobId || !isDownloading) return;

    const interval = setInterval(async () => {
      try {
        const statusResponse = await getDownloadStatus(jobId);
        setStatus(statusResponse.status);
        setDownloadProgress(statusResponse.progress ?? 0);
        setDownloadInfo({
          downloaded_size: statusResponse.downloaded_size,
          speed: statusResponse.speed,
          eta: statusResponse.eta,
          filename: statusResponse.filename,
        });

        if (statusResponse.status === "complete" || statusResponse.status === "failed") {
          setIsDownloading(false);
          if (statusResponse.status === "failed") {
            setError(statusResponse.error ?? "Download failed");
          }
          clearInterval(interval);
        }
      } catch {
        setError("Unable to fetch download status.");
        setIsDownloading(false);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, isDownloading]);

  const handleAnalyze = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setStatus("Analyzing");
    setError(null);
    setMetadata(null);
    setJobId(null);
    setDownloadProgress(0);
    setIsDownloading(false);

    try {
      const result = await analyzeUrl(url);
      setMetadata(result);
      setSelectedFormat(result.formats[0]?.format_id ?? "");
      setStatus("Ready to download");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze this URL.");
      setStatus("Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!metadata || !selectedFormat || !url.trim()) return;

    setError(null);
    setStatus("Preparing");
    setDownloadProgress(0);
    setIsDownloading(true);

    try {
      const result = await createDownload(url, selectedFormat);
      setJobId(result.job_id);
      setStatus("Queued");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
      setStatus("Failed");
      setIsDownloading(false);
    }
  };

  const finalDownloadUrl = jobId ? getDownloadFileUrl(jobId) : "";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl sm:p-6 lg:p-8">
        <form onSubmit={handleAnalyze} className="space-y-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <label htmlFor="video-url" className="sr-only">
              Video URL
            </label>
            <input
              id="video-url"
              value={url}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setUrl(event.target.value)}
              placeholder="Paste a supported video URL here"
              className="h-14 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-base text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              aria-label="Video URL"
            />
            <button
              type="button"
              onClick={() => setUrl("")}
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10"
            >
              <Trash2 className="h-4 w-4" />
              <span className="ml-2">Clear</span>
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing
                </>
              ) : (
                <>
                  Analyze
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {metadata && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[220px_1fr]">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
              <img src={metadata.thumbnail ?? ""} alt={metadata.title} className="h-40 w-full object-cover" />
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Metadata</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">{metadata.title}</h2>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                {metadata.duration ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{Math.floor(metadata.duration / 60)} min</span> : null}
                {metadata.uploader ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{metadata.uploader}</span> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {formatCards.map((format) => {
                  const isSelected = selectedFormat === format.id;
                  return (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => setSelectedFormat(format.id)}
                      className={`rounded-2xl border p-3 text-left transition ${
                        isSelected
                          ? "border-cyan-400/60 bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
                          : "border-white/10 bg-slate-950/40 hover:border-white/20 hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-white">{format.label}</p>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-cyan-300" />}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{format.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 rounded-2xl border border-dashed border-cyan-500/25 bg-cyan-500/5 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3 text-sm text-cyan-100">
            <Sparkles className="h-4 w-4" />
            <span>Ensure you have permission before downloading content.</span>
          </div>
          {jobId && status === "complete" && finalDownloadUrl ? (
            <a
              href={finalDownloadUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
            >
              <Download className="mr-2 h-4 w-4" />
              Download file
            </a>
          ) : (
            <button
              type="button"
              onClick={handleDownload}
              disabled={!metadata || !selectedFormat || loading || isDownloading}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              {isDownloading ? "Downloading" : "Download"}
            </button>
          )}
        </div>

        {(isDownloading || status === "complete" || status === "failed") && (
          <div className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between text-sm text-slate-300">
              <span>{status || "Preparing"}</span>
              <span>{downloadProgress}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-500" style={{ width: `${downloadProgress}%` }} />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400">
              {downloadInfo?.downloaded_size ? <span>Downloaded: {downloadInfo.downloaded_size}</span> : null}
              {downloadInfo?.speed ? <span>Speed: {downloadInfo.speed}</span> : null}
              {downloadInfo?.eta ? <span>ETA: {downloadInfo.eta}</span> : null}
              {downloadInfo?.filename ? <span>File: {downloadInfo.filename}</span> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
