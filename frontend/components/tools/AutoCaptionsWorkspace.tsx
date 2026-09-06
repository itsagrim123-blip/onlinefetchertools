"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileVideo,
  Languages,
  Loader2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Sliders,
  Sparkles,
  Subtitles,
  Trash2,
  UploadCloud,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  burnCaptionsToVideo,
  CaptionSegment,
  CaptionStyleOptions,
  generateSrtContent,
  generateVttContent,
  transcribeVideo,
} from "@/lib/api";
import { useUISound } from "@/lib/sounds/useUISound";

const SUPPORTED_LANGUAGES = [
  { code: "auto", label: "Auto Detect (Recommended)" },
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi (हिंदी)" },
  { code: "es", label: "Spanish (Español)" },
  { code: "fr", label: "French (Français)" },
  { code: "de", label: "German (Deutsch)" },
  { code: "pt", label: "Portuguese (Português)" },
  { code: "ar", label: "Arabic (العربية)" },
  { code: "ja", label: "Japanese (日本語)" },
  { code: "ko", label: "Korean (한국어)" },
  { code: "zh", label: "Chinese (中文)" },
  { code: "ru", label: "Russian (Русский)" },
  { code: "it", label: "Italian (Italiano)" },
  { code: "nl", label: "Dutch (Nederlands)" },
  { code: "tr", label: "Turkish (Türkçe)" },
  { code: "bn", label: "Bengali (বাংলা)" },
  { code: "mr", label: "Marathi (मराठी)" },
  { code: "ta", label: "Tamil (தமிழ்)" },
  { code: "te", label: "Telugu (తెలుగు)" },
  { code: "gu", label: "Gujarati (ગુજરાતી)" },
  { code: "ur", label: "Urdu (اردو)" },
  { code: "pa", label: "Punjabi (ਪੰਜਾਬੀ)" },
];

const PRESET_STYLES: Array<{
  id: CaptionStyleOptions["stylePreset"];
  name: string;
  desc: string;
  previewClass: string;
}> = [
  {
    id: "classic",
    name: "Classic",
    desc: "White text, clear dark outline",
    previewClass: "text-white font-medium [text-shadow:0_2px_4px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]",
  },
  {
    id: "clean",
    name: "Clean",
    desc: "Crisp white text, subtle shadow",
    previewClass: "text-white font-normal [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]",
  },
  {
    id: "bold",
    name: "Bold",
    desc: "Heavy bold lettering with high contrast",
    previewClass: "text-white font-extrabold tracking-wide [text-shadow:0_3px_6px_rgba(0,0,0,0.95)]",
  },
  {
    id: "social",
    name: "Social",
    desc: "Punchy creator subtitle style",
    previewClass: "text-white font-black uppercase tracking-wider [text-shadow:0_4px_8px_rgba(0,0,0,0.9)]",
  },
  {
    id: "highlight",
    name: "Highlight",
    desc: "Vibrant yellow accent with outline",
    previewClass: "text-amber-300 font-extrabold [text-shadow:0_2px_4px_rgba(0,0,0,0.95)]",
  },
];

const COLOR_SWATCHES = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Yellow", hex: "#FFEB3B" },
  { name: "Cyan", hex: "#22D3EE" },
  { name: "Lime", hex: "#A3E635" },
  { name: "Pink", hex: "#F472B6" },
  { name: "Orange", hex: "#FB923C" },
];

const TRANSCRIBE_STAGES = [
  "Extracting audio track from video...",
  "Loading speech recognition model...",
  "Transcribing spoken words with AI...",
  "Generating timestamped subtitle segments...",
  "Synchronizing preview playback...",
];

const EXPORT_STAGES = [
  "Configuring subtitle styling and safe margins...",
  "Burning captions into video stream with FFmpeg...",
  "Encoding high-definition H.264 video...",
  "Finalizing captioned MP4 container...",
];

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const m = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 10);
  return `${String(m).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`;
}

export function AutoCaptionsWorkspace() {
  const [file, setFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Settings
  const [language, setLanguage] = useState<string>("auto");
  const [translate, setTranslate] = useState<boolean>(false);
  const [position, setPosition] = useState<"top" | "center" | "bottom">("bottom");
  const [stylePreset, setStylePreset] = useState<CaptionStyleOptions["stylePreset"]>("classic");
  const [fontSize, setFontSize] = useState<number>(26);
  const [fontColor, setFontColor] = useState<string>("#FFFFFF");
  const [backgroundBox, setBackgroundBox] = useState<boolean>(false);
  const [fontFamily, setFontFamily] = useState<string>("Arial");

  // Transcription & segments
  const [segments, setSegments] = useState<CaptionSegment[]>([]);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  // Video playback
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // States
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [transcribing, setTranscribing] = useState<boolean>(false);
  const [transcribeStageIdx, setTranscribeStageIdx] = useState<number>(0);
  const [exporting, setExporting] = useState<boolean>(false);
  const [exportStageIdx, setExportStageIdx] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Result
  const [exportedResult, setExportedResult] = useState<{ url: string; filename: string; size: number } | null>(null);

  const { playUpload, playSuccess, playError, playDownload, playClick } = useUISound();

  // Object URL for uploaded video
  const videoUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  useEffect(() => {
    return () => {
      if (exportedResult?.url) URL.revokeObjectURL(exportedResult.url);
    };
  }, [exportedResult]);

  // Stage rotation during transcription
  useEffect(() => {
    if (!transcribing) return;
    const interval = setInterval(() => {
      setTranscribeStageIdx((prev) => (prev + 1 < TRANSCRIBE_STAGES.length ? prev + 1 : prev));
    }, 2400);
    return () => clearInterval(interval);
  }, [transcribing]);

  // Stage rotation during export
  useEffect(() => {
    if (!exporting) return;
    const interval = setInterval(() => {
      setExportStageIdx((prev) => (prev + 1 < EXPORT_STAGES.length ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, [exporting]);

  // Handle incoming file
  const handleSelectFile = (chosen: File) => {
    setError(null);
    setSegments([]);
    setDetectedLanguage(null);
    if (exportedResult?.url) URL.revokeObjectURL(exportedResult.url);
    setExportedResult(null);

    const allowed = [".mp4", ".mov", ".webm", ".mkv", ".avi"];
    const ext = "." + (chosen.name.split(".").pop()?.toLowerCase() || "");
    if (!allowed.includes(ext)) {
      playError();
      setError("Please select a supported video file (MP4, MOV, WebM, MKV, AVI).");
      return;
    }

    const maxBytes = 500 * 1024 * 1024;
    if (chosen.size > maxBytes) {
      playError();
      setError("File exceeds the 500 MB upload limit.");
      return;
    }

    playUpload();
    setFile(chosen);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleSelectFile(dropped);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) handleSelectFile(picked);
  };

  // Reset workspace
  const handleReset = () => {
    playClick();
    if (exportedResult?.url) URL.revokeObjectURL(exportedResult.url);
    setFile(null);
    setSegments([]);
    setDetectedLanguage(null);
    setExportedResult(null);
    setError(null);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  // Generate captions
  const handleGenerateCaptions = async () => {
    if (!file) return;
    playClick();
    setError(null);
    setTranscribing(true);
    setTranscribeStageIdx(0);

    try {
      const res = await transcribeVideo(file, language, translate);
      setSegments(res.segments);
      setDetectedLanguage(res.language);
      playSuccess();
    } catch (err: unknown) {
      playError();
      const message = err instanceof Error ? err.message : "Failed to generate captions. Please try again.";
      setError(message);
    } finally {
      setTranscribing(false);
    }
  };

  // Export video with captions burned in
  const handleExport = async () => {
    if (!file || !segments.length) return;
    playClick();
    setError(null);
    setExporting(true);
    setExportStageIdx(0);

    try {
      const res = await burnCaptionsToVideo(file, segments, {
        position,
        stylePreset,
        fontSize,
        fontColor,
        backgroundBox,
        fontFamily,
      });

      const url = URL.createObjectURL(res.blob);
      setExportedResult({
        url,
        filename: res.filename,
        size: res.blob.size,
      });
      playSuccess();
    } catch (err: unknown) {
      playError();
      const msg = err instanceof Error ? err.message : "Export failed. Please try again.";
      setError(msg);
    } finally {
      setExporting(false);
    }
  };

  // Subtitle downloads
  const handleDownloadSrt = () => {
    if (!segments.length || !file) return;
    playDownload();
    const content = generateSrtContent(segments);
    const blob = new Blob([content], { type: "application/x-subrip;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stem = file.name.replace(/\.[^/.]+$/, "");
    a.href = url;
    a.download = `${stem}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadVtt = () => {
    if (!segments.length || !file) return;
    playDownload();
    const content = generateVttContent(segments);
    const blob = new Blob([content], { type: "text/vtt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stem = file.name.replace(/\.[^/.]+$/, "");
    a.href = url;
    a.download = `${stem}.vtt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Caption Segment Editor handlers
  const handleUpdateSegmentText = (id: number, text: string) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  const handleUpdateSegmentTiming = (id: number, start: number, end: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, start: Math.max(0, start), end: Math.max(start + 0.1, end) } : s))
    );
  };

  const handleDeleteSegment = (id: number) => {
    playClick();
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddSegment = () => {
    playClick();
    const lastSeg = segments[segments.length - 1];
    const newStart = lastSeg ? lastSeg.end + 0.2 : currentTime;
    const newEnd = newStart + 2.5;
    const newId = (lastSeg ? Math.max(...segments.map((s) => s.id)) : 0) + 1;
    setSegments((prev) => [...prev, { id: newId, start: Number(newStart.toFixed(2)), end: Number(newEnd.toFixed(2)), text: "New caption" }]);
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  // Find currently active caption for live video overlay preview
  const activeSegment = useMemo(() => {
    return segments.find((s) => currentTime >= s.start && currentTime <= s.end);
  }, [segments, currentTime]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 text-slate-100">
      {/* Upload Dropzone (When no file chosen) */}
      {!file ? (
        <div className="mx-auto max-w-3xl">
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`flex min-h-[300px] sm:min-h-[360px] cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed p-6 sm:p-10 text-center transition-all duration-300 ${
              isDragging
                ? "border-cyan-400 bg-cyan-950/40 scale-[1.01] shadow-2xl shadow-cyan-900/30"
                : "border-white/15 bg-slate-900/40 hover:border-cyan-400/50 hover:bg-slate-900/70 shadow-xl"
            }`}
          >
            <input type="file" accept=".mp4,.mov,.webm,.mkv,.avi,video/*" onChange={onFileChange} className="hidden" />
            <div className="flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/20 to-blue-600/10 text-cyan-300 shadow-inner">
              <UploadCloud className="h-8 w-8 sm:h-10 sm:w-10 animate-pulse" />
            </div>
            <h3 className="mt-4 sm:mt-6 text-lg sm:text-xl font-semibold text-white">Upload video for Auto Captions</h3>
            <p className="mt-2 max-w-md text-xs sm:text-sm text-slate-400">
              Drag & drop your video file here, or click to browse. MP4, MOV, WebM, MKV, AVI up to 500 MB supported.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] sm:text-xs font-medium text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">AI Speech-to-Text</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">99+ Languages</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Permanent Burn</span>
            </div>
          </label>
        </div>
      ) : (
        /* Workspace when file is loaded */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Video Preview & Overlay (Desktop: 7 cols, Mobile: full) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 shadow-2xl">
              {/* Top metadata strip */}
              <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 py-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2 truncate pr-2">
                  <FileVideo className="h-4 w-4 text-cyan-400 shrink-0" />
                  <span className="truncate font-medium text-white">{file.name}</span>
                  <span className="text-slate-500 text-[11px] shrink-0">({formatSize(file.size)})</span>
                  {videoDimensions.width > 0 && (
                    <span className="text-slate-400 text-[11px] shrink-0 font-mono">
                      {videoDimensions.width}x{videoDimensions.height}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition"
                  title="Remove or replace video"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Replace
                </button>
              </div>

              {/* Video Player + Synchronized Live Caption Overlay */}
              <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group">
                <video
                  ref={videoRef}
                  src={videoUrl || undefined}
                  className="h-full w-full object-contain"
                  onTimeUpdate={() => {
                    if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
                  }}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setVideoDuration(videoRef.current.duration);
                      setVideoDimensions({
                        width: videoRef.current.videoWidth,
                        height: videoRef.current.videoHeight,
                      });
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  playsInline
                />

                {/* Synchronized Caption Overlay */}
                {activeSegment && (
                  <div
                    className={`pointer-events-none absolute left-0 right-0 px-6 flex justify-center transition-all duration-100 ${
                      position === "top" ? "top-[9%]" : position === "center" ? "top-1/2 -translate-y-1/2" : "bottom-[9%]"
                    }`}
                  >
                    <div
                      style={{
                        fontSize: `${fontSize}px`,
                        color: fontColor,
                        fontFamily: fontFamily,
                      }}
                      className={`max-w-[90%] text-center leading-tight transition-all ${
                        backgroundBox ? "bg-black/80 px-4 py-2 rounded-xl backdrop-blur-xs" : ""
                      } ${
                        stylePreset === "bold"
                          ? "font-extrabold [text-shadow:0_3px_6px_rgba(0,0,0,0.95)]"
                          : stylePreset === "clean"
                          ? "font-normal [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]"
                          : stylePreset === "social"
                          ? "font-black uppercase tracking-wider [text-shadow:0_4px_8px_rgba(0,0,0,0.95)]"
                          : stylePreset === "highlight"
                          ? "font-extrabold text-amber-300 [text-shadow:0_2px_5px_rgba(0,0,0,0.95)]"
                          : "font-medium [text-shadow:0_2px_4px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.9)]"
                      }`}
                    >
                      {activeSegment.text}
                    </div>
                  </div>
                )}

                {/* Subtle Click to Play / Pause Overlay on Desktop */}
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900/80 border border-white/20 text-white shadow-xl">
                    {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
                  </div>
                </button>
              </div>

              {/* Video Player Transport Bar */}
              <div className="flex items-center gap-3 border-t border-white/10 bg-slate-900/80 px-4 py-3 text-xs text-slate-300">
                <button
                  onClick={togglePlay}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-white transition"
                  aria-label={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                </button>

                <span className="font-mono text-cyan-300 text-xs shrink-0">{formatSeconds(currentTime)}</span>
                <span className="text-slate-500">/</span>
                <span className="font-mono text-slate-400 text-xs shrink-0">{formatSeconds(videoDuration)}</span>

                {/* Scrubber slider */}
                <input
                  type="range"
                  min={0}
                  max={videoDuration || 100}
                  step={0.05}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-white/15 accent-cyan-400"
                  aria-label="Video scrubber"
                />

                <button
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.muted = !isMuted;
                      setIsMuted(!isMuted);
                    }
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition shrink-0"
                  aria-label="Toggle mute"
                >
                  {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Transcription State Banner / Action */}
            {!segments.length && !transcribing && (
              <div className="rounded-2xl border border-cyan-500/25 bg-gradient-to-r from-cyan-950/30 to-blue-950/20 p-5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-cyan-400" /> Speech Recognition Ready
                    </h4>
                    <p className="mt-1 text-xs text-slate-400">
                      Click below to transcribe spoken dialog into timestamped captions.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateCaptions}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-950/40 hover:from-cyan-400 hover:to-blue-500 transition active:scale-[0.98]"
                  >
                    <Subtitles className="h-4 w-4" /> Generate Captions
                  </button>
                </div>
              </div>
            )}

            {/* Transcribing Progress State */}
            {transcribing && (
              <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6 shadow-xl text-center space-y-4 animate-pulse">
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white">Transcribing Video Speech</h4>
                  <p className="mt-1 text-xs text-cyan-300 font-medium">{TRANSCRIBE_STAGES[transcribeStageIdx]}</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  Runs locally with faster-whisper speech recognition. Multilingual auto-detection active.
                </p>
              </div>
            )}

            {/* Exporting Progress State */}
            {exporting && (
              <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/90 p-6 shadow-xl text-center space-y-4">
                <div className="flex justify-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                </div>
                <div>
                  <h4 className="text-base font-semibold text-white">Burning Permanent Captions with FFmpeg</h4>
                  <p className="mt-1 text-xs text-cyan-300 font-medium">{EXPORT_STAGES[exportStageIdx]}</p>
                </div>
                <p className="text-[11px] text-slate-500">
                  Subtitles are permanently burned into the video frames. Audio fidelity and original resolution are preserved.
                </p>
              </div>
            )}

            {/* Exported Result Download Card */}
            {exportedResult && (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-2xl space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Captioned Video Ready</h4>
                      <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-md">
                        {exportedResult.filename} ({formatSize(exportedResult.size)})
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-1">
                  <a
                    href={exportedResult.url}
                    download={exportedResult.filename}
                    onClick={playDownload}
                    className="flex-1 min-w-[200px] inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-950/40 hover:from-emerald-400 hover:to-teal-500 transition active:scale-[0.98]"
                  >
                    <Download className="h-4 w-4" /> Download Captioned Video
                  </a>
                  <button
                    onClick={handleDownloadSrt}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
                  >
                    <Subtitles className="h-3.5 w-3.5 text-cyan-400" /> SRT
                  </button>
                  <button
                    onClick={handleDownloadVtt}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
                  >
                    <Subtitles className="h-3.5 w-3.5 text-cyan-400" /> VTT
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Settings & Caption Editor (Desktop: 5 cols, Mobile: full) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-xs text-red-300 shadow-lg">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </div>
            )}

            {/* Caption Customization Settings Card */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-cyan-400" /> Caption Settings
                </h3>
                {detectedLanguage && (
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-cyan-300">
                    Detected: {detectedLanguage.toUpperCase()}
                  </span>
                )}
              </div>

              {/* Language Selection */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Languages className="h-3.5 w-3.5 text-cyan-400" /> Spoken Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                      {lang.label}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={translate}
                    onChange={(e) => setTranslate(e.target.checked)}
                    className="rounded border-white/20 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                  />
                  <span className="text-[11px] text-slate-400">
                    Translate speech to English (Hindi/Spanish/etc. → English captions)
                  </span>
                </label>
              </div>

              {/* Caption Position Visual Selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Position</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["top", "center", "bottom"] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setPosition(pos)}
                      className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border text-xs font-semibold capitalize transition ${
                        position === pos
                          ? "border-cyan-400 bg-cyan-500/15 text-cyan-200 shadow-md shadow-cyan-950/30"
                          : "border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <div className="w-8 h-6 border border-current rounded-sm mb-1.5 relative opacity-80 flex flex-col justify-between p-0.5">
                        <div
                          className={`w-full h-1 rounded-[1px] bg-current transition-opacity ${
                            pos === "top"
                              ? "opacity-100"
                              : pos === "center"
                              ? "my-auto opacity-100"
                              : pos === "bottom"
                              ? "mt-auto opacity-100"
                              : "opacity-0"
                          }`}
                        />
                      </div>
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Presets */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-300">Style Preset</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PRESET_STYLES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setStylePreset(preset.id)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition ${
                        stylePreset === preset.id
                          ? "border-cyan-400 bg-cyan-500/15 text-white"
                          : "border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <span className="text-xs font-semibold text-white">{preset.name}</span>
                      <span className="text-[10px] text-slate-400 line-clamp-1">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size & Box Background */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Font Size</span>
                    <span className="font-mono text-cyan-300">{fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={48}
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-white/15 rounded-lg"
                  />
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-slate-300 block">Background Box</span>
                  <button
                    type="button"
                    onClick={() => setBackgroundBox(!backgroundBox)}
                    className={`w-full py-1.5 px-3 rounded-xl border text-xs font-medium transition ${
                      backgroundBox
                        ? "border-cyan-400 bg-cyan-500/15 text-cyan-200"
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
                    }`}
                  >
                    {backgroundBox ? "Dark Box Enabled" : "No Box (Shadow Only)"}
                  </button>
                </div>
              </div>

              {/* Text Color Swatches */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-slate-300">Text Color</label>
                <div className="flex items-center gap-2">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => setFontColor(swatch.hex)}
                      style={{ backgroundColor: swatch.hex }}
                      title={swatch.name}
                      className={`h-6 w-6 rounded-full border-2 transition-transform ${
                        fontColor.toUpperCase() === swatch.hex.toUpperCase()
                          ? "scale-110 border-cyan-400 shadow-md"
                          : "border-white/20 hover:scale-105"
                      }`}
                    />
                  ))}
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    className="h-7 w-7 rounded-lg cursor-pointer bg-transparent border-0"
                    title="Custom hex color"
                  />
                </div>
              </div>

              {/* Font Family Selector */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-slate-300">Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                >
                  <option value="Arial">Arial (Universal Sans-Serif)</option>
                  <option value="Segoe UI">Segoe UI (Modern)</option>
                  <option value="Impact">Impact (Bold Title)</option>
                  <option value="Trebuchet MS">Trebuchet MS (Clean)</option>
                  <option value="Georgia">Georgia (Classic Serif)</option>
                </select>
              </div>
            </div>

            {/* Caption Editor & Transcript Timeline Card */}
            {segments.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Captions ({segments.length})</h3>
                    <span className="text-[11px] text-slate-400">Click time to seek</span>
                  </div>
                  <button
                    onClick={handleAddSegment}
                    className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs text-cyan-300 hover:bg-cyan-500/20 transition"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>

                {/* Segments List */}
                <div className="max-h-[340px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {segments.map((seg) => (
                    <div
                      key={seg.id}
                      className={`rounded-xl border p-3 text-xs transition ${
                        currentTime >= seg.start && currentTime <= seg.end
                          ? "border-cyan-400/60 bg-cyan-950/30 shadow-md"
                          : "border-white/5 bg-slate-950/60 hover:border-white/15"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <button
                            type="button"
                            onClick={() => handleUpdateSegmentTiming(seg.id, seg.start - 0.2, seg.end)}
                            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white hover:bg-white/10"
                            title="Start 0.2s earlier"
                          >
                            -0.2s
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSeek(seg.start)}
                            className="text-cyan-400 hover:underline flex items-center gap-1 shrink-0"
                            title="Seek video to start"
                          >
                            <Play className="h-2.5 w-2.5" />
                            <span>
                              {formatSeconds(seg.start)} → {formatSeconds(seg.end)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateSegmentTiming(seg.id, seg.start, seg.end + 0.2)}
                            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white hover:bg-white/10"
                            title="End 0.2s later"
                          >
                            +0.2s
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteSegment(seg.id)}
                            className="text-slate-500 hover:text-red-400 p-1 transition"
                            title="Delete this caption"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Text editor input */}
                      <textarea
                        rows={2}
                        value={seg.text}
                        onChange={(e) => handleUpdateSegmentText(seg.id, e.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none resize-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Primary Export Action */}
                <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/40 hover:from-cyan-400 hover:to-blue-500 transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {exporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Burning Captions...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" /> Export Video with Captions
                      </>
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      onClick={handleDownloadSrt}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
                    >
                      <Download className="h-3.5 w-3.5 text-cyan-400" /> Download SRT
                    </button>
                    <button
                      onClick={handleDownloadVtt}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
                    >
                      <Download className="h-3.5 w-3.5 text-cyan-400" /> Download VTT
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
