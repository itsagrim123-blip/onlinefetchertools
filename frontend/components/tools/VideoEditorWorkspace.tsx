"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Scissors,
  UploadCloud,
  Volume2,
  VolumeX,
} from "lucide-react";
import { runFileTool } from "@/lib/api";

function formatSeconds(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  const formattedSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
  const formattedMins = mins < 10 ? `0${mins}` : `${mins}`;
  return `${formattedMins}:${formattedSecs}`;
}

function parseSeconds(val: string): number {
  const parts = val.trim().split(":");
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(val) || 0;
}

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function VideoEditorWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Editing parameters
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [resolution, setResolution] = useState<string>("original");
  const [quality, setQuality] = useState<string>("high");
  const [outputFormat, setOutputFormat] = useState<string>("mp4");
  const [includeAudio, setIncludeAudio] = useState<boolean>(true);

  // Execution states
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; size: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const videoUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const onLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDuration = videoRef.current.duration;
      setDuration(vidDuration);
      setStartTime(0);
      setEndTime(vidDuration);
      setCurrentTime(0);
    }
  };

  const onTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Auto pause if reached endTime during cut preview
      if (videoRef.current.currentTime >= endTime && isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (currentTime >= endTime || currentTime < startTime) {
        videoRef.current.currentTime = startTime;
      }
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const seekTo = (seconds: number) => {
    if (videoRef.current) {
      const clamped = Math.max(0, Math.min(seconds, duration));
      videoRef.current.currentTime = clamped;
      setCurrentTime(clamped);
    }
  };

  const addFile = (selected: File) => {
    setError(null);
    setResult(null);
    setFile(selected);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const dropped = event.dataTransfer.files[0];
    if (dropped) addFile(dropped);
  };

  const onChoose = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0];
    if (chosen) addFile(chosen);
  };

  const handleSetCurrentAsStart = () => {
    const nextStart = Math.min(currentTime, endTime);
    setStartTime(nextStart);
  };

  const handleSetCurrentAsEnd = () => {
    const nextEnd = Math.max(currentTime, startTime);
    setEndTime(nextEnd);
  };

  const handleExport = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);
      if (startTime > 0) form.append("start_time", startTime.toFixed(2));
      if (endTime > 0 && endTime < duration) form.append("end_time", endTime.toFixed(2));
      if (resolution !== "original") form.append("resolution", resolution);
      form.append("quality", quality);
      form.append("output_format", outputFormat);
      form.append("include_audio", includeAudio ? "true" : "false");

      const response = await runFileTool("video-editor", form);
      const url = URL.createObjectURL(response.blob);
      setResult({
        url,
        name: response.filename || `${file.name.replace(/\.[^/.]+$/, "")}_edited.${outputFormat}`,
        size: response.blob.size,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Video processing failed. Make sure the file is valid.");
    } finally {
      setBusy(false);
    }
  };

  const resetAll = () => {
    setFile(null);
    setResult(null);
    setError(null);
    setDuration(0);
    setCurrentTime(0);
    setStartTime(0);
    setEndTime(0);
    setIsPlaying(false);
  };

  const cutDuration = Math.max(0, endTime - startTime);

  return (
    <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl sm:p-8">
        {!file ? (
          <label
            onDrop={onDrop}
            onDragOver={(event) => event.preventDefault()}
            className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.04] px-6 text-center transition hover:border-cyan-300 hover:bg-cyan-400/[0.08]"
          >
            <input
              type="file"
              className="sr-only"
              accept=".mp4,.webm,.mov,.mkv,.avi,video/*"
              onChange={onChoose}
            />
            <UploadCloud className="h-10 w-10 text-cyan-300" />
            <h2 className="mt-4 text-xl font-semibold text-white">Choose a video file to edit</h2>
            <p className="mt-2 text-sm text-slate-400">
              Drag &amp; drop or click to upload (MP4, WebM, MOV, MKV, AVI)
            </p>
            <span className="mt-4 rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-xs text-slate-400">
              Trim · Cut · Resize · Quality · Audio Preserved
            </span>
          </label>
        ) : (
          <div className="space-y-6">
            {/* File Info Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 border border-cyan-400/20">
                  <Film className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatSize(file.size)} {duration > 0 && `· Total: ${formatSeconds(duration)}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Choose another
              </button>
            </div>

            {/* Video Player Preview */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-inner">
              {videoUrl && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="max-h-[380px] w-full object-contain"
                  onLoadedMetadata={onLoadedMetadata}
                  onTimeUpdate={onTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  playsInline
                />
              )}
              {/* Play / Pause overlay */}
              <div className="flex items-center justify-between bg-slate-950/90 px-4 py-2.5 border-t border-white/5">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300 hover:bg-cyan-400/20 transition"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </button>
                <div className="text-xs font-mono text-slate-300">
                  <span className="text-cyan-300">{formatSeconds(currentTime)}</span> / {formatSeconds(duration)}
                </div>
              </div>
            </div>

            {/* Interactive Timeline & Cut Scrubbing */}
            <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  <Scissors className="h-3.5 w-3.5" /> Trim &amp; Timeline Range
                </span>
                <span className="rounded-full bg-cyan-400/10 px-2.5 py-0.5 text-xs font-mono font-medium text-cyan-300 border border-cyan-400/20">
                  Selected: {formatSeconds(cutDuration)}
                </span>
              </div>

              {/* Visual Timeline Bar */}
              <div className="relative h-7 w-full rounded-lg bg-slate-800/80 overflow-hidden cursor-pointer">
                {/* Selected cut region */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-cyan-500/40 to-blue-500/40 border-x-2 border-cyan-400"
                    style={{
                      left: `${(startTime / duration) * 100}%`,
                      width: `${Math.max(0, ((endTime - startTime) / duration) * 100)}%`,
                    }}
                  />
                )}
                {/* Current playhead indicator */}
                {duration > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-md transition-all duration-75"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />
                )}
                {/* Clickable scrub track */}
                <input
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full opacity-0 cursor-pointer"
                  aria-label="Timeline scrubber"
                />
              </div>

              {/* Start Time & End Time Controls */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-300">Start Time</span>
                    <button
                      type="button"
                      onClick={handleSetCurrentAsStart}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 underline"
                    >
                      Set to current ({formatSeconds(currentTime)})
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formatSeconds(startTime)}
                    onChange={(e) => setStartTime(Math.max(0, Math.min(parseSeconds(e.target.value), endTime)))}
                    className="h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-3 font-mono text-sm text-white"
                  />
                </div>

                <div className="rounded-xl border border-white/5 bg-slate-900/60 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-slate-300">End Time</span>
                    <button
                      type="button"
                      onClick={handleSetCurrentAsEnd}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 underline"
                    >
                      Set to current ({formatSeconds(currentTime)})
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formatSeconds(endTime)}
                    onChange={(e) => setEndTime(Math.min(duration, Math.max(parseSeconds(e.target.value), startTime)))}
                    className="h-9 w-full rounded-lg border border-white/10 bg-slate-950 px-3 font-mono text-sm text-white"
                  />
                </div>
              </div>
            </div>

            {/* Video Settings: Resolution, Quality, Audio, Format */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Resolution selector */}
              <label className="block text-xs text-slate-400">
                Resolution
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white"
                >
                  <option value="original">Original resolution</option>
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="720p">720p (HD)</option>
                  <option value="480p">480p (SD)</option>
                  <option value="1080x1920">9:16 Vertical (1080x1920)</option>
                  <option value="1080x1080">1:1 Square (1080x1080)</option>
                </select>
              </label>

              {/* Quality selector */}
              <label className="block text-xs text-slate-400">
                Quality
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white"
                >
                  <option value="high">High (Visually lossless, CRF 18)</option>
                  <option value="medium">Medium (Balanced file size, CRF 23)</option>
                  <option value="low">Low (Compact file size, CRF 28)</option>
                </select>
              </label>

              {/* Output format */}
              <label className="block text-xs text-slate-400">
                Output Format
                <select
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white"
                >
                  <option value="mp4">MP4 (Standard / Compatible)</option>
                  <option value="webm">WebM</option>
                </select>
              </label>

              {/* Audio preservation toggle */}
              <div className="flex flex-col justify-end">
                <label className="flex h-11 cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={includeAudio}
                    onChange={(e) => setIncludeAudio(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 accent-cyan-400"
                  />
                  <span className="flex items-center gap-1.5">
                    {includeAudio ? (
                      <Volume2 className="h-4 w-4 text-cyan-300" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-slate-500" />
                    )}
                    Preserve audio track
                  </span>
                </label>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3.5 text-sm text-red-200">
                {error}
              </p>
            )}

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExport}
              disabled={busy}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Processing video with FFmpeg...
                </>
              ) : (
                <>
                  <Scissors className="h-4 w-4" /> Export Edited Video
                </>
              )}
            </button>

            {/* Completed Result Card */}
            {result && (
              <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.08] p-5 sm:flex-row sm:items-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">Your edited video is ready!</p>
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
                    Edit again
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
