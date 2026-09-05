"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Download,
  Languages,
  Loader2,
  Music2,
  Search,
  Sparkles,
  Subtitles,
  Trash2,
  Video,
} from "lucide-react";
import { analyzeUrl, createDownload, getDownloadFileUrl, getDownloadStatus, type VideoMetadata } from "@/lib/api";

type DownloadTab = "video" | "audio" | "subtitles";

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
  const [activeTab, setActiveTab] = useState<DownloadTab>("video");
  const [languageQuery, setLanguageQuery] = useState("");

  const canSubmit = url.trim().length > 0 && !loading;

  const formatGroups = useMemo(() => {
    const formats = metadata?.formats ?? [];
    return {
      video: formats.filter((format) => format.type === "video"),
      audio: formats.filter((format) => format.type === "audio"),
    };
  }, [metadata]);

  const activeFormats = activeTab === "video" ? formatGroups.video : formatGroups.audio;
  const languageOptions = useMemo(() => {
    const labels = activeFormats.map((format) => format.language || format.quality_label || format.resolution || "Original");
    return Array.from(new Set(labels)).slice(0, 24);
  }, [activeFormats]);
  const filteredLanguages = languageOptions.filter((language) => language.toLowerCase().includes(languageQuery.toLowerCase()));

  const selectTab = (tab: DownloadTab) => {
    setActiveTab(tab);
    setLanguageQuery("");
    if (tab === "subtitles") return;
    const nextFormat = tab === "video" ? formatGroups.video[0] : formatGroups.audio[0];
    setSelectedFormat(nextFormat?.format_id ?? "");
  };

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
      const initialTab: DownloadTab = result.formats.some((format) => format.type === "video") ? "video" : "audio";
      const initialFormat = result.formats.find((format) => format.type === initialTab) ?? result.formats[0];
      setMetadata(result);
      setSelectedFormat(initialFormat?.format_id ?? "");
      setActiveTab(initialTab);
      setLanguageQuery("");
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
              className="h-12 sm:h-14 flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm sm:text-base text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30"
              aria-label="Video URL"
            />
            <div className="flex items-center gap-2 md:contents">
              <button
                type="button"
                onClick={() => setUrl("")}
                className="inline-flex h-12 sm:h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/10 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
                <span className="ml-2 hidden xs:inline sm:inline">Clear</span>
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-12 sm:h-14 flex-1 items-center justify-center rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 md:flex-initial"
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
          </div>
        </form>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {metadata && (
          <div className="mt-8 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-950/60 sm:h-24 sm:w-40">
                <img src={metadata.thumbnail ?? ""} alt={metadata.title} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Metadata</p>
                <h2 className="mt-1 truncate text-xl font-semibold text-white sm:text-2xl">{metadata.title}</h2>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  {metadata.duration ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{Math.floor(metadata.duration / 60)} min</span> : null}
                  {metadata.uploader ? <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">{metadata.uploader}</span> : null}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {([
                ["video", "Video (MP4)", "Download video with audio", Video],
                ["audio", "Audio (MP3)", "Download audio only", Music2],
                ["subtitles", "Subtitles (SRT)", "Download subtitles", Subtitles],
              ] as const).map(([tab, label, description, Icon]) => {
                const isActive = activeTab === tab;
                const isDisabled = tab === "subtitles";
                return (
                  <button
                    key={tab}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectTab(tab)}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                      isActive ? "border-cyan-400 bg-cyan-500/10 shadow-lg shadow-cyan-500/10" : "border-white/10 bg-slate-950/40 hover:border-white/20 hover:bg-white/5"
                    } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-cyan-300" : "text-slate-400"}`} />
                    <span className="min-w-0"><span className="block text-sm font-semibold text-white">{label}</span><span className="mt-1 block text-[11px] text-slate-400">{description}</span></span>
                  </button>
                );
              })}
            </div>

            {activeTab === "subtitles" ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 p-5 text-center text-sm text-slate-400">Subtitles are not available for this video.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium text-white"><Languages className="h-4 w-4 text-cyan-300" /> Select Language</div>
                  <label className="relative block sm:w-52"><Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" /><input value={languageQuery} onChange={(event) => setLanguageQuery(event.target.value)} placeholder="Search language..." className="h-9 w-full rounded-lg border border-white/10 bg-slate-950/60 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/60" aria-label="Search language" /></label>
                </div>
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
                  {filteredLanguages.map((language, index) => {
                    const format = activeFormats[index % Math.max(activeFormats.length, 1)];
                    const isSelected = format?.format_id === selectedFormat;
                    return <button key={`${language}-${index}`} type="button" onClick={() => format && setSelectedFormat(format.format_id)} className={`flex min-h-10 items-center justify-between rounded-lg border px-3 text-left text-xs transition ${isSelected ? "border-cyan-400 bg-cyan-500/10 text-white" : "border-white/10 bg-slate-950/40 text-slate-300 hover:border-white/20 hover:bg-white/5"}`}><span className="truncate">{language}</span>{isSelected ? <Check className="h-3.5 w-3.5 shrink-0 text-cyan-300" /> : null}</button>;
                  })}
                </div>
                {!filteredLanguages.length ? <p className="text-xs text-slate-500">No matching formats found.</p> : null}
              </div>
            )}

            <button type="button" onClick={handleDownload} disabled={!metadata || !selectedFormat || loading || isDownloading || activeTab === "subtitles"} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45">
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloading ? "Preparing download..." : activeTab === "audio" ? "Download Audio (MP3)" : "Download Video (MP4)"}
            </button>
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
              download={downloadInfo?.filename || (activeTab === "audio" ? "audio.mp3" : "video.mp4")}
              className="inline-flex h-12 w-full sm:w-auto items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:brightness-110"
            >
              <Download className="mr-2 h-4 w-4" />
              Download file
            </a>
          ) : null}
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
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
              {downloadInfo?.downloaded_size ? <span>Downloaded: {downloadInfo.downloaded_size}</span> : null}
              {downloadInfo?.speed ? <span>Speed: {downloadInfo.speed}</span> : null}
              {downloadInfo?.eta ? <span>ETA: {downloadInfo.eta}</span> : null}
              {downloadInfo?.filename ? <span className="break-all">File: {downloadInfo.filename}</span> : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
